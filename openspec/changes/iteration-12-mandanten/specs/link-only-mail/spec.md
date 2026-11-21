# Spec Delta

## ADDED Requirements

### Requirement: E-Mails enthalten nur Links
The system SHALL NOT attach documents to e-mails. Signed disclaimers, exercise sheets and other patient documents SHALL be sent as a link to the «Dokumente» tab of the patient zone, which the patient opens after confirming the date of birth. The e-mail SHALL name the Praxis but no diagnosis, treatment area or health-related document title.

#### Scenario: Unterschriebener Haftungsausschluss
- **WHEN** eine Patientin mit E-Mail-Einwilligung den Haftungsausschluss unterschreibt
- **THEN** erhält sie eine E-Mail «Ein neues Dokument Ihrer Praxis steht bereit» mit Link in die Zone, ohne PDF-Anhang

#### Scenario: Übungsblatt
- **WHEN** die Therapeutin das Übungsblatt «per E-Mail» sendet
- **THEN** enthält die E-Mail einen Link zum Übungsblatt in der Zone, und das Blatt erscheint dort unter «Dokumente»

#### Scenario: Patientin noch ohne Zonen-Link
- **WHEN** ein Dokument per E-Mail an eine Patientin ohne gültigen Zonen-Link geht
- **THEN** erzeugt das System einen Zonen-Link nach den bestehenden Regeln und versendet diesen

#### Scenario: Ohne E-Mail
- **WHEN** die Patientin keine E-Mail-Einwilligung gegeben hat
- **THEN** bietet das System wie bisher Ausdruck und QR-Zugangsblatt an

### Requirement: Versand über die Plattform-Domain
The system SHALL send all e-mails via SMTP from `noreply@pain-therapy.online` with the practice name as display name and the practice contact e-mail as Reply-To. Sign-in codes and invitations SHALL use the same sender with the display name «Pain Therapy».

#### Scenario: Antwort der Patientin
- **WHEN** eine Patientin auf eine Dokument-E-Mail der Praxis «Physio Muster» antwortet
- **THEN** geht die Antwort an die Kontakt-E-Mail von «Physio Muster»
