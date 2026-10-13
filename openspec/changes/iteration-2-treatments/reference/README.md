# Referenzdaten für den Therapiekatalog

Diese Tabellen bilden die L&B-Behandlungs-Sammelmappe der Praxis digital ab. Sie sind der Vorschlag für die Erstbefüllung des Therapiekatalogs (Seed) in Iteration 2 und werden vor dem Import von der Praxis geprüft.

## Dateien

| Datei | Inhalt | Anzahl |
|---|---|---|
| `regions.json` | Die 12 Behandlungsbereiche: Nummer, Name Deutsch und Englisch, Titel des Bogens | 12 |
| `osteopressure-points.json` | Osteopressur-Punkte: ID (z. B. `2.11.1`), Gruppe (1 Kopf/Hals, 2 Rumpf, 3 Arm, 4 Bein), Muskel und Ansatz (Latein), Ansatz deutsch | 72 |
| `region-points.csv` | Welche Punkte auf welchem Bogen stehen, in welcher Reihenfolge und mit welcher Hervorhebung | 132 |
| `exercises.json` | Engpassdehnungen 1A bis 4G: Code, Gruppe, Name Deutsch und Englisch, Bereiche, Rollmassage, Varianten | 27 |
| `region-exercises.csv` | Welche Übungen auf welchem Bogen stehen, in welcher Reihenfolge | 69 |
| `rolling-tools.json` | Werkzeuge der Faszien-Rollmassage (MiKu, MeKu, MiRo, MeRo) | 4 |
| `scales.json` | Skalen des Bogens: Schmerz in %, Empfindlichkeit, "Übung fällt", Anzahl Rollmassage-Zeilen | |

## Herkunft

- **Bereiche, Punkte, Hervorhebung, Übungen pro Bogen:** maschinell aus dem Textlayer von `Ayanta Home - Dokumente/pain-therapy/Sammelmappe 12 Behandlungsbögen_Liebscher & Bracht.pdf` gelesen (OneDrive Ayanta AG), inklusive Schriftfarbe und Schriftschnitt.
- **Hervorhebung (`emphasis`):** `standard` = schwarz, `relevant` = orange, `main` = orange fett. Der Bogen hat dazu keine Legende; die Deutung "orange fett = Hauptpunkt des Bereichs" ist eine Annahme und von der Praxis zu bestätigen.
- **Übung 2A, Rollmassage und Varianten:** aus `Ayanta Home - Dokumente/pain-therapy/exercises/scan1.pdf` (Buchseite 97), in eigenen Worten zusammengefasst. Für die übrigen 26 Übungen stehen Rollmassage, Varianten und Übungsblatt auf `TODO`, bis entsprechende Scans vorliegen.
- **Englische Namen** von Bereichen, Übungen und Werkzeugen sind eigene Übersetzungen und von der Praxis zu prüfen. Punkte haben keine englischen Namen; die lateinische Bezeichnung gilt in beiden Sprachen.

## Bereinigungen gegenüber der Vorlage

- Tippfehler korrigiert: "SpinaScapulea", "Manudibula", "PectroralisMajor", "Darmsteinstachel", "EpikondylusLateralis", "FlexorPoIlicisBrevis", "DiaphragmaProcessXiphoideus", "Augen-Übrung", "Äußerere".
- Bogen 1 führt "Punkt 2.8." mit RectusAbdominis-OsPubis; übernommen als `2.8.1`.
- Bogen 2 nennt bei `1.8.2` zweimal "ScalenusAnterior"; übernommen als ScalenusMedius wie auf Bogen 1.
- Punkt `1.3` hat zwei Ansätze (Unterkiefer und Schädel) und bleibt ein Punkt.
- Bei mehrfach vorkommenden Punkten gilt die häufigste Schreibweise.

## Seed-Plan

1. Die Dateien werden mit der Implementierung nach `prisma/catalog/` übernommen (gleiches Format).
2. Ein idempotentes Skript `npm run catalog:sync` liest sie und schreibt per Upsert in die Tabellen `Region`, `OsteopressurePoint`, `RegionPoint`, `Exercise`, `RegionExercise`, `RollingTool`. Schlüssel sind Bereichsnummer, Punkt-ID und Übungscode.
3. Das Skript läuft im Migrationsjob nach `prisma migrate deploy`, lokal mit `npm run db:seed`. Es löscht keine Einträge: Punkte oder Übungen, die aus den Dateien verschwinden, werden als `retired` markiert, damit erfasste Konsultationen gültig bleiben.
4. Jede Konsultation speichert Punkt-IDs und Übungscodes; Bezeichnungen werden zur Anzeige aus dem Katalog gelesen.
5. Eine spätere Iteration macht den Katalog in der App verwaltbar; bis dahin ändern sich die Daten nur über diese Dateien und einen Pull Request.
