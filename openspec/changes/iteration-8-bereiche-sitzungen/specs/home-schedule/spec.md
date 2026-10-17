# Spec Delta

## Purpose

Selbstausführung mit Ausführungen pro Tag und Wochentagen statt "wöchentlich n×"; Zeitbedarf, Übungsblatt, Tagebuch und Einhaltung folgen daraus.

## ADDED Requirements

### Requirement: Selbstausführung pro verordneter Übung
The section "Selbstausführung" SHALL show one row per prescribed exercise with its FRM and chosen EPD, executions per day "1×", "2×" or "3×" (default 1×), the weekdays Mo to So as multiple choice (default all selected, each can be deselected, at least one required) and a note. It SHALL NOT offer intensity, steps or "wöchentlich n×".

#### Scenario: Tage abwählen
- **WHEN** die Therapeutin bei 1A "2×" wählt und Sa und So abwählt
- **THEN** ist 1A an Mo bis Fr je zweimal verordnet

#### Scenario: Kein Tag
- **WHEN** sie alle Wochentage abwählt
- **THEN** speichert die App nicht und verlangt mindestens einen Tag

### Requirement: Zeitbedarf
The system SHALL compute the time per week as the sum over the rows of duration of one execution × executions per day × number of selected weekdays, and the time per day as week / 7, and SHALL show it per exercise and in total as before.

#### Scenario: Zeit
- **WHEN** 1D (6 min pro Ausführung) 1× an 5 Tagen verordnet ist
- **THEN** zeigt die Selbstausführung 30 min pro Woche, rund 4 min pro Tag

### Requirement: Übungsblatt und Patienten-Zone
The exercise handout and the patient zone SHALL show for each prescribed exercise the FRM band with text and tools, the band of the chosen EPD (for a variant with its text highlighted), executions per day, weekdays and note.

#### Scenario: Übungsblatt
- **WHEN** die Therapeutin ein Übungsblatt mit 1A (EPD Variante 4, 1×, Mo–Fr) erstellt
- **THEN** zeigt es für 1A das FRM-Band, das Variantenband mit hervorgehobenem Text von Variante 4 und "1× pro Tag · Mo Di Mi Do Fr"

### Requirement: Tagebuch und Einhaltung nach Wochentagen
The required number of executions SHALL count only selected weekdays since the session (days × executions per day). On a weekday that is not selected the patient zone SHALL not show the exercise as open, but SHALL still accept an entry, which counts. The cockpit alert (below 50 % or 3 days without entry) SHALL count only selected weekdays.

#### Scenario: Wochenende frei
- **WHEN** eine Übung nur Mo bis Fr verordnet ist und der Patient am Samstag die Zone öffnet
- **THEN** steht die Übung nicht als "heute offen", und das fehlende Wochenende senkt die Einhaltung nicht
