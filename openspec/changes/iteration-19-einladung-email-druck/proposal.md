# Proposal

## Why

Mike Franz am 23.11.2026, nach Rücksprache mit Chrissie: Die Einladung per SMS ist gut, muss aber auch per E-Mail gehen. Ein Link auf dem Handy, womöglich auf älterer Hardware, überfordert manche Therapeutinnen. Sie sollen die Einladung am Computer öffnen können, oder vor Ort ein Blatt in die Hand bekommen.

Heute (Iteration 16) gibt es entweder SMS oder E-Mail. Mit einem neuen Postfach @pain-therapy.online geht nur SMS, weil das neue Postfach noch niemand liest. Mike hat am 24.11.2026 den folgenden Vorschlag angenommen.

## Mockup

https://claude.ai/artifact/7TvEPVXCz885UPFqXuhr2t (Einladen mit Kanalwahl, Einladung öffnen mit Code per SMS oder E-Mail, Druckblatt A4)

## What Changes

- **Kanal «SMS», «E-Mail» oder «beides»**, Standard «beides». SMS und E-Mail enthalten denselben Link.
- **E-Mail an die private Adresse:** Wer ein Postfach bei uns bekommt (neu oder bestehend), erhält die Einladung an eine zusätzlich erfasste **private E-Mail-Adresse** (z.B. `christina.franz@ayanta.ch`). Angemeldet wird weiterhin mit der Postfach-Adresse. Bei «Eigene Adresse» ist die private Adresse die Anmeldeadresse.
- **Code wahlweise per SMS oder E-Mail:** Beim Öffnen der Einladung wählt die Person «Code per SMS an +41 79 *** ** 67» oder «Code per E-Mail an c***@ayanta.ch», je nachdem, was hinterlegt ist.
- **«Einladung drucken»:** Bei jeder offenen Einladung (Team-Seite und Plattform-Seite) gibt es eine Druckseite mit Name, Praxis, QR-Code, Kurzlink und einer Anleitung in fünf Schritten, für das Einrichten vor Ort.
- Das Postfach wird wie bisher beim Versand der Einladung angelegt. App-Mails enthalten weiterhin nur Zugangslinks und Codes, nie Gesundheitsdaten.

## Nicht Teil dieser Änderung

- Eine Einladung ganz ohne SMS und ohne E-Mail (nur gedruckt): Für den Code braucht es eine Handynummer oder eine E-Mail-Adresse.
- Erinnerungen an noch nicht angenommene Einladungen.

## Impact

- Datenbank: `InvitationChannel.BOTH`, `Invitation.notifyEmail String?` (private Adresse, wenn sie von der Anmeldeadresse abweicht).
- Einladungsformular (`InviteFields`, Team-Seite, Plattform-Seite), `parseInviteForm`, `createInvitation`, Einladungsseite (`InviteFlow`), neue Druckseite.
- Aufwand geschätzt: 1 bis 1.5 Personentage.
