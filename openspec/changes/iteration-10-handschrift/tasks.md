# Tasks

## 1. Vorbereitung

- [ ] 1.1 Probe: 10 handschriftliche Diagnosen von Mike Franz mit Document Intelligence Read (Switzerland North) erkennen und die Qualität mit ihm besprechen (Risiko Erkennungsqualität)
- [x] 1.2 Freigabe von Mike Franz (21.11.2026): Deploy-Identität darf «Cognitive Services User» zuweisen (D8)

## 2. Azure und Datenmodell

- [x] 2.1 Bicep: Document Intelligence `di-pain-therapy` (F0, Switzerland North, ohne lokale Schlüssel), Rollenzuweisung für die Praxis-App, `AZURE_DOCINTEL_ENDPOINT` (D8)
- [x] 2.2 Prisma: `User.noteInputMode`, Json-Spalten `…Ink`, Migration; Spaltenrechte für die Zonen-Rolle (D3, D5, D6)
- [x] 2.3 Löschen und Export einer Praxis: entfällt, die Spalten gehören zur Zeile (Iteration 12 ersetzt das Lösch-Skript)

## 3. Eingabe

- [x] 3.1 `HandwritingPad` mit der Strichlogik der Unterschrift (eigene Komponente, die Zone bleibt unverändert); Linien, «+ Zeile», «Rückgängig», «Löschen», Handballen-Filter, Grenzen (D2)
- [x] 3.2 `NoteInput` mit Umschalter in Behandlung, Sitzung und Patient einbauen (D1)
- [x] 3.3 Vorgabe pro Benutzer speichern und in «Mein Profil» anzeigen (D3)
- [x] 3.4 Umschalten mit Inhalt inkl. Dialog «Text durch Handschrift ersetzen?» (D7)

## 4. Erkennung und Bild

- [x] 4.1 Server Action `recognizeHandwriting` mit verwalteter Identität, Polling, Zeitlimit, Rate-Limit, Audit ohne Inhalt, Stub für lokal und E2E (D4, D8)
- [x] 4.2 Speichern als Bild: SVG auf dem Server aus den Punkten, Pflichtfeld-Prüfung Text oder Bild (D5)
- [x] 4.3 Anzeige in den Detailansichten und im Zonen-Tab «Behandlungen» (D6)
- [x] 4.4 «In Text umwandeln» für gespeicherte Bilder (D7)
- [x] 4.5 Texte Deutsch und Englisch

## 5. Tests und Abnahme

- [x] 5.1 Unit-Tests: Punkte-Grenzen, SVG aus Punkten, Pflichtfeld Text oder Bild, Zusammenfügen der erkannten Zeilen
- [x] 5.2 End-to-End-Test mit Stub: Umschalten, Erkennen, Speichern als Bild, Umwandeln, Ersetzen mit Rückfrage, Vorgabe im Profil (Anzeige in der Zone: Spaltenrechte im Unit-Test)
- [ ] 5.3 Deployment und Abnahme durch Mike Franz auf dem iPad mit Apple Pencil
