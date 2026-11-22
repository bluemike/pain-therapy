# Spec Delta

## ADDED Requirements

### Requirement: Einladung per SMS
The system SHALL let a Praxis-Admin (for her practice) and the Plattform-Admin (for a practice's first Praxis-Admin) invite a person by SMS with name and mobile number, as an alternative to the e-mail invitation. The SMS SHALL contain only the practice name, the person's first name and a short invitation link valid for 7 days and usable once.

#### Scenario: Chrissie per SMS einladen
- **WHEN** Mike für «Pain Therapy Falera» «Praxis-Admin einladen» wählt, «per SMS» mit Name «Christina Franz» und Nummer 079 123 45 67 angibt und «Einladung senden» tippt
- **THEN** erhält Chrissie eine SMS «Pain Therapy Falera: Christina, Sie sind eingeladen. Einrichten: https://pain-therapy.online/e/… (7 Tage gültig)» und die Praxis zeigt «Einladung offen (SMS)»

#### Scenario: Ungültige Nummer
- **WHEN** die Praxis-Admin «079 123» als Handynummer eingibt
- **THEN** zeigt das System «Bitte eine vollständige Handynummer eingeben, z.B. 079 123 45 67» und sendet nichts

### Requirement: SMS-Code beim Annehmen
When an SMS invitation is opened the system SHALL show the masked mobile number and, on request, send a 6-digit code by SMS that the person SHALL confirm before setting up a passkey or TOTP. The code SHALL be valid for 10 minutes, single use and stored only as a hash; 5 wrong codes SHALL block the invitation for 15 minutes. After the code the existing setup (passkey or TOTP, recovery codes) SHALL apply unchanged.

#### Scenario: Einladung annehmen
- **WHEN** Chrissie den Link auf dem iPad öffnet, «Code senden» tippt, den Code aus der zweiten SMS eingibt und mit Face ID einen Passkey einrichtet
- **THEN** ist ihr Konto aktiv und sie sieht ihre Wiederherstellungscodes einmal

#### Scenario: Weitergeleiteter Link
- **WHEN** jemand anders den weitergeleiteten Link öffnet und «Code senden» tippt
- **THEN** geht der Code an Chrissies Nummer und der Link allein genügt nicht zur Einrichtung

#### Scenario: Zu viele Fehlversuche
- **WHEN** fünfmal ein falscher SMS-Code eingegeben wird
- **THEN** nimmt das System für 15 Minuten keinen Code für diese Einladung an

### Requirement: Kostenschutz beim SMS-Versand
The system SHALL send at most 5 SMS per invitation and hour and at most 50 SMS per day across the platform, SHALL log every SMS with masked recipient, purpose and status but never the code, and SHALL show a clear error when a limit is reached.

#### Scenario: Tageslimit erreicht
- **WHEN** an einem Tag schon 50 SMS versendet wurden und eine weitere Einladung per SMS geschickt werden soll
- **THEN** zeigt das System «Heute können keine SMS mehr versendet werden. Bitte per E-Mail einladen oder morgen erneut versuchen.» und schreibt einen Audit-Eintrag

### Requirement: Anmeldung zurücksetzen über denselben Kanal
When a Praxis-Admin resets a member's sign-in, the system SHALL send the new invitation by SMS if the member has a mobile number, otherwise by e-mail.

#### Scenario: iPad verloren
- **WHEN** die Praxis-Admin bei einer Therapeutin mit Handynummer «Anmeldung zurücksetzen» wählt
- **THEN** löscht das System deren Passkeys, TOTP und Wiederherstellungscodes und die Therapeutin erhält eine neue Einladung per SMS

### Requirement: Handynummer im Profil
The system SHALL store the mobile number of a user in E.164 format, show it on the team page and let the user change it under «Mein Profil» after confirming a code sent by SMS to the new number.

#### Scenario: Neue Nummer
- **WHEN** eine Therapeutin unter «Mein Profil» eine neue Handynummer eingibt und den Code bestätigt, der an die neue Nummer ging
- **THEN** gilt die neue Nummer für künftige Einladungen und Zurücksetzungen
