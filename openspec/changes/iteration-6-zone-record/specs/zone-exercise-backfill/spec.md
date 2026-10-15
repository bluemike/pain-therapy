# Spec Delta

## Purpose

Lässt die Patientin Ausführungen für vergangene Tage des aktuellen Heimprogramms nacherfassen und macht nachgetragene Einträge in der Praxis erkennbar.

## ADDED Requirements

### Requirement: Tag wählen
The system SHALL let the patient choose, in the exercise log, any day from the date of the consultation with the current home program up to today, with "Heute" as default and buttons for the previous and the next day. For the chosen day it SHALL show every prescribed exercise with its target and the executions recorded for that day; for weekly targets the week of that day counts.

#### Scenario: Gestern nachtragen
- **WHEN** die Patientin "Vorheriger Tag" antippt
- **THEN** zeigt das Übungstagebuch den gestrigen Tag mit den Übungen, dem Ziel und den an diesem Tag erfassten Ausführungen

#### Scenario: Grenzen
- **WHEN** die Patientin den Tag der Konsultation erreicht hat
- **THEN** ist "Vorheriger Tag" nicht mehr wählbar, und ein Tag nach heute ist nie wählbar

### Requirement: Ausführung für einen vergangenen Tag
The system SHALL let the patient record an execution for the chosen day with the same fields as today (done, rating, time, note), with the chosen date preset. The rules of the exercise log SHALL stay: not in the future, not before the consultation, correction within 24 hours after recording.

#### Scenario: Einzelne Übung
- **WHEN** die Patientin für vorgestern bei Übung 2A "gemacht" mit Bewertung 6 erfasst
- **THEN** zählt die Ausführung für vorgestern, und die Tagesansicht von vorgestern zeigt sie

#### Scenario: Vor der Konsultation
- **WHEN** jemand eine Ausführung mit einem Datum vor der Konsultation sendet
- **THEN** lehnt das System sie mit "Dieses Datum liegt vor Ihrem Heimprogramm" ab

### Requirement: Alle Übungen eines Tages erledigt
The system SHALL offer "Alle Übungen dieses Tages erledigt" for a chosen past day. It SHALL record the open executions of the daily exercises of that day as done without rating, like the quick entry for today, at 12:00 of that day.

#### Scenario: Ganzer Tag
- **WHEN** die Patientin für gestern "Alle Übungen dieses Tages erledigt" wählt
- **THEN** sind die offenen Ausführungen von gestern als erledigt erfasst, bereits erfasste bleiben unverändert

### Requirement: Einträge des ganzen Heimprogramms
The system SHALL list the entries of the whole current home program by day, newest first, instead of only the last 14 days.

#### Scenario: Ältere Einträge
- **WHEN** die Patientin drei Wochen nach der Konsultation die Einträge ansieht
- **THEN** sieht sie alle Einträge seit der Konsultation

### Requirement: Nachgetragene Einträge in der Praxis
The system SHALL mark an entry in the practice app as "nachgetragen am …" when it was recorded more than 24 hours after the time of the execution. Adherence and the cockpit alerts SHALL count it for the day of the execution.

#### Scenario: Kennzeichnung
- **WHEN** eine Patientin am Freitag eine Ausführung für Dienstag erfasst
- **THEN** zeigt das Übungstagebuch der Akte den Eintrag am Dienstag mit "nachgetragen am Freitag", und die Adhärenz zählt ihn für Dienstag
