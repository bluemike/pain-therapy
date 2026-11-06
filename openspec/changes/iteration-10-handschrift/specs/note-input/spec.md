# Spec Delta

## Purpose

Wahl der Eingabeart für Bemerkungsfelder der Praxis-App.

## ADDED Requirements

### Requirement: Umschalter pro Bemerkungsfeld
The practice app SHALL show a switch with the options "Tastatur", "Handschrift → Text" and "Handschrift als Bild" on these fields: treatment "Diagnose", session "Diagnose", session "Vergleich mit der letzten Sitzung" and patient "Weitere Diagnosen". The switch SHALL be operable by touch, Apple Pencil and keyboard. The patient zone fields SHALL NOT show the switch.

#### Scenario: Wechsel auf Handschrift
- **WHEN** die Therapeutin in der Sitzung bei «Diagnose» auf «Handschrift → Text» tippt
- **THEN** ersetzt eine linierte Schreibfläche das Textfeld, mit «Erkennen», «Rückgängig», «Löschen» und «+ Zeile»

#### Scenario: Zone bleibt Tastatur
- **WHEN** ein Patient in der Zone einen Tagebucheintrag mit Notiz erfasst
- **THEN** sieht er ein normales Textfeld ohne Umschalter

### Requirement: Vorgabe pro Benutzer
The practice app SHALL store the last chosen input mode per user and SHALL use it as the default for every remark field of that user. "Mein Profil" SHALL offer the same choice. New users SHALL start with "Tastatur". A field that already holds a stored handwriting image SHALL open in "Handschrift als Bild" regardless of the default.

#### Scenario: Vorgabe gilt in der nächsten Sitzung
- **WHEN** Chrissie bei einer Sitzung auf «Handschrift als Bild» umschaltet und später eine neue Behandlung erfasst
- **THEN** öffnet «Diagnose» der Behandlung direkt mit der Schreibfläche

#### Scenario: Gespeichertes Bild
- **WHEN** Mike mit Vorgabe «Tastatur» eine Sitzung öffnet, deren «Vergleich» als Bild gespeichert ist
- **THEN** zeigt das Feld das Bild in der Stellung «Handschrift als Bild»

### Requirement: Schreibfläche
The writing surface SHALL use the same stroke rendering as the signature, with pen pressure when available. It SHALL span the field width, start with 4 ruled lines and grow by "+ Zeile" up to 12 lines. Once a pen stroke was drawn, touch input SHALL be ignored on the surface. "Rückgängig" SHALL remove the last stroke and "Löschen" SHALL remove all strokes without confirmation. The surface SHALL accept at most 400 strokes and 20 000 points.

#### Scenario: Handballen
- **WHEN** die Therapeutin mit dem Pencil schreibt und die Hand auf dem Bildschirm ablegt
- **THEN** entstehen keine Striche von der Hand

### Requirement: Umschalten mit Inhalt
Switching a field that holds text to "Handschrift als Bild" SHALL keep the text visible and SHALL ask for confirmation on save before the image replaces the text. Switching a field that holds an image to "Tastatur" SHALL keep the image until the user chooses "Bild entfernen".

#### Scenario: Text durch Bild ersetzen
- **WHEN** die Diagnose «LWS-Schmerz» als Text gespeichert ist, die Therapeutin auf «als Bild» umschaltet, schreibt und speichert
- **THEN** fragt ein Dialog «Text durch Handschrift ersetzen?», und nach «Ersetzen» ist nur noch das Bild gespeichert
