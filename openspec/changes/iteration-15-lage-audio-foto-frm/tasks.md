# Tasks

## 1. Behandlungslage

- [x] 1.1 `treatment-positions.json` (6 Grundlagen de/en) und `position` in `osteopressure-points.json` aus `reference/behandlungslage-punkte.csv`
- [x] 1.2 Migration `TreatmentPosition`, `OsteopressurePoint.position`; `sync.mjs` prüft die Kürzel
- [x] 1.3 Sitzung: Spalte «Lage» vor «Muskel-Ansatz» mit `abbr` und Popover; Katalog: Lage ausgeschrieben

## 2. Punkte-Filter

- [x] 2.1 Filter beim Öffnen immer «Alle»; Tests anpassen

## 3. Audio in drei Sprachen

- [ ] 3.1 Texte Englisch (übersetzt, Mike liest gegen) und Mundart (umgeschrieben, Chrissie liest gegen) in `exercise-media`
- [ ] 3.2 Englische Aufnahmen mit Azure AI Speech F0 (`npm run media:audio-parts -- segments-content.en.json --lang en`)
- [ ] 3.3 Mundart-Aufnahmen mit Google Gemini TTS erzeugen (Entscheid D3: A, `npm run media:audio-parts -- segments-content.gsw.json --lang gsw`); Chrissie hört alle Dateien ab
- [x] 3.4 `User.audioLanguage`, `Patient.audioLanguage`; Wahl in «Mein Profil», im Dossier und in der Zone
- [x] 3.5 Routen mit `lang`, Rückfall auf Hochdeutsch mit Hinweis

## 4. Vorschau bei der Verordnung

- [x] 4.1 «Blatt ansehen» im Heimprogramm mit `ExercisePreview`

## 5. Fotos mit dem Smartphone

- [x] 5.1 `PhotoHandoff`, Status «wartet auf Speichern» bei `ClinicalPhoto`, Aufräum-Job nach 24 h
- [x] 5.2 QR-Code, Prüfcode und Restzeit im Fotofeld; «Beenden»
- [x] 5.3 Öffentliche Route `/foto/<token>` mit Kamera, Verkleinern, Upload; Begrenzung pro IP
- [x] 5.4 Formular fragt neue Fotos ab und übernimmt sie beim Speichern; Protokoll

## 6. Faszien-Rollmassage verordnen

- [x] 6.1 `parts` (FRM_EPD, EPD, FRM) an `ConsultationExercise` und `HomePrescription`, Standard FRM_EPD
- [x] 6.2 Auswahl der Teile in der Sitzung; Werkzeuge bei «nur FRM»
- [x] 6.3 Zeitbedarf, Übungsblatt, Zone und Audio folgen den Teilen

## 7. Tests und Abnahme

- [ ] 7.1 Unit- und E2E-Tests, Axe ohne Befund
- [ ] 7.2 Abnahme am iPad und Smartphone durch die Praxis
