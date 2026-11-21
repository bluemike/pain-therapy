# Spec Delta

## Purpose

Speichern und Anzeigen von Bemerkungen als Handschrift-Bild.

## ADDED Requirements

### Requirement: Speichern als Bild
In mode "Handschrift als Bild", saving the form SHALL store the handwriting with the record. The server SHALL build the image itself from the raw stroke points and SHALL NOT accept an image from the browser. A required field such as "Diagnose" SHALL count as filled when it holds text or an image. The image SHALL be retained and deleted together with the record it belongs to.

#### Scenario: Diagnose als Bild
- **WHEN** die Therapeutin bei einer neuen Behandlung die Diagnose von Hand schreibt und speichert
- **THEN** ist die Behandlung gespeichert, obwohl kein Text eingetippt wurde, und die Diagnose ist als Bild hinterlegt

#### Scenario: Leere Fläche
- **WHEN** «Diagnose» auf «als Bild» steht, aber nichts geschrieben wurde
- **THEN** meldet das Formular, dass die Diagnose fehlt

### Requirement: Anzeige des Bilds
Wherever the app shows the text of a remark field today, it SHALL show the handwriting image instead when one is stored, scaled to the column width with the alternative text "Handschriftliche Notiz". This SHALL include the "Behandlungen" tab of the patient zone.

#### Scenario: Patienten-Zone
- **WHEN** ein Patient in der Zone den Tab «Behandlungen» öffnet und die Diagnose als Bild gespeichert ist
- **THEN** sieht er die Handschrift statt eines leeren Felds

### Requirement: In Text umwandeln
A stored handwriting image SHALL offer "In Text umwandeln", which runs the recognition on the image and puts the result into the field for review. The text SHALL replace the image only when the form is saved; "Abbrechen" SHALL keep the image.

#### Scenario: Später umwandeln
- **WHEN** Mike bei einer Sitzung mit Handschrift-Bild «In Text umwandeln» tippt, den Text korrigiert und speichert
- **THEN** ist der Vergleich als Text gespeichert und das Bild entfernt
