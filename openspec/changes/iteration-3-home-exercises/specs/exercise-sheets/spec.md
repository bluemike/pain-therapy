# Spec Delta

## Purpose

Stellt die 27 Übungsblätter der L&B-Sammelmappe digital bereit: pro Übung ein Bild, die Texte des Blatts und die Zeit für eine Ausführung.

## ADDED Requirements

### Requirement: Übungsblatt pro Übung
The system SHALL provide for each of the 27 stretching exercises (1A to 4G) whose sheet is digitized one image taken from the photo area of the sheet in the Sammelmappe and the German texts of the sheet: fascia rolling (area, tool and rolling time per row), the stretch in steps 1, 2 and 3 including 3A and 3B where the sheet has them, variants and side notes. English texts MAY be provided per exercise. The system MUST NOT include the advertisement of the sheet's footer.

#### Scenario: Blatt 2A
- **WHEN** das Übungsblatt 2A digitalisiert ist
- **THEN** stellt das System ein Bild, die Rollmassage, die Schritte 1 bis 3 mit 3A und 3B, die Varianten und die Dauer der Übung 2A bereit

#### Scenario: Blatt noch nicht digitalisiert
- **WHEN** für eine Übung noch kein digitalisiertes Blatt vorliegt
- **THEN** zeigt das System bei dieser Übung "noch nicht digitalisiert" an Stelle von Bild, Texten und Dauer

### Requirement: Dauer einer Ausführung
The system SHALL store per digitized exercise the time for one execution in whole minutes. If the sheet states a time, the system SHALL use it. Otherwise the time SHALL be derived as the rolling time on the sheet plus 4 × 30 seconds of stretching per side times the number of sides, rounded up to whole minutes, and SHALL be marked as derived wherever it is shown.

#### Scenario: Zeit vom Blatt
- **WHEN** das Blatt einer Übung eine Zeit angibt
- **THEN** übernimmt das System diese Zeit ohne Kennzeichnung

#### Scenario: Berechnete Zeit
- **WHEN** das Blatt einer beidseitigen Übung keine Zeit, aber 2 Minuten Rollmassage angibt
- **THEN** speichert das System 6 Minuten und zeigt sie als "6 Min. · berechnet"

### Requirement: Herkunft und Einspielen
The system SHALL load the exercise sheets (data file and one image per exercise) from versioned reference files during deployment, idempotently, together with the therapy catalog. Sheets removed from the files SHALL be marked as retired.

#### Scenario: Erneutes Einspielen
- **WHEN** das Deployment die unveränderten Übungsblätter ein zweites Mal einspielt
- **THEN** bleiben Übungsblätter und Bilder unverändert

#### Scenario: Neues Blatt
- **WHEN** ein weiteres Blatt mit Bild in die Referenzdateien aufgenommen und deployt wird
- **THEN** zeigt der Katalog die Übung mit Bild, Texten und Dauer

### Requirement: Schutz der Bilder
The system MUST NOT deliver exercise images without a valid sign-in with a role; they SHALL have no public address.

#### Scenario: Bild ohne Anmeldung
- **WHEN** jemand die Adresse eines Übungsbilds ohne gültige Anmeldung aufruft
- **THEN** liefert das System das Bild nicht aus
