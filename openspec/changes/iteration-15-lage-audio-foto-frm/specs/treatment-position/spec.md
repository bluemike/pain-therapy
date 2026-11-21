# Spec Delta

## ADDED Requirements

### Requirement: Behandlungslage pro Osteopressur-Punkt
The system SHALL store a treatment position for every osteopressure point in the reference data, as one base position or a combination of two separated by «/». The base positions SHALL be SL Seitenlage, RL Rückenlage, BL Bauchlage, S Sitzen, HSL Halbseitenlage and SSL Stabile Seitenlage, each with a German and an English name. The catalog sync SHALL reject a position that contains an unknown code.

#### Scenario: Kombination auflösen
- **WHEN** der Punkt 2.1.2 die Lage «BL/HSL» hat
- **THEN** zeigt das System sie ausgeschrieben als «Bauchlage / Halbseitenlage»

#### Scenario: Unbekanntes Kürzel
- **WHEN** die Referenzdatei einem Punkt die Lage «XL» gibt
- **THEN** bricht der Katalog-Abgleich mit einer Fehlermeldung ab

### Requirement: Lage im Katalog
The system SHALL show the treatment position, written out, for every osteopressure point in the catalog («L&B Basisdaten»).

#### Scenario: Katalog
- **WHEN** die Therapeutin in den L&B-Basisdaten die Osteopressur-Punkte öffnet
- **THEN** steht bei 1.1.1 «Sitzen»
