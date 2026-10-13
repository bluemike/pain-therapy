# Spec Delta

## Purpose

Stellt die 27 Übungsblätter der L&B-Sammelmappe digital bereit: Hauptbild, Blattbild, Inhalte und Zeitbedarf pro Übung.

## ADDED Requirements

### Requirement: Digitalisiertes Übungsblatt
The system SHALL provide for each of the 27 exercises 1A to 4G one main image (the photo of the stretch), an image of the whole sheet and the texts of the sections fascia rolling, stretch steps and variants, imported from the practice's Sammelmappe.

#### Scenario: Übung im Katalog ansehen
- **WHEN** ein Benutzer im Katalog die Übung 2A öffnet
- **THEN** sieht er das Hauptbild, die Abschnitte Faszien-Rollmassage, Engpassdehnung und Varianten, den Zeitbedarf und das ganze Blatt

#### Scenario: Blatt noch nicht eingespielt
- **WHEN** für eine Übung noch keine Inhalte eingespielt sind
- **THEN** zeigt der Katalog die Übung mit "noch nicht erfasst" statt Bild und Text

### Requirement: Zeitbedarf einer Übung
The system SHALL store for each exercise the stretch time per side, the number of sides and the fascia rolling time, and SHALL compute the duration of one execution as rolling time plus stretch time per side times sides. Values not yet set SHALL be shown as "noch nicht festgelegt" and left out of sums with a hint.

#### Scenario: Übung mit zwei Seiten
- **WHEN** eine Übung 120 Sekunden Dehnung pro Seite, 2 Seiten und 120 Sekunden Rollmassage hat
- **THEN** zeigt das System eine Dauer von 6 Minuten pro Ausführung

#### Scenario: Wert fehlt
- **WHEN** für eine Übung die Rollmassage-Dauer nicht festgelegt ist
- **THEN** zeigt das System die Dauer der Dehnung und den Hinweis "Rollmassage noch nicht festgelegt"

### Requirement: Schutz der Übungsinhalte
The system SHALL deliver exercise images and texts only to signed-in users with a role, and to patients only inside their personal exercise sheet. The contents MUST NOT be stored in the source code repository.

#### Scenario: Bild ohne Anmeldung
- **WHEN** jemand die Adresse eines Übungsbilds ohne gültige Anmeldung aufruft
- **THEN** liefert das System das Bild nicht aus
