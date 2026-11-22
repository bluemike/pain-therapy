# Tasks

## 0. Voraussetzungen (Mike)

- [x] 0.1 Infomaniak-Benutzer `api@pain-therapy.online` (nur Mail Service), API-Token «pain-therapy-onboarding» mit Bereich «mail» als Key-Vault-Geheimnis `infomaniak-api-token`; `mail_hosting_id` 1127554 (22.11.2026)
- [x] 0.2 Konto bei ASPSMS mit 1000 Credits, Userkey und Passwort als `aspsms-userkey` und `aspsms-password` in den Key Vault

## 1. Abklärung Infomaniak und ASPSMS

- [x] 1.1 Testpostfach `api-test@pain-therapy.online` per API anlegen (HTTP 201); das gesetzte Passwort gilt nicht für IMAP und SMTP, auch nicht nach `PATCH` (22.11.2026)
- [x] 1.2 Token von `api@pain-therapy.online` mit Bereich «mail» genügt für Auflisten, Anlegen und Ändern
- [x] 1.3 Kein dokumentierter Endpunkt für Gerätepasswörter; Übergabe über die App festgelegt (Design D4)
- [x] 1.4 ASPSMS: Testversand an eine Swisscom- und eine Sunrise-Nummer, alphanumerischer Absender «PainTherapy» möglich? (nach der Kontoprüfung) (Testversand 22.11.2026 erfolgreich, Absender «PainTherapy»; «Pain Therapy» geht nicht, Text-Absender höchstens 11 Zeichen)
- [x] 1.5 `DELETE` entfernt das Testpostfach (HTTP 200, 22.11.2026); Löschen bei Ablauf einer Einladung ist damit machbar

## 2. Datenmodell (0.5 PT)

- [x] 2.1 `Invitation.channel`, `Invitation.mobile`, `Invitation.mailboxMode`, `Invitation.mailboxAddress`; `User.mobile`; `Practice.mailboxQuota` (umgesetzt: Postfach-Modus und Adresse in `MailboxProvisioning` statt auf der Einladung)
- [x] 2.2 `SmsMessage` (maskierter Empfänger, Zweck, Status, Credits) und `MailboxProvisioning` (Adresse, Praxis, Benutzer, Status, letzter Fehler, `handoverEnc` und Ablauf)
- [x] 2.3 `LoginCodePurpose.INVITATION_SMS`

## 3. SMS-Versand (1 PT)

- [x] 3.1 `src/lib/sms.ts` mit `SmsSender`, `AspsmsSender`, `ConsoleSender`; Limits 5 pro Einladung und Stunde, 50 pro Tag (umgesetzt mit `OutboxSender` statt `ConsoleSender`, SMS als Dateien in `SMS_OUTBOX_DIR`)
- [x] 3.2 Kurzlink `/e/<token>` auf die Einladungsseite
- [x] 3.3 Einladung per SMS in `createInvitation`, Team-Seite und Plattform-Seite (Kanalwahl, Handynummer mit `libphonenumber-js`) (umgesetzt mit eigener Prüfung in `src/lib/phone.ts` statt `libphonenumber-js`: CH 074–079, LI, DE, AT, IT, FR)
- [x] 3.4 Einladungsseite: maskierte Nummer, «Code senden», Code prüfen statt E-Mail-Code
- [x] 3.5 «Anmeldung zurücksetzen» über SMS, wenn eine Nummer hinterlegt ist; Handynummer ändern unter «Mein Profil»

## 4. Postfächer (1.5 bis 2 PT)

- [x] 4.1 `src/lib/infomaniak.ts`: Postfächer auflisten, anlegen, löschen; Fehler und asynchrone Antworten behandeln
- [x] 4.2 Einladungsdialog: drei Modi, Vorschlag der Adresse, Prüfung ob frei, Kontingent; Anlegen beim Senden, Löschen bei Ablauf oder Rückzug ohne Annahme
- [x] 4.3 Plattform-Übersicht: Aufgaben «Postfach-Zugang vorbereiten» mit Link in den Manager, Feld «Postfach-Zugang übergeben» mit IMAP-Prüfung, verschlüsselt höchstens 14 Tage
- [x] 4.4 Schritt «Ihr E-Mail-Postfach»: Zugang einmal anzeigen und löschen, Kopieren, Outlook-Anleitung; «wird vorbereitet» mit SMS, sobald bereit
- [x] 4.5 `src/lib/mail-profile.ts`: Apple-Profil (`com.apple.mail.managed`) über einmaligen Link, 10 Minuten, nicht gespeichert (umgesetzt: das Profil liegt bis zum Abruf höchstens 10 Minuten verschlüsselt in der Datenbank, der Link gilt einmal und nur mit Anmeldung)
- [x] 4.6 «Mein Profil > E-Mail-Postfach»: neuen Zugang anfordern (umgesetzt auf der Seite «E-Mail-Postfach» `/postfach`, erreichbar aus «Mein Profil»)
- [x] 4.7 Plattform-Übersicht: belegte und freie Adressen, Kontingent pro Praxis, Postfächer deaktivierter Mitglieder

## 5. Tests und Abnahme (1 PT)

- [x] 5.1 Unit-Tests: Adressvorschlag (Umlaute, Akzente, Dubletten), Limits, Code-Sperre, Profil-XML
- [ ] 5.2 E2E mit `ConsoleSender` und einem Infomaniak-Mock: Einladung per SMS bis Schritt «Ihr E-Mail-Postfach» (teilweise: E2E bis zur Übergabe auf der Plattform-Seite; Annahme per SMS-Code bis zur Anzeige des Zugangs als Unit-Test)
- [ ] 5.3 Audit-Einträge ohne Passwörter und Codes, Security-Review
- [ ] 5.4 Abnahme mit Chrissie auf dem iPad (Mike)
