# Spec Delta

## Purpose

Lässt die Patientin in der Patienten-Zone erfassen, ob sie die Übungen ihres Heimprogramms gemacht hat und wie gut sie sie ausführen konnte.

## ADDED Requirements

### Requirement: Heimprogramm in der Patienten-Zone
The system SHALL show the patient the exercises of her current home program, i.e. the prescriptions of her most recent consultation with at least one prescription, each with main image, code, name in her language, repetition, duration of one execution and the progress of today (daily exercises) or this week (weekly exercises).

#### Scenario: Übungen von heute
- **WHEN** 2A täglich 2x und 2D wöchentlich 5x verordnet sind und die Patientin heute 2A einmal und 2D in dieser Woche noch nicht erfasst hat
- **THEN** zeigt das System bei 2A "heute 1 von 2" und bei 2D "diese Woche 0 von 5"

#### Scenario: Neue Verordnung
- **WHEN** die Therapeutin in einer neuen Konsultation andere Übungen verordnet
- **THEN** zeigt die Patienten-Zone nur noch die neuen Übungen, und die früheren Einträge bleiben bei der alten Verordnung

### Requirement: Ausführung erfassen
The system SHALL let the patient record per execution the exercise, whether she did it ("gemacht" ja oder nein), when done the rating "Wie gut konnten Sie die Übung ausführen?" from 1 to 10, date and time and an optional note of at most 500 characters. The rating MUST be between 1 and 10 and MUST be empty when the exercise was not done.

#### Scenario: Übung gemacht
- **WHEN** die Patientin bei 2A "gemacht: ja" und die Bewertung 7 wählt und speichert
- **THEN** speichert das System einen Eintrag für 2A mit Bewertung 7 und dem aktuellen Zeitpunkt

#### Scenario: Übung nicht gemacht
- **WHEN** die Patientin "gemacht: nein" wählt
- **THEN** blendet das System die Bewertung aus und speichert den Eintrag ohne Bewertung

#### Scenario: Bewertung ausserhalb der Skala
- **WHEN** eine Anfrage eine Bewertung von 11 speichern will
- **THEN** lehnt das System den Eintrag ab, auch auf Ebene der Datenbank

### Requirement: Datum und Zeit
The system SHALL prefill date and time of an entry with the current time. The patient MAY change them; they MUST NOT be in the future and MUST NOT be before the consultation of the prescription.

#### Scenario: Nachtragen
- **WHEN** die Patientin am Morgen die Übung vom Vorabend mit 20:30 Uhr nachträgt
- **THEN** speichert das System den Eintrag mit gestern 20:30 Uhr

#### Scenario: Zeit in der Zukunft
- **WHEN** die Patientin eine Zeit in der Zukunft wählt
- **THEN** speichert das System den Eintrag nicht und zeigt einen Hinweis

### Requirement: Schnelleintrag
The system SHALL offer "Alle heutigen Übungen erledigt", which records for each daily exercise the executions still open today as done, without rating. The patient MAY add the rating later within 24 hours.

#### Scenario: Alles erledigt
- **WHEN** 2A täglich 2x mit einem Eintrag von heute und 1F täglich 1x ohne Eintrag verordnet sind und die Patientin "Alle heutigen Übungen erledigt" wählt
- **THEN** erfasst das System einen weiteren Eintrag für 2A und einen für 1F, jeweils als gemacht

### Requirement: Letzte 14 Tage und Korrektur
The system SHALL show the patient her own entries of the last 14 days, newest first, and SHALL let her correct or delete an entry within 24 hours after recording it.

#### Scenario: Korrektur innerhalb von 24 Stunden
- **WHEN** die Patientin einen Eintrag von vor 2 Stunden auf Bewertung 5 ändert
- **THEN** zeigt das System die neue Bewertung, und die Akte vermerkt die Korrektur

#### Scenario: Nach 24 Stunden
- **WHEN** ein Eintrag älter als 24 Stunden ist
- **THEN** bietet das System kein Ändern oder Löschen mehr an

### Requirement: Nachvollziehbare Einträge
The system SHALL keep every entry with its history: corrections and deletions SHALL be recorded with before and after values, and deleting SHALL only mark the entry as deleted. Deleted entries SHALL NOT count towards adherence. The practice SHALL be able to read but not change entries.

#### Scenario: Eintrag löschen
- **WHEN** die Patientin einen Eintrag löscht
- **THEN** verschwindet er aus ihrer Liste und aus der Einhaltung, bleibt aber in der Datenbank mit Zeitpunkt der Löschung
