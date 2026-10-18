# Spec Delta

## Purpose

Audio, Zeiten und Übungsblatt passend zur Verordnung.

## ADDED Requirements

### Requirement: Anhören nur in der Selbstausführung
The session form SHALL NOT show "Anhören" for the exercises done with the therapist. It SHALL show "Anhören" in the Selbstausführung for each prescribed exercise, playing FRM and the prescribed EPD (standard or variant).

#### Scenario: Übung in der Sitzung
- **WHEN** die Therapeutin die Übungen der Sitzung erfasst
- **THEN** gibt es dort keinen Knopf «Anhören», aber unten in der Selbstausführung bei jeder verordneten Übung

### Requirement: Ganze Minuten
The practice app, the exercise sheet PDF and the patient zone SHALL show exercise times and totals in whole minutes, rounded half up, never with decimals.

#### Scenario: Zeit pro Tag
- **WHEN** eine Selbstausführung rechnerisch 12,5 Minuten pro Tag ergibt
- **THEN** zeigt die App «13 min»

### Requirement: Zugeschnittenes Übungsblatt
Tapping a prescribed exercise in the Selbstausführung SHALL open an exercise sheet tailored to the prescription: the FRM and the prescribed EPD (the standard exercise, or the chosen variant). It SHALL NOT show segments that are not prescribed.

#### Scenario: Variante verordnet
- **WHEN** für 2C die Variante 2C-V2 verordnet ist und die Therapeutin auf die Übung tippt
- **THEN** zeigt das Blatt die FRM von 2C und die Variante 2C-V2, ohne die Standardübung
