# Spec Delta

## Purpose

Dokumentiert jede Sitzung einer Behandlung als Konsultation mit dem digitalen Behandlungsbogen des Bereichs aus der L&B-Sammelmappe.

## ADDED Requirements

### Requirement: Konsultation eröffnen
The system SHALL let users with the role Therapist or Admin add any number of consultations to a treatment of an active patient with a valid signed disclaimer. Date and time SHALL be required, default to now and MUST NOT be in the future. The diagnosis SHALL be prefilled from the treatment and MAY be changed for the consultation without changing the treatment.

#### Scenario: Erste Konsultation
- **WHEN** die Therapeutin bei einer Behandlung "+ Konsultation" wählt und speichert
- **THEN** legt das System Konsultation Nr. 1 mit dem aktuellen Zeitpunkt und der Diagnose der Behandlung an

#### Scenario: Diagnose überschreiben
- **WHEN** die Therapeutin in der Konsultation eine andere Diagnose einträgt
- **THEN** speichert das System sie bei der Konsultation, und die Diagnose der Behandlung bleibt unverändert

### Requirement: Nummerierung der Konsultationen
The system SHALL number the consultations of a treatment starting at 1, in the order they are created, and show the number as on the paper form ("Behandlung Nr.").

#### Scenario: Dritte Konsultation
- **WHEN** eine Behandlung zwei Konsultationen hat und eine weitere gespeichert wird
- **THEN** zeigt das System sie als Konsultation Nr. 3

### Requirement: Behandlungsbogen des Bereichs
The system SHALL show in each consultation the treatment form (Behandlungsbogen) of the treatment's area from the therapy catalog: the area's Osteopressur points in the order of the paper form with their emphasis, the area's stretching exercises (Engpassdehnungen) and six rows for fascia rolling (Faszien-Rollmassage).

#### Scenario: Bogen "Lendenwirbelsäule, Bauch"
- **WHEN** die Therapeutin eine Konsultation einer Behandlung im Bereich 6 öffnet
- **THEN** zeigt der Bogen die 15 Punkte und die Übungen 1F, 2A, 2B, 2C und 2D dieses Bereichs, Hauptpunkte hervorgehoben

#### Scenario: Nur Hauptpunkte
- **WHEN** die Therapeutin den Filter "nur Hauptpunkte" einschaltet
- **THEN** zeigt der Bogen nur die Hauptpunkte des Bereichs

#### Scenario: Punkt aus anderem Bereich
- **WHEN** die Therapeutin einen Punkt behandelt, der nicht auf dem Bogen des Bereichs steht
- **THEN** kann sie ihn aus dem Katalog hinzufügen und wie die anderen Punkte erfassen

### Requirement: Schmerz vorher und Restschmerz
The system SHALL record per consultation the pain before the consultation and the residual pain after it, each optional, from 0 to 100 % in steps of 10.

#### Scenario: Restschmerz
- **WHEN** die Therapeutin Schmerz vorher 60 und Restschmerz 30 wählt
- **THEN** zeigt die Liste der Konsultationen für diese Konsultation "60 % → 30 %"

### Requirement: Osteopressur erfassen
The system SHALL record per point of a consultation whether it was treated left and/or right and its sensitivity (niedrig, mittel, stark, extrem).

#### Scenario: Punkt erfassen
- **WHEN** die Therapeutin bei Punkt 2.11.1 "Re" ankreuzt und "stark" wählt
- **THEN** speichert das System für diese Konsultation Punkt 2.11.1, rechts behandelt, Empfindlichkeit stark

### Requirement: Engpassdehnungen erfassen
The system SHALL record per exercise of a consultation whether it was prescribed, how hard it was for the patient (leicht, mittel, schwer, unmöglich) and variants as free text.

#### Scenario: Übung verordnen
- **WHEN** die Therapeutin bei 2D "verordnet" ankreuzt und "Übung fällt: schwer" wählt
- **THEN** speichert das System die Verordnung mit der Schwierigkeit

### Requirement: Faszien-Rollmassage und Vergleich
The system SHALL record per consultation up to six fascia rolling rows, each with an area as free text and a tool (MiKu, MeKu, MiRo, MeRo), and a free-text comparison with the previous consultation.

#### Scenario: Rollmassage erfassen
- **WHEN** die Therapeutin in Zeile 1 "Beckenkamm" und "MiKu" einträgt
- **THEN** speichert das System die Rollmassage mit Bereich und Werkzeug

### Requirement: Bedienung des Bogens
The system SHALL let the user choose each scale value with one tap and remove a chosen value with another tap, and SHALL save a consultation even when no entries of the form are filled in.

#### Scenario: Wahl aufheben
- **WHEN** die Therapeutin auf die bereits gewählte Empfindlichkeit "stark" tippt
- **THEN** ist für diesen Punkt keine Empfindlichkeit mehr gewählt

#### Scenario: Leerer Bogen
- **WHEN** die Therapeutin nur Datum und Diagnose ausfüllt und speichert
- **THEN** speichert das System die Konsultation ohne Bogeneinträge

### Requirement: Konsultation ändern
The system SHALL let users with the role Therapist or Admin change all fields of a consultation and add or remove photos. Every change SHALL appear in the record's history. The system MUST NOT offer deleting a consultation.

#### Scenario: Empfindlichkeit korrigieren
- **WHEN** die Therapeutin bei einem Punkt "stark" in "mittel" ändert
- **THEN** zeigt die Konsultation "mittel", und die Änderungshistorie zeigt beide Werte
