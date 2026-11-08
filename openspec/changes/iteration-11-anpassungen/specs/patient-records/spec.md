# Spec Delta

## MODIFIED Requirements

### Requirement: Patientenliste und Suche
The system SHALL list patients sorted by last name, show only active patients by default with a filter for inactive or all, and SHALL search by name or date of birth. The system SHALL NOT search by insurance number.

#### Scenario: Suche nach Name
- **WHEN** ein Benutzer "Müller" ins Suchfeld eingibt
- **THEN** listet das System die aktiven Patientinnen und Patienten, deren Vor- oder Nachname "Müller" enthält, mit Geburtsdatum

#### Scenario: Keine Suche nach Versicherungsnummer
- **WHEN** ein Benutzer einen Teil einer Versicherungsnummer ins Suchfeld eingibt
- **THEN** findet das System die Patientin nicht über ihre Versicherungsnummer

#### Scenario: Inaktive einblenden
- **WHEN** der Filter auf "inaktiv" gestellt wird
- **THEN** zeigt die Liste nur deaktivierte Patientinnen und Patienten
