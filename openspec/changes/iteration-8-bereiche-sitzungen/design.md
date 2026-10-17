# Design

## Context

- Iteration 2 kennt 12 Behandlungsbereiche (`Region` 1 bis 12) mit Punkten (`RegionPoint`, Hervorhebung `main`/`relevant`/`standard`) und Übungen (`RegionExercise`). Übungen und Punkte haben eine `group` 1 bis 4.
- Die Konsultation (`Consultation`) hat diese Blöcke:
  - Kopf mit Diagnose und Vergleich
  - Osteopressur (links/rechts, Empfindlichkeit)
  - Engpassdehnungen (verordnet, "Übung fällt", Varianten als Freitext)
  - Faszien-Rollmassage mit 6 freien Zeilen
  - Selbstausführung (`HomePrescription` mit `Repetition` täglich/wöchentlich, Intensität, Schritte, Bemerkung)
  - Schmerz vorher/nachher
  - Fotos
- Iteration 3 legt pro Übung Hauptbild, Blatt und Texte (`exercises-content.json`) in den privaten Container `exercise-media`; Iteration 7 ergänzt eine MP3 pro Übung.
- Die Neuanalyse vom 17.10.2026 hat jedes Blatt in drei Bänder zerlegt: FRM, EPD-Standard und Varianten. Daraus sind entstanden:
  - 81 Bildbänder
  - Texte (`segments.json`)
  - 92 Varianten, nach den Korrekturen der Praxis: 3C mit Bildern 1+2, 3+4, 5; 3E mit 1+2, 3; Schritte "3a/3b" klein
  - 146 MP3s

  Das liegt im OneDrive der Praxis unter `pain-therapy/exercises/analyse-v2`.
- Stichworte aus dem Gespräch mit Christina Franz: `spec-20261017.rtf`. Präzisiert durch die Nachricht von Mike Franz vom 17.10.2026.

## Goals / Non-Goals

**Goals:**
- Struktur und Begriffe wie in der L&B-Dokumentation.
- Sitzung in der Reihenfolge der Behandlung.
- Verordnen ohne Freitext: Übung mit EPD-Standard oder Variante.
- Selbstausführung mit Wochentagen.

**Non-Goals:**
- Audio in der Patienten-Zone.
- Bildausschnitt pro Variante.
- Benutzerverwaltung.
- Übernahme bestehender Patientendaten. Sie werden gelöscht.

## Decisions

### D1: Bereiche und Schmerzbereiche
- Neues Modell `BodyArea` (1 Kopf, 2 Rumpf, 3 Schulter/Arm, 4 Becken/Beine) aus `prisma/catalog/body-areas.json`.
- `Region` (in der Oberfläche "Schmerzbereich") erhält `bodyAreaId` und `code` "1.1" bis "4.3". Die IDs 1 bis 12 bleiben, weil sie den Behandlungsbögen entsprechen: Bereich = ⌈id/3⌉, Nummer im Bereich = (id−1) mod 3 + 1.
- `Exercise.group` und `OsteopressurePoint.group` werden zu `bodyAreaId` (FK). Die Werte 1 bis 4 passen bereits: Übung 1A bis 1F gehört zu Kopf, 2A bis 2F zu Rumpf usw. Die Oberfläche sagt "Bereich" statt "Gruppe".
- Schmerzbereiche werden überall nach Bereich gruppiert angezeigt (Auswahlliste mit Überschriften, L&B Basisdaten als Baum).

### D2: Übung = FRM + EPD-Standard + Varianten
- Neues Katalogmodell `ExerciseVariant` (`exerciseCode`, `number` 1…n, `images` [Bildnummern], `aids`, `seconds`) aus `prisma/catalog/exercise-variants.json`. Die Datei enthält nur Struktur, keine L&B-Texte.
- `ExerciseSheet` erhält:
  - `rollingTools` (Werkzeugcodes der FRM)
  - `standardAids`
  - `rollingSeconds` (bleibt, 120 s)
  - `stretchSecondsPerSide` und `sides` (bleiben)
- Die Texte kommen aus `segments-content.json` im Container `exercise-media` und werden von `catalog:sync` in `ExerciseSheet.content` übernommen, wie bisher die Texte aus Iteration 3:
  - `{ frm: { items }, standard: { intro, steps, note }, variants: { intro, items: [{ number, text }] } }`
- Medien: `<code>-frm.png`, `<code>-std.png`, `<code>-var.png`, `<code>-frm.mp3`, `<code>-std.mp3` und `<code>-V<n>.mp3`. Die Route `/api/exercise-media/{code}/{kind}` kennt neu `frm`, `std`, `var`, `frm-audio`, `std-audio` und `v<n>-audio`. Das Hauptbild und das ganze Blatt bleiben verfügbar.
- Zeit einer Ausführung: FRM-Sekunden + EPD-Sekunden.
  - EPD-Standard: Sekunden pro Seite × Seiten.
  - Variante: eigene Sekunden, wenn das Blatt welche nennt, sonst wie die Standardübung.
- Die FRM-Werkzeuge verlinken auf den Reiter "Rollmassage-Werkzeuge" der L&B Basisdaten.

### D3: Sitzung (bisher Konsultation)
- Datenmodell und Routen behalten den Namen `Consultation`, damit die Migration klein bleibt. Nur die Oberfläche, Dokumente und E-Mails sagen "Sitzung".
- Reihenfolge im Formular:
  1. Kopf (Datum, Schmerzlokalisation und Schmerzzustand, Vergleich)
  2. Schmerz vorher
  3. Osteopressur
  4. Übungen
  5. Selbstausführung
  6. Schmerz nachher
  7. Fotos
- `ConsultationRolling` und der Block "Faszien-Rollmassage" entfallen. Die FRM ist Teil jeder verordneten Übung.

### D4: Körperseite
- `Treatment.side` hat die Werte `UNSPECIFIED`, `LEFT` oder `RIGHT`. Pflichtfeld bei der Eröffnung, Vorgabe "nicht spezifiziert". Nach der ersten Sitzung ist die Seite fest, wie der Schmerzbereich; bei falscher Seite wird eine neue Behandlung eröffnet.
- Osteopressur: Bei "links" ist nur das Kästchen "li" aktiv, bei "rechts" nur "re", bei "nicht spezifiziert" beide. Wählt die Therapeutin eine Empfindlichkeit, wird bei festgelegter Seite deren Kästchen automatisch angekreuzt.
- Der Server lehnt eine gespeicherte Gegenseite ab.

### D5: Punktauswahl pro Sitzung
- Die Auswahlliste "Punkte" über der Osteopressur bietet:

  | Eintrag | Zeigt | Hervorhebung |
  |---|---|---|
  | "Alle" | alle Punkte | – |
  | "Sitzung 1" | dunkelrote Punkte | `main` |
  | "Sitzung 2" | rote Punkte | `relevant` |
  | "Sitzung 3" | schwarze Punkte | `standard` |

- Vorgabe ist die Nummer der Sitzung (1, 2, 3), ab Sitzung 4 "Alle".
- Die Auswahl filtert nur die Anzeige. Ein Punkt mit erfassten Werten bleibt immer sichtbar, damit nichts verdeckt gespeichert wird.
- Die Farbe der Punkte wird auf die Bezeichnungen der Praxis umgestellt (dunkelrot, rot, schwarz).

### D6: Übungen verordnen
- Die Liste zeigt die Übungen des Bereichs des Schmerzbereichs, z.B. Schmerzbereich 1.2 → Übungen 1A bis 1F. Die Übungen des Behandlungsbogens stehen zuerst, in seiner Reihenfolge, die übrigen des Bereichs danach. "Übung aus anderem Bereich hinzufügen" ergänzt eine Zeile.
- Jede Zeile hat:
  - Bild und Audio (Iteration 7)
  - "verordnen"
  - "EPD": Auswahl "Standard" oder "Variante n – <Anfang des Texts>", Vorgabe "Standard"
  - "Übung fällt": Pflicht, sobald die Übung verordnet ist
- `ConsultationExercise.variant` (Int?, null = Standard) ersetzt den Freitext `variants`.
- Speichern mit einer verordneten Übung ohne "Übung fällt" zeigt den Fehler an der Zeile. Begründung: Jede verordnete Übung wird in der Sitzung durchgeführt.

### D7: Selbstausführung mit Wochentagen
- Jede verordnete Übung erscheint automatisch als Zeile "1A · FRM + EPD Standard" bzw. "+ EPD Variante 2". Es gibt keine separate Auswahl. Wer die EPD ändert, ändert sie im Block Übungen.
- `HomePrescription`:
  - `timesPerDay` 1 bis 3, Vorgabe 1
  - `weekdays` (Bitmaske Mo=1 … So=64, Vorgabe 127 = alle)
  - `note`
  - Mindestens ein Wochentag ist Pflicht.
  - `repetition`, `intensity` und `steps` entfallen.
- Zeitbedarf pro Woche = Σ Ausführungszeit × `timesPerDay` × Anzahl Wochentage, pro Tag = Woche / 7. Die Anzeige bleibt wie bisher: pro Übung, Total pro Woche und Tag, Hinweis über 30 min/Tag.
- Übungsblatt-PDF pro Übung:
  - FRM-Band mit Text und Werkzeugen
  - EPD-Band (Standard: Standardband mit Schritten; Variante: Variantenband mit hervorgehobenem Variantentext)
  - "pro Tag n×", die Wochentage, die Bemerkung

### D8: Tagebuch und Einhaltung
- Gesollt sind die Ausführungen an gewählten Wochentagen seit der Sitzung: Anzahl dieser Tage × `timesPerDay`. Dasselbe gilt für Trend und "heute offen".
- An einem nicht gewählten Tag zeigt die Zone die Übung nicht als offen. Ein Eintrag bleibt möglich und zählt.
- Die Schwelle im Cockpit (< 50 % oder 3 Tage ohne Eintrag) bleibt. "3 Tage" zählt nur gewählte Wochentage.

### D9: Benutzerprofil und Begrüssung
- `User.displayName` (Vorgabe: Vorname aus Entra) und `User.title`.
  - `title` ist ein Enum: `THERAPIST_F` = "Therapeutin" / "Therapist", `THERAPIST_M` = "Therapeut" / "Therapist".
  - Beide Konten existieren bereits. Die Migration setzt mike.franz@ayanta.ch auf "Mike", Therapeut und christina.franz@ayanta.ch auf "Chrissie", Therapeutin.
  - Neue Konten erhalten beim ersten Anmelden den Vornamen aus Entra und "Therapeutin" als Vorgabe. Beides lässt sich in "Mein Profil" anpassen.
- "Mein Profil" im Benutzermenü ändert beide Felder.
- Dokumente zeigen "<Berufsbezeichnung>: <voller Name>", z.B. "Therapeutin: Christina Franz".
- Begrüssung: "Hallo <Anzeigename>" bzw. "Hello <Anzeigename>". Sie erscheint nur auf der ersten Seite nach dem Anmelden. Ein Hinweis im Sitzungscookie (`greeted`) unterdrückt sie danach bis zur nächsten Anmeldung.

### D10: Begriffe
Nur Übersetzungen, Dokumente und E-Mails; keine Umbenennung in Datenbank oder Routen.
- "Konsultation" → "Sitzung"
- "Katalog" → "L&B Basisdaten"
- "Weitere Diagnosen" → "Arzt-Diagnose": Das ist die Diagnose des Arztes beim Patienten.
- "Diagnose" bei Behandlung und Sitzung → "Schmerzlokalisation und Schmerzzustand"
- "Bereich" einer Behandlung → "Schmerzbereich"
- "Gruppe" → "Bereich"
- "Muskel und Ansatz" → "Osteopressurpunkt"

Englisch analog: "Session", "L&B reference data", "Physician's diagnosis", "Pain location and condition", "Pain area", "Area", "Osteopressure point". Ein Test stellt sicher, dass "Konsultation", "Arzt" (ausser "Arzt-Diagnose" und "ärztlich" in der Anamnese) und "Gruppe" in den deutschen Texten nicht mehr vorkommen.

### D11: Migration und Löschung
- Ablauf:
  1. Vor dem Deployment löscht die Praxis die Patientendaten nach dem Ablauf vom 15.10.2026 (Skript auf dem Mac). Patiententabellen und Dokumente werden geleert. Katalog, Benutzer und Texte des Haftungsausschlusses bleiben.
  2. Die Migration prüft zuerst, dass `Treatment` leer ist, und bricht sonst ab. So gehen keine Behandlungen durch entfernte Spalten verloren.
  3. Danach entfernt sie `ConsultationRolling`, `Repetition`, `intensity`, `steps` und `ConsultationExercise.variants` und legt die neuen Felder an.
- `catalog:sync` lädt Bereiche und Varianten. Die Texte werden geladen, sobald `segments-content.json` hochgeladen ist; bis dahin zeigt die App "noch nicht erfasst" wie in Iteration 3.

## Risks / Trade-offs

- **Löschen ist endgültig.** Ausdrücklicher Wunsch von Mike Franz. Der Ablauf läuft erst unmittelbar vor dem Deployment und nur nach einem letzten OK im Thread. PITR-Backups von Postgres laufen nach 35 Tagen ab.
- **Eine EPD-Auswahl pro Übung.** In der Sitzung und zu Hause gilt dieselbe EPD. Wenn die Praxis zu Hause eine andere Variante will als in der Sitzung, braucht es später eine zweite Auswahl.
- **Variantenband für alle Varianten.** Auf PDF und Zone sieht der Patient alle Varianten. Der Text der gewählten wird hervorgehoben, und die Nummer im Bild verweist darauf.
- **Wochentage und Einhaltung.** Weniger Tage senken das Soll. Wer nur Mo wählt, hat ein kleines Soll; das ist gewollt.
