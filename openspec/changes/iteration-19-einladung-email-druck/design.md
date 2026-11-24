# Design

## D1 Kanal und Adressen

| Postfach | Anmeldeadresse | E-Mail-Einladung geht an | Kanäle |
|---|---|---|---|
| Eigene Adresse | die eigene Adresse | dieselbe Adresse | SMS, E-Mail, beides |
| Neues Postfach | `vorname.nachname@pain-therapy.online` | private Adresse (Pflicht bei E-Mail oder beides) | SMS, E-Mail, beides |
| Postfach besteht schon (nur Plattform) | die Postfach-Adresse | private Adresse (Pflicht bei E-Mail oder beides) | SMS, E-Mail, beides |

- Standard ist «beides». Handynummer ist Pflicht bei SMS und beides, private Adresse bei E-Mail und beides (sofern ein Postfach gewählt ist).
- Die Regel «Neues Postfach nur per SMS» (Iteration 16, Fehler `mailboxNeedsSms`) entfällt: Die E-Mail geht ja nicht an das neue Postfach, sondern an die private Adresse.
- `Invitation.email` bleibt die Anmeldeadresse. `Invitation.notifyEmail` hält die private Adresse nur, wenn sie abweicht. Die Einladungs-Mail geht an `notifyEmail ?? email`.
- Schlägt bei «beides» die SMS fehl, aber die E-Mail ging raus, bleibt die Einladung bestehen und die Seite meldet «SMS konnte nicht gesendet werden, die E-Mail ist unterwegs». Scheitern beide, wird die Einladung zurückgezogen (wie heute bei SMS).

## D2 Code beim Annehmen

- Die Einladungsseite zeigt je hinterlegtem Kanal einen Knopf: «Code per SMS an +41 79 *** ** 67» und «Code per E-Mail an c***@ayanta.ch» (maskiert). Bei nur einem Kanal gibt es nur einen Knopf.
- Der Code wird wie heute unter der Anmeldeadresse gespeichert (Sperre, Ticket, Limits unverändert). Per E-Mail geht er an `notifyEmail ?? email`.
- Der Link allein genügt weiterhin nicht: Der Code geht nur an die hinterlegte Nummer oder Adresse.

## D3 «Einladung drucken»

- Bei jeder offenen Einladung auf der Team-Seite und der Plattform-Seite: Knopf «Drucken».
- Weil nur der Hash des Links gespeichert ist, erzeugt «Drucken» einen **neuen Link** für diese Einladung. SMS- und E-Mail-Link von vorher gelten danach nicht mehr. Der Knopf sagt das vorher: «Erstellt einen neuen Link. Der Link aus SMS und E-Mail gilt dann nicht mehr.»
- Die Druckseite (A4, `@media print`) zeigt: Praxis, «Einladung für Christina Franz», QR-Code des Kurzlinks, den Kurzlink zum Abtippen, gültig bis, und fünf Schritte (QR scannen oder Link eingeben, Code per SMS oder E-Mail anfordern und eingeben, Passkey oder Authenticator-App einrichten, Postfach-Zugang einmal ansehen falls ein neues Postfach angelegt wurde, ab dann mit der Anmeldeadresse anmelden). Der Code selbst steht nie auf dem Blatt.
- QR-Code serverseitig als SVG (wie die bestehende QR-Erzeugung für TOTP und die Patienten-Zone).

## D4 Formular

- Kanal als drei Felder «per SMS», «per E-Mail», «beides» (vorgewählt).
- Das Feld «Private E-Mail-Adresse» erscheint bei Neues/Bestehendes Postfach, sobald E-Mail oder beides gewählt ist, mit dem Hinweis «Für die Einladung, falls sie am Computer geöffnet wird. Angemeldet wird mit der Postfach-Adresse.»
- Die Liste offener Einladungen zeigt den Kanal: «SMS und E-Mail», «SMS», «E-Mail».
