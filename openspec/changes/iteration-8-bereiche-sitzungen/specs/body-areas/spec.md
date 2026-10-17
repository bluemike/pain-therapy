# Spec Delta

## Purpose

Gliedert die 12 Behandlungsbögen in 4 Bereiche mit je 3 Schmerzbereichen, wie in der L&B-Dokumentation.

## ADDED Requirements

### Requirement: Bereiche und Schmerzbereiche
The reference data SHALL contain the 4 areas "1 Kopf", "2 Rumpf", "3 Schulter/Arm" and "4 Becken/Beine". Each area SHALL contain 3 pain areas numbered "<Bereich>.<n>" in the order of the 12 treatment sheets. Exercises and osteopressure points SHALL belong to an area (formerly "Gruppe").

#### Scenario: Nummerierung
- **WHEN** die 12 Behandlungsbögen geladen sind
- **THEN** heissen sie 1.1 Kopf, Nacken, Halswirbelsäule; 1.2 Kiefer und Zähne; 1.3 Augen; 2.1 Brustwirbelsäule, Brustkorb; 2.2 Zwerchfell, Atmung; 2.3 Lendenwirbelsäule, Bauch; 3.1 Schulter; 3.2 Oberarm, Ellenbogen; 3.3 Unterarm, Handgelenk, Hand; 4.1 Becken, Gesäss, Hüfte; 4.2 Oberschenkel, Knie; 4.3 Unterschenkel, Fussgelenk, Fuss

#### Scenario: L&B Basisdaten
- **WHEN** die Therapeutin "L&B Basisdaten" öffnet
- **THEN** sieht sie die 4 Bereiche mit ihren je 3 Schmerzbereichen, und Übungen und Osteopressurpunkte zeigen die Spalte "Bereich"

### Requirement: Schmerzbereich wählen
When a treatment is opened, the system SHALL offer the 12 pain areas grouped by area, labelled with number and name (e.g. "1.2 Kiefer und Zähne").

#### Scenario: Auswahl
- **WHEN** die Therapeutin eine Behandlung eröffnet
- **THEN** zeigt die Auswahl "Schmerzbereich" die Überschriften Kopf, Rumpf, Schulter/Arm, Becken/Beine mit je drei Einträgen
