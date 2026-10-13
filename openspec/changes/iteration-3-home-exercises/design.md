# Design

## Context

Vorlage ist die "Sammelmappe 27 Übungsblätter" (`docs/research/pdf2-uebungsblaetter.md`), ein Blatt pro Übung 1A bis 4G. Jedes Blatt hat oben die Felder "Häufigkeit pro Woche", "täglich", "Intensität" und "Schritte", die die Therapeutin von Hand ausfüllt, darunter die Abschnitte Faszien-Rollmassage, Engpassdehnung (3 Schritte im 30-Sekunden-Takt) und Varianten mit nummerierten Fotos. Iteration 2 hat die Übungen als Katalog mit Code, Name und Bereichen angelegt und in der Konsultation "verordnet", "Übung fällt" und Varianten erfasst. Iteration 3 baut darauf auf.

## Goals / Non-Goals

**Goals:**
- Die Patientin bekommt am Ende der Konsultation ohne Handarbeit ein vollständiges, persönliches Übungsblatt.
- Der Zeitbedarf ist für Therapeutin und Patientin vor dem Versand sichtbar, damit das Programm machbar bleibt.
- Die urheberrechtlich geschützten Inhalte der Blätter liegen nur dort, wo die Praxis sie ohnehin hat, nicht im Git-Repository.

**Non-Goals:**
- Patienten-Zone, Erinnerungen, Fortschrittsprotokoll (spätere Iteration).
- Eigene Übungstexte oder Videos.

## Decisions

### D1: Digitalisierung der Übungsblätter
Ein Importskript (`scripts/import-exercise-sheets.py`, PyMuPDF) liest die PDF-Sammelmappe der Praxis und erzeugt pro Übung:
- **Hauptbild:** das Foto der Engpassdehnung mit der Markierung "1-2" (bei 1E das grösste Foto des Abschnitts), als JPEG.
- **Blattbild:** das ganze Blatt als PNG (110 dpi) für die Katalogansicht und das Übungsblatt.
- **Inhalte:** die Texte der Abschnitte Faszien-Rollmassage, Engpassdehnung (Schritte) und Varianten, wörtlich vom Blatt.

Ein erster Lauf ist gemacht; die Ergebnisse liegen in OneDrive unter `Ayanta Home - Dokumente/pain-therapy/exercises/digitalisiert/` (27 Hauptbilder, 27 Blattbilder, `exercises-content.json`, Übersicht `uebersicht-hauptbilder.png`). Im Repository liegt nur `reference/exercise-sheets.json` mit Code, Seite, Dateinamen, Schritt-Bezeichnungen und Zeitbedarf, ohne Texte und Bilder von L&B.

### D2: Ablage und Einspielen
Bilder und `exercises-content.json` werden einmalig von einem Administrator in den privaten Container `exercise-media` geladen (`az storage blob upload-batch`, dokumentiert in docs/deployment.md). `catalog:sync` liest `exercise-sheets.json` aus dem Repository und `exercises-content.json` aus dem Container und schreibt Inhalte und Zeitbedarf per Upsert in `ExerciseSheet`. Fehlt der Container-Inhalt, bleiben die Übungen ohne Blatt und die App zeigt "noch nicht erfasst". Die App liefert die Bilder über `/api/exercise-media/{code}/{main|sheet}` nur an angemeldete Benutzer aus; Patientinnen bekommen sie nur eingebettet im PDF.

### D3: Zeitbedarf
Die Blätter nennen keine Gesamtzeit. Abgeleitet:
- **Dehnung pro Seite:** Schritt 1 (30 s) + Schritt 2 (2 × 30 s, langsam und schnell) + Schritt 3 (30 s) = 120 s. Bei 3A/3B ist Schritt 3 eine Wahl, nicht zusätzlich.
- **Seiten:** 2, wenn das Blatt die andere Seite oder beide Seiten nennt (18 Übungen), sonst 1.
- **Rollmassage:** steht nicht auf den Blättern; Vorschlag 120 s pro Übung, von der Praxis zu bestätigen.
- **Sonderfälle:** 2C (Atemübung mit zwölf Atemzügen) und 1C (mehrere Blickrichtungen) ohne abgeleiteten Wert, von der Praxis festzulegen.

Dauer einer Ausführung = Rollmassage + Dehnung pro Seite × Seiten, also typisch 4 Minuten (eine Seite) oder 6 Minuten (zwei Seiten). Die Werte stehen in `reference/exercise-sheets.json` (`timing`) mit Herkunft und offenen Punkten; `null` heisst "noch nicht festgelegt", die App rechnet dann ohne diesen Anteil und zeigt einen Hinweis.

### D4: Selbstausführung als Verordnung
Neue Tabelle `HomePrescription` (Konsultation, Übungscode, Wiederholung, Intensität 1 bis 9 optional, Schritte 1 bis 3 optional, Bemerkung). Wiederholung ist ein Enum:
- `DAILY_1` täglich 1x (7 Ausführungen pro Woche)
- `DAILY_2` täglich 2x (14 pro Woche)
- `WEEKLY_3_7` 3-7x pro Woche (3 bis 7 pro Woche, als Spanne angezeigt)
- `WEEKLY_5` 5x pro Woche (5 pro Woche)

Übungen mit "verordnet" im Bogen erscheinen automatisch im Block, mit Vorschlag "täglich 2x" (L&B-Standard 6x pro Woche, 2x täglich laut Praxisunterlagen); weitere Übungen lassen sich aus dem Katalog hinzufügen. Entfernt die Therapeutin "verordnet", verschwindet die Zeile. Der Block zeigt pro Zeile die Dauer einer Ausführung und unten den Gesamtbedarf pro Tag und pro Woche (bei 3-7x als Spanne).
Mockup: [`mockups/selbstausfuehrung.html`](mockups/selbstausfuehrung.html) (Ansichten 1 Selbstausführung, 2 Abschluss, 3 Übungsblatt, 4 Katalog-Übung).

### D5: Übungsblatt als PDF
Mit `@react-pdf/renderer` wie das Formular-PDF aus Iteration 1, in der Sprache der Patientin:
1. **Deckblatt:** Praxis, Patientin, Datum der Konsultation, Therapeut:in, Tabelle der Übungen (Hauptbild klein, Code, Name, Wiederholung, Intensität, Schritte, Dauer) und Gesamtzeitbedarf, Sicherheitshinweis (Intensität nie 10 oder höher).
2. **Pro Übung das Blattbild** mit eingedruckter Verordnung in den Feldern "Häufigkeit pro Woche", "täglich", "Intensität" und "Schritte".

Das PDF wird mit Dokumentnummer im bestehenden Archiv-Container abgelegt (`SignedDocument` bekommt einen Typ `EXERCISE_SHEET`, oder eine eigene Tabelle `HandoutDocument`; Entscheid bei der Umsetzung) und erscheint in der Akte unter "Dokumente".

### D6: Abschluss und Versand
Der Abschluss einer Konsultation bietet "Übungsblatt senden" an, sobald mindestens eine Verordnung besteht:
- Mit Einwilligung in unverschlüsselte E-Mail (aus der gültigen Unterschrift) und E-Mail-Adresse: Versand über Microsoft Graph aus `pain-therapy@ayanta.ch`, mit den bestehenden Wiederholungen und dem Zustellstatus.
- Sonst: "Drucken" öffnet das PDF im Browser zum Ausdrucken; die Akte vermerkt "ausgedruckt".
Ein erneutes Senden nach Änderungen erzeugt eine neue Version; ältere bleiben in der Akte.

## Risks / Trade-offs

- [Urheberrecht an Texten und Fotos der L&B-Blätter] → Inhalte nicht im Repository; digitale Nutzung und E-Mail-Versand erst nach schriftlicher Erlaubnis von Liebscher & Bracht oder Bestätigung, dass die Lizenz der Praxis das abdeckt. Bis dahin kann das Deckblatt allein (ohne Blattbilder) versendet werden.
- [Abgeleitete Zeiten stimmen nicht mit der Praxis überein] → Werte in einer Datei mit Herkunft, Abnahme durch die Praxis, Korrektur per Pull Request.
- [Gesundheitsdaten per unverschlüsselter E-Mail] → Nur mit Einwilligung, wie in Iteration 1.
- [Zu viele Übungen für den Alltag] → Gesamtzeitbedarf sichtbar vor dem Versand; Hinweis ab 30 Minuten pro Tag.

## Migration Plan

Additive Migration, Upload der Medien in `exercise-media` vor dem ersten Deployment, danach `catalog:sync` im Migrationsjob. Rollback durch Aktivieren der vorherigen Revision.

## Open Questions

- Darf die Praxis die L&B-Übungsblätter digital nutzen und per E-Mail versenden? (Voraussetzung für die Blattbilder im PDF.)
- "3-7x pro Woche" und "5x pro Woche" überschneiden sich; ist "3-7x" so gemeint, oder "3x pro Woche"?
- Rollmassage-Dauer pro Übung (Vorschlag 120 s) und Dauer für 1C und 2C.
- Vorschlagswert für neue Verordnungen: "täglich 2x"?
- Soll das Übungsblatt automatisch beim Speichern der Konsultation erzeugt werden oder nur auf Knopfdruck (Vorschlag: auf Knopfdruck)?
