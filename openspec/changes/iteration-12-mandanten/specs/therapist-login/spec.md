# Spec Delta

## ADDED Requirements

### Requirement: Anmeldung ohne Entra mit zwei Faktoren
The practice app SHALL authenticate users without Entra ID, either with a passkey with user verification, or with a one-time code sent to the user's e-mail address followed by a code from an authenticator app (TOTP). Only invited users with an active membership in an active Praxis SHALL be able to sign in.

#### Scenario: Anmeldung mit Passkey
- **WHEN** Chrissie auf dem iPad «Mit Passkey anmelden» tippt und Face ID bestätigt
- **THEN** ist sie angemeldet und sieht das Cockpit ihrer Praxis

#### Scenario: Anmeldung mit E-Mail-Code und Authenticator
- **WHEN** eine Therapeutin ohne Passkey ihre Adresse eingibt, den 6-stelligen Code aus der E-Mail und danach den Code aus ihrer Authenticator-App eingibt
- **THEN** ist sie angemeldet

#### Scenario: Nur E-Mail-Code genügt nicht
- **WHEN** eine Therapeutin den E-Mail-Code richtig eingibt, den Authenticator-Code aber nicht
- **THEN** ist sie nicht angemeldet

#### Scenario: Unbekannte Adresse
- **WHEN** jemand eine Adresse ohne Konto eingibt
- **THEN** zeigt das System dieselbe Meldung wie bei einer bekannten Adresse und sendet keinen Code

#### Scenario: Gesperrte Praxis
- **WHEN** sich eine Therapeutin einer gesperrten Praxis anmelden will
- **THEN** zeigt das System «Diese Praxis ist gesperrt. Bitte wenden Sie sich an den Betreiber.»

### Requirement: Schutz vor Erraten
The system SHALL make e-mail codes valid for 10 minutes and single use, SHALL block an address for 15 minutes after 5 wrong codes, and SHALL store codes only as hashes and TOTP secrets only encrypted.

#### Scenario: Zu viele Fehlversuche
- **WHEN** jemand fünfmal einen falschen Code für dieselbe Adresse eingibt
- **THEN** nimmt das System für 15 Minuten keine Codes für diese Adresse an

### Requirement: Erste Einrichtung und Wiederherstellung
On accepting an invitation the system SHALL require the user to confirm an e-mail code and to set up a passkey or TOTP before the account becomes active, and SHALL show 10 single-use recovery codes once. A Praxis-Admin SHALL be able to reset another member's factors, which sends a new invitation.

#### Scenario: Einladung annehmen
- **WHEN** eine eingeladene Therapeutin den Link öffnet, den E-Mail-Code bestätigt und einen Passkey einrichtet
- **THEN** ist ihr Konto aktiv und sie sieht ihre Wiederherstellungscodes einmal

#### Scenario: Gerät verloren
- **WHEN** die Praxis-Admin bei einer Therapeutin «Anmeldung zurücksetzen» wählt
- **THEN** löscht das System deren Passkeys, TOTP und Wiederherstellungscodes und sendet ihr eine neue Einladung

### Requirement: Rollen pro Praxis
The system SHALL grant the roles «Praxis-Admin» and «Therapeut/in» per Praxis membership and the role «Plattform-Admin» per user. The Plattform-Admin SHALL manage Praxen but SHALL NOT see patient data of a Praxis without a membership in it.

#### Scenario: Eigenes Admin-Konto
- **WHEN** Mike sich mit admin@pain-therapy.online anmeldet
- **THEN** sieht er nur die Plattform-Übersicht der Praxen und keine Praxis-Ansicht

#### Scenario: Plattform-Admin ohne Patientendaten
- **WHEN** Mike als Plattform-Admin die Praxis «Physio Muster» öffnet
- **THEN** sieht er Name, Status, Mitglieder und letzte Aktivität, aber keine Patientinnen
