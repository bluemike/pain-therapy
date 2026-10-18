# Spec Delta

## Purpose

Bedienung der Kopfzeile, der Dialoge und der PDFs auf iPad und iPhone.

## ADDED Requirements

### Requirement: Profilmenü am Initialen-Button
The practice app SHALL open a menu with "Mein Profil" and "Abmelden" when the user taps the initials button in the header. It SHALL NOT show separate header entries for these two actions. The menu SHALL close on a tap outside or on Escape.

#### Scenario: Abmelden über das Menü
- **WHEN** Mike auf «MF» tippt und «Abmelden» wählt
- **THEN** wird er abgemeldet und sieht die Anmeldeseite

#### Scenario: Menü schliessen
- **WHEN** das Menü offen ist und Mike daneben tippt
- **THEN** schliesst sich das Menü, ohne etwas auszulösen

### Requirement: Zentrierte Dialoge
The practice app and the patient zone SHALL show every dialog centered in the viewport above a dimmed backdrop, including the image preview. The dialog SHALL fit the screen of an iPhone in portrait mode and scroll inside when its content is taller.

#### Scenario: Einladung zur Unterschrift
- **WHEN** die Therapeutin «Zur Unterschrift einladen» öffnet
- **THEN** erscheint der Dialog mittig über der abgedunkelten Seite und nicht oben links

### Requirement: PDF in der App
The practice app and the patient zone SHALL open every PDF (signed disclaimer, exercise sheet, preview) in a full-screen view inside the app with a "Zurück" button that returns to the previous page. The view SHALL show all pages scrollable on iPad and iPhone and SHALL offer "Drucken" or "Herunterladen". It SHALL NOT open a new browser tab. The printout of an exercise sheet keeps its own window, which the browser needs for printing; clinical photos keep their own view.

#### Scenario: Vorschau des Übungsprogramms
- **WHEN** die Therapeutin in der Sitzung die Vorschau des Übungsprogramms öffnet
- **THEN** zeigt die App das PDF im Vollbild mit allen Seiten, und «Zurück» führt in die Sitzung zurück

#### Scenario: Dokument in der Zone
- **WHEN** ein Patient unter «Dokumente» sein Übungsblatt öffnet
- **THEN** sieht er es im Vollbild der Zone und kommt mit «Zurück» zur Liste
