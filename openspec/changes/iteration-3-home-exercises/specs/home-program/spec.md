# Spec Delta

## Purpose

Verordnet in der Konsultation die Übungen zur Selbstausführung zu Hause, mit Wiederholung, Intensität, Schritten und Zeitbedarf, ähnlich einer Medikamentenverordnung.

## ADDED Requirements

### Requirement: Block Selbstausführung
The system SHALL show in each consultation a section "Selbstausführung" that lists every exercise marked as prescribed (verordnet) in the treatment form, and SHALL let the user add further exercises from the catalog. Removing the prescription in the treatment form SHALL remove the exercise from the section.

#### Scenario: Verordnete Übung erscheint
- **WHEN** die Therapeutin bei 2D "verordnet" ankreuzt
- **THEN** erscheint 2D im Block "Selbstausführung" mit der Wiederholung "täglich 1x" vorgewählt

#### Scenario: Weitere Übung
- **WHEN** die Therapeutin im Block "Übung hinzufügen" wählt und 4B aussucht
- **THEN** erscheint 4B im Block und gilt als verordnet

### Requirement: Wiederholung
The system SHALL require for each exercise in the section one of ten repetition options: daily 1x, 2x or 3x (täglich), or weekly 1x to 7x (wöchentlich). It SHALL offer intensity (1 to 9, as the intensity must stay below 10) and steps (1 to 3) as optional fields, as on the paper sheet.

#### Scenario: Wiederholung wählen
- **WHEN** die Therapeutin bei 2A "wöchentlich 5x" antippt
- **THEN** speichert das System für 2A die Wiederholung 5x pro Woche

#### Scenario: Zehn Optionen
- **WHEN** die Therapeutin die Wiederholung einer Übung wählt
- **THEN** sieht sie "täglich" 1x, 2x, 3x und "wöchentlich" 1x bis 7x

#### Scenario: Intensität 10
- **WHEN** jemand versucht, eine Intensität von 10 einzugeben
- **THEN** bietet das System diesen Wert nicht an

### Requirement: Gesamter Zeitbedarf
The system SHALL show for each exercise in the section the duration of one execution and below the section the total time per week of all prescribed exercises and the average per day.

#### Scenario: Zwei Übungen
- **WHEN** 2A (4 Minuten) täglich 2x und 2D (4 Minuten) wöchentlich 5x verordnet sind
- **THEN** zeigt das System pro Woche 56 + 20 = 76 Minuten und pro Tag den Durchschnitt von rund 11 Minuten

#### Scenario: Dreimal täglich
- **WHEN** eine Übung mit 6 Minuten täglich 3x verordnet ist
- **THEN** zeigt das System pro Woche 126 Minuten und pro Tag 18 Minuten

#### Scenario: Viel Zeitbedarf
- **WHEN** der Zeitbedarf mehr als 30 Minuten pro Tag beträgt
- **THEN** zeigt das System einen Hinweis, dass das Programm umfangreich ist
