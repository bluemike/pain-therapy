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
- **Rollmassage:** steht nicht auf den Blättern; 120 s pro Übung (von der Praxis festgelegt am 13.10.2026).
- **Sonderfälle:** 2C (Atemübung mit zwölf Atemzügen) und 1C (mehrere Blickrichtungen) ohne abgeleiteten Wert, von der Praxis festzulegen.

Dauer einer Ausführung = Rollmassage + Dehnung pro Seite × Seiten, also typisch 4 Minuten (eine Seite) oder 6 Minuten (zwei Seiten). Die Werte stehen in `reference/exercise-sheets.json` (`timing`) mit Herkunft und offenen Punkten; `null` heisst "noch nicht festgelegt", die App rechnet dann ohne diesen Anteil und zeigt einen Hinweis.

### D4: Selbstausführung als Verordnung
Neue Tabelle `HomePrescription` (Konsultation, Übungscode, Wiederholung, Intensität 1 bis 9 optional, Schritte 1 bis 3 optional, Bemerkung). Wiederholung ist ein Enum:
- `DAILY_1`, `DAILY_2`, `DAILY_3`: täglich 1x, 2x, 3x (7, 14, 21 Ausführungen pro Woche)
- `WEEKLY_1` bis `WEEKLY_7`: wöchentlich 1x bis 7x (1 bis 7 Ausführungen pro Woche)

Die Auswahl zeigt die zehn Optionen in zwei Gruppen ("täglich" 1x bis 3x, "wöchentlich" 1x bis 7x).

Übungen mit "verordnet" im Bogen erscheinen automatisch im Block, mit Vorschlag "täglich 1x"; weitere Übungen lassen sich aus dem Katalog hinzufügen. Entfernt die Therapeutin "verordnet", verschwindet die Zeile. Der Block zeigt pro Zeile die Dauer einer Ausführung und unten den Gesamtbedarf pro Woche und den Durchschnitt pro Tag (Woche / 7).
Mockup: [`mockups/selbstausfuehrung.html`](mockups/selbstausfuehrung.html) (Ansichten 1 Selbstausführung, 2 Abschluss, 3 Übungsblatt, 4 Katalog-Übung).

### D5: Übungsblatt als PDF
Mit `@react-pdf/renderer` wie das Formular-PDF aus Iteration 1, in der Sprache der Patientin:
1. **Deckblatt:** Praxis, Patientin, Datum der Konsultation, Therapeut:in, Tabelle der Übungen (Hauptbild klein, Code, Name, Wiederholung, Intensität, Schritte, Dauer) und Gesamtzeitbedarf, Sicherheitshinweis (Intensität nie 10 oder höher).
2. **Pro Übung das Blattbild** mit eingedruckter Verordnung in den Feldern "Häufigkeit pro Woche", "täglich", "Intensität" und "Schritte".

Das PDF wird mit Dokumentnummer im bestehenden Archiv-Container abgelegt (`SignedDocument` bekommt einen Typ `EXERCISE_SHEET`, oder eine eigene Tabelle `HandoutDocument`; Entscheid bei der Umsetzung) und erscheint in der Akte unter "Dokumente".

### D6: Abschluss und Versand
Das Übungsblatt entsteht nur auf Knopfdruck ("Übungsblatt erstellen"), nicht automatisch beim Speichern. Der Abschluss einer Konsultation bietet es an, sobald mindestens eine Verordnung besteht:
- Mit Einwilligung in unverschlüsselte E-Mail (aus der gültigen Unterschrift) und E-Mail-Adresse: Versand über Microsoft Graph aus `pain-therapy@ayanta.ch`, mit den bestehenden Wiederholungen und dem Zustellstatus.
- Sonst: "Drucken" öffnet das PDF im Browser zum Ausdrucken; die Akte vermerkt "ausgedruckt".
Ein erneutes Senden nach Änderungen erzeugt eine neue Version; ältere bleiben in der Akte.

## Risks / Trade-offs

- [Urheberrecht an Texten und Fotos der L&B-Blätter] → Die Praxis darf die Bilder an Patientinnen abgeben (Bestätigung von Mike Franz am 13.10.2026). Die Inhalte bleiben trotzdem ausserhalb des Repositorys und sind in der App nur für angemeldete Benutzer und im persönlichen Übungsblatt sichtbar.
- [Abgeleitete Zeiten stimmen nicht mit der Praxis überein] → Werte in einer Datei mit Herkunft, Abnahme durch die Praxis, Korrektur per Pull Request.
- [Gesundheitsdaten per unverschlüsselter E-Mail] → Nur mit Einwilligung, wie in Iteration 1.
- [Zu viele Übungen für den Alltag] → Gesamtzeitbedarf sichtbar vor dem Versand; Hinweis ab 30 Minuten pro Tag.

## Migration Plan

Additive Migration, Upload der Medien in `exercise-media` vor dem ersten Deployment, danach `catalog:sync` im Migrationsjob. Rollback durch Aktivieren der vorherigen Revision.

## Open Questions

- Dauer der Dehnung für 1C (Augen, mehrere Blickrichtungen) und 2C (Atemübung mit zwölf Atemzügen).

Entschieden am 13.10.2026: Wiederholungen täglich 1x bis 3x und wöchentlich 1x bis 7x; Rollmassage 2 Minuten; Vorschlag für neue Verordnungen "täglich 1x"; Übungsblatt nur auf Knopfdruck; die Bilder dürfen an Patientinnen abgegeben werden.
