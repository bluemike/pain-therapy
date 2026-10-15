import type { Language } from '@prisma/client';
import { db } from './db';
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
  }
  initialTextsChecked = true;
}

export async function currentVersionNumber(): Promise<number> {
  await ensureInitialTexts();
  const v = await db.consentTextVersion.aggregate({ _max: { version: true } });
  return v._max.version ?? 0;
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
) {
  return db.$transaction(async (tx) => {
    const max = await tx.consentTextVersion.aggregate({ _max: { version: true } });
    const version = (max._max.version ?? 0) + 1;
    await tx.consentTextVersion.createMany({
      data: [
        { version, language: 'de', title: input.titleDe, body: input.bodyDe, publishedBy: actor.name },
        { version, language: 'en', title: input.titleEn, body: input.bodyEn, publishedBy: actor.name },
      ],
    });
    await audit(actor, 'consentText.published', { details: { version } }, tx);
    return version;
  });
}

/** First version, written from the practice forms (pdf3, pages 2, 5 and 6). To be legally reviewed (task 6.1). */
export const INITIAL_TEXTS = {
  de: {
    title: 'Haftungsausschluss, Patienteninformation und Datenschutzhinweis',
    body: `## 1. Haftungsausschluss
Ich nehme die Schmerztherapie nach Liebscher & Bracht freiwillig und in eigener Verantwortung in Anspruch. Ich habe die Fragen zu meiner Gesundheit vollständig und wahrheitsgemäss beantwortet und melde wesentliche Veränderungen, zum Beispiel eine Schwangerschaft, neue Diagnosen oder neue Medikamente, sofort.

Soweit gesetzlich zulässig, verzichte ich gegenüber dem Zentrum sowie der behandelnden Therapeutin oder dem behandelnden Therapeuten auf Haftungsansprüche, die aus der Behandlung oder den Übungen für zu Hause entstehen. Ausgenommen sind Schäden aus grober Fahrlässigkeit oder Vorsatz.

## 2. Patienteninformation zur Schmerztherapie
Die Methode beruht auf Ihrer Mitarbeit. Muskulär-fasziale Spannungen verursachen rund 90 % aller Schmerzen. Mit der Osteopressur und den Engpassdehnungen werden diese Spannungen gelöst.

- Rechnen Sie im Durchschnitt mit 3 bis 5 Behandlungen pro Schmerzbereich. Meist lässt der Schmerz schon in der ersten Sitzung deutlich nach.
- Dehnen Sie einen Monat lang 6 Mal pro Woche, je 2 Mal täglich. Danach besprechen wir den Erfolg.
- Nehmen Sie während der Behandlung keine anderen Therapien in Anspruch.
- Verzichten Sie auf Schmerzmittel, damit sich der Erfolg beurteilen lässt. Starke Medikamente wie Morphin dürfen nicht abrupt abgesetzt werden. Besprechen Sie jede Änderung mit Ihrer Ärztin oder Ihrem Arzt.

Mögliche Reaktionen auf die Osteopressur sind blaue Flecken, druckempfindliche Stellen und eine vorübergehende Verschlechterung in den ersten 24 Stunden. Wärme hilft: ein warmes Bad oder eine Dusche, warme Wickel und Dehnen mit Intensität 8 bis 9.

## 3. Datenschutzhinweis
Verantwortlich für die Bearbeitung Ihrer Daten ist die Praxis. Grundlage sind der Behandlungsvertrag und das Schweizer Datenschutzgesetz.

Ihre Patientenakte enthält Personalien, Kontakt- und Versicherungsangaben, das Informationsgespräch sowie Gesundheitsdaten wie Anamnese, Diagnosen, Befunde und den Therapieverlauf. Wir bewahren die Akte 20 Jahre nach der letzten Behandlung auf, länger nur mit Ihrer ausdrücklichen Einwilligung.

Wir geben Daten nur weiter, wenn das Gesetz es erlaubt oder Sie eingewilligt haben. Angaben zu unbezahlten Rechnungen können an ein Inkassobüro gehen.

Sie können Ihre Einwilligung widerrufen, Auskunft und eine Kopie Ihrer Daten verlangen (in der Regel kostenlos), Ihre Daten in einem maschinenlesbaren Format erhalten, Berichtigung verlangen oder einen Bestreitungsvermerk anbringen lassen.

## 4. Unverschlüsselte E-Mail
Wenn Sie zustimmen, sendet Ihnen die Praxis Unterlagen und Informationen zu Terminen per unverschlüsselter E-Mail. Unverschlüsselte E-Mails können von Dritten gelesen werden. Diese Einwilligung ist freiwillig und lässt sich jederzeit widerrufen.`,
  },
  en: {
    title: 'Liability waiver, patient information and privacy notice',
    body: `## 1. Liability waiver
I undergo pain therapy according to Liebscher & Bracht voluntarily and on my own responsibility. I have answered the questions about my health completely and truthfully, and I will report significant changes straight away, such as a pregnancy, new diagnoses or new medication.

To the extent permitted by law, I waive liability claims against the centre and the treating therapist arising from the treatment or the home exercises. Damage caused by gross negligence or intent is excluded.

## 2. Patient information on the pain therapy
The method relies on your cooperation. Muscular-fascial tension causes about 90% of all pain. Osteopressure and the stretching exercises release this tension.

- Expect 3 to 5 treatments per pain area on average. The pain usually eases noticeably in the first session.
- Stretch 6 times a week, twice a day, for one month. We will then review the results together.
- Do not have other therapies during the treatment.
- Avoid painkillers so that the results can be assessed. Strong medication such as morphine must not be stopped abruptly. Agree any change with your doctor.

Possible reactions to osteopressure are bruises, tender spots and a temporary worsening in the first 24 hours. Warmth helps: a warm bath or shower, warm wraps, and stretching at intensity 8 to 9.

## 3. Privacy notice
The practice is responsible for processing your data. The legal basis is the treatment contract and the Swiss Data Protection Act.

Your patient record contains personal, contact and insurance details, the information conversation, and health data such as medical history, diagnoses, findings and the course of therapy. We keep the record for 20 years after the last treatment, and longer only with your explicit consent.

We only disclose data where the law allows it or you have consented. Details of unpaid invoices may be passed to a debt-collection agency.

You can withdraw your consent, request information and a copy of your data (normally free of charge), receive your data in a machine-readable format, request correction, or have a note added where accuracy is disputed.

## 4. Unencrypted email
If you agree, the practice sends you documents and appointment information by unencrypted email. Unencrypted emails can be read by third parties. This consent is optional and can be withdrawn at any time.`,
  },
};
