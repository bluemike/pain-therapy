# Spec Delta

## Purpose

Lässt Patientinnen und Patienten nach der Aufnahme den Haftungsausschluss mit Patienteninformation und Datenschutzhinweis auf dem iPad lesen und mit ihrer Unterschrift bestätigen, ohne dass sie dabei andere Daten der App sehen.

## ADDED Requirements

### Requirement: Unterschriftsablauf starten
The system SHALL let a user start the signing process for a patient right after creating the patient and at any later time from the patient record.

#### Scenario: Direkt nach der Aufnahme
- **WHEN** die Therapeutin einen neuen Patienten gespeichert hat und "An Patient übergeben" wählt
- **THEN** wechselt das Gerät in den Patientenmodus mit dem Haftungsausschluss in der Sprache des Patienten

### Requirement: Patientenmodus
The system SHALL show in patient mode only the disclaimer and signing screen for that one patient, with no navigation and no other patient data.

#### Scenario: Navigation im Patientenmodus
- **WHEN** der Patient im Patientenmodus versucht, eine andere Seite der App aufzurufen
- **THEN** bleibt das System im Unterschriftsbildschirm

### Requirement: Patientenmodus verlassen
The system SHALL leave patient mode only after the signed-in user re-authenticates with Entra ID, whether the signature was completed or aborted.

#### Scenario: Gerät zurückgeben
- **WHEN** der Patient unterschrieben hat und die Therapeutin "Zurück zur Praxis" wählt
- **THEN** verlangt das System ihre erneute Anmeldung und zeigt danach die Akte des Patienten

#### Scenario: Abbruch
- **WHEN** der Patient nicht unterschreiben will und die Therapeutin den Patientenmodus nach erneuter Anmeldung verlässt
- **THEN** bleibt der Haftungsausschluss als "nicht unterschrieben" in der Akte stehen

### Requirement: Inhalt des Formulars
The system SHALL show the patient's personal details for checking, followed by the current version of the liability waiver, the patient information on the therapy, the privacy notice and the consent choices.

#### Scenario: Personalien prüfen
- **WHEN** der Patient im Formular einen Fehler in seiner Adresse bemerkt
- **THEN** kann er dies im Formular anmerken, und die Anmerkung erscheint nach der Rückgabe bei der Therapeutin

### Requirement: Vollständiges Lesen erzwingen
The system SHALL enable the signature only after the patient has scrolled to the end of the text.

#### Scenario: Nicht bis zum Ende gescrollt
- **WHEN** der Patient das Ende des Textes noch nicht erreicht hat
- **THEN** ist das Unterschriftsfeld gesperrt und ein Hinweis bittet, den Text bis zum Ende zu lesen

### Requirement: Einwilligungen auswählen
The system SHALL require confirmation of the liability waiver and of data processing, and SHALL offer consent to unencrypted email as an optional choice that is not preselected.

#### Scenario: Pflicht-Einwilligung fehlt
- **WHEN** der Patient die Datenbearbeitung nicht bestätigt
- **THEN** lässt sich das Formular nicht abschliessen, und das System erklärt, dass eine Behandlung ohne diese Einwilligung nicht möglich ist

#### Scenario: E-Mail-Einwilligung abgelehnt
- **WHEN** der Patient die Einwilligung für unverschlüsselte E-Mail nicht ankreuzt
- **THEN** kann er trotzdem unterschreiben, und die Einwilligung wird als nicht erteilt gespeichert

### Requirement: Unterschriftsfeld
The system SHALL capture the signature with finger or Apple Pencil in a signature field with smooth, pressure-sensitive strokes, and SHALL let the patient clear and redo it before confirming.

#### Scenario: Unterschrift wiederholen
- **WHEN** der Patient "Löschen" im Unterschriftsfeld wählt
- **THEN** ist das Feld leer und er kann neu unterschreiben

#### Scenario: Leeres Unterschriftsfeld
- **WHEN** der Patient ohne Unterschrift auf "Unterschreiben" tippt
- **THEN** schliesst das System nicht ab und bittet um eine Unterschrift

### Requirement: Abschluss der Unterschrift
The system SHALL record on completion the patient, the text version, the consent choices, the signature, the place and the time, and SHALL show the patient a confirmation.

#### Scenario: Erfolgreich unterschrieben
- **WHEN** der Patient den Text gelesen, die Pflicht-Einwilligungen bestätigt und unterschrieben hat
- **THEN** zeigt das System "Vielen Dank" und speichert die Einwilligungen mit Textversion und Zeitpunkt

### Requirement: Versionierte Formulartexte
The system SHALL store the disclaimer texts in German and English as versions; Administration SHALL publish a new version without changing earlier ones, and patients who signed an older version SHALL be marked for re-signing.

#### Scenario: Neue Textversion
- **WHEN** die Administration eine neue Version des Datenschutzhinweises veröffentlicht
- **THEN** zeigt die Akte von Patienten mit älterer Version "Neue Unterschrift nötig" und das Dashboard führt sie unter "Unterschrift ausstehend"
