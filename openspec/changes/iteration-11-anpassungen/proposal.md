# Proposal

## Why

Mike Franz hat am 08.11.2026 drei Anpassungen gewünscht. Das Übungsblatt soll standardmässig wieder das ganze Blatt zeigen, die Suche soll nicht mehr nach der Versicherungsnummer suchen, und Schmerzangaben sollen mit einem Schieberegler statt mit elf Knöpfen erfasst werden.

## What Changes

- **Übungsblatt:** Beim Senden oder Drucken wählt die Therapeutin den Inhalt.
  - Neu ist «Gesamtes Blatt» der Standard: Jede verordnete Übung zeigt ihr ganzes Übungsblatt.
  - «Nur verordnete Teile» zeigt wie bisher die Faszien-Rollmassage und die gewählte Engpassdehnung.
  - Die Vorschau folgt der Wahl. Die Wahl wird mit dem Dokument und im Protokoll festgehalten.
- **Suche:** Die Patientensuche findet nach Name oder Geburtsdatum, nicht mehr nach Versicherungsnummer. **BREAKING**
- **Schmerz in %:** «Schmerzgrad zu Beginn», «Schmerz vorher» und «Schmerz nachher» werden mit einem Schieberegler von 0 bis 100 % in 10-%-Schritten erfasst. Ohne Wert steht «nicht erfasst». «Zurücksetzen» hebt einen optionalen Wert auf.

Nicht Teil dieser Änderung: Die Bewertung 1 bis 10 im Übungstagebuch der Patienten-Zone ist keine Schmerz-%-Angabe und bleibt unverändert.

## Impact

- Praxis-App: `PainSlider`, Behandlungs- und Sitzungsformular, Abschlussseite mit Übungsblatt, PDF des Übungsblatts, Patientensuche.
- Keine Migration: Die Wahl steht im Snapshot `prescriptions.layout` des Übungsblatts.
