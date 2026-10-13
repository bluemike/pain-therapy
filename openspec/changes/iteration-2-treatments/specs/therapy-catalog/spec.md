# Spec Delta

## Purpose

Stellt die Inhalte der L&B-Behandlungs-Sammelmappe als Referenzdaten bereit: Bereiche, Osteopressur-Punkte, Engpassdehnungen und Rollwerkzeuge, mit ihrer Zuordnung zu den Behandlungsbögen.

## ADDED Requirements

### Requirement: Behandlungsbereiche
The system SHALL provide the 12 treatment areas of the practice's Behandlungs-Sammelmappe with number and name in German and English: 1 Kopf, Nacken, Halswirbelsäule; 2 Kiefer und Zähne; 3 Augen; 4 Brustwirbelsäule, Brustkorb; 5 Zwerchfell, Atmung; 6 Lendenwirbelsäule, Bauch; 7 Schulter; 8 Oberarm, Ellenbogen; 9 Unterarm, Handgelenk, Hand; 10 Becken, Gesäss, Hüfte; 11 Oberschenkel, Knie; 12 Unterschenkel, Fussgelenk, Fuss.

#### Scenario: Bereich wählen
- **WHEN** die Therapeutin die Auswahl des Bereichs öffnet
- **THEN** sieht sie die 12 Bereiche mit Nummer und Name in der Sprache der Oberfläche

### Requirement: Osteopressur-Punkte
The system SHALL provide the Osteopressur points of the Sammelmappe with their ID (for example 2.11.1), group, muscle and attachment in Latin and the attachment in German, and for each area the points of its form in the paper order with their emphasis (main, relevant, standard).

#### Scenario: Punkte eines Bereichs
- **WHEN** der Bogen für Bereich 6 aufgebaut wird
- **THEN** enthält er die Punkte 2.1.1, 2.1.2, 2.2.1, 2.2.2, 2.3, 2.4, 2.5, 2.8.1, 2.8.2, 2.10, 2.11.1, 2.11.2, 2.12, 2.13 und 4.5 in dieser Reihenfolge

### Requirement: Engpassdehnungen
The system SHALL provide the 27 stretching exercises 1A to 1F, 2A to 2F, 3A to 3H and 4A to 4G with code, group and name in German and English, the areas whose form lists them, and, where a source exists, the fascia rolling instructions and variants.

#### Scenario: Übungen eines Bereichs
- **WHEN** der Bogen für Bereich 12 aufgebaut wird
- **THEN** enthält er die Übungen 2F, 4B, 4C, 4D, 4E und 4F

### Requirement: Erstbefüllung und Änderungen
The system SHALL load the catalog from versioned reference files during deployment, idempotently. It MUST NOT delete catalog entries that consultations refer to; entries removed from the files SHALL be marked as retired and stay visible in existing consultations.

#### Scenario: Erneutes Einspielen
- **WHEN** das Deployment die unveränderten Referenzdateien ein zweites Mal einspielt
- **THEN** bleibt der Katalog unverändert

#### Scenario: Punkt zurückgezogen
- **WHEN** ein Punkt aus den Referenzdateien entfernt wird, der in einer Konsultation erfasst ist
- **THEN** erscheint er nicht mehr auf neuen Bögen, aber weiterhin in der bestehenden Konsultation
