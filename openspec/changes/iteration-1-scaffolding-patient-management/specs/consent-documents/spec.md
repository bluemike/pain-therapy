# Spec Delta

## Purpose

Macht aus jeder abgeschlossenen Unterschrift ein unveränderbares PDF-Dokument, archiviert es bei der Patientin oder dem Patienten und stellt es ihr oder ihm per E-Mail zu.

## ADDED Requirements

### Requirement: PDF des unterschriebenen Formulars
The system SHALL generate a PDF after each completed signature in the patient's language, containing the practice header, the patient's personal details, the full text of the signed version, the consent choices, the signature image, place, date and time, and a document number.

#### Scenario: PDF erzeugt
- **WHEN** ein Patient den Haftungsausschluss unterschrieben hat
- **THEN** erzeugt das System ein PDF mit seinen Personalien, dem vollständigen Text, seinen Einwilligungen und seiner Unterschrift

### Requirement: Archiv in der Akte
The system SHALL archive each signed PDF with the patient record and MUST NOT allow changing or deleting an archived PDF. It SHALL store a checksum to prove the file is unchanged.

#### Scenario: Dokument ansehen
- **WHEN** ein Benutzer in der Akte unter "Dokumente" das unterschriebene Formular öffnet
- **THEN** zeigt das System das PDF mit Datum der Unterschrift und Textversion

#### Scenario: Mehrere Unterschriften
- **WHEN** ein Patient nach einer neuen Textversion erneut unterschreibt
- **THEN** sind beide PDFs in der Akte vorhanden und das neueste ist als gültig markiert

#### Scenario: Deaktivierter Patient
- **WHEN** ein Patient deaktiviert wird
- **THEN** bleiben seine archivierten PDFs unverändert erhalten

### Requirement: Zustellung per E-Mail
The system SHALL email the signed PDF to the patient's email address in the patient's language when an email address is stored and the patient granted consent to unencrypted email.

#### Scenario: E-Mail versandt
- **WHEN** ein Patient mit E-Mail-Adresse und erteilter E-Mail-Einwilligung unterschrieben hat
- **THEN** erhält er eine E-Mail mit dem PDF im Anhang, und die Akte vermerkt Zeitpunkt und Empfängeradresse des Versands

#### Scenario: Keine E-Mail-Einwilligung oder keine Adresse
- **WHEN** der Patient keine E-Mail-Adresse hat oder die E-Mail-Einwilligung nicht erteilt hat
- **THEN** versendet das System nichts, vermerkt den Grund in der Akte und bietet der Therapeutin das PDF zum Ausdrucken an

### Requirement: Fehlgeschlagener Versand
The system SHALL retry a failed email delivery and SHALL show the therapist a failed delivery in the patient record with an option to resend.

#### Scenario: Versand schlägt fehl
- **WHEN** der Mailversand nach mehreren Versuchen nicht gelingt
- **THEN** zeigt die Akte "E-Mail nicht zugestellt" mit der Möglichkeit, erneut zu senden oder auszudrucken
