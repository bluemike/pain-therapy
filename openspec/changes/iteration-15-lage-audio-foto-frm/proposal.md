# Proposal

## Why

Mike Franz hat am 21.11.2026 nach den Tests am iPad sechs Wünsche formuliert. Er hat dazu die Behandlungslage für alle 72 Osteopressur-Punkte geliefert (`reference/behandlungslage-punkte.csv`).

1. Die Behandlungslage (zum Beispiel «SL» für Seitenlage) gehört in den Stamm, zu jedem Punkt. In der Sitzung soll sie als Spalte vor der Beschreibung stehen: als Kürzel, die volle Bezeichnung beim Darüberfahren.
2. Die Sitzung soll standardmässig alle Osteopressur-Punkte zeigen. Die Umschaltung auf Sitzung 1, 2 oder 3 bleibt.
3. «Anhören» soll es in drei Sprachen geben: Hochdeutsch, Mundart und Englisch. Abspielbar ist es bei der Patientin und in der Praxis. Bei Sprache Deutsch lässt sich im Profil die Audiosprache wählen.
4. Bei der Verordnung soll die Therapeutin das Übungsblatt kurz ansehen können (Vorschau).
5. Fotos sollen auch mit dem Smartphone gehen: ein QR-Code führt ohne Anmeldung auf eine Foto-Seite. Dort nimmt das Smartphone mit seiner Kamera auf und übermittelt die Fotos direkt.
6. Die Faszien-Rollmassage soll verordnet werden können. Dazu ist ein Vorschlag erbeten.

## What Changes

- **Behandlungslage im Stamm:**
  - Neue Referenzliste mit sechs Lagen: SL Seitenlage, RL Rückenlage, BL Bauchlage, S Sitzen, HSL Halbseitenlage, SSL Stabile Seitenlage.
  - Jeder Osteopressur-Punkt hat eine Lage oder eine Kombination aus zwei Lagen («BL/HSL»).
  - Der Katalog zeigt die Lage.
- **Sitzung:**
  - Die Punkte-Tabelle bekommt vor «Muskel-Ansatz» eine Spalte «Lage» mit dem Kürzel. Beim Darüberfahren oder Antippen erscheint die volle Bezeichnung, für Screenreader ausgeschrieben.
  - Der Punkte-Filter steht beim Öffnen immer auf «Alle». **BREAKING** für die bisherige Vorauswahl nach Sitzungsnummer.
- **Audio in drei Sprachen:**
  - Zu jeder Aufnahme (FRM, Standardübung, Varianten) gibt es neben Hochdeutsch auch eine Mundart- und eine englische Fassung.
  - Die Praxis-App spielt die Sprache aus «Mein Profil». Bei Deutsch wählt die Therapeutin dort Hochdeutsch oder Mundart.
  - Die Patienten-Zone spielt die Sprache der Patientin. Bei Deutsch gilt die Audiosprache im Patientendossier, Standard Hochdeutsch. Die Patientin kann sie in der Zone umstellen.
- **Vorschau bei der Verordnung:** Jede Übung im Heimprogramm bekommt den Knopf «Blatt ansehen». Er öffnet das Übungsblatt im Popup, wie es in der Liste der Übungen schon geht.
- **Fotos mit dem Smartphone:**
  - Im Fotofeld gibt es «Mit Smartphone aufnehmen». Das öffnet einen QR-Code mit einem Einmal-Link, 15 Minuten gültig.
  - Die Foto-Seite auf dem Smartphone braucht keine Anmeldung. Sie kann nur hochladen und zeigt keine Patientendaten.
  - Die Fotos erscheinen nach wenigen Sekunden im Formular auf dem iPad. Gespeichert werden sie erst mit dem Formular.
- **Faszien-Rollmassage verordnen:**
  - Pro verordneter Übung wählt die Therapeutin die Teile: «FRM + Dehnung» (Standard, wie heute), «nur Dehnung» oder «nur FRM».
  - Übungsblatt, Patienten-Zone, Zeitbedarf und Audio folgen dieser Wahl.

## Capabilities

### New Capabilities
- `treatment-position`: Behandlungslage der Osteopressur-Punkte
- `photo-handoff`: Fotos mit dem Smartphone über einen QR-Code

### Modified Capabilities
- `session-form`: Spalte «Lage», Filter standardmässig «Alle»
- `exercise-audio`: drei Sprachen, Wahl der Audiosprache
- `home-program`: Vorschau des Übungsblatts, Teile pro Verordnung

## Impact

- **Daten:**
  - `OsteopressurePoint.position`.
  - Neue Tabelle `TreatmentPosition`.
  - `User.audioLanguage` und `Patient.audioLanguage`.
  - `ConsultationExercise.parts` und `HomePrescription.parts`.
  - Neue Tabelle `PhotoHandoff`, und `ClinicalPhoto` bekommt den Zustand «wartet auf Speichern».
- **Medien:** Im privaten Container `exercise-media` kommen pro Aufnahme zwei MP3 dazu (`<name>.gsw.mp3`, `<name>.en.mp3`), bei 146 Aufnahmen also 292 Dateien. Dazu kommen die Texte in Mundart und Englisch (`segments-content.gsw.json`, `segments-content.en.json`). Nichts davon liegt im Repository.
- **Infrastruktur:** Die öffentliche Route `/foto/*` der Praxis-App ist von der Anmeldung ausgenommen und pro IP begrenzt. Ein Aufräum-Job löscht nicht gespeicherte Smartphone-Fotos nach 24 Stunden.
- **Externe Dienste:**
  - Die englischen Aufnahmen entstehen mit Azure AI Speech (F0, vorhanden).
  - Für Mundart gibt es bei Azure keine Stimme. Vorschlag siehe design.md D3, Entscheid durch Mike.
