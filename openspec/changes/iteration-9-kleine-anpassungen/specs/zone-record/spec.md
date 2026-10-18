# Spec Delta

## Purpose

Die Patienten-Zone folgt der Struktur Behandlung → Sitzung, auch bei mehreren Behandlungen.

## ADDED Requirements

### Requirement: Heimprogramme pro Behandlung
The patient zone SHALL show under "Übungen" one home program per running treatment, each as prescribed in the latest session of that treatment, titled with the pain area. The exercise diary SHALL record entries per program. With a single running treatment the zone SHALL look as before.

#### Scenario: Zwei Behandlungen
- **WHEN** ein Patient je eine laufende Behandlung für die Lendenwirbelsäule und den Nacken hat
- **THEN** zeigt «Übungen» zwei Programme mit den Titeln der Schmerzbereiche, und Einträge gelten für das jeweilige Programm

### Requirement: Dokumente pro Behandlung und Sitzung
The patient zone SHALL group exercise sheets under "Dokumente" by treatment and session (e.g. "Lendenwirbelsäule/Bauch · Sitzung Nr. 2"). Signed disclaimers SHALL stay in their own group.

#### Scenario: Übungsblatt finden
- **WHEN** ein Patient unter «Dokumente» schaut
- **THEN** findet er jedes Übungsblatt unter seiner Behandlung und Sitzung
