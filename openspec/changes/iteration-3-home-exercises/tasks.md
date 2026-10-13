# Tasks

## 1. Übungsblätter digitalisieren (exercise-sheets)

- [x] 1.1 Nutzungsrechte klären: Bilder und Texte der Übungsblätter in der App und auf Übungsblättern für Patient:innen (bestätigt am 13.10.2026; Texte als mitgemeint angenommen)
- [ ] 1.2 PDF "Sammelmappe 27 Übungsblätter" von der Praxis erhalten und unter `docs/research/` vermerken (Herkunft, Stand)
- [ ] 1.3 Skript zum Ausschneiden des Fotobereichs pro Seite als WebP (höchstens 1600 Pixel) und zum Auslesen der Textebene; Ergebnis von Hand prüfen
- [ ] 1.4 `prisma/catalog/exercise-sheets/exercise-sheets.json` und `<code>.webp` für alle 27 Übungen; Dauer vom Blatt oder berechnet (D3) mit `durationDerived`
- [ ] 1.5 Modell `ExerciseSheet` mit additiver Migration; `catalog:sync` erweitern (Einträge, SHA-256 der Bilder, `retiredAt`, Übernahme von Rollmassage und Varianten nach `Exercise`); Tests für zweimaliges Einspielen, fehlendes Bild und die Regel der berechneten Dauer
- [ ] 1.6 Bilder ins Container-Image übernehmen (Dockerfile) und über `/api/exercise-images/{code}` nur mit Anmeldung und Rolle ausliefern; Test ohne Anmeldung

## 2. Katalog (therapy-catalog)

- [ ] 2.1 Spalte "Dauer" in der Tabelle der Engpassdehnungen, mit "berechnet" bzw. "noch nicht digitalisiert"
- [ ] 2.2 Detailansicht `/catalog/exercises/{code}` mit Bild, Bereichen, Rollmassage, Schritten (inkl. 3A/3B), Varianten, Hinweis und Dauer nach dem Mockup; Zustand "noch nicht digitalisiert"; Test, dass es keine Bearbeitungsfunktion gibt
- [ ] 2.3 Texte in `messages/de.json` und `messages/en.json`

## 3. Selbstausführung (consultations)

- [ ] 3.1 Enum `HomeFrequency` und Modell `ConsultationHomeExercise` mit additiver Migration; zod-Schema (Häufigkeit Pflicht, jede Übung höchstens einmal)
- [ ] 3.2 Reine Funktion für den Zeitbedarf pro Tag und pro Woche (Spannen, Übungen ohne Dauer); Unit-Tests mit dem Beispiel 2A, 2D, 4C
- [ ] 3.3 Abschnitt "Selbstausführung" im Konsultationsformular: "Vorschläge übernehmen" aus "verordnet", "+ Übung" mit Suche über den Katalog, Häufigkeit, Bemerkung, Entfernen, Gesamtzeit; nach dem Mockup `mockups/selbstausfuehrung.html`
- [ ] 3.4 Service: Speichern mit der Konsultation, Änderungen in der Änderungshistorie (`home:<code>:frequency`, `home:<code>:note`); Tests
- [ ] 3.5 Aktuelles Heimprogramm einer Behandlung (neueste Konsultation) als Abfrage im Service; Test

## 4. Übungsblatt (exercise-handout)

- [ ] 4.1 Modelle `ExerciseHandout` und `ExerciseHandoutDelivery` mit additiver Migration
- [ ] 4.2 PDF mit `@react-pdf/renderer`: Praxiskopf, Patient:in, Datum, Konsultation, Übungen mit Bild, Häufigkeit, Dauer und Anleitung, Gesamtzeit, Sicherheitshinweis, ohne L&B-App-Werbung; Deutsch und Englisch mit Rückfall auf Deutsch und Hinweis; Test der Inhalte
- [ ] 4.3 "Übungsblatt erstellen" in der Konsultation (nur mit Selbstausführung, nur aktive Patient:innen), Ablage im Container `exercise-handouts`, Audit `handout.created`
- [ ] 4.4 Dialog "Übungsblatt senden": E-Mail nur mit Einwilligung `UNENCRYPTED_EMAIL` und Adresse, sonst deaktiviert mit Grund; Drucken und Herunterladen über `/api/handouts/{id}` ohne Cache; Tests für beide Fälle und Abruf ohne Anmeldung
- [ ] 4.5 Liste der Übungsblätter in der Konsultation mit Zeitpunkt, Sprache, Versandstatus und "Erneut senden"; Audit `handout.emailed`, `handout.resend`, `handout.downloaded`

## 5. Infrastruktur

- [ ] 5.1 Privater Blob-Container `exercise-handouts` in `infra/main.bicep` (Versionierung und Soft Delete vom Blob-Dienst, ohne Immutability); `what-if` zeigt nur den neuen Container
- [ ] 5.2 Umgebungsvariablen `AZURE_STORAGE_HANDOUT_CONTAINER` und `STORAGE_HANDOUT_LOCAL_DIR` in `src/lib/config.ts`, Bicep und `docs/deployment.md`

## 6. Gesamtprüfung

- [ ] 6.1 End-to-End-Test: Konsultation mit Selbstausführung (2A, 2D, 4C), Gesamtzeit prüfen, Übungsblatt erstellen, Versand mit und ohne Einwilligung, Änderung in der Historie
- [ ] 6.2 Zugänglichkeitsprüfung mit axe für Übungsdetail, Selbstausführung und Versanddialog
- [ ] 6.3 Manuelle Prüfung auf iPad und iPhone, Ausdruck des Übungsblatts auf A4
- [ ] 6.4 Abnahme mit der Praxis unter https://pain-therapy.ayanta.ch, inklusive der berechneten Dauern

## 7. Dokumentation

- [ ] 7.1 `prisma/catalog/README.md` um die Übungsblätter ergänzen (Herkunft, Bildformat, Regel der Dauer)
- [ ] 7.2 `docs/roadmap.md` nach der Abnahme aktualisieren
