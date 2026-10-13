# Spec Delta

## Purpose

Führt die Patientinnen und Patienten der Praxis mit den Angaben des Anamnesebogens: anlegen, ansehen, ändern sowie deaktivieren und reaktivieren statt löschen.

## ADDED Requirements

### Requirement: Personalien
The system SHALL store for each patient the personal details of the intake form: first and last name, gender (m/w/d), date of birth, address, phone, mobile, email, occupation, GP (Hausärzt:in), emergency contact with phone, health or accident insurer, insurance number and preferred language (German or English).

#### Scenario: Personalien anzeigen
- **WHEN** ein Benutzer die Akte einer Patientin öffnet
- **THEN** sieht er alle erfassten Personalien gruppiert nach Person, Kontakt, Notfallkontakt und Versicherung

### Requirement: Medizinische Angaben des Anamnesebogens
The system SHALL store the medical part of the intake form: smoker (yes/no, years, packs per day), high blood pressure, high blood lipids, dizziness or fainting, orthopaedic conditions (osteoporosis, arthrosis, rheumatism, other), internal conditions (cardiovascular, diabetes, asthma, allergies, other), further diagnoses, current medication, pregnancy and current medical treatment with the treating doctor.

#### Scenario: Erkrankungen ankreuzen
- **WHEN** die Therapeutin "Osteoporose" und "Diabetes" ankreuzt und speichert
- **THEN** zeigt die Akte beide Erkrankungen im Abschnitt Anamnese

#### Scenario: Freitext bei "andere"
- **WHEN** bei den orthopädischen Erkrankungen "andere" angekreuzt wird
- **THEN** verlangt das System eine Beschreibung im zugehörigen Freitextfeld

### Requirement: Patient anlegen
The system SHALL create a patient when at least first name, last name, date of birth, preferred language and email are given. The email is required because signed documents are sent to it. New patients SHALL have the status "aktiv".

#### Scenario: Erfolgreich anlegen
- **WHEN** die Therapeutin die Pflichtfelder ausfüllt und speichert
- **THEN** legt das System den Patienten mit Status aktiv an und bietet direkt den Unterschriftsablauf an

#### Scenario: Pflichtfeld fehlt
- **WHEN** das Geburtsdatum fehlt
- **THEN** speichert das System nicht und markiert das Feld mit einer Meldung in der Sprache der Oberfläche

#### Scenario: E-Mail-Adresse fehlt
- **WHEN** keine E-Mail-Adresse eingegeben wird
- **THEN** speichert das System nicht und markiert das Feld als Pflichtfeld

#### Scenario: Ungültige E-Mail-Adresse
- **WHEN** eine E-Mail-Adresse ohne gültiges Format eingegeben wird
- **THEN** speichert das System nicht und weist auf das Format hin

### Requirement: Mögliche Dubletten
The system SHALL warn before saving a new patient whose last name and date of birth match an existing patient, active or inactive.

#### Scenario: Gleicher Name und Geburtsdatum
- **WHEN** eine Patientin mit Nachname und Geburtsdatum einer bestehenden Akte angelegt wird
- **THEN** zeigt das System die bestehende Akte und fragt, ob trotzdem eine neue angelegt werden soll

### Requirement: Patientenliste und Suche
The system SHALL list patients sorted by last name, show only active patients by default with a filter for inactive or all, and SHALL search by name, date of birth or insurance number.

#### Scenario: Suche nach Name
- **WHEN** ein Benutzer "Müller" ins Suchfeld eingibt
- **THEN** listet das System die aktiven Patientinnen und Patienten, deren Vor- oder Nachname "Müller" enthält, mit Geburtsdatum

#### Scenario: Inaktive einblenden
- **WHEN** der Filter auf "inaktiv" gestellt wird
- **THEN** zeigt die Liste nur deaktivierte Patientinnen und Patienten

### Requirement: Patient ändern
The system SHALL let users change all patient data and SHALL keep each change with previous value, new value, user and time.

#### Scenario: Adresse geändert
- **WHEN** die Adresse eines Patienten geändert wird
- **THEN** zeigt die Änderungshistorie der Akte die alte und neue Adresse mit Benutzer und Zeitpunkt

### Requirement: Deaktivieren und Reaktivieren
The system SHALL let users deactivate a patient with an optional reason and reactivate an inactive patient. The system MUST NOT offer deleting a patient.

#### Scenario: Patient deaktivieren
- **WHEN** ein Benutzer einen Patienten deaktiviert und bestätigt
- **THEN** erhält der Patient den Status inaktiv, verschwindet aus der Standardliste und seine Daten und Dokumente bleiben erhalten

#### Scenario: Inaktiven Patienten öffnen
- **WHEN** die Akte eines inaktiven Patienten geöffnet wird
- **THEN** zeigt das System den Status "inaktiv" deutlich an und bietet "Reaktivieren" an
