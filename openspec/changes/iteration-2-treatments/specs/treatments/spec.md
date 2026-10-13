# Spec Delta

## Purpose

Führt die Behandlungen einer Patientin oder eines Patienten: je Schmerzbereich eine Behandlung mit Diagnose, Bereich, Schmerzgrad zu Beginn und Fotos, unter der die Konsultationen gesammelt werden.

## ADDED Requirements

### Requirement: Behandlungsliste
The system SHALL show all treatments of a patient in the record, newest first, each with treatment area, date and time opened, pain level at the start, diagnosis, number of photos and its consultations.

#### Scenario: Behandlungen ansehen
- **WHEN** ein Benutzer die Akte einer Patientin mit zwei Behandlungen öffnet
- **THEN** sieht er beide Behandlungen, die neueste zuoberst, jede mit ihren Konsultationen

#### Scenario: Noch keine Behandlung
- **WHEN** eine Patientin noch keine Behandlung hat
- **THEN** zeigt die Akte einen Hinweis und die Schaltfläche "Neue Behandlung"

### Requirement: Behandlung eröffnen
The system SHALL let users with the role Therapist or Admin open any number of treatments for an active patient. Date and time, diagnosis (free text), treatment area and pain level at the start SHALL be required. Date and time SHALL default to now and MUST NOT be in the future.

#### Scenario: Erfolgreich eröffnen
- **WHEN** die Therapeutin Diagnose, Bereich "Lendenwirbelsäule, Bauch" und Schmerzgrad 60 % angibt und speichert
- **THEN** legt das System die Behandlung mit dem aktuellen Datum und der aktuellen Zeit an und zeigt sie in der Akte

#### Scenario: Pflichtfeld fehlt
- **WHEN** der Bereich nicht gewählt ist
- **THEN** speichert das System nicht und markiert das Feld mit einer Meldung in der Sprache der Oberfläche

#### Scenario: Zeitpunkt in der Zukunft
- **WHEN** ein Datum oder eine Zeit nach jetzt eingegeben wird
- **THEN** speichert das System nicht und weist auf den Zeitpunkt hin

#### Scenario: Zweite Behandlung im selben Bereich
- **WHEN** eine Patientin schon eine Behandlung im Bereich "Schulter" hat und eine weitere im selben Bereich eröffnet wird
- **THEN** legt das System eine zweite, eigenständige Behandlung an

#### Scenario: Inaktiver Patient
- **WHEN** eine Patientin deaktiviert ist
- **THEN** bietet das System keine neue Behandlung an; bestehende Behandlungen bleiben sichtbar

#### Scenario: Haftungsausschluss nicht unterschrieben
- **WHEN** für die Patientin kein gültiger unterschriebener Haftungsausschluss vorliegt
- **THEN** eröffnet das System keine Behandlung und bietet an, das Formular an die Patientin zu übergeben

### Requirement: Schmerzgrad zu Beginn
The system SHALL record the pain level at the start of a treatment as a percentage from 0 to 100 in steps of 10, chosen from a list without a preselected value.

#### Scenario: Schmerzgrad wählen
- **WHEN** die Therapeutin die Auswahl des Schmerzgrads öffnet
- **THEN** sieht sie die Werte 0 %, 10 % bis 100 %, und keiner ist vorausgewählt

### Requirement: Behandlung ändern
The system SHALL let users with the role Therapist or Admin change date and time, diagnosis, area and pain level of a treatment and add or remove photos. Once a consultation of the treatment is saved, the system MUST NOT allow changing the area, and the start MUST NOT lie after the first consultation; diagnosis, pain level and photos stay changeable. Every change SHALL appear in the record's history with old and new value. The system MUST NOT offer deleting a treatment.

#### Scenario: Diagnose korrigieren
- **WHEN** die Therapeutin die Diagnose einer Behandlung ändert
- **THEN** zeigt die Behandlung die neue Diagnose, und die Änderungshistorie zeigt alte und neue

#### Scenario: Bereich nach der ersten Konsultation
- **WHEN** zu einer Behandlung mindestens eine Konsultation gespeichert ist
- **THEN** zeigt das Formular «Behandlung ändern» den Bereich schreibgeschützt mit dem Hinweis, bei falschem Bereich eine neue Behandlung zu eröffnen, und das System lehnt eine Änderung des Bereichs auch serverseitig ab

#### Scenario: Beginn nicht nach der ersten Konsultation
- **WHEN** die Therapeutin Datum und Zeit einer Behandlung auf einen Zeitpunkt nach ihrer ersten Konsultation ändert
- **THEN** lehnt das System das Speichern ab und zeigt beim Feld Datum und Zeit, dass die Behandlung nicht nach der ersten Konsultation beginnen darf

#### Scenario: Kein Löschen
- **WHEN** ein Benutzer eine Behandlung ansieht
- **THEN** bietet das System keine Funktion zum Löschen an
