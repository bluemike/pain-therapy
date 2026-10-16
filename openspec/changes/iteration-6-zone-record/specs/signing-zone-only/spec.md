# Spec Delta

## Purpose

Entfernt den Patientenmodus auf dem iPad ("An Patient übergeben"). Der Haftungsausschluss wird nur noch in der Patienten-Zone unterschrieben.

## ADDED Requirements

### Requirement: Kein Patientenmodus mehr
The system SHALL NOT offer the patient mode on a practice device. The actions "An Patient übergeben", the pages of the patient mode and the re-authentication for leaving it MUST be removed from the practice app. Opening an old link of the patient mode SHALL show the page "nicht gefunden" of the practice app.

#### Scenario: Neue Patientin erfasst
- **WHEN** die Therapeutin eine neue Patientin gespeichert hat
- **THEN** bietet der Erfolgsdialog nur "Zur Unterschrift einladen" an und keine Übergabe an ein Gerät

#### Scenario: Alter Link des Patientenmodus
- **WHEN** jemand eine frühere Adresse des Patientenmodus aufruft
- **THEN** zeigt die Praxis-App die Seite "nicht gefunden" und startet keine Unterschrift

### Requirement: Unterschrift nur in der Patienten-Zone
The system SHALL let a patient sign the liability waiver only in the patient zone, after an invitation by email, QR code or access sheet. Wherever the practice app pointed to the patient mode (record, cockpit, notice that blocks a new treatment), it SHALL offer "Zur Unterschrift einladen" instead.

#### Scenario: Neue Behandlung ohne Unterschrift
- **WHEN** die Therapeutin bei einer Patientin ohne gültige Unterschrift eine Behandlung eröffnen will
- **THEN** erklärt der Hinweis, dass zuerst die Unterschrift nötig ist, und bietet "Zur Unterschrift einladen" an

#### Scenario: Neue Textversion
- **WHEN** eine neue Version des Haftungsausschlusses gilt
- **THEN** zeigen Akte und Cockpit "Unterschrift ausstehend" mit "Zur Unterschrift einladen", ohne Übergabe an ein Gerät

### Requirement: Bestehende iPad-Unterschriften
The system SHALL keep all signatures and PDFs that were signed in the patient mode valid and unchanged. The record SHALL show their channel as "iPad".

#### Scenario: Ältere Unterschrift
- **WHEN** eine Patientin die gültige Version früher auf dem iPad unterschrieben hat
- **THEN** gilt ihre Unterschrift weiter, und unter Dokumente steht "Kanal: iPad"
