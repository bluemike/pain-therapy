# Spec Delta

## ADDED Requirements

### Requirement: Postfach bei der Einladung festlegen
The invitation form SHALL offer three mailbox modes: «Neues Postfach anlegen» with a suggested address `vorname.nachname@pain-therapy.online` that the inviter can change, «Postfach besteht schon» (Plattform-Admin only) and «Eigene Adresse». The system SHALL check that a new address is free at Infomaniak and not used by an open invitation, and SHALL use the chosen address as the person's sign-in address.

#### Scenario: Vorschlag mit Umlaut
- **WHEN** die Praxis-Admin «Jürg Müller» einlädt und «Neues Postfach anlegen» wählt
- **THEN** schlägt das System `juerg.mueller@pain-therapy.online` vor

#### Scenario: Adresse vergeben
- **WHEN** die vorgeschlagene Adresse bei Infomaniak schon existiert
- **THEN** zeigt das System «Diese Adresse ist schon vergeben» und schlägt `juerg.mueller2@pain-therapy.online` vor

#### Scenario: Kontingent der Praxis ausgeschöpft
- **WHEN** eine Praxis mit Kontingent 5 bereits 5 Postfächer hat und die Praxis-Admin ein weiteres anlegen will
- **THEN** ist «Neues Postfach anlegen» deaktiviert mit dem Hinweis «Kontingent erreicht, bitte beim Betreiber melden», «Eigene Adresse» bleibt möglich

### Requirement: Postfach automatisch anlegen
After the invited person has confirmed the code and set up a passkey or TOTP, the system SHALL create the mailbox through the Infomaniak API (mode «Neues Postfach») or set a new password on the existing mailbox (mode «Postfach besteht schon»). A failure SHALL NOT block the account; the system SHALL show the status to the person and on the team page and SHALL offer a retry.

#### Scenario: Postfach angelegt
- **WHEN** Jürg seinen Passkey eingerichtet hat
- **THEN** existiert `juerg.mueller@pain-therapy.online` bei Infomaniak und die Team-Seite zeigt «Postfach aktiv»

#### Scenario: Infomaniak nicht erreichbar
- **WHEN** die Infomaniak-API beim Anlegen nicht antwortet
- **THEN** ist Jürgs Konto trotzdem aktiv, er sieht «Ihr Postfach wird gerade eingerichtet» mit «Erneut versuchen» und die Team-Seite zeigt «Postfach fehlgeschlagen»

#### Scenario: Nie angenommene Einladung
- **WHEN** eine Einladung mit «Neues Postfach anlegen» nach 7 Tagen abläuft
- **THEN** wurde kein Postfach angelegt

### Requirement: Postfach-Zugang einmal anzeigen
The system SHALL generate a random 20-character mailbox password, SHALL show it exactly once in the app on the step «Ihr E-Mail-Postfach» behind the just-created passkey or TOTP, and SHALL never store it or send it by SMS or e-mail. The same step SHALL offer a one-time Apple configuration profile for iPad, iPhone and Mac, an Outlook guide with address, password and server `mail.infomaniak.com` (IMAP 993 SSL, SMTP 465 SSL), and a link to the Infomaniak webmail.

#### Scenario: Einrichten auf dem iPad
- **WHEN** Chrissie im Schritt «Ihr E-Mail-Postfach» «Auf diesem iPad einrichten» tippt und das Profil installiert
- **THEN** empfängt Apple Mail auf dem iPad die Mails von christina.franz@pain-therapy.online ohne weitere Eingabe

#### Scenario: Profil-Link nur einmal
- **WHEN** der Profil-Link ein zweites Mal oder nach 10 Minuten geöffnet wird
- **THEN** zeigt das System «Dieser Link ist abgelaufen. Unter Mein Profil können Sie einen neuen Zugang ausstellen.»

### Requirement: Neuen Postfach-Zugang ausstellen
The system SHALL let a user with a mailbox created or reset by the app issue a new mailbox password under «Mein Profil > E-Mail-Postfach» after re-confirming with passkey or TOTP, SHALL warn that the previous password stops working, and SHALL record an audit event without the password.

#### Scenario: Outlook auf dem Laptop
- **WHEN** Chrissie unter «Mein Profil» «Neuen Postfach-Zugang ausstellen» wählt und mit Face ID bestätigt
- **THEN** zeigt die App ein neues Passwort mit der Outlook-Anleitung und das Profil auf dem iPad muss mit dem neuen Passwort aktualisiert werden

### Requirement: Übersicht der Postfächer für den Plattform-Admin
The platform overview SHALL show used and available addresses of the Infomaniak mail service, the mailbox quota per practice (default 5, changeable by the Plattform-Admin), the mailboxes created per practice and mailboxes whose member is deactivated.

#### Scenario: Mitglied deaktiviert
- **WHEN** die Praxis-Admin von Falera ein Mitglied mit Postfach deaktiviert
- **THEN** bleibt das Postfach bestehen und die Plattform-Übersicht markiert es als «Mitglied deaktiviert»
