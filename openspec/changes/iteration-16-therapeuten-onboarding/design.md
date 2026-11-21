# Design

## Kontext

- Seit Iteration 12 meldet man sich ohne Entra an: Passkey, oder E-Mail-Code plus Authenticator (TOTP). Zugang nur auf Einladung (`Invitation`, 7 Tage, einmal verwendbar). Die Einladung geht per E-Mail an die eingeladene Adresse; beim Annehmen bestätigt die Person einen E-Mail-Code (`LoginCode`, Zweck `INVITATION`) und richtet danach Passkey oder TOTP ein (`src/lib/auth/accounts.ts`, `src/app/einladung`).
- Die App versendet Mails per SMTP über `noreply@pain-therapy.online` (Infomaniak).
- Bei Infomaniak besteht die Organisation «Pain Therapy» mit dem Mail Service für `pain-therapy.online` (10 Adressen enthalten). Eingerichtet: `admin@`, `christina.franz@`, `noreply@`, `test-therapist@`.
- Das Postfach ist zugleich der Kanal für die Anmeldecodes der App. Wer das Postfach übernimmt, hat einen der zwei Faktoren.

## Infomaniak-API (abgeklärt 21.11.2026)

Quelle: developer.infomaniak.com und die Infomaniak-FAQ 1321 und 1344.

| Funktion | Endpunkt | Befund |
|---|---|---|
| Postfach anlegen | `POST /1/mail_hostings/{mail_hosting_id}/mailboxes` | Felder `mailbox_name` (Pflicht), `password` (Pflicht), `link_to_current_user`, `target` (`current_user`/`other_user`). Passwortregeln nicht dokumentiert. Antwort kann `asynchronous` sein. |
| Postfach ändern | `PATCH /1/mail_hostings/{id}/mailboxes/{mailbox_name}` | Feld `password` (dazu `full_name`, Spam, Filter). Damit lässt sich ein neues Passwort setzen. |
| Postfächer auflisten | `GET /1/mail_hostings/{id}/mailboxes` | Für Kontingent und Prüfung, ob eine Adresse frei ist. |
| Postfach löschen | `DELETE /1/mail_hostings/{id}/mailboxes/{mailbox_name}` | Wird in dieser Iteration nicht genutzt. |
| Gerätepasswörter | nur im Manager dokumentiert | Der neue Mail Service setzt beim Anlegen im Manager kein Passwort; für Outlook und andere Programme erzeugt man im Reiter «Geräte» ein Passwort (mindestens 16 Zeichen, nur einmal sichtbar). Ein API-Endpunkt dafür ist nicht dokumentiert. |
| Token | Manager > API-Token | Bearer-Token; der nötige Bereich (Scope) steht nicht in der Doku. Für Aliasse verlangt die API Admin-Rechte. |

**Offene Punkte, die Aufgabe 1 vor der Umsetzung klärt:**
1. Funktioniert das per API gesetzte `password` für IMAP und SMTP im neuen Mail Service, oder gilt es nur für das alte Webmail? (FAQ 1344: «IMAP und SMTP brauchen beide ein Passwort», «beim Anlegen wird kein Passwort gesetzt».)
2. Welcher Token-Bereich genügt, und lässt sich das Token auf den Mail Service von «Pain Therapy» beschränken?
3. Gibt es einen (undokumentierten oder neuen) Endpunkt für Gerätepasswörter?

Ausweichweg, falls 1 nicht klappt: Die App legt das Postfach trotzdem per API an (die Anmeldecodes kommen dann im Webmail und in der Infomaniak-Mail-App an) und zeigt im Schritt «Ihr E-Mail-Postfach» eine bebilderte Anleitung «Gerätepasswort im Infomaniak-Konto erzeugen». Das Einrichtungsprofil entfällt dann.

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

### D3 Postfach bei der Einladung festlegen, anlegen nach der Einrichtung

Die Einladende wählt einen von drei Modi:

| Modus | Bedeutung | Anmeldeadresse |
|---|---|---|
| Neues Postfach anlegen | App legt `<adresse>@pain-therapy.online` per API an | die neue Adresse |
| Postfach besteht schon | Adresse existiert bei Infomaniak (z.B. `christina.franz@`); die App setzt beim Annehmen ein neues Passwort | die bestehende Adresse |
| Eigene Adresse | Kein Postfach bei uns, z.B. `anna@physio-muster.ch` | die eigene Adresse |

- Vorschlag für neue Adressen: `vorname.nachname`, klein, Umlaute umschrieben (ä → ae), Akzente entfernt, Leerzeichen zu Punkt. Die Einladende kann ihn ändern. Die App prüft gegen die Liste bei Infomaniak und gegen offene Einladungen, ob die Adresse frei ist.
- Das Postfach wird erst angelegt, wenn die Person den SMS-Code bestätigt und Passkey oder TOTP eingerichtet hat. So entstehen keine verwaisten Postfächer aus nie angenommenen Einladungen, und das Passwort kann in diesem Moment erzeugt und direkt angezeigt werden.
- Schlägt das Anlegen fehl (API nicht erreichbar, Adresse inzwischen vergeben), ist das Konto trotzdem aktiv. Die Person sieht «Ihr Postfach wird gerade eingerichtet» und einen Knopf «Erneut versuchen»; die Praxis-Admin sieht auf der Team-Seite «Postfach fehlgeschlagen». `MailboxProvisioning` hält den Status (`PENDING`, `CREATED`, `FAILED`) und die letzte Fehlermeldung.
- «Postfach besteht schon» darf nur der Plattform-Admin wählen, weil das Setzen eines neuen Passworts bestehende Zugänge unterbrechen kann.

### D4 Postfach-Zugang einmal in der App, nicht per SMS

- Die App erzeugt ein Passwort mit 20 Zeichen (Buchstaben und Ziffern ohne verwechselbare Zeichen), setzt es über die API und zeigt es genau einmal im Schritt «Ihr E-Mail-Postfach». Gespeichert wird es nirgends, auch nicht als Hash.
- Auf demselben Schritt:
  - **«Auf diesem iPad/iPhone/Mac einrichten»:** lädt ein Apple-Konfigurationsprofil (`.mobileconfig`, Nutzlast `com.apple.mail.managed`) mit Adresse, Server und Passwort. Das Profil wird beim Herunterladen erzeugt, ist 10 Minuten über einen einmaligen Link abrufbar und wird nicht gespeichert. iOS fragt danach unter «Einstellungen > Profil geladen» nach der Installation.
  - **Outlook:** Anleitung mit den drei Angaben zum Kopieren: E-Mail-Adresse, Passwort, Server `mail.infomaniak.com` (IMAP 993 SSL, SMTP 465 SSL).
  - **Webmail:** Link zu mail.infomaniak.com.
- Unter «Mein Profil > E-Mail-Postfach» stellt «Neuen Postfach-Zugang ausstellen» jederzeit ein neues Passwort aus (nach erneuter Bestätigung mit Passkey oder TOTP). Das alte Passwort gilt danach nicht mehr; die App sagt das vorher.
- Begründung gegen ein Startpasswort per SMS: SMS sind unverschlüsselt, bleiben auf dem Telefon und in Backups, und das Postfach empfängt die E-Mail-Codes der App. Ein Passwort, das nur hinter dem Passkey sichtbar ist, schwächt die Anmeldung nicht.

### D5 Kontingent und Zuständigkeit

- `Practice.mailboxQuota` (Standard 5) begrenzt, wie viele Postfächer eine Praxis-Admin für ihr Team anlegen lassen kann. Der Plattform-Admin ist nicht begrenzt.
- Die Plattform-Übersicht zeigt «Postfächer: 4 von 10 belegt» (aus `GET mailboxes`) und pro Praxis die angelegten Postfächer.
- Wird ein Mitglied deaktiviert, bleibt das Postfach bestehen; die Plattform-Übersicht markiert es als «Mitglied deaktiviert», damit Mike es bei Infomaniak löschen oder weitergeben kann.

### D6 Infomaniak-Token

- Mike legt bei Infomaniak einen eigenen Benutzer «pain-therapy-app» an, der nur den Mail Service der Organisation «Pain Therapy» verwalten darf, und erzeugt mit diesem Benutzer das API-Token. So greift das Token nicht auf Mikes übrige Infomaniak-Produkte zu.
- Token im Key Vault (`infomaniak-api-token`), `INFOMANIAK_MAIL_HOSTING_ID` als App-Einstellung (steht in der URL des Mail Service im Manager).
- Nur der Server der Praxis-App ruft die API auf, nie die Patienten-Zone. Jeder Aufruf schreibt einen Audit-Eintrag (`mailbox.created`, `mailbox.password_reset`) ohne Passwort.

### D7 Handynummer

- `User.mobile` und `Invitation.mobile` im Format E.164, geprüft mit `libphonenumber-js` (Standardland CH). Angezeigt auf der Team-Seite, änderbar unter «Mein Profil» (mit SMS-Code an die neue Nummer).
- Wird nur für Einladung und Zurücksetzen genutzt, nicht für Werbung oder Patientenkontakt.

## Ablauf für Chrissie

1. Mike öffnet als Plattform-Admin die Praxis «Pain Therapy Falera» > «Praxis-Admin einladen», wählt «per SMS», Name «Christina Franz», Handynummer, Postfach «besteht schon: christina.franz@pain-therapy.online».
2. Chrissie tippt auf dem iPad auf den Link in der SMS, fordert den Code an, gibt ihn ein, richtet mit Face ID den Passkey ein und notiert die Wiederherstellungscodes.
3. Schritt «Ihr E-Mail-Postfach»: Sie tippt «Auf diesem iPad einrichten», installiert das Profil, fertig. Für Outlook auf dem Laptop kopiert sie Adresse und Passwort aus der Anleitung oder stellt später unter «Mein Profil» einen neuen Zugang aus.

Ist Chrissie zum Zeitpunkt der Umsetzung schon über die E-Mail-Einladung aktiv, nutzt sie nur Schritt 3 über «Mein Profil».

## Risiken

- Das per API gesetzte Passwort gilt im neuen Mail Service eventuell nicht für IMAP (siehe offene Punkte). Ausweichweg beschrieben; die SMS-Einladung funktioniert unabhängig davon.
- SMS-Zustellung ins Ausland und Absenderkennung sind anbieterabhängig; Aufgabe 1.4 testet mit einer Swisscom- und einer Sunrise-Nummer.
- Ein Token mit Verwaltungsrechten auf den Mail Service ist ein lohnendes Ziel. Deshalb eigener Benutzer mit minimalen Rechten, Key Vault und Audit.
