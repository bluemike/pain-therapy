# Design

## Context

- Iteration 3 legt pro Übung Hauptbild (`1A.jpg`), ganzes Blatt (`1A-blatt.png`) und die Texte (`exercises-content.json`) in den privaten Container `exercise-media`; `catalog:sync` übernimmt die Texte in `ExerciseSheet.content` (`rolling`, `steps`, `variants`). Die Route `/api/exercise-media/{code}/{main|sheet}` liefert die Bilder nur angemeldeten Benutzer:innen.
- Die Sammelmappe ist gescannt; es gibt keinen Ton, der sich herauslösen liesse.

## Goals / Non-Goals

**Goals:** Übungen in der Praxis vorlesen lassen, ohne laufende Kosten und ohne Patientendaten an einen weiteren Dienst; Bild der Übung direkt im Behandlungsbogen.

**Non-Goals:** Patienten-Zone, PDF, Mundart, Synthese zur Laufzeit.

## Decisions

### D1: Capability
Eine neue Capability `exercise-audio`, weil `exercise-library` (Iteration 3) noch nicht archiviert ist.

### D2: Aufnahmen einmalig erzeugen
Azure AI Speech, Stufe F0 (500 000 Zeichen pro Monat frei; die 27 Blätter brauchen grob 40 000), Region Switzerland North, Stimme `de-CH-LeniNeural` (Hochdeutsch mit Schweizer Akzent, wählbar). Erwogen: Sprachausgabe des Browsers (gratis, aber Qualität je Gerät, nicht prüfbar), Piper offline (gratis, eher mechanisch, kein Schweizer Akzent), Synthese bei jedem Abruf (unnötige Abhängigkeit und Kosten). Die Aufnahmen werden einmalig erzeugt, angehört und mit den Bildern hochgeladen; der Dienst wird von der App nie aufgerufen, darum keine Bicep-Ressource, kein Secret in der App.

### D3: Text und Dateiname
`speechSections()` liest das Blatt in seiner Reihenfolge: "Übung 2A, Wirbelsäulen-Übung.", "Faszien-Rollmassage. …", "Schritt 1. …", "Varianten. …"; leere Abschnitte entfallen, "2 × 30 s" wird "2 mal 30 Sekunden". SSML mit 0,9 s Pause zwischen den Abschnitten und leicht reduziertem Tempo. Dateiname wie das Hauptbild mit `.mp3`, damit kein neues Datenbankfeld nötig ist. Ausgabe: `audio-24khz-48kbitrate-mono-mp3` (rund 360 kB pro Minute).

### D4: Auslieferung
`MediaKind` erhält `audio` (`audio/mpeg`); gleiche Prüfung (angemeldet, Rolle) und Cache-Regeln wie die Bilder. Die Route beantwortet `Range`-Anfragen mit 206, weil Safari Audio sonst nicht abspielt.

### D5: Oberfläche
`ExercisePreview`: Hauptbild 64 × 52 px als Schaltfläche (verzögert geladen), öffnet ein `<dialog>` mit dem ganzen Bild, schliesst mit "Schliessen", Escape oder Klick daneben. `ExerciseAudio`: Schaltfläche "▶ Anhören" / "■ Stopp" (`aria-pressed`); lädt erst beim Klick; eine laufende andere Übung stoppt; fehlt die Datei, steht "Audio nicht verfügbar". Neue Spalte "Bild · Audio" im Abschnitt "Engpassdehnungen" und im Katalog; "Anhören" auch auf der Katalogseite der Übung.

## Risks / Trade-offs

- **Lizenz:** Eine vorgelesene Fassung ist eine neue Form der L&B-Texte → Praxis klärt mit L&B; ohne Zusage werden keine MP3s hochgeladen, die App zeigt dann "Audio nicht verfügbar".
- **Aussprache:** Fachwörter oder Abkürzungen können falsch klingen → Aufnahmen vor dem Hochladen anhören, Text in `exercises-content.json` anpassen und mit `--only` neu erzeugen.
