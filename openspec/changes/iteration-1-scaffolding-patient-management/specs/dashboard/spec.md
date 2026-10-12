# Spec Delta

## Purpose

Bietet nach der Anmeldung eine Startseite, die heute begrüsst und zu den wichtigsten Aktionen führt und später um weitere Inhalte ergänzt wird.

## ADDED Requirements

### Requirement: Startseite nach der Anmeldung
The system SHALL show the dashboard after sign-in, greeting the user by name.

#### Scenario: Begrüssung
- **WHEN** sich Mike Franz anmeldet
- **THEN** zeigt das Dashboard eine Begrüssung mit seinem Namen

### Requirement: Schnellaktionen
The system SHALL offer on the dashboard the actions "Neue Patientin / neuer Patient" and a patient search.

#### Scenario: Patient suchen
- **WHEN** ein Benutzer auf dem Dashboard einen Namen ins Suchfeld eingibt
- **THEN** zeigt das System die passenden aktiven Patientinnen und Patienten

### Requirement: Kennzahlen und offene Unterschriften
The system SHALL show the number of active patients, the patients created or changed most recently and the patients whose disclaimer is not yet signed.

#### Scenario: Offene Unterschrift
- **WHEN** ein Patient angelegt, der Haftungsausschluss aber noch nicht unterschrieben wurde
- **THEN** erscheint er auf dem Dashboard unter "Unterschrift ausstehend" mit einem Link zum Unterschriftsablauf

### Requirement: Erweiterbarkeit
The system SHALL build the dashboard from independent tiles, so later iterations can add tiles without changing existing ones.

#### Scenario: Leeres System
- **WHEN** noch keine Patientinnen und Patienten erfasst sind
- **THEN** zeigt das Dashboard Kennzahlen mit 0 und einen Hinweis zum Anlegen der ersten Patientin
