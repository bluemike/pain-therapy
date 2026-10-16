# Tasks

## 1. Patientenmodus entfernen (signing-zone-only)

- [x] 1.1 `src/app/sign/`, `src/lib/patient-mode.ts`, `PatientModeBar`, `SigningForm` der Praxis-App, `startSigning()`/`completeSigning()` und die Patientenmodus-Sperre in Middleware und Sitzung entfernen; Übersetzungen und Tests bereinigen (D2)
- [x] 1.2 "An Patient übergeben" in Erfolgsdialog, Akte, Cockpit und `OpeningBlocked` durch "Zur Unterschrift einladen" ersetzen
- [x] 1.3 Migration: offene `IPAD`-Sitzungen auf `ABORTED`; Anzeige "Kanal: iPad" für bestehende Dokumente bleibt
- [x] 1.4 Tests: keine Route unter `/sign`, Erfolgsdialog nur mit Einladung, bestehende iPad-Unterschrift gilt weiter

## 2. Zugang und Rechte

- [x] 2.1 `purposeActive` um `hasRecord` erweitern (Praxis-App und Zone); "Zugang zur Patienten-Zone senden" auch ohne Heimprogramm (D3); Unit-Tests
- [x] 2.2 `prisma/patient-zone-role.sql` nach D4 und D5 erweitern; Rechte-Test mit neuen erlaubten und weiterhin verweigerten Spalten
- [x] 2.3 Bicep: "Storage Blob Data Reader" der Zonen-Identität auf `signed-documents`

## 3. Dokumente (zone-documents)

- [x] 3.1 Seite `/dokumente` mit Gruppen "Haftungsausschluss" und "Übungsblätter", aktuell/ältere Versionen, "wird erstellt"
- [x] 3.2 Route `/dokumente/{documentNumber}` mit Prüfung auf die Patientin der Sitzung, Blob-Abruf, Kopfzeilen nach D4, Audit `document.viewedInZone`; Anzeige im Verlauf der Akte
- [x] 3.3 Tests: eigene Dokumente, fremde Nummer 404, ohne Sitzung kein PDF

## 4. Behandlungen (zone-record)

- [x] 4.1 Seiten `/behandlungen` und `/behandlungen/{id}` mit Konsultationen, Punkten, Übungen, Rollmassage, Heimprogramm, Link zum Übungsblatt und Schmerzverlauf (D5); de und en
- [x] 4.2 Reiter-Navigation, Umleitung ohne Heimprogramm, Vorrang der Unterschrift (D6)
- [x] 4.3 Tests: fremde Behandlung 404, keine Fotos, leere Liste

## 5. Nacherfassen (zone-exercise-backfill)

- [x] 5.1 Tagesauswahl mit Grenzen, Tagesansicht mit `progress()` für den gewählten Tag, Formular mit vorgesetztem Datum (D7)
- [x] 5.2 "Alle Übungen dieses Tages erledigt" für vergangene Tage; Einträge des ganzen Heimprogramms
- [x] 5.3 Kennzeichnung "nachgetragen am …" im Übungstagebuch der Akte
- [x] 5.4 Tests: gestern nachtragen, Grenze Konsultation, ganzer Tag, Kennzeichnung

## 6. Abschluss

- [x] 6.1 Playwright auf 390 px: Reiter, Behandlung, Dokument öffnen, gestern nachtragen; axe ohne Verstösse
- [x] 6.2 `docs/roadmap.md` und `docs/deployment.md` nachführen (Ausweg ohne Telefon, Fotos in der Zone als spätere Punkte)
- [ ] 6.3 Abnahme durch die Praxis auf iPhone und Android
