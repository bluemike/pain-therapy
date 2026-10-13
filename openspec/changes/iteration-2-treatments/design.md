# Design

## Context

Vorlage ist der Behandlungsbogen "Dokumentation L&B Schmerztherapie" der Sammelmappe (`docs/research/pdf1-behandlungsboegen.md`): Kopf mit Diagnose, Datum, Behandlung Nr., Schmerz in % und Vergleich, darunter pro Bereich die Osteopressur-Punkte (behandelt links/rechts, Empfindlichkeit niedrig bis extrem), der Restschmerz nach der Behandlung (0 bis 100 %), die Engpassdehnungen (verordnet, "Übung fällt" leicht bis unmöglich, Varianten) und 6 Zeilen Faszien-Rollmassage (Bereich und Werkzeug). Ein Bogen entspricht einer Sitzung. In der App heisst diese Sitzung **Konsultation**; mehrere Konsultationen im selben Bereich bilden eine **Behandlung**. Architektur, Audit und Speicher aus Iteration 1 werden weiterverwendet.

## Goals / Non-Goals

**Goals:**
- Eine Konsultation ist auf dem iPad während der Sitzung erfassbar, mit grossen Bedienelementen und ohne Tippen von Codes.
- Der Katalog ist Daten, nicht Code, damit eine spätere Verwaltung im UI ohne Umbau möglich ist.
- Erfasste Konsultationen bleiben gültig, auch wenn sich der Katalog später ändert.

**Non-Goals:**
- Katalogverwaltung im UI, PDF des Bogens, Heimprogramm, Auswertungen.

## Decisions

### D1: Begriffe und Datenmodell
- `Region`, `OsteopressurePoint`, `RegionPoint` (Bereich, Punkt, Hervorhebung `main`/`relevant`/`standard`, Reihenfolge), `Exercise`, `RegionExercise` (Bereich, Übung, Reihenfolge), `RollingTool`. Alle mit `retiredAt` statt Löschen.
- `Treatment`: Patient, `startedAt` (Datum und Zeit), Bereich, Diagnose, Schmerzgrad zu Beginn (0 bis 100, Vielfaches von 10), erstellt/geändert von und am.
- `Consultation`: Behandlung, Nummer innerhalb der Behandlung, `at` (Datum und Zeit), Diagnose, Schmerz vorher (optional), Restschmerz nachher (optional), Vergleich (Freitext), erstellt/geändert von und am.
- `ConsultationPoint`: Konsultation, Punkt-ID, links, rechts, Empfindlichkeit (`LOW`/`MEDIUM`/`STRONG`/`EXTREME`, optional). Ein Eintrag entsteht nur, wenn mindestens eine Angabe gemacht ist.
- `ConsultationExercise`: Konsultation, Übungscode, verordnet, "Übung fällt" (`EASY`/`MEDIUM`/`HARD`/`IMPOSSIBLE`, optional), Varianten (Freitext).
- `ConsultationRolling`: Konsultation, Position 1 bis 6, Bereich (Freitext), Werkzeug (Code).
- `ClinicalPhoto`: Behandlung, optional Konsultation, Blob-Pfad, SHA-256, Pixelmasse, Dateigrösse, `takenAt`, `uploadedAt`, `uploadedBy`, `removedAt`/`removedBy`.

Alle Schreibzugriffe laufen über die Service-Schicht mit `AuditEvent` (z. B. `treatment.created`, `consultation.updated`, `photo.added`, `photo.viewed`).

### D2: Katalog aus Referenzdateien
Die Tabellen in `reference/` werden nach `prisma/catalog/` übernommen und mit `npm run catalog:sync` per Upsert eingespielt, im Migrationsjob nach `prisma migrate deploy`. Seed-Plan und Herkunft der Daten in `reference/README.md`. Konsultationen speichern Punkt-IDs und Übungscodes mit Fremdschlüssel; der Bogen zeigt die Bezeichnungen aus dem Katalog.

### D3: Behandlungsbogen aus dem Katalog
Der Bogen einer Konsultation wird aus `RegionPoint` und `RegionExercise` des Bereichs der Behandlung aufgebaut, in der Reihenfolge der Papiervorlage. Hauptpunkte (orange fett) und wichtige Punkte (orange) sind wie auf dem Papier farbig hervorgehoben; ein Filter "nur Hauptpunkte" verkürzt die Liste. Punkte anderer Bereiche lassen sich über "Punkt aus anderem Bereich" ergänzen, weil die Bereiche sich Punkte teilen und Therapeut:innen davon abweichen. Empfindlichkeit, "Übung fällt" und Restschmerz sind Segmentschalter statt Auswahllisten, damit sie mit einem Tippen bedienbar sind; ein zweites Tippen auf den gewählten Wert hebt die Wahl auf.
Mockup: [`mockups/konsultation-lws-bauch.html`](mockups/konsultation-lws-bauch.html) (im Browser öffnen; Ansichten 1 Akte, 2 Neue Behandlung, 3 Konsultation für Bereich 6 mit den echten Referenzdaten).

### D4: Nummerierung
Konsultationen werden innerhalb ihrer Behandlung nummeriert (1, 2, 3 …); das entspricht "Behandlung Nr." auf dem Papierbogen, wo pro Schmerzbereich 3 bis 5 Sitzungen üblich sind. Die Nummer wird beim Speichern in derselben Transaktion vergeben und ändert sich nicht, wenn Datum oder Zeit korrigiert werden. Behandlungen selbst tragen ihren Bereich als Kennung ("6 · Lendenwirbelsäule, Bauch"); eine zweite Behandlung im selben Bereich ist möglich (z. B. ein neuer Schmerzschub ein Jahr später) und wird über das Datum unterschieden.

### D5: Fotos mit der Gerätekamera
Ein Dateifeld mit `accept="image/*"` und `capture="environment"` öffnet auf iPad und iPhone direkt die Rückkamera, auf dem Desktop die Dateiauswahl. Jedes Foto erscheint sofort als Vorschau mit Zeitstempel und lässt sich vor dem Speichern verwerfen. Der Zeitstempel ist der Aufnahmezeitpunkt aus den EXIF-Daten (`DateTimeOriginal`), wenn vorhanden, sonst der Zeitpunkt der Auswahl. Danach wird das Foto im Browser per Canvas auf höchstens 2048 Pixel verkleinert und als JPEG (Qualität 0.85) neu kodiert; das entfernt alle Metadaten inklusive Standort und wandelt HEIC in JPEG. Der Server prüft JPEG-Signatur und Grösse (höchstens 5 MB pro Foto, 10 Fotos pro Speichern).
*Alternative:* eigene Kameraansicht mit `getUserMedia`; verworfen, weil die System-Kamera auf iOS vertrauter ist und keinen Berechtigungsdialog braucht.

### D6: Speicher und Auslieferung der Fotos
Privater Container `clinical-photos` im bestehenden Storage-Account, mit Versionierung und Soft Delete (365 Tage), ohne Immutability, damit Fehlaufnahmen entfernt werden können. Entfernen setzt nur `removedAt`; die Datei bleibt und das Entfernen steht in der Änderungshistorie. Auslieferung über `/api/photos/{id}` und `/api/photos/{id}/thumb` nur an angemeldete Benutzer mit Rolle, mit `Cache-Control: private, no-store` und Audit-Eintrag pro Abruf der Vollansicht. Formulare mit Fotos gehen als Server Action; `serverActions.bodySizeLimit` wird auf 25 MB gesetzt. Erst werden die Dateien gespeichert, dann die Datenbank in einer Transaktion; verwaiste Dateien nach einem Fehler sind harmlos.

### D7: Akte
Der Reiter "Behandlungen" wird erster Reiter und Standardansicht der Akte. Jede Behandlung zeigt Bereich, Eröffnung, Schmerzgrad zu Beginn, Diagnose und ihre Konsultationen (neueste zuerst, mit Schmerz vorher und nachher). "Neue Behandlung" steht im Kopf der Akte, "+ Konsultation" bei jeder Behandlung.

### D8: Voraussetzungen
Neue Behandlungen und Konsultationen nur für aktive Patienten mit gültigem unterschriebenem Haftungsausschluss (gleiche Prüfung wie "Unterschrift ausstehend" auf dem Dashboard). Ohne Unterschrift zeigt die App einen Hinweis mit "An Patient:in übergeben". Beide Rollen (Therapist, Admin) dürfen erfassen und ändern.

## Risks / Trade-offs

- [Deutung der Farben auf dem Bogen ist eine Annahme] → In `reference/README.md` vermerkt; Abnahme durch die Praxis vor dem Import.
- [Fotos von Körperstellen sind besonders schützenswert] → Kein öffentlicher Zugriff, kein Browser-Cache, Metadaten werden entfernt, jeder Abruf wird protokolliert.
- [Langer Bogen auf dem iPhone] → Filter "nur Hauptpunkte", Abschnitte einklappbar, Speichern-Leiste bleibt sichtbar.
- [Grosse Uploads über Praxis-WLAN] → Verkleinerung im Browser (typisch 300 bis 800 KB pro Foto) und Fortschrittsanzeige.
- [Katalogänderungen nach erfassten Konsultationen] → Kein Löschen, nur `retiredAt`; alte Konsultationen zeigen zurückgezogene Punkte weiter an.

## Migration Plan

Additive Prisma-Migration, danach `catalog:sync` im Migrationsjob; neuer Blob-Container per Bicep im normalen Deployment. Rollback durch Aktivieren der vorherigen Revision; die neuen Tabellen stören die alte Version nicht.

## Open Questions

Diese Punkte sind mit dem jeweiligen Vorschlag umgesetzt und können bei der Durchsicht geändert werden:

- Fotos sind optional (0 bis n), sowohl bei der Behandlung als auch bei der Konsultation.
- Ohne gültigen unterschriebenen Haftungsausschluss lassen sich keine Behandlungen und Konsultationen eröffnen.
- Nummeriert werden die Konsultationen innerhalb einer Behandlung (entspricht "Behandlung Nr." auf dem Bogen), nicht die Behandlungen.
- "Schmerzgrad" der Behandlung ist der Schmerz zu Beginn; jede Konsultation hat zusätzlich "Schmerz vorher" und "Restschmerz nachher" wie der Bogen. Beide sind bei der Konsultation optional.
- Fehlerfassungen werden noch nicht gekennzeichnet; Korrekturen erfolgen durch Ändern mit Historie.
- Bedeutung der Farben auf dem Bogen (orange fett = Hauptpunkt, orange = wichtig, schwarz = weitere) ist zu bestätigen.
- Rollmassage, Varianten und Übungsblätter fehlen für 26 der 27 Übungen (nur 2A liegt als Scan vor).
