# Tasks

## 0. Voraussetzungen (Mike)

- [ ] 0.1 Bei Infomaniak einen Benutzer «pain-therapy-app» mit Rechten nur auf den Mail Service von «Pain Therapy» anlegen, damit ein API-Token erzeugen und als Key-Vault-Geheimnis `infomaniak-api-token` hinterlegen; `mail_hosting_id` aus der URL des Mail Service notieren
- [ ] 0.2 Konto bei ASPSMS eröffnen, 500 Credits kaufen (30 EUR), Userkey und Passwort als `aspsms-userkey` und `aspsms-password` in den Key Vault

## 1. Abklärung Infomaniak und ASPSMS (0.5 PT)

- [ ] 1.1 Testpostfach `api-test@pain-therapy.online` per API anlegen; prüfen, ob das gesetzte Passwort für IMAP und SMTP (mail.infomaniak.com) funktioniert; danach löschen
- [ ] 1.2 Nötigen Token-Bereich ermitteln und festhalten, ob das Token auf den Mail Service beschränkt ist
- [ ] 1.3 Prüfen, ob es einen Endpunkt für Gerätepasswörter gibt; falls 1.1 scheitert, Ausweichweg aus dem Design (Anleitung statt Profil) festlegen und Mike informieren
- [ ] 1.4 ASPSMS: Testversand an eine Swisscom- und eine Sunrise-Nummer, alphanumerischer Absender «PainTherapy» möglich?

## 2. Datenmodell (0.5 PT)

- [ ] 2.1 `Invitation.channel`, `Invitation.mobile`, `Invitation.mailboxMode`, `Invitation.mailboxAddress`; `User.mobile`; `Practice.mailboxQuota`
- [ ] 2.2 `SmsMessage` (maskierter Empfänger, Zweck, Status, Credits) und `MailboxProvisioning` (Adresse, Praxis, Benutzer, Status, letzter Fehler)
- [ ] 2.3 `LoginCodePurpose.INVITATION_SMS`

## 3. SMS-Versand (1 PT)

- [ ] 3.1 `src/lib/sms.ts` mit `SmsSender`, `AspsmsSender`, `ConsoleSender`; Limits 5 pro Einladung und Stunde, 50 pro Tag
- [ ] 3.2 Kurzlink `/e/<token>` auf die Einladungsseite
- [ ] 3.3 Einladung per SMS in `createInvitation`, Team-Seite und Plattform-Seite (Kanalwahl, Handynummer mit `libphonenumber-js`)
- [ ] 3.4 Einladungsseite: maskierte Nummer, «Code senden», Code prüfen statt E-Mail-Code
- [ ] 3.5 «Anmeldung zurücksetzen» über SMS, wenn eine Nummer hinterlegt ist; Handynummer ändern unter «Mein Profil»

## 4. Postfächer (1.5 bis 2 PT)

- [ ] 4.1 `src/lib/infomaniak.ts`: Postfächer auflisten, anlegen, Passwort setzen; Fehler und asynchrone Antworten behandeln
- [ ] 4.2 Einladungsdialog: drei Modi, Vorschlag der Adresse, Prüfung ob frei, Kontingent
- [ ] 4.3 Nach der Einrichtung des zweiten Faktors: Postfach anlegen oder Passwort setzen, Status in `MailboxProvisioning`, «Erneut versuchen»
- [ ] 4.4 Schritt «Ihr E-Mail-Postfach»: Passwort einmal anzeigen, Kopieren, Outlook-Anleitung, Webmail-Link
- [ ] 4.5 `src/lib/mail-profile.ts`: Apple-Profil (`com.apple.mail.managed`) über einmaligen Link, 10 Minuten, nicht gespeichert
- [ ] 4.6 «Mein Profil > E-Mail-Postfach»: neuen Zugang ausstellen nach erneuter Bestätigung
- [ ] 4.7 Plattform-Übersicht: belegte und freie Adressen, Kontingent pro Praxis, Postfächer deaktivierter Mitglieder

## 5. Tests und Abnahme (1 PT)

- [ ] 5.1 Unit-Tests: Adressvorschlag (Umlaute, Akzente, Dubletten), Limits, Code-Sperre, Profil-XML
- [ ] 5.2 E2E mit `ConsoleSender` und einem Infomaniak-Mock: Einladung per SMS bis Schritt «Ihr E-Mail-Postfach»
- [ ] 5.3 Audit-Einträge ohne Passwörter und Codes, Security-Review
- [ ] 5.4 Abnahme mit Chrissie auf dem iPad (Mike)
