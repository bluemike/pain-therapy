# Spec Delta

## Purpose

Zeigt bei den Engpassdehnungen ein Bild der Übung, das sich gross öffnen lässt, und spielt eine gesprochene Fassung des Übungsblatts ab.

## ADDED Requirements

### Requirement: Bild der Übung gross öffnen
The system SHALL show, for every exercise in the section "Engpassdehnungen" of the consultation form and in the catalog tab "Engpassdehnungen", a small main image. Activating it SHALL open the whole main image in a popup that closes with "Schliessen", Escape or a click outside. While the image is not uploaded, the system SHALL show "Bild nicht verfügbar".

#### Scenario: Bild öffnen
- **WHEN** die Therapeutin im Behandlungsbogen auf das kleine Bild der Übung 2A klickt
- **THEN** öffnet sich ein Fenster mit dem ganzen Hauptbild von 2A und dem Namen der Übung

#### Scenario: Fenster schliessen
- **WHEN** sie "Schliessen" wählt, Escape drückt oder neben das Bild klickt
- **THEN** schliesst sich das Fenster und der Behandlungsbogen bleibt unverändert

### Requirement: Übung anhören
The system SHALL offer "Anhören" next to the image of every exercise in both lists and on the catalog page of an exercise. It SHALL play the spoken sheet of that exercise; activating it again SHALL stop it. Starting one exercise SHALL stop any other one that is playing. While no recording is uploaded, the system SHALL show "Audio nicht verfügbar".

#### Scenario: Abspielen und stoppen
- **WHEN** die Therapeutin bei 2A "Anhören" wählt
- **THEN** spielt die Aufnahme von 2A, die Schaltfläche zeigt "Stopp", und ein weiterer Klick stoppt die Aufnahme

#### Scenario: Aufnahme fehlt
- **WHEN** für eine Übung noch keine Aufnahme hochgeladen ist und die Therapeutin "Anhören" wählt
- **THEN** steht dort "Audio nicht verfügbar"

### Requirement: Inhalt der Aufnahme
The recording SHALL be generated once from the digitised texts of the sheet, in the order title, "Faszien-Rollmassage", the steps of the stretch and "Varianten", skipping empty sections, with a Swiss neural German voice. Only the texts of the sheets SHALL be sent to the speech service, never patient data.

#### Scenario: Erzeugen
- **WHEN** eine Administratorin `npm run media:audio` mit dem Ordner der Texte startet
- **THEN** entsteht pro Übung mit Text eine MP3 mit dem Namen des Hauptbilds (`2A.mp3`), vorhandene Dateien bleiben ohne `--force` unverändert

### Requirement: Schutz der Aufnahmen
The system SHALL deliver recordings only to signed-in users with a role, like the images, from the private container `exercise-media`, and SHALL answer byte-range requests so that Safari can play them.

#### Scenario: Ohne Anmeldung
- **WHEN** jemand ohne Anmeldung `/api/exercise-media/2A/audio` abruft
- **THEN** antwortet die App mit 403 und liefert keine Aufnahme

#### Scenario: Safari
- **WHEN** Safari einen Byte-Bereich der Aufnahme anfragt
- **THEN** antwortet die App mit 206 und genau diesem Bereich
