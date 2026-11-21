# Spec Delta

## ADDED Requirements

### Requirement: Adressen unter pain-therapy.online
The practice app SHALL be served at `https://pain-therapy.online` (with `www` redirecting) and the patient zone at `https://patient.pain-therapy.online`, both with managed TLS certificates. The zone SHALL determine the Praxis from the access link and show its branding.

#### Scenario: Zone erkennt die Praxis
- **WHEN** eine Patientin der Praxis «Physio Muster» ihren Link öffnet
- **THEN** zeigt die Zone nach der Bestätigung des Geburtsdatums Name, Logo und Kontakt von «Physio Muster»

### Requirement: Weiterleitung der alten Adressen
The system SHALL redirect `pain-therapy.ayanta.ch` to `pain-therapy.online` and SHALL keep links sent to `patient.pain-therapy.ayanta.ch` working until they expire, redirecting to the same path on `patient.pain-therapy.online`.

#### Scenario: Alter Zonen-Link
- **WHEN** eine Patientin einen vor der Umstellung versandten Link unter `patient.pain-therapy.ayanta.ch` öffnet
- **THEN** landet sie auf demselben Link unter `patient.pain-therapy.online` und kann sich wie gewohnt bestätigen

#### Scenario: Alte Praxis-Adresse
- **WHEN** Chrissie ein altes Lesezeichen auf `pain-therapy.ayanta.ch` öffnet
- **THEN** leitet das System auf die Anmeldung unter `pain-therapy.online` weiter
