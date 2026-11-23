# Design

## D1 Verlangte Version pro Person

Für jede Person gilt eine **verlangte Version**:

```
verlangt = max( neueste Version mit resignRequired = true,
                Patient.signatureRequiredVersion )
```

- Hat die Person noch nie unterschrieben, gilt die aktuelle (neueste) Version, wie heute.
- `signaturePending` (Cockpit, Liste, Akte, Patienten-Zone, `openingBlocker`) vergleicht die zuletzt unterschriebene Version mit der verlangten Version statt mit der neuesten.
- Beim Unterschreiben gilt immer die neueste Version. Wer unterschreibt, unterschreibt also nie eine alte Version.

## D2 Auslöser «nächste Behandlung oder Sitzung»

- Die Seiten «Neue Behandlung» und «Neue Sitzung» rufen `openingBlocker(patientId, { forNewVisit: true })` auf. Ist die letzte Unterschrift älter als die neueste Version, setzt die Funktion `Patient.signatureRequiredVersion` auf die neueste Version (Audit `consent.resignRequested`) und meldet `consent`. Die Seite zeigt den bestehenden Hinweis mit «Zur Unterschrift einladen».
- Auch das Speichern einer neuen Behandlung oder Sitzung prüft so, falls die Seite vor dem Veröffentlichen geöffnet wurde.
- Bestehende Sitzungen bearbeiten löst nichts aus.

## D3 Veröffentlichen

- Unter dem Text eine Auswahl mit zwei Optionen, vorgewählt «Bei der nächsten Behandlung oder Sitzung».
- Die Migration setzt alle bestehenden Versionen auf `resignRequired = true`. Damit ändert sich für bereits verlangte Unterschriften nichts.
- Der Hinweis über dem Editor nennt beide Zahlen: «2 Patient:innen müssen neu unterschreiben. 12 unterschreiben die neue Version bei der nächsten Behandlung oder Sitzung.»
- Die Vorlage aus Iteration 17 übernimmt dieselbe Auswahl.

## D4 Patienten-Zone

Die Zone fragt nach der Unterschrift nur, wenn sie nach D1 aussteht. Eine Person mit gültiger älterer Unterschrift sieht ihre Übungen und Dokumente wie bisher. Hat die Praxis die neue Version verlangt (D2) und die Person eingeladen, zeigt die Zone das Formular mit der neuesten Version.
