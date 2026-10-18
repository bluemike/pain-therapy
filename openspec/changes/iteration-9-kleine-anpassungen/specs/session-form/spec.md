# Spec Delta

## Purpose

Kleine Anpassungen am Erfassen und Darstellen von Sitzungen (Iteration 8).

## ADDED Requirements

### Requirement: Übernahme aus der Behandlung ohne Rückschreiben
A new session SHALL be prefilled with the details of its treatment (Schmerzlokalisation und Schmerzzustand). The therapist SHALL be able to change them in the session; the system SHALL NOT write these changes back to the treatment.

#### Scenario: Angabe in der Sitzung anpassen
- **WHEN** die Therapeutin in Sitzung 2 die Schmerzlokalisation anpasst und speichert
- **THEN** gilt die neue Angabe für Sitzung 2, und die Behandlung zeigt weiter ihre ursprüngliche Angabe

### Requirement: Kein Vergleich in Sitzung 1
The session form SHALL hide "Vergleich mit der letzten Sitzung" in the first session of a treatment.

#### Scenario: Erste Sitzung
- **WHEN** die Therapeutin die erste Sitzung einer Behandlung erfasst
- **THEN** gibt es kein Feld «Vergleich mit der letzten Sitzung»

### Requirement: Schmerzknöpfe über die volle Breite
"Schmerz vorher" and "Schmerz nachher" SHALL show their 11 buttons (0 to 100 % in steps of 10) in one row of equal buttons across the full width of the form. On narrow screens the row MAY wrap into two even rows.

#### Scenario: iPad quer
- **WHEN** die Sitzung auf dem iPad quer geöffnet ist
- **THEN** stehen 0 % bis 100 % in einer Reihe gleich breiter Knöpfe

### Requirement: Seiten der Osteopressur und Prüfung beim Speichern
For each point the session form SHALL offer only the sides that match the body side of the treatment: "li" for "links", "re" for "rechts", "li" and "re" for "beidseitig". The body side value formerly called "nicht spezifiziert" SHALL be shown as "beidseitig". When saving, every point with a sensitivity SHALL have a side and every point with a side SHALL have a sensitivity; otherwise the system SHALL NOT save the session and SHALL mark the incomplete points.

#### Scenario: Behandlung links
- **WHEN** die Behandlung die Körperseite «links» hat
- **THEN** bietet jeder Punkt nur «li» an

#### Scenario: Seite ohne Empfindlichkeit
- **WHEN** die Therapeutin bei einem Punkt «re» wählt, keine Empfindlichkeit erfasst und speichert
- **THEN** wird die Sitzung nicht gespeichert, und der Punkt ist markiert

### Requirement: Sitzungen unter der Behandlung
The patient page SHALL separate the sessions of a treatment from the treatment with a dark gold divider. The treatment header SHALL read e.g. "Behandlung 2.3 Lendenwirbelsäule/Bauch" with the buttons "Ändern" and "+ Sitzung". Each session SHALL be titled in full, e.g. "Sitzung Nr. 1", with its own button "Ändern" instead of an arrow.

#### Scenario: Sitzung finden
- **WHEN** die Therapeutin eine Behandlung mit zwei Sitzungen öffnet
- **THEN** sieht sie unter dem goldenen Trenner «Sitzung Nr. 1» und «Sitzung Nr. 2», je mit «Ändern»

### Requirement: Abbrechen beim Ändern
The Abschluss page of a session (exercise sheet) SHALL offer "Abbrechen" next to "Sitzung ändern", as the session form does next to "Sitzung speichern". "Abbrechen" SHALL return to the patient page without saving or sending.

#### Scenario: Nur anschauen
- **WHEN** die Therapeutin nach dem Speichern auf der Abschlussseite die Vorschau anschaut und dann «Abbrechen» wählt
- **THEN** ist nichts geändert, und sie ist zurück auf der Patientenseite
