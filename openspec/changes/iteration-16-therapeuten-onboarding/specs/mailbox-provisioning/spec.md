# Spec Delta

## ADDED Requirements

### Requirement: Postfach bei der Einladung festlegen
The invitation form SHALL offer three mailbox modes: «Neues Postfach anlegen» with a suggested address `vorname.nachname@pain-therapy.online` that the inviter can change, «Postfach besteht schon» (Plattform-Admin only, the app does not change the mailbox) and «Eigene Adresse». The system SHALL check that a new address is free at Infomaniak and not used by an open invitation, and SHALL use the chosen address as the person's sign-in address.

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
When an invitation with mode «Neues Postfach anlegen» is sent, the system SHALL create the mailbox through the Infomaniak API. A failure SHALL NOT block the invitation; the system SHALL show the status on the team page and SHALL offer a retry. If the invitation expires or is revoked without being accepted, the system SHALL delete the mailbox it created.

#### Scenario: Postfach angelegt
- **WHEN** die Praxis-Admin Jürg mit «Neues Postfach anlegen» einlädt
- **THEN** existiert `juerg.mueller@pain-therapy.online` bei Infomaniak und die Team-Seite zeigt «Postfach angelegt, Zugang offen»

#### Scenario: Infomaniak nicht erreichbar
- **WHEN** die Infomaniak-API beim Anlegen nicht antwortet
- **THEN** geht die Einladung trotzdem hinaus und die Team-Seite zeigt «Postfach fehlgeschlagen» mit «Erneut versuchen»

#### Scenario: Nie angenommene Einladung
- **WHEN** eine Einladung mit «Neues Postfach anlegen» nach 7 Tagen abläuft
- **THEN** löscht das System das dafür angelegte Postfach bei Infomaniak

### Requirement: Postfach-Zugang übergeben
The system SHALL show the Plattform-Admin a task «Postfach-Zugang vorbereiten» for each mailbox of a pending or active member without a delivered access, with a direct link to the Infomaniak Manager. The Plattform-Admin SHALL paste a device password created there; the system SHALL verify it with an IMAP login, SHALL store it encrypted for at most 14 days and SHALL delete it after it has been shown once or when it expires. It SHALL never be sent by SMS or e-mail.

#### Scenario: Zugang übergeben
- **WHEN** Mike im Manager ein Gerätepasswort für christina.franz@ erzeugt und es in der App unter «Postfach-Zugang übergeben» einfügt
- **THEN** meldet die App «Zugang funktioniert» und die Aufgabe wechselt auf «Bereit zur Abholung»

#### Scenario: Falsches Passwort
- **WHEN** Mike ein Passwort einfügt, das Infomaniak beim IMAP-Login ablehnt
- **THEN** speichert die App nichts und zeigt «Infomaniak lehnt dieses Passwort ab. Bitte im Manager prüfen.»

#### Scenario: Nicht abgeholt
- **WHEN** ein übergebener Zugang 14 Tage lang nicht angezeigt wurde
- **THEN** löscht die App ihn und die Aufgabe zeigt «Zugang nicht abgeholt»

### Requirement: Postfach-Zugang einmal anzeigen
The system SHALL show a delivered mailbox access exactly once on the step «Ihr E-Mail-Postfach» behind the just-created passkey or TOTP (or later under «Mein Profil» after re-confirming). The same step SHALL offer a one-time Apple configuration profile for iPad, iPhone and Mac and an Outlook guide with address, password and server `mail.infomaniak.com` (IMAP 993 SSL, SMTP 465 SSL). If the access is not yet delivered, the system SHALL say so and SHALL notify the person by SMS once it is ready.

#### Scenario: Einrichten auf dem iPad
- **WHEN** Chrissie im Schritt «Ihr E-Mail-Postfach» «Auf diesem iPad einrichten» tippt und das Profil installiert
- **THEN** empfängt Apple Mail auf dem iPad die Mails von christina.franz@pain-therapy.online ohne weitere Eingabe

#### Scenario: Zugang noch nicht bereit
- **WHEN** Jürg seine Anmeldung eingerichtet hat, Mike den Zugang aber noch nicht übergeben hat
- **THEN** sieht Jürg «Ihr E-Mail-Zugang wird vorbereitet. Sie erhalten eine SMS, sobald er bereit ist.»

#### Scenario: Profil-Link nur einmal
- **WHEN** der Profil-Link ein zweites Mal oder nach 10 Minuten geöffnet wird
- **THEN** zeigt das System «Dieser Link ist abgelaufen. Unter Mein Profil können Sie einen neuen Zugang anfordern.»

### Requirement: Neuen Zugang anfordern
The system SHALL let a user with a mailbox at pain-therapy.online request a new mailbox access under «Mein Profil > E-Mail-Postfach», which SHALL create a new task for the Plattform-Admin.

#### Scenario: Outlook auf dem Laptop
- **WHEN** Chrissie unter «Mein Profil» «Neuen Zugang anfordern» wählt
- **THEN** sieht Mike die Aufgabe «Postfach-Zugang vorbereiten» für Chrissie und Chrissie erhält eine SMS, sobald er bereitsteht

### Requirement: Übersicht der Postfächer für den Plattform-Admin
The platform overview SHALL show used and available addresses of the Infomaniak mail service, the mailbox quota per practice (default 5, changeable by the Plattform-Admin), the mailboxes created per practice and mailboxes whose member is deactivated.

#### Scenario: Mitglied deaktiviert
- **WHEN** die Praxis-Admin von Falera ein Mitglied mit Postfach deaktiviert
- **THEN** bleibt das Postfach bestehen und die Plattform-Übersicht markiert es als «Mitglied deaktiviert»

### Requirement: Own address and Reply-To

A person invited with «Eigene Adresse» SHALL sign in with that address and SHALL get no mailbox at pain-therapy.online and no hand-over task. Patient mails SHALL be sent from `noreply@pain-therapy.online` with the practice name as display name and the sign-in address of the therapist who requested the mail as Reply-To, or the contact address of the practice when none is stored. The Plattform-Admin SHALL be able to withdraw an open invitation; for an existing mailbox only the app's record and a handed-over password are removed.

#### Scenario: Therapist with her own address

- **WHEN** the Plattform-Admin invites Christina Franz with «Eigene Adresse» `christina.franz@ayanta.ch`
- **THEN** no mailbox is created or handed over, and the invitation and sign-in use `christina.franz@ayanta.ch`

#### Scenario: Patient answers a document mail

- **WHEN** Christina sends a patient a document link and the patient answers
- **THEN** the mail came from `noreply@pain-therapy.online` and the answer goes to `christina.franz@ayanta.ch`
