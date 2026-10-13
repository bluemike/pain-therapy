# Tasks

## 1. Therapiekatalog (therapy-catalog)

- [ ] 1.1 Referenzdaten von der Praxis prüfen lassen (Farbdeutung, Schreibweisen, englische Namen); Rückmeldungen in `reference/` einarbeiten
- [x] 1.2 Prisma-Modelle `Region`, `OsteopressurePoint`, `RegionPoint`, `Exercise`, `RegionExercise`, `RollingTool` mit additiver Migration
- [x] 1.3 Referenzdateien nach `prisma/catalog/` übernehmen und `npm run catalog:sync` (Upsert, `retiredAt` statt Löschen) schreiben; Tests für zweimaliges Einspielen und zurückgezogenen Punkt
- [x] 1.4 Leseansicht "Katalog" mit Navigationseintrag und Reitern Bereiche, Punkte (Filter nach Bereich), Engpassdehnungen, Werkzeuge; "noch nicht erfasst" für fehlende Inhalte; Test, dass es keine Bearbeitungsfunktion gibt
- [x] 1.5 `catalog:sync` im Migrationsjob nach `prisma migrate deploy` ausführen (Dockerfile, deploy.yml, Bicep-Job-Kommando)

## 2. Behandlungen (treatments)

- [x] 2.1 Modell `Treatment` und zod-Schema (Pflichtfelder, Zeitpunkt nicht in der Zukunft, Schmerzgrad in 10er-Schritten); Unit-Tests
- [x] 2.2 Service: anlegen und ändern mit Audit; nur aktive Patienten mit gültigem Haftungsausschluss; Tests für beide Sperren
- [x] 2.3 Reiter "Behandlungen" als Standardansicht der Akte mit Liste, leerem Zustand und "Neue Behandlung"
- [x] 2.4 Formular "Neue Behandlung" und "Behandlung ändern" in Deutsch und Englisch
- [x] 2.5 Nach der ersten Konsultation: Bereich gesperrt (Formular und Server), Beginn nicht nach der ersten Konsultation; Tests

## 3. Konsultationen (consultations)

- [x] 3.1 Modelle `Consultation`, `ConsultationPoint`, `ConsultationExercise`, `ConsultationRolling` mit additiver Migration
- [x] 3.2 Service: anlegen mit Nummer pro Behandlung in einer Transaktion, ändern mit Änderungshistorie; Tests für Nummerierung und übernommene Diagnose
- [x] 3.3 Bogen aus dem Katalog aufbauen (Reihenfolge, Hervorhebung, Filter "nur Hauptpunkte", Punkt aus anderem Bereich) nach dem Mockup `mockups/konsultation-lws-bauch.html`
- [x] 3.4 Abschnitt "Schmerz" mit zwei Zeilen (vor und nach der Konsultation) und Segmentschalter für Empfindlichkeit und "Übung fällt", jeweils mit Abwählen; Tastatur- und Screenreader-Bedienung
- [x] 3.5 Konsultationsliste pro Behandlung mit Schmerz vorher und nachher

## 4. Fotos (clinical-photos)

- [x] 4.1 Modell `ClinicalPhoto` und privater Blob-Container `clinical-photos` (Bicep: Versionierung, Soft Delete); `what-if` zeigt nur den neuen Container (Befehl in docs/deployment.md, vor dem ersten Deployment manuell auszuführen)
- [x] 4.2 Kamera-Feld mit `capture="environment"`, Zeitstempel aus EXIF, Verkleinerung und Neukodierung im Browser, Vorschau mit Verwerfen, Fortschrittsanzeige
- [x] 4.3 Server: JPEG-Prüfung, Grenzen (5 MB, 10 pro Speichern), SHA-256, `bodySizeLimit` 25 MB; Tests mit lokalem Speicher
- [x] 4.4 Auslieferung über `/api/photos/{id}` und `/thumb` nur mit Anmeldung und Rolle, ohne Cache, mit Audit; Test ohne Anmeldung und Test, dass keine GPS-Daten gespeichert werden
- [x] 4.5 Foto entfernen (nur ausblenden) mit Eintrag in der Änderungshistorie

## 5. Gesamtprüfung

- [x] 5.1 End-to-End-Test: Behandlung LWS/Bauch mit Foto eröffnen, Konsultation mit Punkten, Übung, Rollmassage und Restschmerz erfassen, zweite Konsultation, Änderung in der Historie
- [x] 5.2 Zugänglichkeitsprüfung mit axe für Akte, Behandlungsformular, Konsultation und Katalog
- [ ] 5.3 Manuelle Prüfung von Kamera und Bogen auf iPad und iPhone
- [ ] 5.4 Abnahme mit der Praxis unter https://pain-therapy.ayanta.ch
