# Spec Delta

## ADDED Requirements

### Requirement: Daten gehören genau einer Praxis
The system SHALL assign every patient, treatment, session, document, photo, exercise sheet, zone link, diary entry and audit event to exactly one Praxis. A user SHALL only read and change data of the Praxis of their membership. The catalog (Bereiche, Osteopressur-Punkte, Übungen, Übungsmedien) SHALL be shared by all Praxen.

#### Scenario: Fremde Patientin nicht sichtbar
- **WHEN** eine Therapeutin der Praxis A die Adresse einer Patientin der Praxis B direkt aufruft
- **THEN** zeigt das System «Nicht gefunden» und protokolliert den Versuch

#### Scenario: Suche bleibt in der Praxis
- **WHEN** eine Therapeutin der Praxis A nach «Müller» sucht
- **THEN** listet das System nur Patientinnen der Praxis A

#### Scenario: Katalog gemeinsam
- **WHEN** Therapeutinnen der Praxen A und B das Übungsblatt 2A öffnen
- **THEN** sehen beide dieselben Bilder, Texte und Audios

### Requirement: Trennung in der Datenbank erzwungen
The database SHALL enforce the separation with row-level security on every table holding practice data, so that a query without a set Praxis returns no rows and a query cannot read or write rows of another Praxis. Only platform functions and migrations MAY bypass it, and each such call SHALL be logged.

#### Scenario: Abfrage ohne Praxis
- **WHEN** eine Abfrage der Praxis-App ohne gesetzte Praxis auf die Patiententabelle zugreift
- **THEN** liefert die Datenbank keine Zeilen

#### Scenario: Schreiben in fremde Praxis
- **WHEN** ein Fehler im Code versucht, eine Sitzung mit der Praxis B zu speichern, während die Anfrage der Praxis A gilt
- **THEN** lehnt die Datenbank das Speichern ab

### Requirement: Dateien pro Praxis
The system SHALL store new signed documents and clinical photos under a path per Praxis and SHALL deliver a file only after checking that its database row belongs to the Praxis of the request.

#### Scenario: Foto einer fremden Praxis
- **WHEN** eine angemeldete Therapeutin der Praxis A die Foto-Adresse einer Behandlung der Praxis B aufruft
- **THEN** liefert das System kein Bild

### Requirement: Dokumentnummern pro Praxis
The system SHALL number signed documents per Praxis and year as `<Kürzel>-<Jahr>-<laufende Nummer>`, with the Kürzel from the practice settings.

#### Scenario: Erste Nummer einer neuen Praxis
- **WHEN** eine neue Praxis mit Kürzel «PT» 2026 ihr erstes Dokument unterschreiben lässt
- **THEN** erhält es die Nummer PT-2026-00001, unabhängig von den Nummern anderer Praxen

### Requirement: Bestehende Daten an Falera
On migration the system SHALL assign all existing data and users to the Praxis «Pain Therapy Falera» with the address «Pain Therapy | Via Prau da Cuort 5 | 7153 Falera», keeping document numbers and stored file paths unchanged.

#### Scenario: Nach der Migration
- **WHEN** Chrissie sich nach der Umstellung anmeldet
- **THEN** sieht sie alle bisherigen Patientinnen, Behandlungen und Dokumente unverändert
