# Spec Delta

## ADDED Requirements

### Requirement: Praxis anlegen und einladen
The system SHALL let the Plattform-Admin, signed in with the separate account admin@pain-therapy.online, create and activate a Praxis with name, address and contact e-mail and invite its first Praxis-Admin by e-mail. A Praxis-Admin SHALL invite further members with role Therapeut/in or Praxis-Admin. Invitations SHALL be valid for 7 days and usable once.

#### Scenario: Neue Praxis
- **WHEN** Mike die Praxis «Physio Muster» anlegt und anna@pain-therapy.online als Praxis-Admin einlädt
- **THEN** erhält Anna eine E-Mail mit einem Einladungslink und die Praxis erscheint in der Plattform-Übersicht als «Einladung offen»

#### Scenario: Abgelaufene Einladung
- **WHEN** eine Einladung nach 8 Tagen geöffnet wird
- **THEN** zeigt das System «Einladung abgelaufen» und die Praxis-Admin kann sie erneut senden

### Requirement: Team verwalten
A Praxis SHALL have one or more members without a fixed upper limit. The system SHALL let a Praxis-Admin list members with role and last sign-in, change roles, reset sign-in factors and deactivate members. A Praxis SHALL always keep at least one active Praxis-Admin.

#### Scenario: Mehrere Therapeutinnen
- **WHEN** die Praxis-Admin von «Physio Muster» drei Therapeutinnen einlädt
- **THEN** arbeiten alle vier mit denselben Patientinnen ihrer Praxis

#### Scenario: Letzte Praxis-Admin
- **WHEN** die einzige Praxis-Admin sich selbst die Rolle entziehen will
- **THEN** lehnt das System ab und erklärt, dass eine andere Praxis-Admin bestimmt werden muss

### Requirement: Praxis sperren, exportieren und löschen
The system SHALL let the Plattform-Admin suspend and reactivate a Praxis, SHALL let Praxis-Admin and Plattform-Admin export all data of a Praxis as a ZIP (PDFs, photos, structured data), and SHALL let the Plattform-Admin delete a Praxis only after an export and a second confirmation. Signed documents under retention SHALL be marked for deletion and removed when their retention ends.

#### Scenario: Sperren
- **WHEN** Mike die Praxis «Physio Muster» sperrt
- **THEN** können sich ihre Mitglieder nicht mehr anmelden und ihre Zonen-Links zeigen «Zurzeit nicht verfügbar», die Daten bleiben erhalten

#### Scenario: Export
- **WHEN** die Praxis-Admin «Alle Daten exportieren» wählt
- **THEN** erhält sie nach Fertigstellung einen 24 Stunden gültigen Download-Link per E-Mail

#### Scenario: Löschen ohne Export
- **WHEN** Mike eine Praxis löschen will, für die kein Export der letzten 7 Tage existiert
- **THEN** lehnt das System ab
