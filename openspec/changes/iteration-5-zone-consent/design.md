# Design

## Context

Iteration 1 hat die Unterschrift des Haftungsausschlusses als Patientenmodus auf dem iPad gebaut: `startSigning()` legt eine `SignatureSession` an, das Gerät zeigt nur `/sign/[sid]`, `completeSigning()` in `src/lib/signing.ts` speichert Unterschrift und Einwilligungen, erzeugt das PDF (`renderSignedFormPdf`), legt es im unveränderbaren Blob-Speicher ab (`SignedDocument`) und stellt es per `EmailDelivery` zu. Den Patientenmodus verlässt die Therapeutin nur mit einer neuen Entra-Anmeldung (`reauthenticate()`), das ist der mühsame Teil. Ob eine Unterschrift aussteht, berechnet `consentStatusOf()` aus dem jüngsten archivierten Dokument (`src/lib/patients.ts`); ohne gültige Unterschrift sperrt `openingBlocker()` neue Behandlungen.

Iteration 4 hat die Patienten-Zone als eigene App gebaut (`apps/patient-zone`): Link mit Token-Hash (`PatientAccessLink`), Bestätigung mit dem Geburtsdatum, Gerätesitzung (`PatientZoneSession`), eigene Datenbankrolle `patient_zone` mit Spaltenrechten (`prisma/patient-zone-role.sql`). Der Link gilt heute nur bei aktivem Heimprogramm (`linkState()`, `sessionLinkOk()` in `packages/shared/src/access.ts`). Die Zone hat bewusst keinen Zugriff auf Dokumente und Kontaktdaten.

## Goals / Non-Goals

**Goals:**
- Die Patientin unterschreibt den Haftungsausschluss auf dem eigenen Telefon, idealerweise schon vor dem ersten Termin, ohne dass die Praxis ihr iPad aus der Hand gibt.
- Rechtlich derselbe Inhalt wie auf dem iPad: gleicher Text, gleiche Einwilligungen, gleiches PDF, gleiche Archivierung.
- Die Patienten-Zone bleibt minimal berechtigt: Sie schreibt die Unterschrift, aber Dokumente erzeugt und liest nur die Praxis-App.

**Non-Goals:**
- Anamnese-Fragebogen, Selbstregistrierung, Änderung der Personalien durch die Patientin (Roadmap).
- Qualifizierte elektronische Signatur.
- Erinnerungen an ausstehende Unterschriften.

## Decisions

### D1: Capabilities und bestehende Specs
Zwei neue Capabilities: `zone-consent-invitation` (Praxis-Seite: Einladung, Gültigkeit des Links, Stand) und `zone-consent-signing` (Zonen-Seite: Vorrang, Formular, Abschluss, Übergabe an die Praxis-App, Rechte). Die Erweiterungen von `patient-access`, `patient-zone-app` und `consent-signing` stehen als Anforderungen in den neuen Capabilities, weil die Changes der Iterationen 1 bis 4 noch nicht archiviert sind (wie in Iteration 4, D1).

### D2: Ausstehende Unterschrift aus der Sitzung, nicht aus dem PDF
`consentStatusOf()` liest heute die Textversion des jüngsten `SignedDocument`. Neu zählt die jüngste `SignatureSession` mit Status `SIGNED` (über `textVersion.version`), damit eine Unterschrift in der Zone sofort gilt, auch wenn das PDF noch erzeugt wird (D7). Für alle bestehenden Unterschriften ist das gleichwertig, weil jede `SIGNED`-Sitzung aus Iteration 1 ein Dokument hat. Die reine Funktion `signaturePending(latestSignedVersion, currentVersion)` wandert nach `packages/shared` und wird von Praxis-App (Cockpit, Akte, `openingBlocker()`) und Zone gleich genutzt. Massgebend ist die aktuelle Versionsnummer (`currentVersionNumber()`); die Sprache bestimmt nur den angezeigten Text.

### D3: Einladung
- **Auslöser:** "Zur Unterschrift einladen" in der Akte (Kopf, solange eine Unterschrift aussteht) und im Erfolgsdialog nach dem Erfassen einer Patientin neben "An Patient übergeben". Nur Rollen Therapist und Admin; nur wenn `PATIENT_ZONE_URL` gesetzt ist.
- **Link:** `issueAccessLink()` aus Iteration 4 stellt einen neuen Link aus und ersetzt den alten. Ein eigener Einladungslink ist nicht nötig: Derselbe Link führt nach der Unterschrift zu den Übungen, sobald es ein Heimprogramm gibt.
- **Kanal:** Dialog mit "Per E-Mail" (nur mit E-Mail-Adresse, die bei neuen Patientinnen Pflicht ist), "QR-Code anzeigen" und "Zugangsblatt drucken". `AccessLinkDelivery` bekommt die Spalte `purpose` (`EXERCISES` wie bisher, `SIGNATURE` neu), damit Akte und Verlauf die Einladung unterscheiden.
- **E-Mail:** eigener Text (de und en) "Bitte unterschreiben Sie den Haftungsausschluss" mit Praxisname, Link, Hinweis auf das Geburtsdatum und Kontakt der Praxis; ohne Anhang, ohne Gesundheitsdaten. Zustellung, Wiederholungen und Status wie `deliverAccessLink()`.
- **E-Mail ohne Einwilligung:** Die Einladung geht auch ohne Einwilligung in unverschlüsselte E-Mail an die erfasste Adresse (Ausnahme nur für diese E-Mail; `emailConsentOf()` bleibt für Übungsblatt, PDF und Link mit dem Übungsblatt massgebend). Begründung: Die Einwilligung wird erst mit genau diesem Formular erteilt, die E-Mail enthält keine Gesundheitsdaten, und ohne Geburtsdatum öffnet der Link nichts. Entscheid der Praxis offen, siehe Open Questions.

### D4: Gültigkeit des Links
`linkState()` und `sessionLinkOk()` bekommen statt `homeProgramActive: boolean` die Angabe `purposeActive = homeProgramActive || signaturePending`. Alles andere bleibt: höchstens 6 Monate, ersetzt, gesperrt, blockiert, aktive Patientin. Nach der Unterschrift ohne Heimprogramm bleibt die laufende Gerätesitzung bis zum Schliessen auf der Dankesseite; neue Bestätigungen mit diesem Link werden abgelehnt (neutrale Seite), bis ein Heimprogramm verordnet ist oder eine neue Textversion gilt. Die Akte zeigt den Link dann als "abgelaufen" wie heute ohne Heimprogramm.

### D5: Ablauf in der Patienten-Zone
- **Vorrang:** Die Startseite `/` prüft nach der Sitzung zuerst `signaturePending`. Wenn ja, leitet sie auf `/unterschrift` um; Übungsseiten, Einträge und Bilder (`/media/{code}`) lehnen die Anfrage ab, solange die Unterschrift aussteht.
- **Aufgabe** (`/unterschrift`): Begrüssung mit Vorname, kurze Erklärung ("Bevor wir Sie behandeln, brauchen wir Ihre Unterschrift…", ca. 5 Minuten), Schaltfläche "Formular öffnen".
- **Formular** (`/unterschrift/formular`), eine lange Seite, mobil zuerst:
  1. "Ihre Angaben": Name, Geburtsdatum, Adresse, Telefon, Mobile, E-Mail, Versicherer, Versicherungsnummer, schreibgeschützt; Feld "Anmerkung zu meinen Angaben" (höchstens 500 Zeichen).
  2. Text der aktuellen Version in der Sprache der Patientin (`parseBlocks()` aus `src/lib/consent-texts.ts`, nach `packages/shared` verschoben), Fortschrittsanzeige; ein Sentinel am Ende schaltet Einwilligungen und Unterschrift frei (Intersection Observer, wie auf dem iPad).
  3. Einwilligungen: Haftungsausschluss (Pflicht), Datenbearbeitung (Pflicht, mit Erklärung bei fehlender Bestätigung), unverschlüsselte E-Mail (optional, nicht vorgewählt).
  4. Unterschriftsfeld in voller Breite, Höhe ca. 180 px, `touch-action: none` nur im Feld, perfect-freehand (`src/lib/signature.ts` nach `packages/shared`), "Unterschrift löschen", "Unterschreiben".
- **Dankesseite** (`/unterschrift/danke`): "Vielen Dank. Ihre Unterschrift ist bei der Praxis." Mit Heimprogramm: "Weiter zu Ihren Übungen"; ohne: Hinweis, dass die Praxis das Dokument zustellt beziehungsweise beim Termin ausdruckt.
- **Sitzung des Formulars:** Beim Öffnen des Formulars legt die Zone eine `SignatureSession` mit `channel = PATIENT_ZONE`, `status = OPEN`, `startedBy = "patient-zone"`, der aktuellen Textversion in der Sprache der Patientin und `zoneSessionId` an, oder verwendet eine offene aus derselben Gerätesitzung weiter. Der Abschluss läuft wie in `completeSigning()` mit `updateMany({ where: { id, status: 'OPEN' } })`, damit ein doppelter Klick genau eine Unterschrift ergibt. Ist inzwischen eine neuere Version aktuell, wird die offene Sitzung abgebrochen und eine neue mit der neuen Version geöffnet (Szenario "Version während des Lesens geändert").

### D6: Datenmodell
Additive Migration:
- `enum SignatureChannel { IPAD, PATIENT_ZONE }`; `SignatureSession.channel` (Default `IPAD`), `SignatureSession.zoneSessionId` (optional, Fremdschlüssel auf `PatientZoneSession`), `SignatureSession.noteResolvedAt`, `noteResolvedBy` (Anmerkung erledigt).
- `enum AccessLinkPurpose { EXERCISES, SIGNATURE }`; `AccessLinkDelivery.purpose` (Default `EXERCISES`).
- Keine neue Tabelle für Einladungen: Stand der Einladung = jüngste `AccessLinkDelivery` mit `purpose = SIGNATURE` plus `PatientAccessLink.lastUsedAt` plus offene/abgeschlossene `SignatureSession` mit Kanal Zone.
- `place` einer Zonen-Unterschrift: "Online (Patienten-Zone)" beziehungsweise "Online (patient zone)".

### D7: PDF, Archiv und Zustellung durch die Praxis-App
`completeSigning()` wird in zwei Schritte geteilt:
1. `recordSignature()` speichert Unterschrift, Einwilligungen, Anmerkung, Zeitpunkt und Audit-Ereignis in einer Transaktion. Die Zone führt diesen Schritt mit ihrer eigenen Rolle aus (Code in `packages/shared`).
2. `finalizeSignature(sid)` in der Praxis-App erzeugt das PDF, legt es im Blob-Speicher ab, erstellt `SignedDocument` und `EmailDelivery` und startet die Zustellung. Idempotent: Hat die Sitzung schon ein Dokument, tut der Schritt nichts; konkurrierende Läufe sichert ein Advisory-Lock pro Sitzung.

Der iPad-Ablauf ruft beide Schritte nacheinander auf wie bisher. Für die Zone:
- **Sofort:** Nach dem Speichern ruft die Zone `POST /api/internal/signatures/{sid}/finalize` der Praxis-App über die interne Adresse der Container-Apps-Umgebung auf, mit `Authorization: Bearer <HMAC-SHA-256(sid, ZONE_INTERNAL_SECRET)>`. Die Route ist von der Entra-Middleware ausgenommen, prüft die Signatur zeitkonstant und akzeptiert nur `SIGNED`-Sitzungen mit Kanal Zone ohne Dokument. Ein Fehler beim Aufruf ändert nichts an der Dankesseite.
- **Rückfall:** Ein geplanter Container-Apps-Job `caj-pain-therapy-finalize` (alle 5 Minuten, Image der Praxis-App) ruft `POST /api/internal/signatures/finalize-pending` auf, das alle `SIGNED`-Sitzungen ohne Dokument verarbeitet, die älter als eine Minute sind.
- Das PDF bekommt beim Kanal Zone die Zeile "Unterschrieben online in der Patienten-Zone, Zugang bestätigt mit Geburtsdatum am …" und den Zeitpunkt der Bestätigung der Gerätesitzung, sonst denselben Inhalt wie vom iPad.

### D8: Rechte der Rolle `patient_zone`
Ergänzung von `prisma/patient-zone-role.sql`, Test `tests/unit/patient-zone-role.test.ts` erweitert:
- `SELECT` zusätzlich auf `Patient(lastName, street, zip, city, phone, mobile, email, insurer, insuranceNumber)`: nur die Felder, die das Formular zur Prüfung zeigt.
- `SELECT` auf `ConsentTextVersion(id, version, language, title, body)`.
- `SELECT (id, patientId, textVersionId, language, status, channel, zoneSessionId, startedAt, completedAt)` und `INSERT` auf `SignatureSession`; `UPDATE (status, completedAt, abortedAt, patientNote, place, signaturePoints, signatureSvg)`. Kein `SELECT` auf Unterschriftsbilder.
- `INSERT` auf `Consent`.
- Weiterhin kein Zugriff auf `Anamnesis`, `SignedDocument`, `EmailDelivery`, Diagnosen, Fotos, kein `DELETE`. Die Zone schreibt nur für `patientId` der bestätigten Gerätesitzung; das prüft der Code in `packages/shared` bei jedem Schreiben gegen die Sitzung.

### D9: Akte und Cockpit
- **Akte, Kopf:** Statuszeile der Unterschrift: "Unterschrift ausstehend · nicht eingeladen" / "Einladung per E-Mail versendet am …" / "Link geöffnet am …" / "Unterschrieben online am …" / "Einladung nicht zugestellt"; Schaltflächen "Zur Unterschrift einladen" und "An Patient übergeben" (iPad).
- **Akte, Anmerkung:** Hinweisbox mit der Anmerkung der Patientin und "Erledigt" (setzt `noteResolvedAt`), bis dahin auch im Cockpit als Hinweis.
- **Akte, Dokumente:** Spalte "Kanal" (iPad, Patienten-Zone); während das PDF erzeugt wird "wird erstellt …".
- **Cockpit:** Liste "Unterschrift ausstehend" zeigt pro Patientin den Stand der Einladung und die Schaltfläche "Einladen".

### D10: Gemeinsamer Code
Nach `packages/shared` verschoben und in der Praxis-App re-exportiert: `signature.ts` (Striche, SVG), `parseBlocks()`, zod-Schema der Unterschrift (`signingSchema`), `signaturePending()`, `recordSignature()` mit Prisma-Client als Parameter. Das Formular selbst ist in der Zone eine eigene Komponente (mobil, eigene Übersetzungen), damit `apps/patient-zone` weiterhin nicht von `src/` abhängt.

### D11: Infrastruktur
- **Secret:** `zone-internal-secret` in Key Vault, gelesen von beiden Apps (`ZONE_INTERNAL_SECRET`); die Identität der Zone bekommt Lesezugriff nur auf dieses zusätzliche Secret.
- **Interne Adresse:** Die Zone erreicht die Praxis-App unter ihrem Standard-Hostnamen in der Container-Apps-Umgebung `https://<app-name>.<env-domain>` (Variable `PRACTICE_INTERNAL_URL`, unabhängig vom eigenen Hostnamen); die Praxis-App bleibt nur mit Entra erreichbar, die Route `/api/internal/*` nimmt nur signierte Aufrufe an.
- **Job:** `caj-pain-therapy-finalize` als Container-Apps-Job mit Cron `*/5 * * * *` im Bicep, gleiche Identität und Secrets wie die Praxis-App, Befehl `node scripts/finalize-pending.mjs` (ein `fetch` mit HMAC auf die interne Adresse).

Mockup: [`mockups/unterschrift-zone.html`](mockups/unterschrift-zone.html) (Ansichten 1 Akte mit Einladung, 2 E-Mail, 3 Aufgabe in der Zone, 4 Formular, 5 Dank, 6 Akte nach der Unterschrift, 7 Cockpit).

## Risks / Trade-offs

- [Unterschrift auf fremdem Telefon] → Zugang nur mit Link und vollständigem Geburtsdatum wie in Iteration 4; das PDF hält Kanal und Bestätigungszeitpunkt fest. Gleiche Beweiskraft wie die einfache elektronische Unterschrift auf dem iPad, die ebenfalls keine Identitätsprüfung hat.
- [Einladung per unverschlüsselter E-Mail ohne Einwilligung] → Nur Link und Praxisname, keine Gesundheitsdaten; Entscheid der Praxis offen (Open Questions). Ohne E-Mail bleibt der QR-Code.
- [Zone liest jetzt Kontaktdaten] → Nur Spalten für das Formular, nur nach Bestätigung, nur die eigene Patientin; die Zone zeigt sie nur auf der Formularseite und speichert sie nirgends sonst. Der Hinweis in `patient-zone-app` ("nicht lesen: Kontaktdaten") wird damit für diese Felder aufgehoben.
- [Zeilenrechte nur im Code] → Spaltenrechte erzwingt die Datenbank, die Zuordnung zur Patientin der Code. Row-Level-Security wäre stärker, aber für die ganze Zone einzuführen; als Roadmap-Punkt notiert.
- [PDF entsteht asynchron] → Sofortiger interner Aufruf plus Job alle 5 Minuten; die Akte zeigt "wird erstellt …". Die Unterschrift gilt schon vorher (D2).
- [Lesen auf dem Telefon ist mühsam] → Gut lesbare Typografie, Fortschrittsanzeige, Zwischenüberschriften; derselbe Text wie auf dem iPad, weil er rechtlich massgebend ist.

## Migration Plan

Additive Migration (`SignatureChannel`, `AccessLinkPurpose`, neue Spalten mit Defaults). Vor dem Deployment: Key-Vault-Secret `zone-internal-secret` über Bicep erzeugen (zufällig, einmalig). Der Migrationsjob setzt die erweiterten Rechte. Die Funktion bleibt ausgeblendet, bis `PATIENT_ZONE_URL` und `PRACTICE_INTERNAL_URL` gesetzt sind. Rollback: vorherige Revisionen beider Apps; bereits online unterschriebene Sitzungen ohne PDF verarbeitet der Job nach dem erneuten Ausrollen.

## Open Questions

Diese Punkte gelten wie beschrieben, bis die Praxis etwas anderes entscheidet:
- **Einladung per E-Mail ohne vorherige Einwilligung** (D3): vorgeschlagen ja, nur mit Link und Praxisname. Alternative: nur QR-Code in der Praxis.
- **Personalien in der Zone:** nur prüfen und anmerken, nicht ändern.
- **Nach der Unterschrift ohne Heimprogramm:** Link wird ungültig, bis es ein Heimprogramm gibt (D4).
- **Text der Einladungs-E-Mail und der Aufgabenseite:** Entwurf im Mockup, von der Praxis zu bestätigen.
