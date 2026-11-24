# Tasks

## 1. Datenmodell

- [ ] 1.1 `InvitationChannel.BOTH`, `Invitation.notifyEmail`

## 2. Einladung senden

- [ ] 2.1 `InviteFields`: Kanal SMS / E-Mail / beides (Standard beides), Feld «Private E-Mail-Adresse» bei Postfach und E-Mail (D4)
- [ ] 2.2 `parseInviteForm`: Pflichtfelder je Kanal, `mailboxNeedsSms` entfällt
- [ ] 2.3 `createInvitation`: SMS und/oder E-Mail an `notifyEmail ?? email`; Verhalten bei teilweisem Fehlschlag (D1)
- [ ] 2.4 Liste offener Einladungen zeigt den Kanal

## 3. Einladung annehmen

- [ ] 3.1 Einladungsseite: Knopf je Kanal, Code per E-Mail an die private Adresse (D2)

## 4. Drucken

- [ ] 4.1 «Drucken» bei offenen Einladungen (Team, Plattform) mit Hinweis, neuer Link (D3)
- [ ] 4.2 Druckseite A4 mit QR-Code (SVG), Kurzlink, gültig bis, fünf Schritten

## 5. Test

- [ ] 5.1 Unit: Kanäle und Pflichtfelder, beides mit fehlgeschlagener SMS, Code per E-Mail an die private Adresse, Drucken ersetzt den Link
- [ ] 5.2 E2E: Einladung «beides» mit neuem Postfach, Annahme per E-Mail-Code, Druckseite
- [ ] 5.3 Abnahme durch Mike und Chrissie
