# Spec Delta

## ADDED Requirements

### Requirement: Vorschau des Übungsblatts bei der Verordnung
The system SHALL offer «Blatt ansehen» on every exercise of the home program in the session, opening the exercise sheet in a popup that can be zoomed and closed with Esc.

#### Scenario: Blatt ansehen
- **WHEN** die Therapeutin im Heimprogramm bei 4C «Blatt ansehen» tippt
- **THEN** zeigt das System das Übungsblatt 4C im Popup, und das Formular bleibt unverändert

### Requirement: Teile einer Verordnung
The system SHALL let the therapist choose per prescribed exercise which parts are prescribed: «FRM + Dehnung» (default), «nur Dehnung» or «nur FRM». With «nur FRM» the choice of the stretch and «Übung fällt» SHALL not be required, and the rolling tools of the sheet SHALL be shown. Time, exercise sheet («Nur verordnete Teile»), patient zone and audio SHALL follow the chosen parts.

#### Scenario: Nur FRM
- **WHEN** die Therapeutin bei 2A «nur FRM» wählt und die Sitzung speichert
- **THEN** zeigt die Patienten-Zone bei 2A nur die Faszien-Rollmassage mit Bild, Text und Aufnahme, und der Zeitbedarf zählt nur die FRM

#### Scenario: Bisherige Verordnungen
- **WHEN** eine vor dieser Änderung gespeicherte Verordnung angezeigt wird
- **THEN** gilt sie als «FRM + Dehnung»
