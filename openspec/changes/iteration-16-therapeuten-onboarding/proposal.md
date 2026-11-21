# Proposal

## Why

Mike Franz will Therapeutinnen wie Chrissie (christina.franz@pain-therapy.online, erste Praxis-Admin von «Pain Therapy Falera») ohne Umweg über den Infomaniak Manager auf die Plattform bringen (Wunsch vom 21.11.2026). Heute braucht das zwei getrennte Wege:

1. Mike richtet im Infomaniak Manager das Postfach ein, lädt die Person dort als Benutzerin ein oder erzeugt ein Gerätepasswort und übermittelt es ihr.
2. Die App lädt die Person per E-Mail an genau dieses Postfach ein (Iteration 12). Ohne funktionierendes Postfach kommt die Einladung nicht an.

Das ist umständlich, und Passwörter wandern über Kanäle, die nicht dafür gemacht sind.

## What Changes

- **Einladung per SMS:** Beim Einladen (Team-Seite der Praxis-Admin und Plattform-Seite des Plattform-Admins) gibt es neben «per E-Mail» neu «per SMS» mit Name und Handynummer. Die Person erhält eine SMS mit dem Einladungslink. Beim Öffnen schickt die App einen 6-stelligen Code per SMS, danach richtet sie Passkey oder Authenticator ein wie bisher. Die SMS ersetzt bei dieser Einladung den E-Mail-Code.
- **Postfach automatisch:** In derselben Einladung wählt die Einladende «Neues Postfach anlegen» (Vorschlag `vorname.nachname@pain-therapy.online`), «Postfach besteht schon» oder «Eigene Adresse». Die App legt das Postfach über die Infomaniak-API an, sobald die Person ihre Anmeldung eingerichtet hat.
- **Postfach-Zugang statt Passwort per SMS:** Das Passwort des Postfachs erzeugt die App erst nach der Einrichtung des Passkeys und zeigt es genau einmal in der App an, zusammen mit einem Einrichtungsprofil für iPad, iPhone und Mac (ein Tipp, dann ist das Postfach in Apple Mail) und einer kurzen Anleitung für Outlook. Unter «Mein Profil» kann sie jederzeit einen neuen Zugang ausstellen. Das Passwort wird nirgends gespeichert und nie per SMS oder E-Mail verschickt.
- **SMS-Anbieter:** ASPSMS (Schweizer Anbieter, keine Grundgebühr, rund 4 bis 7 Euro-Cent pro SMS) hinter einer austauschbaren Schnittstelle.
- **Kontingent:** Der Plattform-Admin sieht belegte und freie Adressen des Infomaniak Mail Service und legt pro Praxis fest, wie viele Postfächer sie selbst anlegen darf (Standard 5).

## Abweichung vom ersten Vorschlag

Im Chat war ein Startpasswort per SMS vorgeschlagen. Die Spec zeigt das Passwort stattdessen einmal in der App, nachdem der Passkey steht: SMS sind unverschlüsselt und bleiben auf dem Telefon liegen, und das Postfach empfängt die Anmeldecodes der App. Für Chrissie ändert sich dadurch nichts am Aufwand.

## Nicht Teil dieser Änderung

- Anmeldung per SMS-Code im Alltag (bleibt Passkey oder E-Mail-Code plus Authenticator). SMS nur bei der Einladung und beim Zurücksetzen der Anmeldung.
- Postfächer automatisch löschen, wenn ein Mitglied deaktiviert wird (der Plattform-Admin sieht einen Hinweis und löscht von Hand bei Infomaniak).
- Kalender, Aliasse, Weiterleitungen, Abwesenheitsnotizen.
- Postfächer unter einer eigenen Domain der Praxis.
- Konfiguration von Outlook per Autodiscover (Infomaniak bietet für IMAP keine verlässliche automatische Einrichtung in Outlook; es bleibt eine Anleitung mit drei Feldern).

## Impact

- Datenbank: `Invitation.channel` (EMAIL/SMS), `Invitation.mobile`, `Invitation.mailbox` (Modus und Adresse), `User.mobile`, `Practice.mailboxQuota`, neue Tabelle `SmsMessage` (Versandprotokoll ohne Inhalt der Codes), `MailboxProvisioning` (Status pro Adresse).
- Praxis-App: Einladungsdialog (Team und Plattform), Einladung annehmen (SMS-Code, Schritt «Ihr E-Mail-Postfach»), «Mein Profil» mit «Neuen Postfach-Zugang ausstellen», Plattform-Übersicht mit Kontingent.
- Neue Server-Module `src/lib/sms.ts` (ASPSMS), `src/lib/infomaniak.ts` (Mail-API), `src/lib/mail-profile.ts` (Apple-Profil).
- Infrastruktur: Key-Vault-Geheimnisse `aspsms-userkey`, `aspsms-password`, `infomaniak-api-token`; App-Einstellung `INFOMANIAK_MAIL_HOSTING_ID`. Kein neuer Azure-Dienst.
- Kosten: SMS etwa 0.05 bis 0.08 CHF pro Einladung (2 SMS). Weitere Infomaniak-Adressen über die 10 enthaltenen hinaus kosten bei Infomaniak extra.
- Aufwand geschätzt: 4 bis 6 Personentage, davon 0.5 PT Abklärung der Infomaniak-API (Aufgabe 1).

Mockup: `mockups/onboarding.html` (online: https://claude.ai/artifact/YPfij21kLi1Db8bF6ERxH3)
