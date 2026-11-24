import type { Language } from '@prisma/client';
import { unknownFields } from '@pain-therapy/shared/consent-fields';
import { mandatoryConsentVersion } from '@pain-therapy/shared/signing';
import { db, rawDb } from './db';
import { currentPractice, requirePractice } from './practice';
import { audit } from './audit';
import type { Actor } from './session';

// Moved to @pain-therapy/shared (iteration 5, design D10): the patient zone shows the same text
export { parseBlocks, type Block } from '@pain-therapy/shared/consent-blocks';

let initialTextsChecked = false;
/** Publishes INITIAL_TEXTS as version 1 on a fresh database, so a new deployment can sign without a seed step. */
async function ensureInitialTexts() {
  if (initialTextsChecked) return;
  if ((await db.consentTextVersion.count()) === 0) {
    await db.consentTextVersion.createMany({
      data: (['de', 'en'] as const).map((language) => ({
        version: 1,
        language,
        title: INITIAL_TEXTS[language].title,
        body: INITIAL_TEXTS[language].body,
        publishedBy: 'System',
      })),
      skipDuplicates: true,
    });
    // Iteration 17 (design D3): version 1 is the current template, so it is not offered again
    const p = await currentPractice();
    if (p) await rawDb.practice.update({ where: { id: p.id }, data: { templateSeen: TEMPLATE_VERSION } });
  }
  initialTextsChecked = true;
}

export async function currentVersionNumber(): Promise<number> {
  await ensureInitialTexts();
  const v = await db.consentTextVersion.aggregate({ _max: { version: true } });
  return v._max.version ?? 0;
}

/** Newest version published with «Sofort von allen» (iteration 18, design D1); 0 if none */
export async function mandatoryVersionNumber(): Promise<number> {
  await ensureInitialTexts();
  return mandatoryConsentVersion(db);
}

export async function currentText(language: Language) {
  await ensureInitialTexts();
  return db.consentTextVersion.findFirst({ where: { language }, orderBy: { version: 'desc' } });
}

export async function listVersions() {
  await ensureInitialTexts();
  return db.consentTextVersion.findMany({ orderBy: [{ version: 'desc' }, { language: 'asc' }] });
}

/** consent-signing: Versionierte Formulartexte. Both languages are published together under one version number. */
export async function publishVersion(
  actor: Actor,
  input: { titleDe: string; bodyDe: string; titleEn: string; bodyEn: string },
  opts: { fromTemplate?: boolean; resignRequired?: boolean } = {},
) {
  // Iteration 18 (design D3): by default the new version is signed at the next new treatment or session
  const resignRequired = !!opts.resignRequired;
  const version = await db.$transaction(async (tx) => {
    const max = await tx.consentTextVersion.aggregate({ _max: { version: true } });
    const version = (max._max.version ?? 0) + 1;
    await tx.consentTextVersion.createMany({
      data: [
        { version, language: 'de', title: input.titleDe, body: input.bodyDe, publishedBy: actor.name, resignRequired },
        { version, language: 'en', title: input.titleEn, body: input.bodyEn, publishedBy: actor.name, resignRequired },
      ],
    });
    await audit(
      actor,
      'consentText.published',
      { details: { version, fromTemplate: !!opts.fromTemplate, resignRequired } },
      tx,
    );
    return version;
  });
  if (opts.fromTemplate) await markTemplateSeen();
  return version;
}

/** Unknown fields per input (design D1): «Praxisnam» blocks publishing */
export function unknownFieldsOf(input: Record<string, string>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(input)) {
    const unknown = unknownFields(v);
    if (unknown.length) out[k] = unknown;
  }
  return out;
}

/** Whether the practice still gets the notice «Neue Vorlage verfügbar» (design D3) */
export async function templateOffered(): Promise<boolean> {
  const p = await currentPractice();
  return !!p && p.templateSeen < TEMPLATE_VERSION;
}

/** Adopted or dismissed: the notice disappears until a newer template */
export async function markTemplateSeen() {
  const p = await requirePractice();
  await rawDb.practice.update({ where: { id: p.id }, data: { templateSeen: TEMPLATE_VERSION } });
}

/**
 * Platform template of the form (iteration 17, design D2): our first version from the practice forms (pdf3, pages 2, 5
 * and 6) merged with the privacy notice of another practice (Datenschutz.pdf, 23.11.2026). Fields in guillemets are
 * filled with the practice details (packages/shared/src/consent-fields.ts). New practices start with it as version 1;
 * existing ones are offered it (design D3). To be legally reviewed by the practice.
 */
export const TEMPLATE_VERSION = 2;

export const INITIAL_TEXTS = {
  de: {
    title: 'Haftungsausschluss, Patienteninformation und Datenschutzhinweis',
    body: `## 1. Haftungsausschluss
Ich nehme die Schmerztherapie nach Liebscher & Bracht freiwillig und in eigener Verantwortung in Anspruch. Ich habe die Fragen zu meiner Gesundheit vollständig und wahrheitsgemäss beantwortet und melde wesentliche Veränderungen, zum Beispiel eine Schwangerschaft, neue Diagnosen oder neue Medikamente, sofort.

Soweit gesetzlich zulässig, verzichte ich gegenüber «Praxisname» sowie der behandelnden Therapeutin oder dem behandelnden Therapeuten auf Haftungsansprüche, die aus der Behandlung oder den Übungen für zu Hause entstehen. Ausgenommen sind Schäden aus grober Fahrlässigkeit oder Vorsatz.

## 2. Patienteninformation zur Schmerztherapie
Die Methode beruht auf Ihrer Mitarbeit. Muskulär-fasziale Spannungen verursachen rund 90 % aller Schmerzen. Mit der Osteopressur und den Engpassdehnungen werden diese Spannungen gelöst.

- Rechnen Sie im Durchschnitt mit 3 bis 5 Behandlungen pro Schmerzbereich. Meist lässt der Schmerz schon in der ersten Sitzung deutlich nach.
- Dehnen Sie einen Monat lang 6 Mal pro Woche, je 2 Mal täglich. Danach besprechen wir den Erfolg.
- Nehmen Sie während der Behandlung keine anderen Therapien in Anspruch.
- Verzichten Sie auf Schmerzmittel, damit sich der Erfolg beurteilen lässt. Starke Medikamente wie Morphin dürfen nicht abrupt abgesetzt werden. Besprechen Sie jede Änderung mit Ihrer Ärztin oder Ihrem Arzt.

Mögliche Reaktionen auf die Osteopressur sind blaue Flecken, druckempfindliche Stellen und eine vorübergehende Verschlechterung in den ersten 24 Stunden. Wärme hilft: ein warmes Bad oder eine Dusche, warme Wickel und Dehnen mit Intensität 8 bis 9.

## 3. Datenschutzhinweis
Der Schutz Ihrer persönlichen Daten ist uns wichtig. Wir behandeln alle Angaben vertraulich und halten uns an das Schweizer Datenschutzgesetz (DSG). Grundlage der Bearbeitung ist der Behandlungsvertrag.

Verantwortlich für die Bearbeitung Ihrer Daten:
- «Verantwortliche Person», «Praxisname»
- «Adresse»
- E-Mail: «E-Mail»
- Telefon: «Telefon»

Welche Daten wir bearbeiten: Personalien, Kontakt- und Versicherungsangaben, das Informationsgespräch, Gesundheitsdaten wie Beschwerden, Vorerkrankungen, Operationen, Medikamente, Diagnosen und Befunde, den Behandlungsverlauf mit den empfohlenen Übungen sowie Angaben zu Terminen und Rechnungen.

Wir verwenden Ihre Daten ausschliesslich für:
- die Planung und Durchführung der Behandlungen
- die Dokumentation des Behandlungsverlaufs
- die Beratung und Ihr persönliches Übungsprogramm
- Terminvereinbarungen und die Kommunikation mit Ihnen
- die Rechnungsstellung und gesetzliche Pflichten

Wir schützen Ihre Daten mit angemessenen technischen und organisatorischen Massnahmen vor unberechtigtem Zugriff, Verlust und Missbrauch. Zugriff haben nur berechtigte Personen der Praxis, soweit sie ihn für ihre Aufgabe brauchen.

Wir geben Daten an andere Fachpersonen, Versicherungen oder weitere Dritte nur weiter, wenn Sie eingewilligt haben oder das Gesetz es erlaubt oder verlangt. Angaben zu unbezahlten Rechnungen können an ein Inkassobüro gehen. Für die Patientenakte nutzen wir die Plattform Pain Therapy: Ihre Daten liegen verschlüsselt in Rechenzentren von Microsoft Azure in der Schweiz, E-Mails mit Zugangslinks versendet der Schweizer Anbieter Infomaniak. Diese Dienstleister sind vertraglich zum Datenschutz verpflichtet.

Wir bewahren Ihre Akte 20 Jahre nach der letzten Behandlung auf, länger nur mit Ihrer ausdrücklichen Einwilligung. Danach löschen oder anonymisieren wir sie.

Sie können jederzeit Auskunft und eine Kopie Ihrer Daten verlangen (in der Regel kostenlos), Ihre Daten in einem maschinenlesbaren Format erhalten, unrichtige Angaben berichtigen oder einen Bestreitungsvermerk anbringen lassen, die Löschung verlangen, soweit keine Aufbewahrungspflicht entgegensteht, und eine Einwilligung für die Zukunft widerrufen. Wenden Sie sich dafür an die oben genannte Stelle.

## 4. Unverschlüsselte E-Mail
Wenn Sie zustimmen, sendet Ihnen die Praxis Unterlagen und Informationen zu Terminen per unverschlüsselter E-Mail. Unverschlüsselte E-Mails können von Dritten gelesen werden. Diese Einwilligung ist freiwillig und lässt sich jederzeit widerrufen.

## 5. Bestätigung
Mit meiner Unterschrift bestätige ich, dass ich die Patienteninformation und den Datenschutzhinweis erhalten und verstanden habe und Gelegenheit hatte, Fragen zu stellen.`,
  },
  en: {
    title: 'Liability waiver, patient information and privacy notice',
    body: `## 1. Liability waiver
I undergo pain therapy according to Liebscher & Bracht voluntarily and on my own responsibility. I have answered the questions about my health completely and truthfully, and I will report significant changes straight away, such as a pregnancy, new diagnoses or new medication.

To the extent permitted by law, I waive liability claims against «Practice name» and the treating therapist arising from the treatment or the home exercises. Damage caused by gross negligence or intent is excluded.

## 2. Patient information on the pain therapy
The method relies on your cooperation. Muscular-fascial tension causes about 90% of all pain. Osteopressure and the stretching exercises release this tension.

- Expect 3 to 5 treatments per pain area on average. The pain usually eases noticeably in the first session.
- Stretch 6 times a week, twice a day, for one month. We will then review the results together.
- Do not have other therapies during the treatment.
- Avoid painkillers so that the results can be assessed. Strong medication such as morphine must not be stopped abruptly. Agree any change with your doctor.

Possible reactions to osteopressure are bruises, tender spots and a temporary worsening in the first 24 hours. Warmth helps: a warm bath or shower, warm wraps, and stretching at intensity 8 to 9.

## 3. Privacy notice
Protecting your personal data matters to us. We treat all information confidentially and comply with the Swiss Data Protection Act (FADP). The legal basis for processing is the treatment contract.

Responsible for processing your data:
- «Responsible person», «Practice name»
- «Address»
- Email: «Email»
- Phone: «Phone»

Data we process: personal, contact and insurance details, the information conversation, health data such as complaints, previous illnesses, operations, medication, diagnoses and findings, the course of treatment with the recommended exercises, and details of appointments and invoices.

We use your data only for:
- planning and carrying out the treatments
- documenting the course of treatment
- advice and your personal exercise programme
- appointments and communication with you
- invoicing and legal obligations

We protect your data with appropriate technical and organisational measures against unauthorised access, loss and misuse. Only authorised people at the practice have access, and only as far as their work requires.

We only disclose data to other professionals, insurers or other third parties if you have consented or the law allows or requires it. Details of unpaid invoices may be passed to a debt-collection agency. For the patient record we use the Pain Therapy platform: your data is stored encrypted in Microsoft Azure data centres in Switzerland, and emails with access links are sent by the Swiss provider Infomaniak. These providers are contractually bound to data protection.

We keep your record for 20 years after the last treatment, and longer only with your explicit consent. After that we delete or anonymise it.

You can at any time request information and a copy of your data (normally free of charge), receive your data in a machine-readable format, have incorrect data corrected or a note added where accuracy is disputed, request erasure unless a retention obligation applies, and withdraw a consent for the future. Please contact the person named above.

## 4. Unencrypted email
If you agree, the practice sends you documents and appointment information by unencrypted email. Unencrypted emails can be read by third parties. This consent is optional and can be withdrawn at any time.

## 5. Confirmation
With my signature I confirm that I have received and understood the patient information and the privacy notice and that I had the opportunity to ask questions.`,
  },
};
