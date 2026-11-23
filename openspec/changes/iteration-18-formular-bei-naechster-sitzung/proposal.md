# Proposal

## Why

Mike Franz am 23.11.2026: Die Praxis-Admin soll eine neue Version des Unterschriftsformulars aktiv setzen können, ohne dass alle bestehenden Patient:innen sofort wieder unterschreiben müssen. Eine neue Unterschrift soll erst nötig werden, wenn die Person nach dem Freischalten wieder eine Behandlung oder Sitzung macht.

Heute macht jede neue Version alle früheren Unterschriften ungültig: Das Cockpit zeigt alle als «Neue Unterschrift nötig», die Patienten-Zone leitet jede Person auf die Unterschrift um, und neue Behandlungen und Sitzungen sind gesperrt. Das betrifft gerade jetzt die neue Datenschutz-Vorlage aus Iteration 17.

## What Changes

- **Wahl beim Veröffentlichen** unter «Formulartexte»:
  - «Bei der nächsten Behandlung oder Sitzung» (Standard): Bestehende Unterschriften bleiben gültig. Neue Patient:innen unterschreiben die neue Version.
  - «Sofort von allen» (bisheriges Verhalten), z.B. bei einer wesentlichen rechtlichen Änderung.
- **Nächste Behandlung oder Sitzung:** Öffnet die Therapeutin für eine Person mit älterer Unterschrift «Neue Behandlung» oder «Neue Sitzung», verlangt die App ab dann die aktuelle Version. Es erscheint der bekannte Hinweis mit «Zur Unterschrift einladen». Ab diesem Moment gilt die Person auch im Cockpit und in der Patienten-Zone als «Neue Unterschrift nötig».
- **Anzeige:** In der Akte steht bei einer älteren, noch gültigen Unterschrift «Unterschrieben (Version 2), neue Version 3 bei der nächsten Behandlung oder Sitzung». «Formulartexte» zählt beide Gruppen getrennt.

## Nicht Teil dieser Änderung

- Eine Frist, nach der alle neu unterschreiben müssen.
- Eine nachträgliche Änderung der Wahl für eine bereits veröffentlichte Version (wer umstellen will, veröffentlicht eine neue Version mit «Sofort von allen»).

## Impact

- Datenbank: `ConsentTextVersion.resignRequired Boolean` (Standard `false` für neue Versionen, bestehende Versionen `true`, damit sich nichts rückwirkend ändert), `Patient.signatureRequiredVersion Int?`.
- Geteilt: `signaturePending` rechnet mit der «verlangten Version» statt mit der neuesten (Praxis-App und Zone).
- Praxis-App: «Formulartexte» (Wahl, Zählung), Akte (Hinweis), Seiten «Neue Behandlung» und «Neue Sitzung» (setzen die verlangte Version).
- Patienten-Zone: Rolle `patient_zone` darf `resignRequired` und `signatureRequiredVersion` lesen.
- Aufwand geschätzt: 0.5 bis 1 Personentag.
