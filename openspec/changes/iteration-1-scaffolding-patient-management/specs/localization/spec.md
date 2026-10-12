# Spec Delta

## Purpose

Macht die App von Anfang an auf Deutsch und Englisch verfügbar, für die Benutzer der Praxis ebenso wie für Patientinnen und Patienten im Unterschriftsablauf.

## ADDED Requirements

### Requirement: Sprachen Deutsch und Englisch
The system SHALL provide every text of the user interface, every validation message and every generated document in German and English. No user-visible text SHALL be hard-coded outside the translation resources.

#### Scenario: Fehlende Übersetzung
- **WHEN** ein Text nur in einer Sprache hinterlegt ist
- **THEN** schlägt die automatische Prüfung im Build fehl

### Requirement: Sprache des Benutzers
The system SHALL show the interface in the browser language at first sign-in when it is German or English, otherwise in German, and SHALL let each user switch the language and remember the choice.

#### Scenario: Sprache wechseln
- **WHEN** ein Benutzer in der Kopfzeile von "DE" auf "EN" wechselt
- **THEN** zeigt das System alle Seiten auf Englisch und behält die Wahl bei der nächsten Anmeldung

### Requirement: Sprache der Patientin
The system SHALL store a preferred language (German or English) per patient and SHALL use it for the signing mode, the signed PDF and the email to the patient.

#### Scenario: Englischsprachiger Patient
- **WHEN** ein Patient mit bevorzugter Sprache Englisch den Haftungsausschluss unterschreibt
- **THEN** sind Formular, PDF und E-Mail auf Englisch, auch wenn die Therapeutin die Oberfläche auf Deutsch nutzt

### Requirement: Schweizer Formate
The system SHALL display dates as DD.MM.YYYY and use Swiss conventions for numbers and phone numbers in both languages.

#### Scenario: Datum auf Englisch
- **WHEN** die Oberfläche auf Englisch eingestellt ist
- **THEN** wird ein Geburtsdatum als 05.03.1980 angezeigt
