# Tasks

## 1. Datenmodell, Rechte und gemeinsamer Code

- [ ] 1.1 Additive Migration: `SignatureChannel` und `SignatureSession.channel`, `zoneSessionId`, `noteResolvedAt`, `noteResolvedBy`; `AccessLinkPurpose` und `AccessLinkDelivery.purpose` (D6)
- [ ] 1.2 `packages/shared`: `signaturePending()`, `signature.ts`, `parseBlocks()`, `signingSchema` und `recordSignature()` mit Prisma-Client als Parameter; in der Praxis-App re-exportiert, bestehende Tests grün (D10)
- [ ] 1.3 `consentStatusOf()` und `openingBlocker()` auf die jüngste `SIGNED`-Sitzung umstellen (D2); Unit-Test: Unterschrift ohne Dokument gilt
- [ ] 1.4 `prisma/patient-zone-role.sql` nach D8 erweitern; `tests/unit/patient-zone-role.test.ts` mit der neuen Liste, Dokumente, Anamnese und Unterschriftsbilder weiterhin nicht lesbar

## 2. Einladung in der Praxis-App (zone-consent-invitation)

- [ ] 2.1 `linkState()`/`sessionLinkOk()` mit `purposeActive = homeProgramActive || signaturePending` (D4); Unit-Tests für neue Patientin ohne Heimprogramm und nach der Unterschrift
- [ ] 2.2 "Zur Unterschrift einladen" in der Akte und im Erfolgsdialog nach dem Erfassen: Dialog mit "Per E-Mail", "QR-Code anzeigen", "Zugangsblatt drucken"; nur Therapist und Admin, nur bei ausstehender Unterschrift und gesetzter `PATIENT_ZONE_URL`
- [ ] 2.3 Einladungs-E-Mail (de und en) ohne Anhang, auch ohne E-Mail-Einwilligung (D3, nach Entscheid der Praxis), mit Wiederholungen und Zustellstatus; `purpose = SIGNATURE`
- [ ] 2.4 Statuszeile der Unterschrift in der Akte, Hinweisbox für die Anmerkung mit "Erledigt", Spalte "Kanal" und "wird erstellt …" unter Dokumente (D9)
- [ ] 2.5 Liste "Unterschrift ausstehend" im Cockpit mit Stand der Einladung und "Einladen"
- [ ] 2.6 Audit-Ereignisse für Einladung, Zustellung, Link geöffnet, Unterschrift in der Zone und Anmerkung erledigt; Anzeige im Verlauf

## 3. Unterschrift in der Patienten-Zone (zone-consent-signing)

- [ ] 3.1 Vorrang der Unterschrift: Umleitung von `/` auf `/unterschrift`, Übungen, Einträge und `/media` gesperrt, solange die Unterschrift aussteht (D5)
- [ ] 3.2 Seite "Aufgabe" mit Begrüssung und Erklärung; Formular mit Personalien (schreibgeschützt) und Anmerkung, Text der aktuellen Version, Lesen bis zum Ende, Einwilligungen, Unterschriftsfeld für das Telefon; Dankesseite mit und ohne Heimprogramm; de und en nach dem Mockup
- [ ] 3.3 Sitzung des Formulars öffnen oder wiederverwenden, Abschluss mit Schutz gegen doppeltes Absenden, Prüfung der Textversion beim Abschluss (D5)
- [ ] 3.4 Playwright: ganzer Ablauf auf 390 px (Link, Geburtsdatum, Aufgabe, Formular, Unterschrift, Dank), axe ohne Verstösse, Scrollen zeichnet nicht im Feld

## 4. PDF und Zustellung (zone-consent-signing)

- [ ] 4.1 `completeSigning()` in `recordSignature()` und idempotentes `finalizeSignature()` mit Advisory-Lock teilen; iPad-Ablauf unverändert, bestehende Tests grün (D7)
- [ ] 4.2 Interne Routen `POST /api/internal/signatures/{sid}/finalize` und `/finalize-pending` mit HMAC-Prüfung, von der Entra-Middleware ausgenommen; Aufruf aus der Zone nach dem Abschluss
- [ ] 4.3 PDF-Zeile für den Kanal Zone mit Bestätigungszeitpunkt; Ort "Online (Patienten-Zone)"
- [ ] 4.4 Tests: Zonen-Unterschrift erzeugt genau ein PDF bei doppeltem Aufruf; ohne Einwilligung keine E-Mail; Job verarbeitet liegengebliebene Sitzungen

## 5. Betrieb, Dokumentation und Abnahme

- [ ] 5.1 Bicep: Secret `zone-internal-secret`, Lesezugriff der Zonen-Identität darauf, Variablen `ZONE_INTERNAL_SECRET` und `PRACTICE_INTERNAL_URL`, Job `caj-pain-therapy-finalize` (alle 5 Minuten) mit `scripts/finalize-pending.mjs` (D11)
- [ ] 5.2 `docs/deployment.md` und `docs/roadmap.md` nachführen (Iteration 5, Anamnese-Fragebogen und Row-Level-Security als spätere Punkte)
- [ ] 5.3 Texte der Einladungs-E-Mail, der Aufgabenseite und der Dankesseite von der Praxis bestätigen lassen
- [ ] 5.4 Abnahme durch die Praxis: Einladung per E-Mail und per QR-Code, Unterschrift auf iPhone und Android, PDF in der Akte und per E-Mail
