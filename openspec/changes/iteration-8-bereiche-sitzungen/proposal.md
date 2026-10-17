# Proposal

## Why

Nach einem Gespräch mit Christina Franz (Stichworte vom 17.10.2026) und der Neuanalyse der Übungsblätter hat Mike Franz am 17.10.2026 eine grössere Überarbeitung gewünscht. Die App soll der Struktur der L&B-Dokumentation folgen: 4 Bereiche mit je 3 Schmerzbereichen. Jede Übung besteht aus Faszien-Rollmassage (FRM) und Engpassdehnung (EPD). Die EPD ist eine Standardübung oder eine ihrer Varianten. Die Begriffe sollen die Rolle der Praxis treffen: Therapeutin oder Therapeut, nie Arzt. Die Sitzung soll in der Reihenfolge der Behandlung erfasst werden. Die Osteopressur soll die Therapeutin führen: Körperseite und Punkte der jeweiligen Sitzung. Die Selbstausführung wird mit Wochentagen statt "wöchentlich n×" verordnet.

## What Changes

- **Benutzerprofil:** Jede Benutzerin und jeder Benutzer hat einen Anzeigenamen und eine Berufsbezeichnung ("Therapeutin" oder "Therapeut"). Beides ist in "Mein Profil" änderbar und vorbelegt: christina.franz@ayanta.ch heisst "Chrissie", Therapeutin; mike.franz@ayanta.ch heisst "Mike", Therapeut. Die Begrüssung lautet nur noch "Hallo Chrissie" bzw. "Hello Chrissie". Sie erscheint nur einmal nach dem Anmelden. **BREAKING:** "Guten Morgen/Tag/Abend" entfällt.
- **Bereiche und Schmerzbereiche:** Es gibt 4 Bereiche: 1 Kopf, 2 Rumpf, 3 Schulter/Arm und 4 Becken/Beine. Jeder hat 3 Schmerzbereiche, nummeriert 1.1 bis 4.3 in der Reihenfolge der 12 Behandlungsbögen (1.1 Kopf, Nacken, Halswirbelsäule; 1.2 Kiefer und Zähne; …). Die bisherige "Gruppe" der Übungen und Punkte heisst "Bereich".
- **Übung = FRM + EPD:** Jede der 27 Übungen hat eine FRM (Bildband, Text, Audio, Rollmassage-Werkzeuge mit Link) und eine EPD-Standardübung (Bildband, Schritte, Audio, Hilfsmittel). Dazu kommen 0 bis n Varianten mit eigenem Text und Audio, insgesamt 92. Sie stammen aus der Neuanalyse mit den Korrekturen der Praxis.
- **Sitzung statt Konsultation**, neu in dieser Reihenfolge:
  1. Kopf
  2. **Schmerz vorher**
  3. Osteopressur
  4. Übungen
  5. Selbstausführung
  6. **Schmerz nachher**
  7. Fotos

  **BREAKING:** Der separate Block "Faszien-Rollmassage" mit 6 Zeilen entfällt. Die FRM gehört immer zur Übung.
- **Körperseite der Behandlung:** "nicht spezifiziert", "links" oder "rechts", fest nach der ersten Sitzung wie der Schmerzbereich. In der Osteopressur ist nur die Seite der Behandlung wählbar, bei "nicht spezifiziert" beide. Mit einer Empfindlichkeit wird die Seite automatisch gesetzt.
- **Auswahl der Punkte:** Eine Auswahl über der Osteopressur zeigt "Alle", "Sitzung 1" (dunkelrote Punkte), "Sitzung 2" (rote) oder "Sitzung 3" (schwarze). Vorgabe ist die Nummer der Sitzung, ab Sitzung 4 "Alle". Erfasste Punkte bleiben immer sichtbar.
- **Übungen verordnen:**
  - Die Liste zeigt die Übungen des Bereichs, zu dem der Schmerzbereich gehört. Eine Übung aus einem anderen Bereich lässt sich hinzufügen.
  - Eine verordnete Übung umfasst immer FRM und EPD. Die EPD ist "Standard" oder eine Variante.
  - Jede verordnete Übung wird in der Sitzung durchgeführt. Pro verordneter Übung muss "Übung fällt" (leicht bis unmöglich) erfasst sein, sonst wird die Sitzung nicht gespeichert.
- **Selbstausführung:**
  - Jede verordnete Übung erscheint automatisch mit FRM und ihrer EPD.
  - Gewählt werden "pro Tag 1×/2×/3×" und die Wochentage Mo bis So, alle vorgewählt und einzeln abwählbar.
  - Die Bemerkung bleibt. **BREAKING:** "wöchentlich 1× bis 7×", Intensität und Schritte entfallen.
  - Der Zeitbedarf bleibt, neu aus FRM und gewählter EPD.
- **Übungsblatt-PDF und Patienten-Zone** zeigen pro Übung FRM und die gewählte EPD. Das Tagebuch erwartet Einträge nur an den gewählten Wochentagen. Die Auswertung der Einhaltung im Cockpit rechnet entsprechend.
- **Begriffe:**

  | Bisher | Neu |
  |---|---|
  | "Katalog" | "L&B Basisdaten" |
  | "Konsultation" | "Sitzung" (überall: App, PDF, E-Mails, Patienten-Zone, Verlauf) |
  | "Weitere Diagnosen" in der Anamnese | "Arzt-Diagnose" |
  | "Diagnose" bei Behandlung und Sitzung | "Schmerzlokalisation und Schmerzzustand" |
  | "Bereich" einer Behandlung | "Schmerzbereich" |
  | "Muskel und Ansatz" | "Osteopressurpunkt" |
  | "Therapeut:in" | Berufsbezeichnung der Person |

- **Daten:** Die Daten der bestehenden Patientinnen und Patienten werden vor dem Deployment nach dem bestehenden Ablauf gelöscht (Wunsch von Mike Franz, 17.10.2026). Die Migration bricht ab, falls noch Behandlungen vorhanden sind.

**Nicht im Umfang (Out of scope), siehe docs/roadmap.md:**
- Audio in der Patienten-Zone. Die Aufnahmen pro FRM, EPD und Variante liegen bereit.
- Eigene Bildausschnitte pro Variante. Das Variantenband zeigt alle Varianten; die Nummern im Bild sagen, welche gemeint ist.
- Benutzerverwaltung durch Admins. Jede Person pflegt nur ihr eigenes Profil.
- "Bilder NUR für den Patienten sichtbar machen" (Stichwort vom 17.10.2026): to be defined, noch ohne Spezifikation; siehe docs/roadmap.md.

## Capabilities

### New Capabilities
- `user-profile`: Anzeigename, Berufsbezeichnung, Begrüssung einmal nach dem Anmelden.
- `body-areas`: 4 Bereiche mit je 3 Schmerzbereichen in L&B Basisdaten, Behandlung und Übungsauswahl.
- `exercise-segments`: Übung als FRM + EPD-Standard + Varianten, mit Bildbändern, Texten, Audio, Werkzeugen und Zeiten.
- `session-form`: Sitzung (bisher Konsultation): Reihenfolge, Körperseite, Punktauswahl pro Sitzung, Verordnen mit Variante und Pflicht "Übung fällt".
- `home-schedule`: Selbstausführung mit pro Tag 1× bis 3× und Wochentagen; Zeitbedarf, PDF, Tagebuch und Einhaltung danach.
- `terminology`: Begriffe der Praxis in App, Dokumenten, E-Mails und Patienten-Zone.

### Modified Capabilities
- Keine geänderten Anforderungen in `openspec/specs/`, weil die Changes der Iterationen 1 bis 7 noch nicht archiviert sind. Inhaltlich ersetzt diese Iteration Teile von `consultations`, `treatments`, `therapy-catalog` (Iteration 2), `home-program`, `exercise-handout`, `exercise-library` (Iteration 3), `exercise-log`, `adherence-overview` (Iteration 4), `dashboard` (Iteration 1) und `exercise-audio` (Iteration 7). Die neuen Capabilities halten die Abweichungen fest.

## Mockup

Klickbares Mockup: https://claude.ai/artifact/83kvT7vRyyyKmNrJwEdoRM

## Impact

- **Datenbank:**
  - neu: `BodyArea`, `ExerciseVariant`, `Side`
  - `User.displayName/title`
  - `Treatment.side`
  - `ConsultationExercise.variant`
  - `HomePrescription.timesPerDay/weekdays`
  - entfernt: `ConsultationRolling`, `Repetition`, `intensity`, `steps`
  - Datenmigration nur für Katalog und Benutzer; Patientendaten werden vorher gelöscht.
- **Katalog:**
  - `regions.json` mit Bereich und Nummer
  - neu `body-areas.json` und `exercise-variants.json` (nur Struktur, keine L&B-Texte)
  - Texte, Bildbänder und Audio im privaten Container `exercise-media` (`segments-content.json`, `<code>-frm.png`, `<code>-std.png`, `<code>-var.png`, `<code>-frm.mp3`, `<code>-std.mp3`, `<code>-V<n>.mp3`)
- **Praxis-App:** Sitzungsformular, Behandlung, Patientenseite, L&B Basisdaten, Cockpit, Profil, Übungsblatt-PDF, E-Mails, Übersetzungen DE/EN.
- **Patienten-Zone:** Übungen, Tagebuch und Einhaltung nach Wochentagen, Begriffe.
- **Betrieb:**
  - Patientendaten vor dem Deployment löschen (Mac, bestehender Ablauf).
  - Bildbänder, Texte und Audio aus OneDrive `pain-therapy/exercises/analyse-v2` hochladen. Das braucht das OK von Mike Franz für den Upload.
