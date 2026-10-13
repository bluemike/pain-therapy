# Spec Delta

## Purpose

Ermöglicht Fotos zu Behandlungen und Konsultationen, direkt mit der Kamera des Geräts aufgenommen, mit Zeitstempel und geschützt wie alle Gesundheitsdaten.

## ADDED Requirements

### Requirement: Fotos aufnehmen
The system SHALL let users add any number of photos to a treatment and to a consultation, taken directly with the camera of the device or chosen from the device's photos. Each photo SHALL show a preview with its timestamp and MAY be discarded before saving.

#### Scenario: Foto mit dem iPad aufnehmen
- **WHEN** die Therapeutin auf dem iPad "Foto aufnehmen" tippt
- **THEN** öffnet sich die Kamera, und das aufgenommene Foto erscheint als Vorschau mit Datum und Uhrzeit der Aufnahme

#### Scenario: Foto vor dem Speichern verwerfen
- **WHEN** die Therapeutin ein unscharfes Foto in der Vorschau entfernt
- **THEN** wird es nicht gespeichert

#### Scenario: Ohne Fotos
- **WHEN** die Therapeutin eine Behandlung oder Konsultation ohne Foto speichert
- **THEN** speichert das System sie ohne Fehlermeldung

### Requirement: Zeitstempel
The system SHALL store for each photo the time it was taken, taken from the photo when available and otherwise the time it was added, and the time and user of the upload.

#### Scenario: Zeitstempel anzeigen
- **WHEN** ein Benutzer die Fotos einer Konsultation ansieht
- **THEN** steht unter jedem Foto Datum und Uhrzeit der Aufnahme

### Requirement: Datenschutz der Fotos
The system SHALL remove location and other metadata from photos before storing them, store them only in Switzerland North and MUST NOT deliver a photo without a valid sign-in with a role. Each view of a full-size photo SHALL be logged.

#### Scenario: Zugriff ohne Anmeldung
- **WHEN** jemand die Adresse eines Fotos ohne gültige Anmeldung aufruft
- **THEN** liefert das System das Foto nicht aus

#### Scenario: Standort entfernt
- **WHEN** ein Foto mit GPS-Daten gespeichert wird
- **THEN** enthält die gespeicherte Datei keine Standortdaten

### Requirement: Foto entfernen
The system SHALL let users remove a saved photo from view. The file SHALL be kept and the removal SHALL appear in the record's history.

#### Scenario: Foto entfernen
- **WHEN** die Therapeutin ein gespeichertes Foto entfernt
- **THEN** wird es nicht mehr angezeigt, und die Änderungshistorie vermerkt das Entfernen
