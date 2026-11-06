# Proposal

## Why

Am iPad schreibt die Therapeutin während der Sitzung lieber mit dem Apple Pencil als mit der Bildschirmtastatur. Mike Franz hat am 05.11.2026 gefragt, ob man bei den Bemerkungsfeldern selbst wählen kann zwischen Tastatur, Freihand mit Erkennung im Backend und Freihand, die als Bild gespeichert wird. Am 06.11.2026 hat er den Spec dafür freigegeben.

Mockup: https://claude.ai/artifact/Urx2rtseobvZZyy2odHeFN

## What Changes

- **Umschalter pro Feld:** Jedes Bemerkungsfeld der Praxis-App bekommt einen Umschalter mit drei Stellungen: «Tastatur», «Handschrift → Text» und «Handschrift als Bild».
- **Merken pro Benutzer:** Die zuletzt gewählte Stellung gilt als Vorgabe für alle Bemerkungsfelder dieses Benutzers. Sie kann zusätzlich unter «Mein Profil» gesetzt werden. Neue Benutzer starten mit «Tastatur».
- **Schreibfläche:** Die Handschrift nutzt dieselbe Stiftlinie wie die Unterschrift (perfect-freehand, Druckstärke des Apple Pencil). Sie bietet «Rückgängig», «Löschen» und «+ Zeile». Mit dem Pencil werden Berührungen der Handfläche ignoriert.
- **Handschrift → Text:** «Erkennen» schickt die Schrift an Azure AI Document Intelligence (Modell Read) in Switzerland North. Der erkannte Text erscheint im Textfeld zum Korrigieren und wird erst mit dem Formular gespeichert. Das Bild der Schrift wird nicht gespeichert.
- **Handschrift als Bild:** Die Schrift wird als Bild gespeichert und überall dort angezeigt, wo heute der Text steht, auch im Tab «Behandlungen» der Patienten-Zone. Ein Bild kann später mit «In Text umwandeln» erkannt werden.
- **Betroffene Felder:**
  - Behandlung: «Diagnose»
  - Sitzung: «Diagnose» und «Vergleich mit der letzten Sitzung»
  - Patient: «Weitere Diagnosen»
- **Azure:** neue Ressource `di-pain-therapy` (Document Intelligence, Stufe F0, Switzerland North) per Bicep, Zugriff der Praxis-App über ihre verwaltete Identität.

**Nicht im Umfang (Out of scope):**
- Die Notizfelder der Patienten-Zone (Tagebucheintrag, Bemerkung bei der Unterschrift) bleiben Tastaturfelder, weil dort fast nur Telefone im Einsatz sind.
- Kurze Einzeiler (z. B. «Andere» bei Vorerkrankungen, Medikamente) bleiben Tastaturfelder.
- Zeichnen auf Körperbildern oder Fotos.
- iPadOS Scribble bleibt unverändert nutzbar: In der Stellung «Tastatur» wandelt das iPad Pencil-Schrift selbst in Text um.

## Capabilities

### New Capabilities
- `note-input`: Umschalter, Vorgabe pro Benutzer, Schreibfläche.
- `handwriting-recognition`: Erkennung in Text über Azure in der Schweiz, Korrektur vor dem Speichern.
- `handwritten-notes`: Speichern, Anzeigen und Umwandeln von Handschrift als Bild.

## Impact

- Praxis-App: Formulare Behandlung, Sitzung und Patient; Detailansichten; «Mein Profil».
- Patienten-Zone: Anzeige der Diagnose als Bild im Tab «Behandlungen».
- `@pain-therapy/shared`: Schreibfläche und SVG-Erzeugung aus der Unterschrift werden gemeinsam genutzt.
- Datenmodell: neues Feld `User.noteInputMode`, neue Tabelle `HandwrittenNote`. Das Lösch-Skript der Patientendaten nimmt die Tabelle mit.
- Azure: neue Ressource Document Intelligence (F0) und eine neue Rollenzuweisung «Cognitive Services User» für die Identität der Praxis-App. Diese Rolle muss die Deploy-Identität zuweisen dürfen, was Mike Franz freigeben muss.
- Kosten: F0 enthält 500 Seiten pro Monat gratis. Darüber wechselt man auf S0 mit etwa USD 1.50 pro 1000 Erkennungen.
