# Spec Delta

## Purpose

Schnellere Bestätigung mit dem Geburtsdatum in der Patienten-Zone.

## ADDED Requirements

### Requirement: Geburtsdatum mit automatischem Weiterspringen
The patient zone SHALL move the cursor from the day field to the month field after 2 digits, and from the month field to the year field after 2 digits. The fields SHALL stay editable; deleting in an empty field SHALL move back to the previous field. After 4 digits in the year field the zone SHALL submit the date automatically. The existing limits on attempts SHALL apply unchanged.

#### Scenario: Flüssige Eingabe
- **WHEN** ein Patient «0», «5», «0», «3», «1», «9», «8», «0» tippt
- **THEN** springt der Cursor nach «05» und «03» weiter, und nach «1980» wird ohne weiteren Tipp bestätigt

#### Scenario: Korrigieren
- **WHEN** er im leeren Jahresfeld löscht
- **THEN** springt der Cursor zurück ins Monatsfeld, und er kann den Monat korrigieren
