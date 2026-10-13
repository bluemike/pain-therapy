# Spec Delta

## ADDED Requirements

### Requirement: Behandlungen in der Akte
The system SHALL show the patient's treatments as the first section of the record and open the record on this section. The record header SHALL offer "Neue Behandlung" for active patients.

#### Scenario: Akte öffnen
- **WHEN** ein Benutzer eine Akte öffnet
- **THEN** sieht er zuerst den Bereich "Behandlungen"; Personalien, Anamnese, Dokumente und Verlauf bleiben über eigene Reiter erreichbar
