# Tasks

## 1. Datenmodell und Basisdaten

- [x] 1.1 Migration: Abbruch, falls `Treatment` nicht leer ist; `BodyArea`, `Region.bodyAreaId/code`, `bodyAreaId` statt `group`, `ExerciseVariant`, `ExerciseSheet.rollingTools/standardAids`, `Treatment.side`, `ConsultationExercise.variant`, `HomePrescription.timesPerDay/weekdays`; `ConsultationRolling`, `Repetition`, `intensity`, `steps`, `variants` entfernen (D1 bis D7, D11)
- [x] 1.2 `User.displayName/title`, Vorbelegung Mike und Chrissie (D9)
- [x] 1.3 Katalogdateien `body-areas.json`, `regions.json` (Bereich, Nummer), `exercise-variants.json`; `catalog:sync` mit `segments-content.json`; Unit-Tests

## 2. Übungsteile und Medien

- [x] 2.1 Medien-Route: `frm`, `std`, `var`, `frm-audio`, `std-audio`, `v<n>-audio` (D2); Unit-Tests
- [x] 2.2 Zeit einer Ausführung aus FRM und EPD (Standard/Variante) in `@pain-therapy/shared` (D2, D7); Unit-Tests
- [x] 2.3 L&B Basisdaten: Bereiche als Baum, Übungsseite mit FRM, Standardübung und Varianten, Link zu den Werkzeugen

## 3. Sitzung

- [x] 3.1 Körperseite bei der Behandlung, fest nach der ersten Sitzung (D4)
- [x] 3.2 Sitzungsformular in neuer Reihenfolge, ohne Faszien-Rollmassage-Block (D3)
- [x] 3.3 Osteopressur: Seite aktivieren/sperren, automatisch setzen, Auswahl "Alle/Sitzung 1–3" (D4, D5)
- [x] 3.4 Übungen: Liste nach Bereich, andere hinzufügen, EPD Standard/Variante, Pflicht "Übung fällt" (D6)

## 4. Selbstausführung, PDF, Patienten-Zone

- [x] 4.1 Selbstausführung mit pro Tag und Wochentagen, Zeitbedarf (D7)
- [x] 4.2 Übungsblatt-PDF mit FRM- und EPD-Band (D7)
- [x] 4.3 Patienten-Zone: Übungen, Tagebuch, "heute offen" nach Wochentagen; Einhaltung und Cockpit (D8); Tests

## 5. Profil und Begriffe

- [x] 5.1 "Mein Profil", Begrüssung einmal nach dem Anmelden, Berufsbezeichnung in Dokumenten (D9)
- [x] 5.2 Begriffe DE/EN in App, PDF, E-Mails, Zone, Verlauf; Test gegen alte Begriffe (D10)
- [ ] 5.3 End-to-End-Tests anpassen und ergänzen (Sitzung, Verordnen, Wochentage, Zone)

## 6. Betrieb und Abnahme

- [x] 6.1 `docs/deployment.md` (Iteration 8), `docs/roadmap.md`
- [ ] 6.2 Bildbänder, Texte und Audio aus OneDrive `analyse-v2` in `exercise-media` hochladen (OK von Mike Franz)
- [ ] 6.3 Patientendaten nach bestehendem Ablauf löschen, unmittelbar vor dem Deployment (letztes OK im Thread)
- [ ] 6.4 Deployment und Abnahme auf dem iPad
