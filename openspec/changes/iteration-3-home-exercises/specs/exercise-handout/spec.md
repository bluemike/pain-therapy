# Spec Delta

## Purpose

Erstellt am Ende einer Konsultation ein Übungsblatt mit den verordneten Übungen für die Patientin oder den Patienten und stellt es per E-Mail oder zum Ausdrucken bereit.

## ADDED Requirements

### Requirement: Übungsblatt erstellen
The system SHALL let users with the role Therapist or Admin create an exercise sheet as PDF for a saved consultation of an active patient whose "Selbstausführung" has at least one exercise.

#### Scenario: Übungsblatt erstellen
- **WHEN** die Therapeutin nach dem Speichern der Konsultation "Übungsblatt erstellen" wählt
- **THEN** erzeugt das System das PDF mit den Übungen der Selbstausführung und der Gesamtzeit und zeigt den Dialog "Übungsblatt senden"

#### Scenario: Keine Selbstausführung
- **WHEN** die Selbstausführung einer Konsultation leer ist
- **THEN** bietet das System "Übungsblatt erstellen" nicht an

#### Scenario: Übung ohne digitalisiertes Blatt
- **WHEN** eine verordnete Übung noch nicht digitalisiert ist
- **THEN** enthält das Übungsblatt sie mit Code, Name und Häufigkeit, ohne Bild und Anleitung

### Requirement: Inhalt des Übungsblatts
The exercise sheet SHALL contain the practice header "Pain Therapy | Via Prau da Cuort 5 | 7153 Falera", the patient's name, the date, the consultation number and area, and per prescribed exercise the image, code and title, frequency, time for one execution, rolling, steps, variants and note. It SHALL end with the total time per day and per week and SHALL show the safety note that the intensity must never reach 10. It MUST NOT contain the advertisement of the paper sheets.

#### Scenario: Inhalt
- **WHEN** ein Übungsblatt für 2A täglich 1× und 2D täglich 2× erstellt wird
- **THEN** enthält es Praxiskopf, Name, Datum, Konsultation, beide Übungen mit Bild, Häufigkeit, Dauer und Anleitung, die Gesamtzeit und den Sicherheitshinweis, aber keine Werbung für die L&B-App

### Requirement: Sprache des Übungsblatts
The system SHALL create the exercise sheet in the patient's preferred language (German or English). Where an exercise has no English texts, the English sheet SHALL show the German texts with a note that they are only available in German.

#### Scenario: Englisch ohne Übersetzung
- **WHEN** für einen englischsprachigen Patienten ein Blatt mit Übung 2A erstellt wird, für die keine englischen Texte vorliegen
- **THEN** ist das Blatt englisch, und bei 2A stehen die deutschen Texte mit dem Hinweis "Text only available in German"

### Requirement: Versand oder Ausdruck
The system SHALL offer to send the exercise sheet by email to the patient's address only if the patient's latest valid signed disclaimer grants consent to unencrypted email and an address is on file; otherwise the email option SHALL be disabled with the reason shown. Printing and downloading SHALL always be offered. Emails SHALL be sent from pain-therapy@ayanta.ch with the PDF attached, with delivery status and retries as for signed documents.

#### Scenario: Mit Einwilligung
- **WHEN** die Patientin in unverschlüsselte E-Mails eingewilligt hat und die Therapeutin "Per E-Mail senden" wählt
- **THEN** sendet das System das Übungsblatt als PDF an ihre E-Mail-Adresse und zeigt den Versandstatus

#### Scenario: Ohne Einwilligung
- **WHEN** die Patientin nicht in unverschlüsselte E-Mails eingewilligt hat
- **THEN** ist "Per E-Mail senden" deaktiviert mit dem Hinweis "keine Einwilligung in unverschlüsselte E-Mails", und das System bietet Drucken und Herunterladen an

#### Scenario: Ohne E-Mail-Adresse
- **WHEN** die Patientin eingewilligt hat, aber keine E-Mail-Adresse hinterlegt ist
- **THEN** ist "Per E-Mail senden" deaktiviert mit dem Hinweis "keine E-Mail-Adresse"

### Requirement: Ablage und Historie
The system SHALL store every created exercise sheet unchanged in private storage in Switzerland North with a record linked to the consultation, and SHALL list the consultation's sheets with time, language and delivery status. Creating, sending, resending and downloading SHALL appear in the record's history. The system MUST NOT deliver a stored sheet without a valid sign-in with a role.

#### Scenario: Erneut senden
- **WHEN** die Therapeutin bei einem gespeicherten Übungsblatt "Erneut senden" wählt
- **THEN** sendet das System dasselbe PDF erneut, sofern die Einwilligung vorliegt, und die Änderungshistorie vermerkt den Versand

#### Scenario: Neue Version
- **WHEN** die Selbstausführung nach dem Erstellen eines Blatts geändert und erneut "Übungsblatt erstellen" gewählt wird
- **THEN** speichert das System ein zweites Blatt, und das erste bleibt unverändert abrufbar

#### Scenario: Abruf ohne Anmeldung
- **WHEN** jemand die Adresse eines Übungsblatts ohne gültige Anmeldung aufruft
- **THEN** liefert das System das PDF nicht aus
