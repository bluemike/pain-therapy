# Proposal

## Why

In der Konsultation verordnet die Therapeutin Engpassdehnungen, und die Patientin soll sie zu Hause selbst ausführen. Heute bekommt sie dafür die gedruckten L&B-Übungsblätter, auf denen Häufigkeit, Intensität und Schritte von Hand eingetragen werden. Iteration 3 digitalisiert die 27 Übungsblätter der Sammelmappe, ergänzt die Konsultation um einen Block "Selbstausführung" (Wiederholungen und Zeitbedarf, ähnlich einer Medikamentenverordnung) und erzeugt am Ende der Konsultation ein persönliches Übungsblatt, das per E-Mail oder als Ausdruck an die Patientin geht. Das legt die Grundlage für eine spätere Patienten-Zone, in der Patientinnen ihren Fortschritt selbst erfassen.

## What Changes

- **Übungsbibliothek:** Die 27 Übungsblätter der "Sammelmappe 27 Übungsblätter" werden digitalisiert: pro Übung ein Hauptbild (das Foto der Engpassdehnung), das ganze Blatt als Bild, die Texte zu Faszien-Rollmassage, Engpassdehnung (Schritte) und Varianten sowie der Zeitbedarf einer Ausführung. Ansicht im Katalog pro Übung.
- **Zeitbedarf pro Übung:** Dehnung pro Seite, Anzahl Seiten und Rollmassage ergeben die Dauer einer Ausführung. Die Blätter nennen keine Zeiten; die Werte sind aus dem 30-Sekunden-Takt der Schritte abgeleitet und werden von der Praxis bestätigt.
- **Selbstausführung in der Konsultation:** Pro verordneter Übung eine Wiederholung (täglich 1x, 2x oder 3x, oder wöchentlich 1x bis 7x (10 Optionen)), dazu Intensität und Schritte wie auf dem Blatt. Die App zeigt den gesamten Zeitbedarf pro Tag und pro Woche.
- **Übungsblatt für die Patientin:** Beim Abschluss der Konsultation ein PDF mit Deckblatt (Übersicht, Wiederholungen, Zeitbedarf) und den Blättern der verordneten Übungen mit eingetragener Verordnung. Versand per E-Mail, wenn die Patientin in den unverschlüsselten E-Mail-Versand eingewilligt hat, sonst Ausdruck. Ablage in der Akte unter "Dokumente".

**Nicht im Umfang (Out of scope), siehe docs/roadmap.md:**
- Patienten-Zone mit Fortschritt, Erinnerungen und Protokoll der Selbstausführung.
- Bearbeiten der Übungsinhalte in der App.
- Videos zu den Übungen.
- Übungen, die nicht auf den 27 Blättern stehen.

## Capabilities

### New Capabilities
- `exercise-library`: Digitalisierte Übungsblätter mit Hauptbild, Blattbild, Inhalten und Zeitbedarf.
- `home-program`: Selbstausführung pro Konsultation mit Wiederholungen, Intensität, Schritten und Zeitbedarf.
- `exercise-handout`: Persönliches Übungsblatt als PDF, per E-Mail oder Ausdruck, in der Akte abgelegt.

### Modified Capabilities
- Keine geänderten Anforderungen. Die Oberfläche von `consultations` (Block "Selbstausführung", Abschluss) und `therapy-catalog` (Übungsdetail) wird erweitert; die Anforderungen dazu stehen in `home-program`, `exercise-handout` und `exercise-library`.

## Impact

- Neue Tabellen für Inhalte und Zeitbedarf der Übungen, Verordnungen und Übungsblätter; Prisma-Migration nur additiv.
- Neuer privater Blob-Container `exercise-media` für Bilder und Inhalte der Übungsblätter; die Inhalte liegen nicht im Git-Repository.
- Die Praxis darf die Bilder der L&B-Übungsblätter an Patientinnen abgeben (bestätigt am 13.10.2026); die Inhalte liegen trotzdem nicht im Repository.
- E-Mail-Versand über das bestehende Postfach `pain-therapy@ayanta.ch`.
