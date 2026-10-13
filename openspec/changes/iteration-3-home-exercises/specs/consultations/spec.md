# Spec Delta

## ADDED Requirements

### Requirement: Selbstausführung verordnen
The system SHALL offer in each consultation a section "Selbstausführung" in which users with the role Therapist or Admin prescribe exercises for the patient to do at home, like a medication entry: any number of exercises from the therapy catalog, each at most once, each with exactly one frequency (täglich 1×, täglich 2×, 3–7× pro Woche, 5× pro Woche) and an optional note. The section MAY stay empty.

#### Scenario: Übung aus dem Katalog
- **WHEN** die Therapeutin über "+ Übung" die Übung 4C wählt, die nicht auf dem Bogen des Bereichs steht
- **THEN** nimmt das System 4C in die Selbstausführung auf

#### Scenario: Häufigkeit fehlt
- **WHEN** die Therapeutin eine Übung der Selbstausführung ohne Häufigkeit speichern will
- **THEN** speichert das System nicht und markiert die Zeile mit einer Meldung in der Sprache der Oberfläche

### Requirement: Vorschläge aus dem Bogen
While the section "Selbstausführung" is empty, the system SHALL suggest the exercises marked "verordnet" on the consultation's form and add them on request.

#### Scenario: Vorschläge übernehmen
- **WHEN** im Bogen 2A und 2D als "verordnet" angekreuzt sind und die Therapeutin in der leeren Selbstausführung "Vorschläge übernehmen" wählt
- **THEN** enthält die Selbstausführung 2A und 2D, jede ohne gewählte Häufigkeit

### Requirement: Zeitbedarf der Selbstausführung
The system SHALL show per prescribed exercise its time for one execution from the therapy catalog and the total time per day and per week. The weekly total SHALL be a range when an exercise has the frequency 3–7× pro Woche. The daily total SHALL range from the daily exercises alone to all exercises when weekly frequencies are prescribed. Exercises without a time SHALL be named below the totals and not counted.

#### Scenario: Gesamtzeit
- **WHEN** die Selbstausführung 2A (5 Min.) täglich 1×, 2D (4 Min.) täglich 2× und 4C (6 Min.) 3–7× pro Woche enthält
- **THEN** zeigt das System pro Tag "13–19 Min." und pro Woche "109–133 Min."

#### Scenario: Übung ohne Dauer
- **WHEN** eine verordnete Übung noch nicht digitalisiert ist
- **THEN** zeigt das System bei ihr "noch nicht digitalisiert" und unter der Gesamtzeit, dass sie nicht eingerechnet ist

### Requirement: Aktuelles Heimprogramm
The system SHALL store the prescription with its consultation. The prescription of the latest consultation of a treatment SHALL be the treatment's current home program.

#### Scenario: Neue Konsultation
- **WHEN** zu einer Behandlung eine weitere Konsultation mit einer anderen Selbstausführung gespeichert wird
- **THEN** gilt diese als aktuelles Heimprogramm, und die frühere Konsultation behält ihre Selbstausführung

## MODIFIED Requirements

### Requirement: Konsultation ändern
The system SHALL let users with the role Therapist or Admin change all fields of a consultation, including the prescribed exercises of "Selbstausführung" with frequency and note, and add or remove photos. Every change SHALL appear in the record's history. The system MUST NOT offer deleting a consultation.

#### Scenario: Empfindlichkeit korrigieren
- **WHEN** die Therapeutin bei einem Punkt "stark" in "mittel" ändert
- **THEN** zeigt die Konsultation "mittel", und die Änderungshistorie zeigt beide Werte

#### Scenario: Häufigkeit ändern
- **WHEN** die Therapeutin bei 2D die Häufigkeit von "täglich 2×" in "täglich 1×" ändert
- **THEN** zeigt die Selbstausführung "täglich 1×" mit neu berechneter Gesamtzeit, und die Änderungshistorie zeigt beide Werte
