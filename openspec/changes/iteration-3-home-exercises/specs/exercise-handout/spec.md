# Spec Delta

## Purpose

Gibt der Patientin am Ende der Konsultation ein persönliches Übungsblatt mit den verordneten Übungen, per E-Mail oder als Ausdruck, und legt es in der Akte ab.

## ADDED Requirements

### Requirement: Übungsblatt auf Knopfdruck
The system SHALL generate a personal exercise sheet as a PDF in the patient's language only when the user chooses "Übungsblatt erstellen" at the end of a consultation, never automatically on saving.

#### Scenario: Kein automatisches Blatt
- **WHEN** die Therapeutin eine Konsultation mit verordneten Übungen speichert, ohne "Übungsblatt erstellen" zu wählen
- **THEN** erzeugt das System kein Übungsblatt

### Requirement: Inhalt des Übungsblatts
The system SHALL start the exercise sheet with a cover page listing practice, patient, consultation date, therapist, each prescribed exercise with main image, repetition, intensity, steps and duration, the total time and the safety note, followed by the sheet of each prescribed exercise with the prescription printed into its fields.

#### Scenario: Übungsblatt erzeugen
- **WHEN** die Therapeutin bei einer Konsultation mit drei verordneten Übungen "Übungsblatt erstellen" wählt
- **THEN** erzeugt das System ein PDF mit Deckblatt und drei Übungsblättern

#### Scenario: Ohne Verordnung
- **WHEN** eine Konsultation keine verordnete Übung hat
- **THEN** bietet das System kein Übungsblatt an

### Requirement: Versand oder Ausdruck
The system SHALL send the exercise sheet by email to the patient's address if the patient's valid signature includes consent to unencrypted email, and SHALL otherwise offer to print it. The delivery status or the printout SHALL be recorded.

#### Scenario: Versand per E-Mail
- **WHEN** die Patientin in den unverschlüsselten E-Mail-Versand eingewilligt hat und die Therapeutin "Senden" wählt
- **THEN** sendet das System das PDF an ihre E-Mail-Adresse und zeigt den Zustellstatus in der Akte

#### Scenario: Ohne Einwilligung
- **WHEN** die Patientin nicht in den E-Mail-Versand eingewilligt hat
- **THEN** bietet das System nur "Drucken" an und vermerkt den Ausdruck in der Akte

### Requirement: Ablage in der Akte
The system SHALL store each generated exercise sheet with a document number in the patient's record under "Dokumente". A new sheet after changes SHALL be stored as a new version without removing the older ones.

#### Scenario: Neue Version
- **WHEN** die Therapeutin nach einer Änderung der Verordnung erneut ein Übungsblatt erstellt
- **THEN** zeigt die Akte beide Übungsblätter, das neueste als aktuell
