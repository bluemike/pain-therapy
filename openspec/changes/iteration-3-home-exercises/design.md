# Design

## Context

Vorlage ist das PDF "Sammelmappe 27 Übungsblätter" (`docs/research/pdf2-uebungsblaetter.md`): 27 Seiten mit Textebene, eine Übung pro Seite. Jede Seite hat Titel (Code und Name), Sicherheitshinweis (Intensität nie 10), Verordnungsfelder (Häufigkeit pro Woche, täglich, Intensität, Schritte), Faszien-Rollmassage, Engpassdehnung in 3 Schritten, Varianten, Fotos und in der Fusszeile Werbung für die L&B-App. Iteration 2 hat die 27 Übungen als `Exercise` im Katalog und im Behandlungsbogen das Feld "verordnet" (`ConsultationExercise.prescribed`); Rollmassage und Varianten sind nur für 2A erfasst (Scan). PDF-Erzeugung (`@react-pdf/renderer`, `src/lib/pdf.tsx`), E-Mail (`src/lib/mail.ts`, Graph), Speicher (`src/lib/storage.ts`), Audit und Änderungshistorie werden weiterverwendet.

## Goals / Non-Goals

**Goals:**
- Jede Übung hat ein Bild, die Texte des Blatts und eine Dauer, als Daten im Repository.
- Die Selbstausführung ist auf dem iPad in wenigen Tippen verordnet, mit sofort sichtbarem Zeitbedarf.
- Die Patientin erhält am Ende der Konsultation ein vollständiges Blatt, ohne dass Gesundheitsdaten ohne Einwilligung unverschlüsselt per E-Mail gehen.

**Non-Goals:**
- Patientenzone mit Fortschrittsprotokoll, Intensität und Schritte als Verordnung, Bearbeiten der Blätter in der App.

## Decisions

### D1: Nutzungsrechte
Die Praxisinhaberin hat am 13.10.2026 bestätigt, dass die Bilder der Übungsblätter in der App und auf den Übungsblättern für Patientinnen und Patienten verwendet werden dürfen ("Ja, die Bilder dürfen wir abgeben!"). Annahme: Die Texte der Blätter fallen unter dieselbe Erlaubnis. Die Werbung für die L&B-App wird nicht übernommen.

### D2: Übungsblätter als Referenzdaten
Pro Übung liegen in `prisma/catalog/exercise-sheets/` ein Eintrag in `exercise-sheets.json` und ein Bild `<code>.webp`. Der Eintrag enthält:
- `code`, `sides` (`ONE` eine Seite bzw. symmetrisch, `BOTH` beide Seiten, `AFFECTED` betroffene Seite), `source` (Seite im PDF);
- `de`: Rollmassage (Bereich und Werkzeug pro Zeile, Rollzeit wie auf dem Blatt), Dehnung Schritte 1, 2 und 3 inklusive 3A/3B, wo vorhanden, Varianten, Hinweis (z. B. "Kontaktlinsen herausnehmen");
- `en`: dieselben Texte auf Englisch, optional;
- `durationMin` und `durationDerived` (D3).

Das Bild ist der Fotobereich des Blatts ohne Kopf, Verordnungsfelder und Fusszeile, als WebP mit höchstens 1600 Pixel Breite. Ausgeschnitten wird einmalig mit einem Skript aus dem PDF; die Texte kommen aus der Textebene und werden von Hand geprüft. `catalog:sync` spielt die Einträge idempotent in das neue Modell `ExerciseSheet` (Code als Schlüssel, Texte als JSON, Dauer, Kennzeichen berechnet, SHA-256 und Pfad des Bilds) und übernimmt Rollmassage und Varianten nach `Exercise.rolling` und `Exercise.variants`, damit die bestehende Katalogtabelle dieselben Inhalte zeigt. Nicht digitalisierte Übungen haben keinen Eintrag; Bild und Datei fehlen dann. Zurückziehen wie bisher mit `retiredAt`.

### D3: Dauer einer Ausführung
`durationMin` ist die Zeit für eine Ausführung der Übung inklusive Rollmassage, in ganzen Minuten. Steht auf dem Blatt eine Zeit, wird sie übernommen (`durationDerived: false`). Sonst gilt: Rollzeit laut Blatt (bei einer Spanne der obere Wert) plus 4 × 30 s Dehnung (Schritt 1, Schritt 2 langsam und schnell, Schritt 3) pro Seite mal Anzahl Seiten (`ONE` und `AFFECTED` = 1, `BOTH` = 2), aufgerundet auf ganze Minuten, mit `durationDerived: true`. Die App zeigt berechnete Werte mit dem Zusatz "berechnet". Ein Unit-Test prüft die Regel für alle Einträge, bei denen `durationDerived` gesetzt ist.

### D4: Auslieferung der Bilder
Die Bilder sind Teil des Container-Images und werden über `/api/exercise-images/{code}` nur an angemeldete Benutzer mit Rolle ausgeliefert, wie die übrigen Katalogdaten, mit `Cache-Control: private` und ETag aus dem SHA-256. Keine öffentliche Adresse, kein Audit pro Abruf (keine Patientendaten).

### D5: Katalog: Übungsdetail
Im Reiter "Engpassdehnungen" öffnet jede Zeile die Detailansicht `/catalog/exercises/{code}` mit Bild, Bereichen, Rollmassage, Dehnung in Schritten, Varianten, Hinweis und Dauer ("5 Min." oder "5 Min. · berechnet"). Ohne Blatt zeigt die Ansicht Code, Name und Bereiche und "noch nicht digitalisiert"; die Tabelle zeigt in einer Spalte "Dauer" die Minuten oder denselben Vermerk. Weiterhin nur lesend.

### D6: Selbstausführung in der Konsultation
Neuer Abschnitt "Selbstausführung" in der Konsultation nach "Engpassdehnungen", aufgebaut wie eine Medikamenten-Verordnung: eine Zeile pro Übung mit Code und Name, Häufigkeit (Auswahl, Pflicht), Dauer aus dem Katalog und Bemerkung (Freitext, optional), dazu "Entfernen". Ist der Abschnitt leer, schlägt er die im Bogen als "verordnet" angekreuzten Übungen vor ("Vorschläge übernehmen"); "+ Übung" öffnet eine Suche über alle 27 Übungen des Katalogs. Jede Übung höchstens einmal pro Konsultation.

Modell `ConsultationHomeExercise`: Konsultation, Übungscode, Position, Häufigkeit (Enum `HomeFrequency`), Bemerkung. Häufigkeiten und Wiederholungen pro Woche:

| Wert | Anzeige | pro Tag | pro Woche |
|---|---|---|---|
| `DAILY_1` | täglich 1× | 1 | 7 |
| `DAILY_2` | täglich 2× | 2 | 14 |
| `WEEKLY_3_7` | 3–7× pro Woche | 0 oder 1 | 3 bis 7 |
| `WEEKLY_5` | 5× pro Woche | 0 oder 1 | 5 |

Zeitbedarf: pro Woche die Summe aus Dauer × Wiederholungen pro Woche, als Spanne, sobald eine Übung "3–7× pro Woche" hat. Pro Tag die Summe der täglichen Übungen (Dauer × 1 oder 2) bis zur Summe aller Übungen an einem Tag, an dem auch die wöchentlichen ausgeführt werden; sind alle Übungen täglich, ein einzelner Wert. Übungen ohne Dauer zählen nicht und werden unter der Summe genannt ("ohne 4C: noch nicht digitalisiert"). Die Berechnung liegt in einer reinen Funktion, die Formular, Server und PDF gemeinsam nutzen.

Die Selbstausführung gehört zur Konsultation und wird mit ihr gespeichert; Änderungen stehen wie die übrigen Felder in der Änderungshistorie (Feldname `home:<code>:frequency` bzw. `home:<code>:note`). Das aktuelle Heimprogramm einer Behandlung ist die Selbstausführung ihrer neuesten Konsultation.

### D7: Übungsblatt als PDF
"Übungsblatt erstellen" steht in der gespeicherten Konsultation, sobald die Selbstausführung mindestens eine Übung hat. Das PDF (A4, `@react-pdf/renderer`, Schrift und Farben wie der Haftungsausschluss) enthält: Kopf "Pain Therapy | Via Prau da Cuort 5 | 7153 Falera", Name der Patientin, Datum, Konsultation Nr. und Bereich; pro Übung Bild, Code und Titel, Häufigkeit, Dauer, Rollmassage, Schritte, Varianten und Bemerkung; die Gesamtzeit pro Tag und pro Woche; den Sicherheitshinweis (langsam und bewusst üben, die Intensität darf nie 10 erreichen, Fragen an die Therapeutin). Keine Werbung für die L&B-App. Sprache ist die bevorzugte Sprache der Patientin; fehlen englische Texte einer Übung, stehen die deutschen mit dem Hinweis "Text only available in German". Übungen ohne Blatt erscheinen mit Code, Name und Häufigkeit.

### D8: Speicher und Versand
Jedes erstellte Blatt wird im neuen privaten Container `exercise-handouts` gespeichert (Versionierung und Soft Delete vom Blob-Dienst, ohne Immutability) und als `ExerciseHandout` erfasst: Konsultation, Patient, laufende Nummer pro Konsultation, Sprache, Blob-Pfad, SHA-256, Grösse, erstellt von und am. Ein Blatt ändert sich nach dem Speichern nicht; nach Änderung der Selbstausführung entsteht mit "Übungsblatt erstellen" eine neue Version.

Nach dem Erstellen öffnet sich der Dialog "Übungsblatt senden":
- **Per E-Mail** über den bestehenden Graph-Versand an die E-Mail-Adresse der Patientin, nur wenn der neueste gültige unterschriebene Haftungsausschluss die Einwilligung `UNENCRYPTED_EMAIL` enthält und eine Adresse vorliegt. Sonst ist die Option deaktiviert und nennt den Grund ("keine Einwilligung in unverschlüsselte E-Mails" oder "keine E-Mail-Adresse"). Versand und Wiederholungen wie bei den Dokumenten (Status, Versuche, Fehler), in `ExerciseHandoutDelivery`.
- **Drucken oder Herunterladen** öffnet das PDF über `/api/handouts/{id}` (nur mit Anmeldung und Rolle, `Cache-Control: private, no-store`).

Erstellen, Senden, erneutes Senden und Herunterladen stehen in der Änderungshistorie (`handout.created`, `handout.emailed`, `handout.resend`, `handout.downloaded`). Die Konsultation listet ihre Übungsblätter mit Zeitpunkt, Sprache und Versandstatus und bietet "Erneut senden" an.

### D9: Voraussetzungen und Rollen
Selbstausführung und Übungsblatt für beide Rollen (Therapist, Admin), wie die übrigen Felder der Konsultation. Für inaktive Patienten lässt sich kein neues Blatt erstellen; bestehende bleiben abrufbar.

Mockup: [`mockups/selbstausfuehrung.html`](mockups/selbstausfuehrung.html) (im Browser öffnen; Ansichten Konsultation mit Selbstausführung, Katalog Übung 2A, Übungsblatt mit Versanddialog).

## Risks / Trade-offs

- [Berechnete Dauer weicht von der Praxis ab] → Kennzeichnung "berechnet"; die Praxis prüft die Werte bei der Abnahme und trägt abweichende Zeiten in `exercise-sheets.json` ein.
- [Gesundheitsdaten per E-Mail] → Nur mit Einwilligung in unverschlüsselte E-Mails, wie beim Haftungsausschluss; sonst Ausdruck.
- [Grössere Container-Images und PDFs durch Bilder] → WebP mit höchstens 1600 Pixel, im PDF auf Druckgrösse verkleinert; Ziel unter 2 MB pro Übungsblatt.
- [Bilder und Texte nur für einen Teil der Übungen] → Ansicht und Übungsblatt funktionieren mit fehlenden Blättern; Vermerk "noch nicht digitalisiert".

## Migration Plan

Iteration 2 wird vor diesem Change archiviert, weil die Deltas `therapy-catalog` und `consultations` deren Anforderungen ändern. Additive Prisma-Migration, danach `catalog:sync` im Migrationsjob wie bisher; neuer Blob-Container und Umgebungsvariable per Bicep im normalen Deployment. Rollback durch Aktivieren der vorherigen Revision; die neuen Tabellen stören die alte Version nicht.

## Open Questions

- Liefert die Praxis das PDF "Sammelmappe 27 Übungsblätter"? Bis dahin liegen nur für 2A Rollmassage und Varianten aus einem Scan vor; alle anderen Übungen zeigen "noch nicht digitalisiert".
- Wer übersetzt die Blatttexte ins Englische? Bis dahin gilt der deutsche Text mit Hinweis.
- Gesamtzeit pro Tag als Spanne (nur tägliche bis alle Übungen) ist ein Vorschlag und kann bei der Durchsicht geändert werden.
