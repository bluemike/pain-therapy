# Spec Delta

## Purpose

Die Sitzung (bisher Konsultation) folgt dem Ablauf der Behandlung, führt bei der Osteopressur nach Körperseite und Sitzungsnummer und verordnet Übungen ohne Freitext.

## ADDED Requirements

### Requirement: Reihenfolge der Sitzung
The session form SHALL show, in this order: header (date, "Schmerzlokalisation und Schmerzzustand", comparison), "Schmerz vorher", "Osteopressur", "Übungen", "Selbstausführung", "Schmerz nachher", "Fotos". It SHALL no longer show a separate section "Faszien-Rollmassage".

#### Scenario: Neue Sitzung
- **WHEN** die Therapeutin eine Sitzung eröffnet
- **THEN** ist der erste Block nach dem Kopf "Schmerz vorher" und "Schmerz nachher" steht nach der Selbstausführung

### Requirement: Körperseite der Behandlung
A treatment SHALL have a body side "nicht spezifiziert" (default), "links" or "rechts". After the first session the side SHALL be fixed, like the pain area.

#### Scenario: Seite fest
- **WHEN** eine Behandlung mit Seite "links" bereits eine Sitzung hat
- **THEN** lässt sich die Seite nicht mehr ändern, mit dem Hinweis, bei falscher Seite eine neue Behandlung zu eröffnen

### Requirement: Osteopressur nach Körperseite
In the osteopressure section the system SHALL enable only the checkbox of the treatment's side and disable the other; with "nicht spezifiziert" both SHALL be enabled. When the side is set and the therapist selects a sensitivity for a point, the system SHALL tick that side automatically. The server SHALL reject the opposite side.

#### Scenario: Links
- **WHEN** die Behandlung die Seite "links" hat und die Therapeutin bei Punkt 1.1.1 "stark" wählt
- **THEN** ist "li" angekreuzt und "re" nicht wählbar

#### Scenario: Nicht spezifiziert
- **WHEN** die Seite "nicht spezifiziert" ist
- **THEN** sind "li" und "re" wählbar und werden nicht automatisch gesetzt

### Requirement: Punkte pro Sitzung
Above the osteopressure points the system SHALL offer the choice "Alle", "Sitzung 1" (only dark red points), "Sitzung 2" (only red points) and "Sitzung 3" (only black points), preset to the session number for sessions 1 to 3 and to "Alle" from session 4. A point with recorded values SHALL stay visible whatever the choice.

#### Scenario: Zweite Sitzung
- **WHEN** die Therapeutin Sitzung Nr. 2 öffnet
- **THEN** ist "Sitzung 2" gewählt und nur die roten Punkte des Schmerzbereichs sind sichtbar

#### Scenario: Vierte Sitzung
- **WHEN** sie Sitzung Nr. 4 öffnet
- **THEN** ist "Alle" gewählt

### Requirement: Übungen verordnen
The exercise section SHALL list the exercises of the area of the treatment's pain area and SHALL allow adding an exercise of another area. For each exercise the therapist SHALL be able to prescribe it and choose the EPD "Standard" (default) or one of its variants; a prescribed exercise always includes its FRM. For every prescribed exercise "Übung fällt" (leicht, mittel, schwer, unmöglich) SHALL be required; saving without it SHALL fail with a message at that exercise.

#### Scenario: Liste nach Bereich
- **WHEN** die Behandlung den Schmerzbereich 1.2 Kiefer und Zähne hat
- **THEN** listet der Block "Übungen" die Übungen 1A bis 1F

#### Scenario: Variante verordnen
- **WHEN** die Therapeutin 1A verordnet und als EPD "Variante 4" wählt
- **THEN** ist 1A mit FRM und EPD Variante 4 verordnet und erscheint so in der Selbstausführung

#### Scenario: Schwierigkeit fehlt
- **WHEN** sie speichert, ohne bei der verordneten Übung 1A "Übung fällt" zu wählen
- **THEN** speichert die App nicht und markiert 1A mit "Bitte angeben, wie schwer die Übung fällt"
