# Design

## Kontext

- Seit Iteration 12 meldet man sich ohne Entra an: Passkey, oder E-Mail-Code plus Authenticator (TOTP). Zugang nur auf Einladung (`Invitation`, 7 Tage, einmal verwendbar). Die Einladung geht per E-Mail an die eingeladene Adresse; beim Annehmen bestätigt die Person einen E-Mail-Code (`LoginCode`, Zweck `INVITATION`) und richtet danach Passkey oder TOTP ein (`src/lib/auth/accounts.ts`, `src/app/einladung`).
- Die App versendet Mails per SMTP über `noreply@pain-therapy.online` (Infomaniak).
- Bei Infomaniak besteht die Organisation «Pain Therapy» mit dem Mail Service für `pain-therapy.online` (10 Adressen enthalten). Eingerichtet: `admin@`, `christina.franz@`, `noreply@`, `test-therapist@`.
- Das Postfach ist zugleich der Kanal für die Anmeldecodes der App. Wer das Postfach übernimmt, hat einen der zwei Faktoren.

## Infomaniak-API (abgeklärt 21.11.2026, getestet 22.11.2026)

Quelle: developer.infomaniak.com und die Infomaniak-FAQ 1321 und 1344.

| Funktion | Endpunkt | Befund |
|---|---|---|
| Postfach anlegen | `POST /1/mail_hostings/{mail_hosting_id}/mailboxes` | Felder `mailbox_name` (Pflicht), `password` (Pflicht), `link_to_current_user`, `target` (`current_user`/`other_user`). Passwortregeln nicht dokumentiert. Antwort kann `asynchronous` sein. |
| Postfach ändern | `PATCH /1/mail_hostings/{id}/mailboxes/{mailbox_name}` | Feld `password` (dazu `full_name`, Spam, Filter). Setzt ein Passwort, das aber nicht für IMAP und SMTP gilt (Test 22.11.2026). |
| Postfächer auflisten | `GET /1/mail_hostings/{id}/mailboxes` | Für Kontingent und Prüfung, ob eine Adresse frei ist. |
| Postfach löschen | `DELETE /1/mail_hostings/{id}/mailboxes/{mailbox_name}` | Wird in dieser Iteration nicht genutzt. |
| Gerätepasswörter | nur im Manager dokumentiert | Der neue Mail Service setzt beim Anlegen im Manager kein Passwort; für Outlook und andere Programme erzeugt man im Reiter «Geräte» ein Passwort (mindestens 16 Zeichen, nur einmal sichtbar). Ein API-Endpunkt dafür ist nicht dokumentiert. |
| Token | Manager > API-Token | Bearer-Token; der nötige Bereich (Scope) steht nicht in der Doku. Für Aliasse verlangt die API Admin-Rechte. |

**Test vom 22.11.2026 (Aufgabe 1, auf Mikes Mac mit dem Token von `api@pain-therapy.online`, Bereich «mail»):**
- `GET mailboxes` liefert die Postfächer (Token und Bereich genügen).
- `POST mailboxes` legt `api-test@` an (HTTP 201, Antwort mit `used: 6`, `total: 10`).
- IMAP (993) und SMTP (465) mit dem beim Anlegen gesetzten Passwort: «Login denied», auch nach 2 Minuten.
- `PATCH` mit neuem Passwort: HTTP 200, IMAP aber weiterhin abgelehnt.

Ergebnis: Das API-Passwort gilt nicht für IMAP und SMTP. Im neuen Mail Service gelten dafür nur Gerätepasswörter, die im Manager mit erneuter Bestätigung (Passwort und 2FA) erzeugt werden. Eine API dafür ist nicht dokumentiert. Die App legt deshalb Postfächer an, erzeugt aber keine Zugangspasswörter (D4).

## Entscheide

### D1 Einladung per SMS mit Code beim Öffnen

- Neuer Kanal `SMS` neben `EMAIL`. Die erste SMS enthält nur den Link: «Pain Therapy Falera: Chrissie, Sie sind eingeladen. Einrichten: https://pain-therapy.online/e/AbC123 (7 Tage gültig)». Kurzer Pfad `/e/<token>` wegen der SMS-Länge (160 Zeichen, sonst zwei SMS).
- Öffnet die Person den Link, zeigt die App die Nummer maskiert (`+41 79 *** ** 67`) und sendet auf Knopfdruck einen 6-stelligen Code per SMS. Der Code ersetzt den E-Mail-Code beim Annehmen. Er dient dazu, dass ein weitergeleiteter oder in einer Vorschau geöffneter Link allein nicht genügt.
- Gleiche Regeln wie beim E-Mail-Code: 10 Minuten gültig, Hash in `LoginCode` (neuer Zweck `INVITATION_SMS`), 5 Fehlversuche sperren 15 Minuten.
- Danach unverändert: Passkey oder TOTP, Wiederherstellungscodes.
- «Anmeldung zurücksetzen» schickt die neue Einladung über denselben Kanal wie die erste (SMS, wenn eine Handynummer hinterlegt ist).

### D2 SMS-Anbieter ASPSMS hinter einer Schnittstelle

- `SmsSender` mit einer Methode `send(to, text)`; Umsetzungen `AspsmsSender` (JSON-API von aspsms.com) und `ConsoleSender` für Entwicklung und Tests.
- ASPSMS: Schweizer Anbieter, keine Einrichtungs- oder Monatsgebühr, Guthaben verfällt nicht. Preise (Stand 21.11.2026, ohne MWST): 4 Euro-Cent pro SMS an Swisscom, Wingo, Coop, Migros, Mucho; 7 Euro-Cent an die übrigen Schweizer Netze. Kleinstes Paket 500 Credits für 30 EUR. Eine Einladung braucht 2 SMS.
- Absender: alphanumerisch «PainTherapy», falls ASPSMS das für Schweizer Nummern zulässt (Aufgabe 1.4), sonst die Standardnummer des Anbieters.
- Infomaniak bietet ebenfalls SMS an; eine dokumentierte Versand-API dafür war nicht zu finden. Bleibt als Alternative, falls Mike alles bei Infomaniak haben will.
- Zugangsdaten im Key Vault (`aspsms-userkey`, `aspsms-password`).
- Schutz vor Kosten: höchstens 5 SMS pro Einladung und Stunde, höchstens 50 SMS pro Tag für die ganze Plattform; darüber hinaus Fehlermeldung und Audit-Eintrag.
- `SmsMessage` protokolliert Empfänger (maskiert), Zweck, Status und Kosten-Credits, nie den Code.

### D3 Postfach bei der Einladung festlegen und gleich anlegen

Die Einladende wählt einen von drei Modi:

| Modus | Bedeutung | Anmeldeadresse |
|---|---|---|
| Neues Postfach anlegen | App legt `<adresse>@pain-therapy.online` per API an | die neue Adresse |
| Postfach besteht schon | Adresse existiert bei Infomaniak (z.B. `christina.franz@`); die App ändert daran nichts | die bestehende Adresse |
| Eigene Adresse | Kein Postfach bei uns, z.B. `anna@physio-muster.ch` | die eigene Adresse |

- Vorschlag für neue Adressen: `vorname.nachname`, klein, Umlaute umschrieben (ä → ae), Akzente entfernt, Leerzeichen zu Punkt. Die Einladende kann ihn ändern. Die App prüft gegen die Liste bei Infomaniak und gegen offene Einladungen, ob die Adresse frei ist.
- Das Postfach wird beim Senden der Einladung angelegt, damit der Plattform-Admin den Zugang (D4) gleich vorbereiten kann und die Person bei der Einrichtung alles auf einmal bekommt. Das Passwort beim Anlegen ist zufällig, wird verworfen und hat keine Wirkung auf IMAP.
- Läuft die Einladung ab oder wird sie zurückgezogen, ohne angenommen worden zu sein, löscht die App das neu angelegte Postfach per `DELETE` wieder (nur Modus «Neues Postfach», nur wenn es nie angenommen wurde).
- Schlägt das Anlegen fehl (API nicht erreichbar, Adresse inzwischen vergeben), wird die Einladung trotzdem gesendet; die Team-Seite zeigt «Postfach fehlgeschlagen» mit «Erneut versuchen». `MailboxProvisioning` hält den Status (`PENDING`, `CREATED`, `FAILED`, `DELETED`) und die letzte Fehlermeldung.
- «Postfach besteht schon» darf nur der Plattform-Admin wählen.

### D4 Postfach-Zugang über die App übergeben

Weil Gerätepasswörter nur im Manager entstehen (Test vom 22.11.2026), übergibt der Plattform-Admin den Zugang über die App:

1. Nach dem Anlegen zeigt die Plattform-Übersicht die Aufgabe «Postfach-Zugang für Christina Franz vorbereiten» mit direktem Link in den Manager (Mail Service > Adresse > Geräte > «Gerät hinzufügen», ohne Benutzer, Name «Pain Therapy»).
2. Mike erzeugt dort das Gerätepasswort und fügt es in der App in das Feld «Postfach-Zugang übergeben» ein. Die App prüft es sofort mit einem IMAP-Login und meldet «Zugang funktioniert» oder «Passwort wird abgelehnt».
3. Die App speichert es AES-256-GCM-verschlüsselt (`src/lib/auth/crypto.ts`) in `MailboxProvisioning.handoverEnc`, höchstens 14 Tage.
4. Die Person sieht es im Schritt «Ihr E-Mail-Postfach» genau einmal, hinter dem gerade eingerichteten Passkey oder TOTP. Danach löscht die App es. Ist der Zugang noch nicht übergeben, sieht sie «Ihr E-Mail-Zugang wird vorbereitet» und erhält eine SMS, sobald er bereitsteht («Ihr E-Mail-Zugang ist bereit: pain-therapy.online/postfach»).
5. Nach 14 Tagen ohne Abholung löscht die App den Zugang; Mike sieht «Zugang nicht abgeholt» und kann einen neuen übergeben.

Auf dem Schritt «Ihr E-Mail-Postfach»:
- **«Auf diesem iPad/iPhone/Mac einrichten»:** Apple-Konfigurationsprofil (`.mobileconfig`, Nutzlast `com.apple.mail.managed`) mit Adresse, Server und Gerätepasswort. Wird beim Herunterladen erzeugt, ist 10 Minuten über einen einmaligen Link abrufbar und wird nicht gespeichert.
- **Outlook:** Anleitung mit Adresse, Passwort und Server `mail.infomaniak.com` (IMAP 993 SSL, SMTP 465 SSL) zum Kopieren.
- **Webmail:** Hinweis, dass das Webmail ein Infomaniak-Benutzerkonto braucht und hier nicht nötig ist.

Unter «Mein Profil > E-Mail-Postfach» fordert «Neuen Zugang anfordern» einen neuen Zugang an (z.B. für Outlook auf dem Laptop); das erzeugt wieder die Aufgabe beim Plattform-Admin.

Begründung: Kein Passwort geht über SMS, E-Mail oder Chat. Das Passwort liegt nur kurz verschlüsselt in der App und ist nur hinter dem Passkey sichtbar. Der Aufwand für Mike ist etwa eine Minute pro Person.

### D5 Kontingent und Zuständigkeit

- `Practice.mailboxQuota` (Standard 5) begrenzt, wie viele Postfächer eine Praxis-Admin für ihr Team anlegen lassen kann. Der Plattform-Admin ist nicht begrenzt.
- Die Plattform-Übersicht zeigt «Postfächer: 4 von 10 belegt» (aus `GET mailboxes`) und pro Praxis die angelegten Postfächer.
- Wird ein Mitglied deaktiviert, bleibt das Postfach bestehen; die Plattform-Übersicht markiert es als «Mitglied deaktiviert», damit Mike es bei Infomaniak löschen oder weitergeben kann.

### D6 Infomaniak-Token

- Mike hat am 22.11.2026 den Infomaniak-Benutzer `api@pain-therapy.online` angelegt, der nur den Mail Service verwalten darf, und damit das Token «pain-therapy-onboarding» (Bereich «mail», unbegrenzt) erzeugt. So greift das Token nicht auf Mikes übrige Infomaniak-Produkte zu.
- Token im Key Vault (`infomaniak-api-token`), `INFOMANIAK_MAIL_HOSTING_ID=1127554` als App-Einstellung.
- Nur der Server der Praxis-App ruft die API auf, nie die Patienten-Zone. Jeder Aufruf schreibt einen Audit-Eintrag (`mailbox.created`, `mailbox.deleted`, `mailbox.access_delivered`, `mailbox.access_shown`) ohne Passwort.

### D7 Handynummer

- `User.mobile` und `Invitation.mobile` im Format E.164, geprüft mit `libphonenumber-js` (Standardland CH). Angezeigt auf der Team-Seite, änderbar unter «Mein Profil» (mit SMS-Code an die neue Nummer).
- Wird nur für Einladung und Zurücksetzen genutzt, nicht für Werbung oder Patientenkontakt.

## Ablauf für Chrissie

1. Mike öffnet als Plattform-Admin die Praxis «Pain Therapy Falera» > «Praxis-Admin einladen», wählt «per SMS», Name «Christina Franz», Handynummer, Postfach «besteht schon: christina.franz@pain-therapy.online».
2. Mike erzeugt im Manager ein Gerätepasswort für christina.franz@ und fügt es in der App unter «Postfach-Zugang übergeben» ein.
3. Chrissie tippt auf dem iPad auf den Link in der SMS, fordert den Code an, gibt ihn ein, richtet mit Face ID den Passkey ein und notiert die Wiederherstellungscodes.
4. Schritt «Ihr E-Mail-Postfach»: Sie tippt «Auf diesem iPad einrichten», installiert das Profil, fertig.

Ist Chrissie zum Zeitpunkt der Umsetzung schon über die E-Mail-Einladung aktiv, fordert sie den Zugang unter «Mein Profil» an.

## Risiken

- Infomaniak könnte das Verhalten der Mail-API ändern; die App prüft übergebene Passwörter deshalb immer mit einem IMAP-Login.
- Der Zugang hängt an einem Handgriff von Mike im Manager. Bietet Infomaniak später eine API für Gerätepasswörter, ersetzt sie Schritt 1 und 2 von D4.
- SMS-Zustellung ins Ausland und Absenderkennung sind anbieterabhängig; Aufgabe 1.4 testet mit einer Swisscom- und einer Sunrise-Nummer.
- Ein Token mit Verwaltungsrechten auf den Mail Service ist ein lohnendes Ziel. Deshalb eigener Benutzer mit minimalen Rechten, Key Vault und Audit.
