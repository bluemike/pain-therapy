# Design

## Context

Die App ist heute auf eine Praxis zugeschnitten:
- Anmeldung nur über den Ayanta-Entra-Tenant (`src/auth.ts`, Rollen `THERAPIST`/`ADMIN` aus der Entra-App «Ayanta Schmerztherapie»).
- Praxisadresse, Standardort und Absender sind Konstanten in `src/lib/config.ts` und `apps/patient-zone/src/lib/config.ts`; `Invalid.tsx` der Zone nennt `pain-therapy@ayanta.ch`.
- Mails gehen über Microsoft Graph `sendMail` aus dem Postfach `pain-therapy@ayanta.ch`, der unterschriebene Haftungsausschluss und das Übungsblatt als PDF-Anhang (`src/lib/mail.ts`, `signing.ts`, `handouts.ts`).
- `DocumentCounter` zählt pro Jahr global, `ConsentTextVersion` ist global.
- 32 Prisma-Modelle, davon rund 20 mit Patientendaten, rund 190 Abfragen in Praxis-App und Zone.
- Dateien in `signed-documents` (WORM, 7300 Tage) und `clinical-photos`; jede Zeile speichert ihren `blobPath`. `exercise-media` ist gemeinsames L&B-Material.
- Die Zone (`ca-pain-therapy-zone`) nutzt die Datenbankrolle `patient_zone` mit eingeschränkten Rechten.

## Goals / Non-Goals

**Goals:**
- Eine Praxis sieht nie Daten einer anderen Praxis, auch nicht bei einem Programmierfehler in einer einzelnen Abfrage.
- Neue Praxis in wenigen Minuten startklar, ohne Deployment und ohne Azure-Portal.
- Anmeldung ohne Microsoft-Konto, mit zweitem Faktor, auf iPad und iPhone bequem.
- Keine Gesundheitsdokumente in E-Mail-Postfächern.
- Ein Deployment, eine Datenbank, Kosten pro zusätzlicher Praxis nahe null.

**Non-Goals:** siehe Proposal, «Nicht Teil dieser Änderung».

## Decisions

### D1 Gemeinsame Datenbank mit `practiceId` und Row-Level Security

Jede Tabelle mit Patienten- oder Praxisdaten erhält `practiceId` (NOT NULL, Fremdschlüssel auf `Practice`, Index). Auf diesen Tabellen gilt `ENABLE ROW LEVEL SECURITY` und `FORCE ROW LEVEL SECURITY` mit der Policy `practiceId = current_setting('app.practice_id')`.

- Die Praxis-App verbindet sich mit einer neuen Rolle `practice_app` ohne `BYPASSRLS`. Ein Prisma-Client-Extension setzt pro Anfrage in einer Transaktion `SET LOCAL app.practice_id` aus der Session. Ohne gesetzte Praxis liefert jede Abfrage nichts.
- Die Zone setzt `app.practice_id` aus dem aufgelösten Link (D6). Die Rolle `patient_zone` behält ihre engen Rechte und unterliegt zusätzlich RLS.
- Plattform-Funktionen (Praxen anlegen, sperren, exportieren, löschen) und Migrationen laufen mit einer eigenen Rolle `platform_admin` mit `BYPASSRLS`, nur in klar abgegrenzten Server-Funktionen, jeder Aufruf wird protokolliert.
- Katalogtabellen (Bereiche, Punkte, Übungen, Varianten, Werkzeuge) bleiben ohne `practiceId`.

Alternativen: Datenbank oder Schema pro Praxis bringt bei wenigen kleinen Praxen mehr Migrations- und Betriebsaufwand ohne Gewinn. Ein Deployment pro Praxis vervielfacht Kosten und Pflege; ab etwa drei Praxen lohnt es sich nicht mehr.

### D2 Anmeldung mit Passkey oder E-Mail-Code plus TOTP

Entra ID entfällt. Auth.js bleibt für Session und Cookies, die Anbieter werden ersetzt.

- **Passkey (empfohlen):** WebAuthn mit Benutzerverifikation (Face ID, Touch ID, Geräte-PIN) über `@simplewebauthn`. Ein Passkey gilt allein als starke Anmeldung, weil er Besitz und Biometrie oder PIN verbindet.
- **Ohne Passkey:** E-Mail-Adresse eingeben, 6-stelliger Code an diese Adresse (gültig 10 Minuten, 5 Versuche), danach 6-stelliger Code aus einer Authenticator-App (TOTP, RFC 6238). Beide Faktoren sind Pflicht.
- **Erste Anmeldung:** über den Einladungslink (D4). Die Benutzerin bestätigt den E-Mail-Code und richtet einen Passkey oder TOTP ein; ohne zweiten Faktor ist kein Konto aktiv. Einmalig angezeigte Wiederherstellungscodes (10 Stück) für den Verlust des Geräts.
- Sperre nach 5 falschen Codes für 15 Minuten pro Adresse und IP. Codes und TOTP-Geheimnisse werden nur gehasht bzw. verschlüsselt gespeichert (Schlüssel im Key Vault).
- Session wie bisher: abgemeldet über `signedOutAt`, Rollen werden bei jeder Anfrage aus der Datenbank gelesen.
- Ein Praxis-Admin kann die Faktoren einer Benutzerin zurücksetzen; sie richtet sie über einen neuen Einladungslink neu ein.

Alternativen: Entra External ID oder B2B-Gäste brauchen Microsoft-Tenants und widersprechen Mikes Entscheid. Magic Link allein ist nur ein Faktor.

### D3 Rollen pro Praxis und Plattform-Admin

- `PracticeMembership(userId, practiceId, roles[])` mit `PRACTICE_ADMIN` und `THERAPIST`. Eine Benutzerin gehört genau einer Praxis (Datenmodell erlaubt später mehrere).
- `User.platformAdmin` (Boolean) für Mike. Der Plattform-Admin sieht Praxen, Mitgliederzahl, Status und letzte Aktivität, aber keine Patientendaten. Will er in seiner eigenen Praxis arbeiten, tut er das über seine Mitgliedschaft dort.
- Die bisherige Rolle `ADMIN` wird zu `PRACTICE_ADMIN`, `THERAPIST` bleibt.

### D4 Einladung

- `Invitation(email, practiceId, roles, tokenHash, expiresAt, acceptedAt)`, gültig 7 Tage, einmal verwendbar. Der Link geht per E-Mail an die eingeladene Adresse.
- Die Adresse muss nicht auf `@pain-therapy.online` enden; Mike plant diese Adressen, die App erzwingt die Domain nicht.

### D5 Praxis-Einstellungen

`Practice` mit `name`, `slug`, `status` (`ACTIVE`, `SUSPENDED`), `addressLine` (eine Zeile wie heute), `street`, `zip`, `city`, `defaultPlace`, `contactEmail` (Antwortadresse und Kontakt in der Zone), `phone`, `logo` (PNG oder SVG, max. 500 KB, in Blob unter `practice-assets/<practiceId>/`), `documentPrefix` (Standard `PT`).

- PDFs (Haftungsausschluss, Übungsblatt, Zugangsblatt), Mails und die Zone lesen Name, Adresse, Logo und Kontakt aus der Praxis. Fehlt das Logo, steht der Praxisname als Schriftzug.
- `ConsentTextVersion` erhält `practiceId`. Beim Anlegen einer Praxis wird die aktuelle Vorlage kopiert, der Praxisname eingesetzt; danach pflegt die Praxis-Admin ihre Version selbst (Versionierung wie bisher).
- Datenschutzhinweis der Zone (`/privacy`) pro Praxis mit derselben Mechanik.
- `DocumentCounter(practiceId, year)`; Dokumentnummer `<documentPrefix>-<Jahr>-<laufende Nummer>`, eindeutig pro Praxis.
- Die Plattform-Marke ist neutral «Pain Therapy» auf `pain-therapy.online`; das Ayanta-Logo und die Ayanta-Hinweise entfallen. Farben und Schrift bleiben.

### D6 Patienten-Zone pro Praxis über den Link

- Eine Zone für alle Praxen unter `patient.pain-therapy.online`. Der Zugangslink (`PatientAccessLink`) gehört über den Patienten zu genau einer Praxis; die Zone löst Token → Link → Praxis auf und setzt danach `app.practice_id`.
- Keine Subdomain pro Praxis: kein Wildcard-Zertifikat nötig, Container Apps verwaltet die zwei Zertifikate selbst.
- Kopfzeile, Kontakt («Fragen? Praxis …»), Datenschutzhinweis und Haftungsausschluss kommen aus der Praxis.

### D7 E-Mail nur mit Links, Versand über Infomaniak SMTP

- Der `Mailer` kennt keine Anhänge mehr. Unterschriebener Haftungsausschluss, Übungsblatt und künftige Dokumente gehen als Link `https://patient.pain-therapy.online/l/<token>?tab=dokumente`; die Patientin bestätigt wie bisher mit dem Geburtsdatum.
- Hat die Patientin noch keinen Zonen-Link, erzeugt der Versand einen (bestehende Regeln: Gültigkeit, Sperre, Widerruf). Ohne E-Mail-Adresse oder ohne Einwilligung bleibt der Ausdruck inkl. QR-Zugangsblatt.
- Die Mail nennt nur Praxisname und «Ein neues Dokument steht für Sie bereit», keine Diagnose, keinen Dokumenttitel mit Gesundheitsbezug.
- Versand per SMTP (Nodemailer) über Infomaniak, Absender `noreply@pain-therapy.online` mit Anzeigename der Praxis, `Reply-To` = Kontakt-E-Mail der Praxis. SPF, DKIM und DMARC für `pain-therapy.online` werden bei Infomaniak eingerichtet. Zugangsdaten im Key Vault (`smtp-password`).
- Login-Codes und Einladungen laufen über denselben Absender.
- Lokal bleibt der Outbox-Ordner.

### D8 Dateien pro Praxis

- Neue Dateien unter `<practiceId>/…` in `signed-documents` und `clinical-photos`. Bestehende Dateien bleiben unter ihrem Pfad, weil WORM-Dateien nicht verschoben werden können; massgebend ist immer der `blobPath` der Zeile, und der Zugriff prüft die Praxis der Zeile (RLS), nie den Pfad allein.
- `exercise-media` bleibt gemeinsam für alle angemeldeten Benutzerinnen und alle gültigen Zonen-Sitzungen.

### D9 Praxis exportieren, sperren, löschen

- **Sperren:** Status `SUSPENDED` blockiert Anmeldung und Zone der Praxis sofort; Daten bleiben.
- **Exportieren:** ZIP mit allen PDFs, Fotos und einem JSON/CSV-Export der Praxisdaten, erzeugt im Hintergrund, Download-Link 24 Stunden gültig, nur für Praxis-Admin und Plattform-Admin.
- **Löschen:** nur nach Export und zweifacher Bestätigung durch den Plattform-Admin. Löscht Datenbankzeilen und Fotos. Unterschriebene PDFs unter WORM können erst nach Ablauf der Aufbewahrung gelöscht werden; sie werden als «zur Löschung vorgemerkt» geführt und danach von einem Job entfernt. Ersetzt `~/Desktop/pain-therapy-purge`.

### D10 Domain und Umstellung

- `pain-therapy.online` (Apex, A- und TXT-Eintrag) auf `ca-pain-therapy`, `www` leitet weiter, `patient.pain-therapy.online` auf `ca-pain-therapy-zone`, verwaltete Zertifikate.
- `pain-therapy.ayanta.ch` leitet auf `pain-therapy.online` weiter. `patient.pain-therapy.ayanta.ch` bleibt gebunden, bis der letzte dort versandte Link abgelaufen ist (höchstens 6 Monate), und leitet dann weiter.
- Reihenfolge: (1) Domain und Mail bei Infomaniak bereit, (2) Deployment mit Migration (alle Daten an «Pain Therapy Falera»), (3) Mike und Chrissie über Einladung an ihre neuen Adressen, (4) Entra-Anmeldung abschalten, (5) Graph-Berechtigung `Mail.Send` und die Entra-App entfernen.

## Risks / Trade-offs

- **Vergessene Abfrage ohne Praxis:** RLS fängt das ab; zusätzlich E2E-Tests mit zwei Praxen, die jede Seite und API gegen fremde IDs prüfen.
- **RLS und Prisma:** Prisma kennt RLS nicht; die Extension mit `SET LOCAL` in einer Transaktion pro Anfrage kostet etwas Leistung, bei dieser Grösse unkritisch.
- **Verlorener Passkey:** Wiederherstellungscodes und Zurücksetzen durch die Praxis-Admin. Verliert die einzige Praxis-Admin alles, hilft der Plattform-Admin mit einer neuen Einladung.
- **Zustellbarkeit:** neue Domain, anfangs geringe Reputation; SPF/DKIM/DMARC vor dem ersten Versand prüfen.
- **Alte Links mit Anhang-Erwartung:** Patientinnen, die bisher PDFs per Mail bekamen, finden neue Dokumente in der Zone; der Mailtext erklärt das.

## Migration Plan

1. Migration A: `Practice` anlegen, «Pain Therapy Falera» mit heutiger Adresse, `practiceId` nullable hinzufügen und mit dieser Praxis füllen, dann NOT NULL.
2. Migration B: Rollen `practice_app` und `platform_admin`, RLS-Policies, Zähler und Einwilligungstexte pro Praxis.
3. Bestehende Benutzer bekommen eine Mitgliedschaft in Falera (`ADMIN` → `PRACTICE_ADMIN`); `entraOid` bleibt für die Historie.
4. Rollback: Migration A ist umkehrbar, solange keine zweite Praxis existiert; deshalb wird die erste fremde Praxis erst nach Abnahme von Falera angelegt.

## Open Questions

- Rechnungsadresse und Name des Plattform-Betreibers in Fusszeile und Impressum (Ayanta oder neue Firma)? Standard bis zur Antwort: «Pain Therapy» ohne Betreiberangabe in der App, Impressum-Link konfigurierbar.
