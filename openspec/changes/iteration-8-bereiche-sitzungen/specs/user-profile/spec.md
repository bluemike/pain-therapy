# Spec Delta

## Purpose

Anzeigename und Berufsbezeichnung pro Person sowie eine kurze Begrüssung nach dem Anmelden.

## ADDED Requirements

### Requirement: Profil
The system SHALL store for every user a display name and a professional title ("Therapeutin" or "Therapeut"), editable by that user under "Mein Profil". For christina.franz@ayanta.ch the system SHALL preset "Chrissie" and "Therapeutin", for mike.franz@ayanta.ch "Mike" and "Therapeut". A new user SHALL get the first name from Entra ID and "Therapeutin" until changed.

#### Scenario: Profil ändern
- **WHEN** Mike unter "Mein Profil" den Anzeigenamen auf "Michael" ändert und speichert
- **THEN** zeigt die App ab sofort "Michael" in der Begrüssung, und der Verlauf hält die Änderung fest

#### Scenario: Vorbelegung
- **WHEN** Christina Franz sich nach dem Deployment anmeldet
- **THEN** steht in ihrem Profil "Chrissie" und "Therapeutin"

### Requirement: Begrüssung einmal nach dem Anmelden
The system SHALL greet the user with "Hallo <Anzeigename>" (English: "Hello <display name>") only on the first page after signing in, and SHALL NOT show it again until the next sign-in. It SHALL NOT use greetings by time of day.

#### Scenario: Erste Seite
- **WHEN** Chrissie sich am Nachmittag anmeldet
- **THEN** steht auf dem Cockpit "Hallo Chrissie" und nicht "Guten Tag"

#### Scenario: Weitere Seiten
- **WHEN** sie danach eine Patientin öffnet und wieder ins Cockpit wechselt
- **THEN** erscheint keine Begrüssung mehr

### Requirement: Berufsbezeichnung in Dokumenten
The system SHALL name the responsible person on documents as "<Berufsbezeichnung>: <voller Name>" and SHALL never call a user "Arzt" or "Ärztin".

#### Scenario: Übungsblatt
- **WHEN** Christina Franz ein Übungsblatt erstellt
- **THEN** steht darauf "Therapeutin: Christina Franz"
