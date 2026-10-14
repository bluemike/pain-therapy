# Proposal

## Why

Seit Iteration 3 bekommt die Patientin am Ende der Konsultation ein persönliches Übungsblatt mit Wiederholungen und Zeitbedarf. Ob sie die Übungen zu Hause tatsächlich macht und wie gut sie gelingen, erfährt die Praxis erst in der nächsten Konsultation, und nur aus der Erinnerung der Patientin. Die Praxis wünscht (Anfrage von Mike Franz):

- Die Patientin bekommt einen Link, über den sie einträgt, ob sie die Übungen gemacht hat und wie gut sie sie ausführen konnte (Skala 1 bis 10), mit Datum und Zeit, die standardmässig aktuell sind.
- Dieser Bereich ist eine eigene App ohne Entra-Anmeldung, separat deployt, auf derselben Datenbank.
- Als zweiter Faktor gibt die Patientin ein Detail ein, das nur sie kennt: ihr ganzes Geburtsdatum.
- Im Cockpit sieht die Praxis in einer weiteren Übersicht, wie die Patientin unterwegs ist und ob sie die verordneten Wiederholungen einhält.

## What Changes

- **Zugangslink zur Patienten-Zone:** Pro Patientin ein persönlicher Link mit zufälligem Token, gespeichert nur als Hash. Versand per E-Mail aus `pain-therapy@ayanta.ch` nur mit Einwilligung in unverschlüsselte E-Mail (dieselbe Regel wie beim Übungsblatt), sonst als QR-Code am Bildschirm und auf einem Zugangsblatt zum Ausdrucken. Der Link geht mit dem Übungsblatt mit ("Link zur Patienten-Zone mitsenden", vorgewählt) oder über "Link senden" in der Akte. Gültig, solange ein Heimprogramm aktiv ist, höchstens 6 Monate; die Praxis kann ihn sperren und einen neuen ausstellen.
- **Bestätigung mit dem Geburtsdatum:** Beim ersten Öffnen auf einem Gerät gibt die Patientin ihr Geburtsdatum ein. Sperre nach Fehlversuchen, Begrenzung pro IP-Adresse, neutrale Fehlermeldungen. Danach bleibt das Gerät 30 Tage angemeldet.
- **Patienten-Zone (eigene App):** Mobil zuerst, Deutsch oder Englisch nach der Sprache der Patientin. Zeigt das aktuelle Heimprogramm mit Hauptbild, Name, Wiederholung und Dauer jeder Übung.
- **Übungstagebuch:** Pro Ausführung "gemacht" ja oder nein, "Wie gut konnten Sie die Übung ausführen?" 1 bis 10, Datum und Zeit (vorbelegt mit jetzt) und eine optionale Bemerkung; Schnelleintrag "Alle heutigen Übungen erledigt"; die letzten 14 Tage mit Korrektur innerhalb von 24 Stunden.
- **Übersicht im Cockpit und in der Akte:** Neue Kachel "Heimprogramm" auf dem Dashboard mit der Einhaltung der letzten 7 Tage, Trend, letztem Eintrag, durchschnittlicher Bewertung und Hinweisen; neuer Reiter "Übungstagebuch" in der Akte mit den Einträgen pro Übung und dem Status des Links.
- **Betrieb:** Zweite Container App in derselben Umgebung mit eigenem Hostnamen (`patient.pain-therapy.ayanta.ch`), eigener verwalteter Identität und einer eigenen Datenbankrolle `patient_zone` mit minimalen Rechten.

**Nicht im Umfang (Out of scope), siehe docs/roadmap.md:**
- Erinnerungen und Push-Benachrichtigungen.
- Erfolgsprotokoll der Patientin nach Stunden, erster Nacht, Tag 1 und Tag 2.
- Selbstregistrierung von Patientinnen, Chat mit der Praxis.
- Diagnosen, klinische Fotos und Notizen der Therapeutin in der Patienten-Zone.
- Bearbeiten von Einträgen der Patientin durch die Praxis.

## Capabilities

### New Capabilities
- `patient-access`: Zugangslink pro Patientin, Versand, QR-Code und Zugangsblatt, Bestätigung mit dem Geburtsdatum, Sperren, Ablauf und Gerätesitzung.
- `exercise-log`: Einträge der Patientin zur Selbstausführung mit Bewertung, Schnelleintrag, Korrektur und Verlauf.
- `patient-zone-app`: Eigene App ohne Entra-Anmeldung, eigenes Deployment, minimale Datenbankrechte, Datenschutz und Zugänglichkeit.
- `adherence-overview`: Berechnung der Einhaltung, Kachel "Heimprogramm" im Cockpit, Reiter "Übungstagebuch" in der Akte.

### Modified Capabilities
- Keine geänderten Anforderungen. Die Oberfläche von `exercise-handout` (Abschluss mit Checkbox "Link zur Patienten-Zone mitsenden"), `dashboard` (neue Kachel) und `patient-records` (neuer Reiter) wird erweitert; die Anforderungen dazu stehen in `patient-access` und `adherence-overview`. Grund: Die Changes der Iterationen 1 bis 3 sind noch nicht archiviert, `openspec/specs/` ist leer; MODIFIED-Deltas gegen diese Capabilities lassen sich erst nach dem Archivieren validieren.

## Impact

- Neue Tabellen für Zugangslinks, Gerätesitzungen, Zugriffsversuche und Übungstagebuch; Prisma-Migration nur additiv. Das Schema bleibt in `prisma/`; Migrationen laufen weiterhin nur im Migrationsjob der Haupt-App.
- Repository wird zum npm-Workspace: Haupt-App bleibt im Wurzelverzeichnis, neue App unter `apps/patient-zone/`, gemeinsamer Code unter `packages/shared/`.
- Zweite Container App, zweite verwaltete Identität, neue Key-Vault-Secrets und die Datenbankrolle `patient_zone` in `infra/main.bicep`; Workflow `deploy.yml` baut und rollt zwei Images aus.
- Der Grundsatz aus Iteration 1 "vorerst haben nur Ayanta-Benutzer Zugang" gilt weiterhin für die Praxis-App. Die Patienten-Zone ist der erste Zugang für Personen ausserhalb von Ayanta, beschränkt auf das eigene Heimprogramm.
- DNS-Eintrag und Zertifikat für den neuen Hostnamen richtet die Praxis (Mike Franz) ein.
- `src/lib/mail.ts` versendet auch E-Mails ohne Anhang (Link allein).
