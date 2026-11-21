# Spec Delta

## ADDED Requirements

### Requirement: Spalte «Lage» in der Punkte-Tabelle
The system SHALL show a column «Lage» before the muscle attachment in the osteopressure table of the session, with the abbreviation of the treatment position. The full name SHALL appear on hover and on tap, and SHALL be available to screen readers.

#### Scenario: Kürzel mit voller Bezeichnung
- **WHEN** die Therapeutin in der Sitzung auf das Kürzel «HSL/RL» bei 4.3 tippt
- **THEN** zeigt das System «Halbseitenlage / Rückenlage»

## MODIFIED Requirements

### Requirement: Punkte-Filter nach Sitzung
The system SHALL open the osteopressure table of every session with the filter «Alle». The filter SHALL still offer «Sitzung 1 · dunkelrot», «Sitzung 2 · rot» and «Sitzung 3 · schwarz»; points already recorded SHALL stay visible under any filter.

#### Scenario: Zweite Sitzung
- **WHEN** die Therapeutin die zweite Sitzung einer Behandlung öffnet
- **THEN** steht der Filter auf «Alle», und alle Punkte des Schmerzbereichs sind sichtbar

#### Scenario: Umschalten
- **WHEN** sie den Filter auf «Sitzung 1 · dunkelrot» stellt
- **THEN** zeigt die Tabelle die Hauptpunkte und die bereits erfassten Punkte
