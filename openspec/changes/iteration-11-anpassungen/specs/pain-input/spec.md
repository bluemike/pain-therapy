# Spec Delta

## ADDED Requirements

### Requirement: Schmerz in Prozent mit Schieberegler
The system SHALL capture every pain level in percent (Schmerzgrad zu Beginn, Schmerz vorher, Schmerz nachher) with a slider from 0 to 100 % in steps of 10 %, operable by touch and keyboard. Without a value the slider SHALL read «nicht erfasst»; an optional value SHALL be clearable with «Zurücksetzen».

#### Scenario: Wert setzen
- **WHEN** die Therapeutin den Regler «Schmerz vorher» auf 60 schiebt und speichert
- **THEN** speichert das System 60 % und zeigt «60 %» neben dem Regler

#### Scenario: Wert aufheben
- **WHEN** die Therapeutin bei «Schmerz nachher» «Zurücksetzen» tippt
- **THEN** zeigt der Regler «nicht erfasst», und die Sitzung wird ohne Wert gespeichert
