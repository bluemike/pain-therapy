# Spec Delta

## Purpose

Gibt der App ein einheitliches Grundgerüst: Navigation, Kopfzeile, responsives Layout für Desktop, iPad und iPhone und ein Erscheinungsbild nach dem Corporate Design von ayanta.ch.

## ADDED Requirements

### Requirement: Erreichbarkeit
The system SHALL be served only over HTTPS at https://pain-therapy.ayanta.ch.

#### Scenario: Aufruf über HTTP
- **WHEN** jemand http://pain-therapy.ayanta.ch aufruft
- **THEN** leitet das System auf die HTTPS-Adresse um

### Requirement: Navigation und Kopfzeile
The system SHALL show on every page except the patient signing mode a header with the Ayanta logo, the app name, the language switch and the signed-in user with a sign-out action, plus navigation to Dashboard and Patienten.

#### Scenario: Navigation
- **WHEN** ein angemeldeter Benutzer in der Navigation "Patienten" wählt
- **THEN** zeigt das System die Patientenliste

### Requirement: Responsives Layout
The system SHALL be fully usable in current Safari on iPad and iPhone and in current desktop browsers (Edge, Chrome, Safari, Firefox), with touch targets of at least 44 by 44 pixels.

#### Scenario: iPhone im Hochformat
- **WHEN** die Patientenliste auf einem iPhone im Hochformat geöffnet wird
- **THEN** ist sie ohne horizontales Scrollen lesbar und die Navigation ist über ein Menü erreichbar

#### Scenario: iPad im Quer- und Hochformat
- **WHEN** ein iPad gedreht wird
- **THEN** passt sich das Layout an, ohne dass Eingaben verloren gehen

### Requirement: Ayanta Corporate Design
The system SHALL use the Ayanta logo, colours and typography from ayanta.ch for all screens and generated PDFs.

#### Scenario: Erscheinungsbild
- **WHEN** ein Benutzer die App öffnet
- **THEN** zeigt sie das Ayanta-Logo sowie die Farben und Schriften von ayanta.ch

### Requirement: Zugänglichkeit
The system SHALL meet WCAG 2.1 level AA for contrast, keyboard operation and form labels.

#### Scenario: Bedienung mit Tastatur
- **WHEN** ein Benutzer das Formular "Neue Patientin" nur mit der Tastatur ausfüllt
- **THEN** erreicht er alle Felder und die Schaltfläche "Speichern" in sinnvoller Reihenfolge
