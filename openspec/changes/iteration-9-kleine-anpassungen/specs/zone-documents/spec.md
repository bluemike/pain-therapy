# Spec Delta

## Purpose

Dokumente erreichen Patienten über die Patienten-Zone statt als E-Mail-Anhang; die Praxis sieht den Stand der Unterschrift ohne Neuladen.

## ADDED Requirements

### Requirement: Keine PDF-Anhänge an Patienten
The system SHALL NOT attach PDFs to emails sent to patients. After a disclaimer is signed, the system SHALL NOT send an email with the signed document; the document SHALL be available under "Dokumente" in the patient zone. When the practice sends an exercise sheet, the email SHALL contain only the link to the patient zone. Printing in the practice app SHALL remain available.

#### Scenario: Übungsblatt senden
- **WHEN** die Therapeutin das Übungsblatt sendet
- **THEN** erhält der Patient eine E-Mail mit dem Link in die Zone und ohne Anhang, und das Blatt steht in der Zone unter «Dokumente»

#### Scenario: Haftungsausschuss unterschrieben
- **WHEN** ein Patient den Haftungsausschuss unterschreibt
- **THEN** wird keine E-Mail mit dem PDF verschickt, und das PDF erscheint unter «Dokumente»

### Requirement: Unterschrift-Status live
While a signature invitation of a patient is open, the patient page of the practice app SHALL check its status every 15 seconds and SHALL show without a reload whether the patient signed or declined. It SHALL stop checking once the invitation is signed, declined or expired, or when the page is left.

#### Scenario: Patient unterschreibt
- **WHEN** die Therapeutin auf der Patientenseite wartet und der Patient am Handy unterschreibt
- **THEN** zeigt die Seite spätestens nach 15 Sekunden «unterschrieben», ohne dass sie neu laden muss
