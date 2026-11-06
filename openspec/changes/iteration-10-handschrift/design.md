# Design

## Context

Iteration 9 ist seit dem 18.10.2026 live. Die Bemerkungsfelder der Praxis-App sind einfache `<textarea>`: Diagnose der Behandlung (`TreatmentForm`), Diagnose und Vergleich der Sitzung (`ConsultationForm`) sowie «Weitere Diagnosen» des Patienten (`PatientForm`). Kein PDF druckt diese Felder. Die Patienten-Zone zeigt die Diagnose der Behandlung im Tab «Behandlungen».

Die Unterschrift nutzt bereits perfect-freehand. `@pain-therapy/shared/signature` erzeugt das SVG auf dem Server aus den rohen Punkten und vertraut keinem SVG aus dem Browser. Die Schreibfläche selbst liegt heute nur in der Patienten-Zone (`ZoneSigningForm`).

Die Praxis läuft in Azure Switzerland North (`rg-pain-therapy`). Für das Vorlesen der Übungen gibt es dort schon die Speech-Ressource `spch-pain-therapy` (F0).

## Goals / Non-Goals

**Goals:**
- Am iPad mit dem Pencil Bemerkungen schreiben, ohne Tastatur.
- Gesundheitsdaten verlassen die Schweiz nicht.
- Erkannter Text wird immer von der Therapeutin geprüft, bevor er gespeichert wird.

**Non-Goals:**
- Handschrift in der Patienten-Zone.
- Durchsuchen von Handschrift-Bildern.
- Eigenes Training eines Erkennungsmodells.

## Decisions

- **D1 Komponente `NoteInput`:** ersetzt die `<textarea>` der vier Felder. Oben rechts steht ein Segmentschalter (`Seg`, `required`) mit «Tastatur | Handschrift → Text | Handschrift als Bild». Der Formularwert bleibt das Textfeld mit demselben `name`. Bei «als Bild» kommt ein verstecktes Feld `<name>__strokes` (JSON der rohen Punkte) dazu.
- **D2 Schreibfläche `HandwritingPad`:** wird aus `ZoneSigningForm` herausgelöst und in beiden Apps genutzt. Linierte Fläche über die volle Feldbreite, 4 Zeilen hoch, «+ Zeile» erweitert bis 12 Zeilen. Dazu kommen «Rückgängig» (letzter Strich) und «Löschen». `touch-action: none` gilt nur auf der Fläche. Sobald ein Strich mit `pointerType === 'pen'` kam, werden `touch`-Ereignisse ignoriert (Handballen). Grenzen: höchstens 400 Striche und 20 000 Punkte pro Feld.
- **D3 Vorgabe pro Benutzer:** neues Feld `User.noteInputMode` (`KEYBOARD | HANDWRITING_TEXT | HANDWRITING_IMAGE`, Standard `KEYBOARD`). Wer im Formular umschaltet, setzt damit auch die Vorgabe (Server Action, ohne das Formular zu speichern). «Mein Profil» zeigt dieselbe Wahl. Ein Feld mit gespeichertem Bild öffnet immer in «als Bild», ein Feld mit Text in der Vorgabe des Benutzers.
- **D4 Erkennung:** «Erkennen» exportiert die Fläche im Browser als PNG (weisser Hintergrund, 2× Auflösung, höchstens 4 MB) und ruft die Server Action `recognizeHandwriting` auf. Der Server prüft die Rolle Therapist oder Admin, die Grösse und den PNG-Kopf. Danach ruft er Document Intelligence `prebuilt-read` (API `2024-11-30`, `locale=de`) mit der verwalteten Identität auf und wartet auf das Ergebnis (Polling, höchstens 15 s). Die Zeilen werden mit Zeilenumbruch zusammengefügt. Der Text wird beim Cursor eingefügt (bei leerem Feld ersetzt er es). Die Fläche wird geleert, das Feld wechselt in die Textansicht mit der Markierung «erkannt – bitte prüfen». Das Bild wird weder gespeichert noch geloggt. Das Audit erhält nur `note.recognized` mit Feld und Zeichenzahl, ohne Inhalt. Grenze: 60 Erkennungen pro Benutzer und Stunde.
- **D5 Speichern als Bild:** neue Tabelle `HandwrittenNote` (`id`, `entityType` = `TREATMENT | CONSULTATION | PATIENT`, `entityId`, `field`, `strokes` Json, `svg`, `width`, `height`, `createdBy`, `createdAt`, eindeutig auf `entityType, entityId, field`). Der Server baut das SVG aus den Punkten mit `signatureSvg` und vertraut keinem SVG aus dem Browser. Ein Bild ist wenige KB gross, deshalb liegt es in der Datenbank und nicht im Blob-Speicher. So erfassen Backups und das Lösch-Skript es automatisch. Pflichtfelder wie die Diagnose gelten als ausgefüllt, wenn Text oder Bild vorhanden ist. Der Text bleibt dann leer (`''`).
- **D6 Anzeige:** Detailansichten von Behandlung, Sitzung und Patient sowie der Tab «Behandlungen» der Zone zeigen das SVG inline (`<img src="data:image/svg+xml…">` mit `alt` «Handschriftliche Notiz»), skaliert auf die Spaltenbreite. Die Zone liest die Tabelle über ihren eingeschränkten DB-Benutzer; die Berechtigung `SELECT` auf `HandwrittenNote` kommt in die Zonen-Rolle.
- **D7 Umschalten mit Inhalt:**
  - Text → «als Bild»: Der Text bleibt erhalten und wird unter der Fläche angezeigt. Mit dem Speichern gilt das Bild, der Text wird geleert. Vorher fragt ein Dialog nach.
  - Bild → «Tastatur»: Das Bild bleibt, bis «Bild entfernen» gewählt wird.
  - «In Text umwandeln» erkennt ein gespeichertes Bild (D4, PNG aus dem SVG im Browser gerendert). Erst beim Speichern ersetzt der Text das Bild.
- **D8 Azure:** In `infra/main.bicep` kommt die Ressource `Microsoft.CognitiveServices/accounts` mit `kind: FormRecognizer`, `sku: F0`, Region `switzerlandnorth`, `disableLocalAuth: true` und `customSubDomainName: di-pain-therapy` dazu. Ausserdem eine Rollenzuweisung «Cognitive Services User» für `identity` (Praxis-App). Neue Umgebungsvariable `AZURE_DOCINTEL_ENDPOINT`. Lokal und in E2E-Tests ersetzt ein Stub mit festem Text die Erkennung (`DOCINTEL_STUB=1`).
- **D9 Sprache:** Erkennung mit `locale=de`. In der englischen Oberfläche wird `locale` weggelassen (automatische Erkennung).

## Risks / Trade-offs

- **Erkennungsqualität:** Medizinische Begriffe und Abkürzungen werden teils falsch erkannt. Deshalb wird jeder Text vor dem Speichern geprüft. Vor der Umsetzung testet Mike Franz 10 Proben echter Handschrift (Aufgabe 1.1).
- **Bilder sind nicht durchsuchbar:** Die Suche findet Handschrift-Bilder nicht. «In Text umwandeln» bleibt jederzeit möglich.
- **F0-Kontingent:** 500 Seiten pro Monat und 20 Aufrufe pro Minute. Bei Überschreitung zeigt die App «Erkennung gerade nicht verfügbar», und die Schrift bleibt auf der Fläche. Der Wechsel auf S0 ist eine Einstellung in Bicep.
- **Neue Rolle:** Die Deploy-Identität darf heute 4 Rollen zuweisen. «Cognitive Services User» braucht die Freigabe von Mike Franz, sonst schlägt das Deployment fehl.
- **Scribble:** In der Stellung «Tastatur» bleibt iPadOS Scribble aktiv. Das ist ein Gratis-Weg für einfache Notizen, auch ohne Erkennung im Backend.
