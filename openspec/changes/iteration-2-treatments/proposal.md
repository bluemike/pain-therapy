# Proposal

## Why

Nach Iteration 1 sind Patientinnen und Patienten mit Anamnese und unterschriebenem Haftungsausschluss in der App. Die Behandlungen selbst dokumentiert die Praxis aber noch auf den Papier-Behandlungsbögen der L&B-Sammelmappe. Iteration 2 bringt diese Dokumentation in die App: Eine Patientin hat eine oder mehrere Behandlungen (je ein Schmerzbereich), und jede Behandlung besteht aus Konsultationen, die den Behandlungsbogen des Bereichs digital ausfüllen. Fotos, direkt mit der Kamera von iPad oder iPhone aufgenommen, ergänzen beides.

## What Changes

- **Behandlungen (1 bis n pro Patient):** In der Akte als Liste, neueste zuerst. Neue Behandlung mit Datum und Zeit (jetzt vorgegeben), Diagnose (Freitext), Bereich (einer der 12 Bereiche der Sammelmappe, z. B. "Lendenwirbelsäule, Bauch") und Schmerzgrad zu Beginn (0 bis 100 % in 10er-Schritten), alle Pflicht, dazu beliebig viele Fotos mit Zeitstempel.
- **Konsultationen (1 bis n pro Behandlung):** Datum und Zeit (Pflicht), Diagnose (aus der Behandlung übernommen, änderbar), Fotos und der digitale Behandlungsbogen des Bereichs: Schmerz vor der Konsultation, Osteopressur-Punkte mit Seite und Empfindlichkeit, Restschmerz nach der Konsultation, Engpassdehnungen mit "verordnet", "Übung fällt" und Varianten, bis zu 6 Faszien-Rollmassagen und Vergleich mit der letzten Konsultation.
- **Therapiekatalog als Referenzdaten:** 12 Bereiche, 72 Osteopressur-Punkte mit Hervorhebung pro Bereich, 27 Engpassdehnungen (1A bis 4G) mit Zuordnung zu den Bereichen, 4 Rollwerkzeuge. Erstbefüllung aus den Tabellen in `reference/`, gelesen aus der Sammelmappe und dem Ordner `exercises`.
- **Fotos:** Aufnahme mit der Gerätekamera, Zeitstempel der Aufnahme, Entfernen von Standortdaten, Ansicht nur nach Anmeldung.
- Klickbares Mockup der Akte, der neuen Behandlung und einer Konsultation für den Bereich "Lendenwirbelsäule, Bauch" in `mockups/`.

**Nicht im Umfang (Out of scope), siehe docs/roadmap.md:**
- Verwaltung des Therapiekatalogs in der App (Änderungen nur über die Referenzdateien).
- Behandlungsbogen als PDF, Heimprogramm mit Übungsblättern, Erfolgsprotokoll, Verlaufsgrafiken.
- Abschliessen oder Archivieren von Behandlungen, Kennzeichnen von Fehlerfassungen, Löschen von Behandlungen oder Konsultationen.
- Bearbeiten oder Beschriften von Fotos, Videos.
- Inhalte der Übungsblätter (Rollmassage, Varianten) für die 26 Übungen, zu denen noch keine Vorlage vorliegt.

## Capabilities

### New Capabilities
- `treatments`: Behandlungen pro Patient mit Bereich, Diagnose, Schmerzgrad und Fotos.
- `consultations`: Konsultationen pro Behandlung mit dem digitalen Behandlungsbogen.
- `therapy-catalog`: Bereiche, Osteopressur-Punkte, Engpassdehnungen und Rollwerkzeuge als Referenzdaten.
- `clinical-photos`: Fotos zu Behandlungen und Konsultationen aufnehmen, speichern und ansehen.

### Modified Capabilities
- `patient-records`: Die Akte zeigt zuerst die Behandlungen.

## Impact

- Neue Tabellen für Katalog, Behandlungen, Konsultationen, Bogeneinträge und Fotos; Prisma-Migration nur additiv.
- Neues Skript `catalog:sync`, das im Migrationsjob nach den Migrationen läuft.
- Neuer privater Blob-Container `clinical-photos` im bestehenden Storage-Account (Bicep).
- Fotos von Körperstellen sind besonders schützenswerte Gesundheitsdaten; sie bleiben in Switzerland North und sind nur für angemeldete Benutzer mit Rolle sichtbar.
- Formulare mit Fotos bis 25 MB.
