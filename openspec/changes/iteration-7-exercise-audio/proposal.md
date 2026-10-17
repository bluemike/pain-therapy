# Proposal

## Why

Die Praxis wünscht (Anfrage von Mike Franz, 17.10.2026), dass die Übungen der L&B-Sammelmappe nicht nur als Bild und Text, sondern auch vorgelesen verfügbar sind. Die Blätter sind Scans ohne Ton; eine Aufnahme entsteht deshalb per Sprachsynthese aus den in Iteration 3 digitalisierten Texten. Im Behandlungsbogen fehlte bei den Engpassdehnungen ausserdem ein Bild der Übung.

## What Changes

- **Vorschau und Bild gross:** Im Abschnitt "Engpassdehnungen" des Behandlungsbogens und im Katalog-Reiter "Engpassdehnungen" zeigt jede Übung ein kleines Hauptbild. Ein Klick öffnet das ganze Bild in einem Fenster.
- **Anhören:** Neben dem Bild spielt "Anhören" die gesprochene Fassung des Übungsblatts (Titel, Faszien-Rollmassage, Schritte der Engpassdehnung, Varianten); ein zweiter Klick stoppt. Es spielt immer nur eine Übung. Auch die Katalogseite einer Übung hat "Anhören".
- **Aufnahmen:** Ein Skript (`npm run media:audio`) erzeugt pro Übung eine MP3 mit Azure AI Speech, Stufe F0 (kostenlos), Region Switzerland North, Stimme `de-CH-LeniNeural`. Die MP3s liegen wie die Bilder nur im privaten Container `exercise-media`, nie im Repository.
- **Auslieferung:** Die bestehende Route `/api/exercise-media/{code}/{kind}` kennt neu `audio`, nur für angemeldete Benutzer:innen, mit Byte-Bereichen für Safari auf iPad und iPhone.

**Nicht im Umfang (Out of scope), siehe docs/roadmap.md:**
- Vorlesen in der Patienten-Zone und im Übungsblatt-PDF.
- Schweizerdeutsche Mundart (Azure hat dafür keine neuronale Stimme).
- Sprachsynthese bei jedem Abruf; die Aufnahmen entstehen einmalig.

## Capabilities

### New Capabilities
- `exercise-audio`: Vorschau mit grossem Bild und gesprochene Fassung der Übungsblätter in der Praxis-App, Erzeugung und Auslieferung der Aufnahmen.

### Modified Capabilities
- Keine geänderten Anforderungen in `openspec/specs/` (die Changes der Iterationen 1 bis 6 sind noch nicht archiviert). Inhaltlich erweitert diese Iteration `exercise-library` (Iteration 3), "Schutz der Übungsinhalte", um die Aufnahmen.

## Impact

- Praxis-App: `ExercisePreview`, `ExerciseAudio`, Behandlungsbogen, Katalog, Medien-Route, `src/lib/exercise-audio.ts`.
- Skript `scripts/exercise-audio.ts`; Dokumentation `docs/deployment.md` (Iteration 7).
- Azure: ein Speech-Dienst F0, von Hand angelegt und nur beim Erzeugen benutzt; keine Bicep-Änderung.
- Lizenz: Mike Franz hat bestätigt, dass die Praxis die Bilder von L&B abgeben darf. Ob das für eine vorgelesene Fassung der Texte auch gilt, klärt die Praxis mit Liebscher & Bracht.
