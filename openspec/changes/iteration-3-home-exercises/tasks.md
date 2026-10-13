# Tasks

## 1. Übungsbibliothek (exercise-library)

- [x] 1.1 Erste Digitalisierung der 27 Blätter (Hauptbild, Blattbild, Texte) nach OneDrive `pain-therapy/exercises/digitalisiert/`; Übersicht der Hauptbilder geprüft
- [x] 1.2 Erlaubnis für die Abgabe der Bilder an Patientinnen geklärt (bestätigt von Mike Franz am 13.10.2026)
- [ ] 1.3 Dauer für 1C und 2C mit der Praxis festlegen und in `reference/exercise-sheets.json` eintragen (Rollmassage 120 s ist festgelegt)
- [ ] 1.4 Importskript `scripts/import-exercise-sheets.py` ins Repository (ohne Inhalte); Upload nach `exercise-media` in docs/deployment.md beschreiben
- [ ] 1.5 Bicep: privater Container `exercise-media`; `what-if` zeigt nur den neuen Container
- [ ] 1.6 Modell `ExerciseSheet` und `catalog:sync` erweitern (Inhalte aus dem Container, Zeitbedarf aus dem Repository); Tests für fehlende Inhalte
- [ ] 1.7 Katalog: Detailansicht pro Übung mit Hauptbild, Abschnitten, Zeitbedarf und Blatt; Auslieferung der Bilder nur mit Anmeldung; Test ohne Anmeldung

## 2. Selbstausführung (home-program)

- [ ] 2.1 Modell `HomePrescription` mit Enum der Wiederholungen; additive Migration
- [ ] 2.2 Berechnung des Zeitbedarfs pro Woche und Tag mit den zehn Wiederholungen und fehlenden Werten; Unit-Tests mit den Szenarien der Spec
- [ ] 2.3 Block "Selbstausführung" in der Konsultation, gekoppelt an "verordnet", mit "Übung hinzufügen", Segmentschaltern und Gesamtzeit nach dem Mockup
- [ ] 2.4 Änderungshistorie für Verordnungen

## 3. Übungsblatt (exercise-handout)

- [ ] 3.1 PDF mit Deckblatt und Blattbildern mit eingedruckter Verordnung in Deutsch und Englisch; Test des Textinhalts
- [ ] 3.2 Ablage mit Dokumentnummer und Versionen in der Akte unter "Dokumente"
- [ ] 3.3 Abschluss der Konsultation mit "Senden" (Einwilligung und Adresse vorhanden) oder "Drucken"; Zustellstatus und Druckvermerk; Tests für beide Wege mit gemocktem Graph

## 4. Gesamtprüfung

- [ ] 4.1 End-to-End-Test: Übungen verordnen, Wiederholungen wählen, Zeitbedarf prüfen, Übungsblatt senden, Dokument in der Akte
- [ ] 4.2 Zugänglichkeitsprüfung mit axe für Selbstausführung, Abschluss und Katalog-Übung
- [ ] 4.3 Abnahme mit der Praxis auf dem iPad, inklusive Ausdruck
