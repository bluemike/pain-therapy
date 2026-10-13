# Proposal

## Why

Nach Iteration 2 dokumentiert die Praxis Behandlungen und Konsultationen in der App, und auf dem Behandlungsbogen lässt sich ankreuzen, welche Engpassdehnungen verordnet sind. Was die Patientin oder der Patient zu Hause üben soll, steht aber noch auf den Papier-Übungsblättern der L&B-Sammelmappe ("Sammelmappe 27 Übungsblätter"), von Hand ausgefüllt. Die Praxisinhaberin wünscht:

1. die Sammelmappe Übungen zu digitalisieren, mit einem Bild und den Beschreibungen pro Übung als Referenz, und mit der Zeit für eine Ausführung;
2. bei der Konsultation einen Block "Selbstausführung", der wie eine Medikamenten-Verordnung die Übungen mit Wiederholung (täglich 1×, täglich 2×, 3–7× pro Woche, 5× pro Woche) und den gesamten Zeitbedarf angibt;
3. am Ende der Konsultation ein Blatt mit den verordneten Übungen für die Patientin, per E-Mail (wenn E-Mail-Versand erlaubt ist) oder zum Ausdrucken.

## What Changes

- **Übungsblätter digitalisiert:** Für jede der 27 Engpassdehnungen (1A bis 4G) ein Bild (Fotobereich des Übungsblatts, WebP), die Texte des Blatts auf Deutsch (Faszien-Rollmassage, Dehnung in den Schritten 1 bis 3 inkl. 3A/3B, Varianten, Hinweis) und die Dauer einer Ausführung in Minuten, vom Blatt übernommen oder nach fester Regel berechnet und als berechnet gekennzeichnet. Daten in `prisma/catalog/exercise-sheets/`, eingespielt mit dem bestehenden `catalog:sync`.
- **Katalog:** Detailansicht pro Übung mit Bild, Texten und Dauer; Übungen ohne digitalisiertes Blatt zeigen "noch nicht digitalisiert".
- **Selbstausführung in der Konsultation:** Eigener Abschnitt mit Übungen (Vorschläge aus den im Bogen verordneten Übungen, jede Übung des Katalogs wählbar), je Übung eine Häufigkeit und optional eine Bemerkung; die App zeigt die Dauer pro Übung und die Gesamtzeit pro Tag und pro Woche. Änderungen stehen in der Änderungshistorie.
- **Übungsblatt für die Patientin:** "Übungsblatt erstellen" erzeugt ein PDF mit Praxiskopf, Patientin, Datum, Konsultation, den verordneten Übungen mit Bild, Häufigkeit, Dauer und Anleitung, Gesamtzeit und Sicherheitshinweis, in der Sprache der Patientin. Versand per E-Mail nur mit Einwilligung in unverschlüsselte E-Mails, sonst Drucken oder Herunterladen. Jedes Blatt wird gespeichert und steht in der Änderungshistorie; erneutes Senden ist möglich.
- Klickbares Mockup der Selbstausführung, der Übungsdetails im Katalog und des Übungsblatts mit Versanddialog in `mockups/`.

**Entschieden:** Die Praxis darf die Bilder der Übungsblätter in der App und auf den Übungsblättern für Patientinnen und Patienten verwenden (Bestätigung der Praxisinhaberin vom 13.10.2026: "Ja, die Bilder dürfen wir abgeben!"). Annahme: Die Texte der Blätter fallen unter dieselbe Erlaubnis.

**Nicht im Umfang (Out of scope), siehe docs/roadmap.md:**
- Patientenzone: Patientinnen und Patienten protokollieren Übungen und Fortschritt selbst.
- Weitere Verordnungsfelder des Papierblatts (Intensität, Schritte) und eigene Übungen ausserhalb der 27 Engpassdehnungen.
- Bearbeiten der Übungsblätter in der App (Änderungen über die Referenzdateien).
- Die Werbung für die L&B-App aus der Fusszeile der Papierblätter.

## Capabilities

### New Capabilities
- `exercise-sheets`: Digitalisierte Übungsblätter mit Bild, Texten und Dauer pro Übung.
- `exercise-handout`: Übungsblatt der Konsultation als PDF, gespeichert, per E-Mail oder zum Drucken.

### Modified Capabilities
- `therapy-catalog`: Katalog mit Übungsdetail aus dem digitalisierten Blatt.
- `consultations`: Abschnitt "Selbstausführung" mit Häufigkeit und Zeitbedarf.

## Impact

- Neue Tabellen für Übungsblätter, Selbstausführung, erstellte Übungsblätter und deren Versand; Prisma-Migration nur additiv.
- Neue Referenzdateien `prisma/catalog/exercise-sheets/` (JSON und 27 WebP-Bilder), im Container-Image enthalten; `catalog:sync` erweitert.
- Neuer privater Blob-Container `exercise-handouts` im bestehenden Storage-Account (Bicep) und Variable `AZURE_STORAGE_HANDOUT_CONTAINER`.
- E-Mail über den bestehenden Graph-Versand (Absender pain-therapy@ayanta.ch).

## Offene Punkte

- Die Praxis stellt das PDF "Sammelmappe 27 Übungsblätter" zum Digitalisieren bereit (heute liegt nur 2A als Scan vor).
- Übersetzung der Blatttexte ins Englische: bis dahin enthält das englische Übungsblatt die deutschen Texte mit Hinweis.
