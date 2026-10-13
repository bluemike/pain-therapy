# Referenzdaten Übungsblätter

`exercise-sheets.json` beschreibt die 27 Blätter der "Sammelmappe 27 Übungsblätter" ohne deren Inhalte: Code, Titel, Seite in der Sammelmappe, Dateinamen von Hauptbild und Blattbild, Bezeichnungen der Dehnungsschritte und Zeitbedarf (`timing`).

## Zeitbedarf (`timing`)

| Feld | Bedeutung |
|---|---|
| `stretchSecondsPerSide` | Dehnung pro Seite: Schritt 1 (30 s) + Schritt 2 (2 × 30 s) + Schritt 3 (30 s) = 120 s; `null` bei 1C und 2C |
| `sides` | 2, wenn das Blatt die andere Seite oder beide Seiten nennt, sonst 1 |
| `rollingSeconds` | Rollmassage; steht nicht auf den Blättern, 120 s (von der Praxis festgelegt am 13.10.2026) |
| `source`, `todo` | Herkunft der Werte und offene Punkte |

## Inhalte

Texte und Bilder der Blätter gehören Liebscher & Bracht und liegen nicht im Repository. Die erste Digitalisierung liegt in OneDrive unter `Ayanta Home - Dokumente/pain-therapy/exercises/digitalisiert/`:

- `1A.jpg` bis `4G.jpg`: Hauptbild (Foto der Engpassdehnung, 200 dpi)
- `1A-blatt.png` bis `4G-blatt.png`: ganzes Blatt (110 dpi)
- `exercises-content.json`: Texte der Abschnitte pro Übung, Schritt-Bezeichnungen, Zeitbedarf
- `uebersicht-hauptbilder.png`: alle 27 Hauptbilder auf einen Blick

Die Praxis darf die Bilder an Patientinnen abgeben (bestätigt am 13.10.2026). Sie werden vor dem ersten Deployment von Iteration 3 in den privaten Container `exercise-media` geladen (design.md, D2).
