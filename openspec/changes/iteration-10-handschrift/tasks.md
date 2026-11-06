# Tasks

## 1. Vorbereitung

- [ ] 1.1 Probe: 10 handschriftliche Diagnosen von Mike Franz mit Document Intelligence Read (Switzerland North) erkennen und die Qualität mit ihm besprechen (Risiko Erkennungsqualität)
- [ ] 1.2 Freigabe von Mike Franz: Deploy-Identität darf «Cognitive Services User» zuweisen (D8)

## 2. Azure und Datenmodell

- [ ] 2.1 Bicep: Document Intelligence `di-pain-therapy` (F0, Switzerland North, ohne lokale Schlüssel), Rollenzuweisung für die Praxis-App, `AZURE_DOCINTEL_ENDPOINT` (D8)
- [ ] 2.2 Prisma: `User.noteInputMode`, Tabelle `HandwrittenNote`, Migration; `SELECT` für die Zonen-Rolle (D3, D5, D6)
- [ ] 2.3 Lösch-Skript der Patientendaten um `HandwrittenNote` ergänzen

## 3. Eingabe

- [ ] 3.1 `HandwritingPad` aus `ZoneSigningForm` herauslösen und gemeinsam nutzen; Linien, «+ Zeile», «Rückgängig», «Löschen», Handballen-Filter, Grenzen (D2)
- [ ] 3.2 `NoteInput` mit Umschalter in Behandlung, Sitzung und Patient einbauen (D1)
- [ ] 3.3 Vorgabe pro Benutzer speichern und in «Mein Profil» anzeigen (D3)
- [ ] 3.4 Umschalten mit Inhalt inkl. Dialog «Text durch Handschrift ersetzen?» (D7)

## 4. Erkennung und Bild

- [ ] 4.1 Server Action `recognizeHandwriting` mit verwalteter Identität, Polling, Zeitlimit, Rate-Limit, Audit ohne Inhalt, Stub für lokal und E2E (D4, D8)
- [ ] 4.2 Speichern als Bild: SVG auf dem Server aus den Punkten, Pflichtfeld-Prüfung Text oder Bild (D5)
- [ ] 4.3 Anzeige in den Detailansichten und im Zonen-Tab «Behandlungen» (D6)
- [ ] 4.4 «In Text umwandeln» für gespeicherte Bilder (D7)
- [ ] 4.5 Texte Deutsch und Englisch

## 5. Tests und Abnahme

- [ ] 5.1 Unit-Tests: Punkte-Grenzen, SVG aus Punkten, Pflichtfeld Text oder Bild, Zusammenfügen der erkannten Zeilen
- [ ] 5.2 End-to-End-Tests mit Stub: Umschalten, Erkennen und Korrigieren, Speichern als Bild, Anzeige in der Zone, Umwandeln
- [ ] 5.3 Deployment und Abnahme durch Mike Franz auf dem iPad mit Apple Pencil
