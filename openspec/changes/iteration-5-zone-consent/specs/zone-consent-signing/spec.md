# Spec Delta

## Purpose

Lässt die Patientin den Haftungsausschluss mit Patienteninformation und Datenschutzhinweis in der Patienten-Zone auf dem eigenen Telefon lesen und unterschreiben, bevor sie dort ihre Übungen sieht.

## ADDED Requirements

### Requirement: Unterschrift vor den Übungen
The patient zone SHALL show, while a signature is pending for the confirmed patient, only the task "Haftungsausschluss unterschreiben" with a short explanation and a button to start. Home program and exercise log SHALL be shown only after the signature is completed.

#### Scenario: Erste Anmeldung
- **WHEN** eine neu eingeladene Patientin ihr Geburtsdatum bestätigt hat
- **THEN** zeigt die Patienten-Zone die Aufgabe "Haftungsausschluss unterschreiben" und keine Übungen

#### Scenario: Neue Textversion bei laufendem Heimprogramm
- **WHEN** eine Patientin mit aktivem Heimprogramm die Patienten-Zone öffnet, nachdem eine neue Textversion veröffentlicht wurde
- **THEN** sieht sie zuerst die Aufgabe "Haftungsausschluss unterschreiben" und nach der Unterschrift wieder ihre Übungen

### Requirement: Inhalt des Formulars in der Patienten-Zone
The patient zone SHALL show the same content as the patient mode on the iPad: the patient's personal details for checking (name, date of birth, address, phone, email, insurer and insurance number), the current text version in her language with liability waiver, patient information and privacy notice, and the consent choices. The patient SHALL be able to add a remark on her personal details but MUST NOT be able to change them.

#### Scenario: Personalien prüfen
- **WHEN** die Patientin bemerkt, dass ihre Telefonnummer falsch ist
- **THEN** kann sie das im Feld "Anmerkung zu meinen Angaben" festhalten, und die Personalien bleiben unverändert

#### Scenario: Sprache der Patientin
- **WHEN** eine Patientin mit Sprache Englisch das Formular öffnet
- **THEN** sind Oberfläche und Formulartext auf Englisch, in der gültigen englischen Version

### Requirement: Lesen und Einwilligen
The patient zone SHALL enable the signature only after the patient has scrolled to the end of the text. It SHALL require confirmation of the liability waiver and of data processing, and SHALL offer consent to unencrypted email as an optional choice that is not preselected.

#### Scenario: Nicht bis zum Ende gelesen
- **WHEN** die Patientin das Ende des Textes noch nicht erreicht hat
- **THEN** ist das Unterschriftsfeld gesperrt und ein Hinweis bittet, den Text bis zum Ende zu lesen

#### Scenario: Datenbearbeitung nicht bestätigt
- **WHEN** die Patientin die Datenbearbeitung nicht bestätigt
- **THEN** lässt sich das Formular nicht abschliessen, und das System erklärt, dass eine Behandlung ohne diese Einwilligung nicht möglich ist

### Requirement: Unterschrift auf dem Telefon
The patient zone SHALL capture the signature with the finger in a signature field that uses the available width of the phone, with smooth strokes, "Unterschrift löschen" to start again and a check that the field is not empty. Scrolling the page MUST NOT draw in the field, and drawing in the field MUST NOT scroll the page.

#### Scenario: Unterschrift wiederholen
- **WHEN** die Patientin "Unterschrift löschen" wählt
- **THEN** ist das Feld leer und sie kann neu unterschreiben

#### Scenario: Leeres Feld
- **WHEN** die Patientin ohne Unterschrift auf "Unterschreiben" tippt
- **THEN** schliesst das System nicht ab und bittet um eine Unterschrift

### Requirement: Abschluss in der Patienten-Zone
The system SHALL record on completion the patient, the text version, the consent choices, the signature, the remark, the time, the channel "Patienten-Zone" and the device session, and SHALL show the patient a confirmation. The text version MUST be the one shown to the patient; when a newer version was published in the meantime, the system SHALL ask her to read the new version instead of saving.

#### Scenario: Erfolgreich unterschrieben
- **WHEN** die Patientin gelesen, die Pflicht-Einwilligungen bestätigt und unterschrieben hat
- **THEN** zeigt die Patienten-Zone "Vielen Dank" und speichert die Unterschrift mit Textversion, Einwilligungen, Zeitpunkt und Kanal

#### Scenario: Version während des Lesens geändert
- **WHEN** die Administration eine neue Version veröffentlicht, während die Patientin die alte liest
- **THEN** speichert das System nicht und zeigt die neue Version zum Lesen

#### Scenario: Doppelt abgeschickt
- **WHEN** die Patientin wegen einer langsamen Verbindung zweimal auf "Unterschreiben" tippt
- **THEN** speichert das System genau eine Unterschrift

### Requirement: PDF, Archiv und Zustellung
The practice application SHALL turn each signature completed in the patient zone into the same immutable PDF as for the iPad, archive it in the patient record and deliver it by email or offer it for printing, with the rules of iteration 1. The patient zone MUST NOT create, read or store documents. The signature SHALL count as completed for the patient as soon as it is saved; the PDF SHALL follow within minutes even if the practice application was briefly unavailable.

#### Scenario: PDF nach der Unterschrift in der Patienten-Zone
- **WHEN** eine Patientin mit E-Mail-Einwilligung in der Patienten-Zone unterschrieben hat
- **THEN** liegt das PDF mit Kanal "Patienten-Zone" in der Akte unter "Dokumente" und die Patientin erhält es per E-Mail

#### Scenario: Ohne E-Mail-Einwilligung
- **WHEN** die Patientin die E-Mail-Einwilligung nicht erteilt hat
- **THEN** versendet das System das PDF nicht, und die Akte bietet es der Therapeutin zum Ausdrucken an

#### Scenario: Praxis-App kurz nicht erreichbar
- **WHEN** die Praxis-App beim Abschluss der Unterschrift gerade neu startet
- **THEN** sieht die Patientin trotzdem "Vielen Dank", und das PDF liegt wenige Minuten später in der Akte

### Requirement: Rechte der Patienten-Zone für die Unterschrift
The database role of the patient zone SHALL additionally read only the personal fields shown for checking, the current consent text versions and the patient's own signature state, and SHALL write signatures and consents only for the patient of the confirmed session. It MUST NOT read anamnesis, diagnoses, photos, documents or earlier signatures' images, and MUST NOT delete rows.

#### Scenario: Dokumente nicht lesbar
- **WHEN** die Rolle der Patienten-Zone archivierte Dokumente abfragt
- **THEN** verweigert die Datenbank den Zugriff

#### Scenario: Rechte nach einer Migration
- **WHEN** der Migrationsjob eine neue Migration ausführt
- **THEN** setzt er die Rechte der Rolle neu, und ein Test vergleicht sie mit der erweiterten erlaubten Liste

### Requirement: Mobil, zugänglich und protokolliert
The signing pages of the patient zone SHALL work without horizontal scrolling from 360 px width, meet WCAG 2.1 AA with touch targets of at least 44 × 44 px, and record opening the form and completing the signature in the audit log.

#### Scenario: Telefon
- **WHEN** die Patientin das Formular auf einem Telefon mit 390 px Breite öffnet
- **THEN** sind Text, Einwilligungen und Unterschriftsfeld ohne seitliches Scrollen bedienbar, und eine axe-Prüfung meldet keine Verstösse
