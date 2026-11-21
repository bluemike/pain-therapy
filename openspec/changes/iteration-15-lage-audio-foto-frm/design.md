# Design

## D1 Behandlungslage

- **Referenzdaten:**
  - `prisma/catalog/treatment-positions.json` enthält die sechs Grundlagen: `code`, `nameDe`, `nameEn`, `sort`.
  - `osteopressure-points.json` bekommt pro Punkt `position`, zum Beispiel `"BL/HSL"`. Die Werte stammen aus Mikes Liste vom 21.11.2026 (`reference/behandlungslage-punkte.csv`).
  - `sync.mjs` prüft, dass jeder Teil einer Kombination eine bekannte Grundlage ist.
- **Datenbank:**
  - Tabelle `TreatmentPosition` (Grundlagen).
  - Spalte `OsteopressurePoint.position String?`: Kürzel, Kombinationen mit «/».
  - Keine Fremdschlüssel auf Kombinationen. Die Anzeige löst jedes Kürzel einzeln auf: «BL/HSL» wird zu «Bauchlage / Halbseitenlage».
- **Sitzung:**
  - Neue Spalte «Lage» zwischen «Punkt» und «Muskel-Ansatz».
  - Das Kürzel steht in `<abbr title="Bauchlage / Halbseitenlage">`. Beim Antippen auf dem iPad zeigt ein kleines Popover dieselbe Bezeichnung, weil `title` dort nicht erscheint.
  - Ohne Lage bleibt die Zelle leer.
- **Katalog:** Die Punkte-Liste der L&B-Basisdaten zeigt die Lage ausgeschrieben.

## D2 Punkte-Filter

`defaultPointFilter()` liefert immer `all`. Die Auswahl «Sitzung 1 · dunkelrot», «Sitzung 2 · rot» und «Sitzung 3 · schwarz» bleibt im Menü. Bereits erfasste Punkte bleiben wie heute auch bei einem Filter sichtbar.

## D3 Audio in drei Sprachen

- **Sprachen:** `de` (Hochdeutsch, bestehende Aufnahmen de-CH-LeniNeural), `gsw` (Mundart), `en` (Englisch).
- **Texte:**
  - Englisch: Die Texte der Übungsblätter (FRM, Standardübung, Varianten) werden einmal maschinell übersetzt und von Mike gegengelesen.
  - Mundart: Die Texte werden in Zürichdeutsch umgeschrieben, nicht wörtlich übersetzt, und von Chrissie gegengelesen.
  - Beide liegen nur in `exercise-media`: `segments-content.en.json` und `segments-content.gsw.json`.
- **Aufnahmen Englisch:** Azure AI Speech F0 mit einer neuronalen Stimme (Vorschlag en-GB-SoniaNeural). Erzeugt über `npm run media:audio -- --lang en`. Rund 50'000 Zeichen liegen im freien Kontingent.
- **Aufnahmen Mundart:** Azure hat keine Mundart-Stimme, de-CH spricht Hochdeutsch. Zwei Wege:
  - **A (Vorschlag):** KI-Stimme mit Schweizerdeutsch-Unterstützung (Google Gemini TTS). Gesendet werden nur die L&B-Texte, keine Patientendaten. Das kostet einmalig wenige Franken. Die Qualität schwankt je nach Dialekt, Chrissie hört alle Dateien ab.
  - **B:** Chrissie spricht die 146 Aufnahmen selbst ein, etwa 1 bis 2 Stunden. Sie lädt sie über ein Skript hoch. Das ergibt die beste Qualität, und die Stimme ist bekannt.
  - Fehlt eine Mundart-Datei, spielt die App Hochdeutsch und zeigt «Mundart folgt».
- **Dateinamen:** `<name>.mp3` bleibt Hochdeutsch. Neu kommen `<name>.gsw.mp3` und `<name>.en.mp3` dazu, zum Beispiel `2A-frm.gsw.mp3`.
- **Wahl der Sprache:**
  - Praxis-App: `User.audioLanguage` (`de` | `gsw`, Standard `de`). Unter «Mein Profil» steht die Wahl nur, wenn die Oberflächensprache Deutsch ist. Bei Englisch gilt immer `en`.
  - Patienten-Zone:
    - `Patient.preferredLanguage = en` ergibt immer `en`.
    - Bei `de` gilt `Patient.audioLanguage` (`de` | `gsw`, Standard `de`). Die Therapeutin setzt sie im Dossier.
    - Die Patientin kann sie in der Zone neben «Anhören» umstellen. Die Umstellung wird gespeichert und protokolliert.
- **Routen:** `/api/exercise-media/{code}/{kind}?lang=` in der Praxis-App und `/media/{code}?teil=…&lang=` in der Zone, je mit Byte-Ranges wie heute.

## D4 Vorschau bei der Verordnung

Im Block «Heimprogramm» der Sitzung bekommt jede Zeile den Knopf «Blatt ansehen». Er nutzt die vorhandene Komponente `ExercisePreview`: ein Popup mit dem Übungsblatt-Bild, das sich zoomen lässt, schliessen mit Esc oder ✕. Damit ist kein Wechsel in den Katalog nötig.

## D5 Fotos mit dem Smartphone

- **Ablauf:**
  1. Im Fotofeld (Behandlung oder Sitzung) tippt die Therapeutin «Mit Smartphone aufnehmen».
  2. Der Server legt ein `PhotoHandoff` an: Praxis, Patient, optional Behandlung, ersteller, `tokenHash` (SHA-256 eines 32-Byte-Tokens), `expiresAt` = jetzt + 15 Minuten, `maxPhotos` = 10.
  3. Das iPad zeigt einen QR-Code mit `https://pain-therapy.online/foto/<token>`, dazu einen vierstelligen Prüfcode und die Restzeit.
  4. Die Seite auf dem Smartphone zeigt nur den Praxisnamen und den Prüfcode, keinen Patientennamen. Mit dem Knopf «Foto aufnehmen» (`capture="environment"`) verkleinert sie die Bilder wie heute im Browser (`processPhoto`) und lädt sie einzeln hoch.
  5. Das Formular auf dem iPad fragt alle 3 Sekunden nach neuen Fotos und zeigt sie mit «vom Smartphone». Beim Speichern übernimmt es sie in die Behandlung oder Sitzung. Verworfene oder nie gespeicherte Fotos löscht der Aufräum-Job nach 24 Stunden endgültig.
- **Sicherheit:**
  - Der Link kann nur hochladen, nie lesen.
  - Er gilt nur bis zum Ablauf und für höchstens 10 Fotos.
  - Pro IP gibt es höchstens 30 Versuche pro Stunde.
  - Nur JPEG bis 8 MB.
  - Der Token liegt nur gehasht in der Datenbank.
  - Die Praxis kann den Link mit «Beenden» sofort ungültig machen.
  - Jede Übergabe und jedes Foto wird protokolliert.
- **Mandanten:** Die Route setzt `app.practice_id` aus dem `PhotoHandoff`. RLS gilt wie überall.

## D6 Faszien-Rollmassage verordnen

Vorschlag: Die FRM bleibt Teil der Übung und wird nicht als eigener Katalog geführt. Pro Verordnung wählt die Therapeutin die Teile.

- **Datenmodell:** `ConsultationExercise.parts` und `HomePrescription.parts` als Enum `FRM_EPD` (Standard, wie bisher), `EPD` oder `FRM`.
- **Bei «nur FRM»:** Die Wahl der Dehnung (Standard oder Variante) und «Übung fällt» entfallen. Dafür zeigt die Zeile die Werkzeuge der FRM aus dem Blatt, zum Beispiel MiKu.
- **Folgen der Wahl:**
  - Zeitbedarf: `executionTime` rechnet nur die gewählten Teile.
  - Übungsblatt: «Nur verordnete Teile» zeigt nur die gewählten Bänder.
  - Patienten-Zone: Karte, Anleitung und «Anhören» zeigen nur die gewählten Teile.
  - Adhärenz: zählt wie bisher pro Verordnung.
- **Warum nicht als eigener Katalog:** Jede FRM gehört fachlich zu einer Übung, mit Blatt, Band, Text und Werkzeug. Eine eigene Liste würde diese Daten doppelt führen.
