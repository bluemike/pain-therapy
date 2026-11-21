# Spec Delta

## Purpose

Umwandlung von Handschrift in Text, mit Verarbeitung in der Schweiz und Prüfung durch die Therapeutin.

## ADDED Requirements

### Requirement: Erkennen in Text
In mode "Handschrift → Text", "Erkennen" SHALL send the handwriting as an image to Azure AI Document Intelligence (model Read) in the region Switzerland North and SHALL insert the recognized text into the field. The text SHALL be marked "erkannt – bitte prüfen" and SHALL be editable before it is saved with the form. Nothing SHALL be saved until the form is saved.

#### Scenario: Diagnose erkennen
- **WHEN** die Therapeutin «Schulter re, Bewegung eingeschränkt» schreibt und «Erkennen» tippt
- **THEN** steht nach wenigen Sekunden der erkannte Text im Feld, die Schreibfläche ist leer und das Feld ist als «erkannt – bitte prüfen» markiert

#### Scenario: Weiterschreiben
- **WHEN** das Feld schon Text enthält und eine weitere Zeile erkannt wird
- **THEN** wird der neue Text an der Cursorposition eingefügt und der bisherige Text bleibt

### Requirement: Datenschutz der Erkennung
The recognition SHALL run only in Azure Switzerland North with the managed identity of the practice app, without API keys. The server SHALL NOT store or log the image or the recognized text; the audit log SHALL record only the event `note.recognized` with the field and the number of characters. Only users with the role Therapist or Admin SHALL call the recognition. Each user SHALL be limited to 60 recognitions per hour.

#### Scenario: Kein Bild gespeichert
- **WHEN** eine Erkennung abgeschlossen ist
- **THEN** gibt es weder in der Datenbank noch im Blob-Speicher noch in den Logs eine Kopie der Handschrift

### Requirement: Fehler der Erkennung
When the recognition fails, times out after 15 seconds or the quota is exhausted, the app SHALL show "Erkennung gerade nicht verfügbar" and SHALL keep the strokes on the surface so the user can retry, save as image or type.

#### Scenario: Kontingent erschöpft
- **WHEN** das monatliche Gratis-Kontingent aufgebraucht ist und die Therapeutin «Erkennen» tippt
- **THEN** bleibt die Schrift auf der Fläche, und die App bietet «Erneut versuchen» und «Als Bild speichern» an
