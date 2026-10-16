# Spec Delta

## Purpose

Legt die unterschriebenen Haftungsausschlüsse und die Übungsblätter der Patientin strukturiert in der Patienten-Zone ab, zum Ansehen und Herunterladen.

## ADDED Requirements

### Requirement: Dokumente der Patientin
The system SHALL show in the patient zone, under "Dokumente", all archived documents of the signed-in patient: every signed liability waiver and every Übungsblatt. The list SHALL be grouped by kind ("Haftungsausschluss", "Übungsblätter") and sorted by date, newest first, with date, document number and, for Übungsblätter, the consultation and the version. A newer version of an Übungsblatt SHALL be marked as current; older versions stay listed.

#### Scenario: Liste
- **WHEN** eine Patientin mit einer Unterschrift und zwei Konsultationen mit Übungsblatt "Dokumente" öffnet
- **THEN** sieht sie den Haftungsausschluss und beide Übungsblätter mit Datum und Dokumentnummer, das neueste zuoberst

#### Scenario: Neue Version eines Übungsblatts
- **WHEN** die Praxis für eine Konsultation ein geändertes Übungsblatt erstellt
- **THEN** steht die neue Version mit "aktuell" in der Liste, und die ältere bleibt darunter abrufbar

#### Scenario: Unterschrift wird noch verarbeitet
- **WHEN** die Patientin eben in der Zone unterschrieben hat und das PDF noch nicht erzeugt ist
- **THEN** zeigt die Liste "Haftungsausschluss wird erstellt" ohne Link, bis das PDF vorliegt

### Requirement: Dokument ansehen und herunterladen
The system SHALL deliver a document of the list as the archived PDF, unchanged, to view in the browser or to download. It MUST deliver a document only to a valid device session of the patient the document belongs to, and MUST NOT cache it in shared caches.

#### Scenario: Ansehen auf dem Telefon
- **WHEN** die Patientin ein Übungsblatt antippt
- **THEN** öffnet das Telefon das archivierte PDF mit derselben Dokumentnummer wie in der Praxis

#### Scenario: Fremdes Dokument
- **WHEN** jemand mit einer gültigen Sitzung die Adresse eines Dokuments einer anderen Patientin aufruft
- **THEN** antwortet das System wie bei einem unbekannten Dokument und liefert nichts aus

#### Scenario: Sitzung beendet
- **WHEN** jemand ohne gültige Sitzung die Adresse eines Dokuments aufruft
- **THEN** liefert das System kein PDF und zeigt die neutrale Startseite

### Requirement: Protokoll der Abrufe
The system SHALL log every retrieval of a document from the patient zone with the document number and the device session, and SHALL show it in the history of the record as "Dokument in der Patienten-Zone abgerufen".

#### Scenario: Abruf im Verlauf
- **WHEN** die Patientin ihren Haftungsausschluss herunterlädt
- **THEN** zeigt der Verlauf der Akte den Abruf mit Dokumentnummer und Zeitpunkt

### Requirement: Rechte für Dokumente
The system SHALL let the patient zone read only the columns of documents and Übungsblätter it needs for the list and the retrieval, and only read access to the document archive. The patient zone MUST NOT change or delete documents and MUST NOT read email deliveries of documents.

#### Scenario: Keine Änderung
- **WHEN** die Rolle der Patienten-Zone ein Dokument ändern oder löschen will
- **THEN** verweigert die Datenbank beziehungsweise der Speicher den Zugriff
