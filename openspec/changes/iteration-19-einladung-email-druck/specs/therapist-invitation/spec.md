# Spec Delta

## ADDED Requirements

### Requirement: Einladung per SMS, E-Mail oder beides
The system SHALL let the inviter choose the channel «SMS», «E-Mail» or «beides» (default «beides») for a therapist invitation, for every mailbox mode. With a new or existing mailbox at pain-therapy.online the system SHALL ask for a private e-mail address when the channel includes e-mail and SHALL send the invitation e-mail there, while the person signs in with the mailbox address. SMS and e-mail SHALL carry the same invitation link and no health data.

#### Scenario: Neue Therapeutin mit Postfach, Einladung an beide Kanäle
- **WHEN** die Praxis-Admin «Anna Muster» mit Handynummer 079 123 45 67, «Neues Postfach» `anna.muster` und privater Adresse `anna@gmail.com` per «beides» einlädt
- **THEN** wird `anna.muster@pain-therapy.online` angelegt, eine SMS geht an die Nummer und eine E-Mail mit demselben Link an `anna@gmail.com`, und die Einladung zeigt «Einladung offen (SMS und E-Mail)»

#### Scenario: Nur E-Mail für eine Person ohne Smartphone
- **WHEN** die Praxis-Admin «per E-Mail» mit «Eigene Adresse» `beat@praxis-beat.ch` wählt
- **THEN** ist keine Handynummer nötig und die Einladung geht nur per E-Mail an diese Adresse

#### Scenario: SMS scheitert, E-Mail geht
- **WHEN** bei «beides» die SMS nicht gesendet werden kann, die E-Mail aber schon
- **THEN** bleibt die Einladung offen und die Seite meldet, dass die SMS nicht ging und die E-Mail unterwegs ist

### Requirement: Code per SMS oder E-Mail beim Annehmen
When an invitation is opened the system SHALL offer to send the 6-digit code to each channel on file (masked mobile number, masked e-mail address) and SHALL accept the code from either. The existing rules (10 minutes, single use, lock after 5 wrong codes) SHALL apply unchanged.

#### Scenario: Am Computer annehmen
- **WHEN** Anna den Link aus der E-Mail am Computer öffnet und «Code per E-Mail an a***@gmail.com» wählt
- **THEN** erhält sie den Code per E-Mail, gibt ihn ein und richtet ihren Passkey ein

### Requirement: Einladung drucken
For every open invitation the system SHALL offer a printable page with the practice, the invited person's name, a QR code and the short link, the expiry date and step-by-step instructions. Printing SHALL issue a new link for the invitation and SHALL say beforehand that the earlier SMS and e-mail links stop working. The page SHALL never show a code.

#### Scenario: Einrichten vor Ort
- **WHEN** die Praxis-Admin bei der offenen Einladung von Anna «Drucken» wählt und bestätigt
- **THEN** zeigt die App eine A4-Seite mit QR-Code und Anleitung, Anna scannt den Code mit dem iPad, fordert den Code per SMS an und richtet sich ein
