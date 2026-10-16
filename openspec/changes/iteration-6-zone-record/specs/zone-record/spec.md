# Spec Delta

## Purpose

Zeigt der Patientin ihre Behandlungen und Konsultationen strukturiert in der Patienten-Zone, wie in der Patientenakte einer Arztpraxis, und regelt Navigation und Zugang der Zone.

## ADDED Requirements

### Requirement: Behandlungen
The system SHALL show in the patient zone, under "Behandlungen", all treatments of the signed-in patient, newest first, each with start date, treatment region, diagnosis, pain at the start, number of consultations and the date of the last consultation.

#### Scenario: Übersicht
- **WHEN** eine Patientin mit zwei Behandlungen "Behandlungen" öffnet
- **THEN** sieht sie beide mit Beginn, Region, Diagnose, Schmerz zu Beginn und Anzahl Konsultationen, die neuere zuoberst

#### Scenario: Noch keine Behandlung
- **WHEN** eine Patientin ohne Behandlung "Behandlungen" öffnet
- **THEN** zeigt die Zone "Noch keine Behandlungen" mit einem kurzen Hinweis, dass hier nach dem ersten Termin die Behandlungen erscheinen

### Requirement: Konsultationen einer Behandlung
The system SHALL show for a treatment all its consultations in order, each with number, date, diagnosis, pain before and after, comparison, the Osteopressur points, the exercises done in the practice, the Faszien-Rollmassage and the home program with a link to its current Übungsblatt. Missing values SHALL be shown as "nicht erfasst". The view SHALL show the pain values of all consultations as a simple course.

#### Scenario: Konsultation ansehen
- **WHEN** die Patientin eine Behandlung öffnet
- **THEN** sieht sie jede Konsultation mit Datum, Schmerz vorher und nachher, behandelten Punkten, Übungen und Heimprogramm

#### Scenario: Übungsblatt aus der Konsultation
- **WHEN** die Patientin bei einer Konsultation "Übungsblatt" antippt
- **THEN** öffnet sich das aktuelle Übungsblatt dieser Konsultation wie unter "Dokumente"

### Requirement: Nicht in der Patienten-Zone
The system MUST NOT show in the patient zone clinical photos, the anamnesis, the history of the record, the names of practice staff or data of other patients.

#### Scenario: Fotos
- **WHEN** zu einer Konsultation Fotos erfasst sind
- **THEN** zeigt die Patienten-Zone keine Fotos und keinen Hinweis auf sie

### Requirement: Nur lesen
The system SHALL show treatments and consultations in the patient zone read-only. The patient zone MUST NOT change treatments, consultations or their parts.

#### Scenario: Keine Änderung
- **WHEN** die Rolle der Patienten-Zone eine Konsultation ändern will
- **THEN** verweigert die Datenbank den Zugriff

### Requirement: Navigation der Patienten-Zone
The system SHALL offer in the patient zone the tabs "Übungen" (only with an active home program), "Behandlungen" and "Dokumente", usable on a phone of 390 px width without horizontal scrolling. Without an active home program the zone SHALL open with "Behandlungen". A pending signature SHALL keep its priority over all tabs.

#### Scenario: Ohne aktives Heimprogramm
- **WHEN** eine Patientin nach Ablauf des Heimprogramms die Zone öffnet
- **THEN** sieht sie "Behandlungen" und "Dokumente", aber keinen Reiter "Übungen"

#### Scenario: Unterschrift ausstehend
- **WHEN** für die Patientin eine Unterschrift aussteht
- **THEN** zeigt die Zone zuerst die Aufgabe "Haftungsausschluss unterschreiben", und die Reiter erscheinen erst danach

### Requirement: Gültigkeit des Links mit Patientenakte
The system SHALL accept an access link to the patient zone for an active patient who has at least one treatment or one archived document, in addition to an active home program or a pending signature. All other rules of the access link SHALL stay unchanged: at most 6 months, confirmation with the full date of birth, locks after failed attempts, revoking and replacing. Deactivating the patient SHALL end all device sessions.

#### Scenario: Nach dem Heimprogramm
- **WHEN** das Heimprogramm einer Patientin abgelaufen ist und sie den Link innerhalb von 6 Monaten öffnet
- **THEN** kann sie sich mit dem Geburtsdatum bestätigen und sieht Behandlungen und Dokumente

#### Scenario: Deaktivierte Patientin
- **WHEN** die Praxis eine Patientin deaktiviert
- **THEN** gilt ihr Link nicht mehr, und laufende Sitzungen enden
