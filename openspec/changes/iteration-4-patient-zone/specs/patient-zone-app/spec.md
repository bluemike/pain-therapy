# Spec Delta

## Purpose

Stellt die Patienten-Zone als eigene App ohne Entra-Anmeldung bereit, separat deployt, auf derselben Datenbank mit minimalen Rechten.

## ADDED Requirements

### Requirement: Eigene App ohne Entra-Anmeldung
The system SHALL provide the patient zone as a separate web application with its own container image, its own Azure Container App and its own hostname. It SHALL NOT use Entra ID sign-in; access SHALL be granted only through the access link and the confirmation with the date of birth. The practice application SHALL remain reachable only for Ayanta users.

#### Scenario: Eigener Hostname
- **WHEN** die Patientin den Link öffnet
- **THEN** öffnet sich die Patienten-Zone unter ihrem eigenen Hostnamen ohne Anmeldung bei Microsoft

#### Scenario: Praxis-App unverändert
- **WHEN** jemand ohne Ayanta-Konto die Adresse der Praxis-App aufruft
- **THEN** verlangt die Praxis-App weiterhin die Anmeldung über Entra ID

### Requirement: Gemeinsame Datenbank mit eigener Rolle
The patient zone SHALL use the same PostgreSQL database as the practice application with its own database role `patient_zone`. It MUST NOT be allowed to delete rows or to read anamnesis, diagnoses, photos, documents or contact data.

#### Scenario: Diagnose nicht lesbar
- **WHEN** die Rolle `patient_zone` die Diagnose einer Konsultation abfragt
- **THEN** verweigert die Datenbank den Zugriff

### Requirement: Rechte der Rolle patient_zone
The role `patient_zone` SHALL only read the patient fields id, first name, language, date of birth and status, read the prescriptions and exercise data of the home program, read and update the counters of access links, read, insert and update device sessions and exercise log entries, and insert audit events. Database migrations SHALL run only in the migration job of the practice application, which SHALL reapply these grants after each migration.

#### Scenario: Rechte nach einer Migration
- **WHEN** der Migrationsjob eine neue Migration ausführt
- **THEN** setzt er die Rechte der Rolle `patient_zone` danach neu, und ein Test vergleicht sie mit der erlaubten Liste

### Requirement: Nur das eigene Heimprogramm
The patient zone SHALL show only data of the patient of the confirmed link: her first name, her current home program and her own exercise log. It MUST NOT show diagnoses, pain values, clinical photos, documents or notes of the therapist. Exercise images SHALL be delivered only to valid sessions and only for exercises of the patient's current program.

#### Scenario: Bild ohne Sitzung
- **WHEN** jemand die Adresse eines Übungsbilds der Patienten-Zone ohne gültige Sitzung aufruft
- **THEN** liefert das System das Bild nicht aus

#### Scenario: Fremde Übung
- **WHEN** eine angemeldete Patientin das Bild einer Übung abruft, die nicht in ihrem Programm steht
- **THEN** liefert das System das Bild nicht aus

### Requirement: Sprache der Patientin
The patient zone SHALL use the patient's preferred language, German or English, for all texts and exercise names.

#### Scenario: Englisch
- **WHEN** eine Patientin mit Sprache Englisch die Patienten-Zone öffnet
- **THEN** sind Oberfläche und Übungsnamen auf Englisch

### Requirement: Mobil und zugänglich
The patient zone SHALL be designed for phones first and SHALL work without horizontal scrolling from 360 px width up to tablet width. It SHALL meet WCAG 2.1 AA, with touch targets of at least 44 × 44 px and numeric keyboards for date entry.

#### Scenario: Telefon
- **WHEN** die Patientin die Patienten-Zone auf einem Telefon mit 390 px Breite öffnet
- **THEN** sind alle Bedienelemente ohne seitliches Scrollen erreichbar, und eine axe-Prüfung meldet keine Verstösse

### Requirement: Datenschutz und Sicherheit
The patient zone SHALL show a short privacy note on the confirmation page and in the footer, SHALL record every access in the audit log, and SHALL send a strict content security policy without third-party sources, `Referrer-Policy: no-referrer`, HSTS and `noindex`. Addresses MUST NOT contain personal data other than the token of the access link.

#### Scenario: Datenschutzhinweis
- **WHEN** die Patientin die Bestätigungsseite öffnet
- **THEN** sieht sie einen kurzen Hinweis, wer ihre Einträge sieht und wozu, mit Kontakt der Praxis

#### Scenario: Zugriff protokolliert
- **WHEN** die Patientin einen Eintrag speichert
- **THEN** enthält das Protokoll ein Ereignis der Patienten-Zone mit Patientin, Link und Zeitpunkt

### Requirement: Betrieb der Patienten-Zone
The patient zone SHALL provide a health endpoint that checks the database connection with its own role. It SHALL get its secrets from Key Vault through its own managed identity, which SHALL have read access only to its own secrets and to the container `exercise-media`. The deployment workflow SHALL build and roll out both applications with the same version.

#### Scenario: Deployment
- **WHEN** der Workflow nach einem Merge auf `main` läuft
- **THEN** baut er beide Images, führt die Migration einmal aus, rollt beide Apps aus und prüft den Gesundheits-Endpunkt beider Apps
