# Spec Delta

## Purpose

Zeigt der Praxis im Cockpit und in der Akte, ob Patientinnen ihr Heimprogramm einhalten, auf Grundlage der Einträge im Übungstagebuch.

## ADDED Requirements

### Requirement: Berechnung der Einhaltung
The system SHALL compute the adherence of the last 7 days per exercise and in total as executions recorded as done divided by executions required by the prescription. Required executions per week SHALL follow the repetition: daily n times = 7n, weekly n times = n. For prescriptions younger than 7 days the requirement SHALL be prorated by the days since the consultation. Done executions SHALL count per exercise at most up to its requirement; deleted entries SHALL NOT count.

#### Scenario: Zwei Übungen
- **WHEN** 2A täglich 2x (Soll 14) und 2D wöchentlich 5x (Soll 5) seit mehr als 7 Tagen verordnet sind und in den letzten 7 Tagen 10 Ausführungen von 2A und 5 von 2D als gemacht erfasst sind
- **THEN** zeigt das System für 2A 71 %, für 2D 100 % und gesamt 15 von 19, also 79 %

#### Scenario: Mehr als verordnet
- **WHEN** 2D wöchentlich 5x verordnet ist und 7 Ausführungen erfasst sind
- **THEN** zählt das System für 2D 5 von 5 und rechnet die zusätzlichen Ausführungen keiner anderen Übung an

#### Scenario: Programm seit 2 Tagen
- **WHEN** 1F täglich 1x vor 2 Tagen verordnet wurde
- **THEN** beträgt das Soll für 1F 2 Ausführungen

### Requirement: Hinweise zur Einhaltung
The system SHALL flag a patient when the total adherence of the last 7 days is below 50 %, starting on day 3 after the consultation, or when there has been no entry for 3 days (since the last entry or, without entries, since the consultation).

#### Scenario: Kein Eintrag seit 3 Tagen
- **WHEN** der letzte Eintrag einer Patientin 3 Tage zurückliegt
- **THEN** zeigt das System den Hinweis "Seit 3 Tagen kein Eintrag"

#### Scenario: Geringe Einhaltung
- **WHEN** die Einhaltung der letzten 7 Tage 40 % beträgt
- **THEN** zeigt das System den Hinweis "Einhaltung unter 50 %"

### Requirement: Kachel Heimprogramm im Cockpit
The dashboard SHALL show a tile "Heimprogramm" listing all patients with an active home program, flagged patients first, each with adherence of the last 7 days, trend since the prescription, date of the last entry, average rating of the last 7 days and the link status. Selecting a patient SHALL open the record on the tab "Übungstagebuch".

#### Scenario: Patientin mit Hinweis zuerst
- **WHEN** zwei Patientinnen ein aktives Heimprogramm haben und eine davon einen Hinweis hat
- **THEN** steht die Patientin mit Hinweis oben in der Kachel

#### Scenario: Ohne aktive Heimprogramme
- **WHEN** keine Patientin ein aktives Heimprogramm hat
- **THEN** zeigt die Kachel "Keine aktiven Heimprogramme"

### Requirement: Reiter Übungstagebuch in der Akte
The patient record SHALL have a tab "Übungstagebuch" with the total adherence, a table per exercise (requirement, done, adherence, average rating, last entry), the rating over time per exercise, the list of entries with notes and the status of the access link (sent, active, locked, blocked, revoked, replaced, expired) with the actions "Link senden" and "Link sperren".

#### Scenario: Übungstagebuch öffnen
- **WHEN** die Therapeutin den Reiter "Übungstagebuch" einer Patientin mit Einträgen öffnet
- **THEN** sieht sie pro Übung Soll, Ist, Einhaltung und Bewertung, die Einträge mit Bemerkungen und den Status des Links

#### Scenario: Noch keine Einträge
- **WHEN** die Patientin ein Heimprogramm, aber noch keinen Eintrag hat
- **THEN** zeigt der Reiter die Verordnungen mit Einhaltung 0 % und den Status des Links

### Requirement: Nur lesen für die Praxis
The system SHALL show the exercise log to users with the role Therapist or Admin read-only and SHALL record opening the tab in the audit log.

#### Scenario: Keine Bearbeitung
- **WHEN** die Therapeutin einen Eintrag der Patientin ansieht
- **THEN** bietet das System kein Ändern oder Löschen an
