# Design

## Context

Iteration 3 hat die Selbstausführung als Verordnung eingeführt: `HomePrescription` pro Konsultation und Übung mit der Wiederholung als Enum (`DAILY_1` bis `DAILY_3`, `WEEKLY_1` bis `WEEKLY_7`, `perWeek()` in `src/lib/home-program.ts`), dazu das Übungsblatt (`ExerciseHandout`, `HandoutDelivery`), das per E-Mail nur mit Einwilligung in unverschlüsselte E-Mail aus der gültigen Unterschrift (`emailConsentOf()` in `src/lib/handouts.ts`) und sonst als Ausdruck an die Patientin geht. Die Bilder der Übungen liegen im privaten Container `exercise-media` und werden nur an angemeldete Benutzer ausgeliefert. Die Praxis-App läuft als Container App `ca-pain-therapy` mit Entra-Anmeldung; Migrationen laufen im Job `caj-pain-therapy-migrate` (`prisma/migrate.sh`). Iteration 4 öffnet erstmals einen Zugang für Patientinnen, deshalb steht die Sicherheit des Zugangs im Vordergrund.

## Goals / Non-Goals

**Goals:**
- Die Patientin erfasst die Selbstausführung in wenigen Sekunden auf dem Telefon, ohne Konto und ohne Passwort.
- Die Praxis sieht vor der nächsten Konsultation, ob das Heimprogramm eingehalten wird.
- Die Patienten-Zone sieht und ändert nur, was sie braucht: technisch erzwungen durch eine eigene App, eine eigene Identität und eine eigene Datenbankrolle.

**Non-Goals:**
- Erinnerungen, Push-Benachrichtigungen, Erfolgsprotokoll nach Stunden und Tagen (Roadmap).
- Selbstregistrierung, Chat, Upload durch Patientinnen.
- Native Apps.

## Decisions

### D1: Capabilities und bestehende Specs
Vier neue Capabilities: `patient-access`, `exercise-log`, `patient-zone-app`, `adherence-overview`. Die Erweiterungen von `exercise-handout` (Checkbox beim Abschluss), `dashboard` (Kachel) und `patient-records` (Reiter) stehen als Anforderungen in den neuen Capabilities, wie in Iteration 3. MODIFIED-Deltas gegen Iteration 1 bis 3 setzen voraus, dass diese Changes archiviert sind; das ist nicht Teil dieser Iteration.

### D2: Aktives Heimprogramm
Das aktuelle Heimprogramm einer Patientin sind die Verordnungen der jüngsten Konsultation mit mindestens einer Verordnung, über alle Behandlungen. Es ist aktiv, solange die Patientin aktiv ist und diese Konsultation höchstens 12 Wochen zurückliegt. Eine neue Konsultation mit Verordnungen ersetzt das Programm; Einträge bleiben bei der Verordnung, zu der sie erfasst wurden.

### D3: Zugangslink
Neue Tabelle `PatientAccessLink` (`id`, `patientId`, `tokenHash` unique, `createdBy`, `createdAt`, `expiresAt`, `revokedAt`, `revokedBy`, `replacedAt`, `failedAttempts`, `lockedUntil`, `blockedAt`, `lastUsedAt`).
- **Token:** 32 Byte aus `crypto.randomBytes` (256 Bit), base64url, in der Adresse `https://<host>/l/<token>`. Gespeichert wird nur SHA-256 des Tokens; das Token selbst wird nie gespeichert und nie geloggt.
- **Ein Link pro Patientin:** Ein neuer Link ersetzt den bisherigen (`replacedAt`), der damit ungültig wird. Da das Token nicht gespeichert ist, erzeugt jeder Versand einen neuen Link.
- **Gültigkeit:** `expiresAt` = Ausstellung + 6 Monate. Zusätzlich ungültig, wenn kein Heimprogramm aktiv ist (D2), die Patientin deaktiviert ist, der Link ersetzt, gesperrt oder blockiert ist.
- **Status in der Akte:** versendet/angezeigt, aktiv (mit letzter Nutzung), vorübergehend gesperrt, blockiert, gesperrt durch die Praxis, ersetzt, abgelaufen.
- **Verlauf:** Ausstellen, Versand, Anzeige als QR-Code, Druck des Zugangsblatts, Sperren, Ersetzen, erfolgreiche und fehlgeschlagene Bestätigung, Sperre und Blockierung erscheinen als Audit-Ereignisse im Verlauf der Akte.

### D4: Zustellung des Links
- **Mit dem Übungsblatt:** Der Abschluss aus Iteration 3 bekommt die Checkbox "Link zur Patienten-Zone mitsenden" (vorgewählt). Beim Versand per E-Mail steht der Link im Text der E-Mail, nicht im PDF; beim Drucken wird ein Zugangsblatt (eine Seite mit QR-Code, Adresse und kurzer Anleitung) mitgedruckt.
- **Über die Akte:** "Link senden" im Reiter "Übungstagebuch". Mit Einwilligung und E-Mail-Adresse geht eine E-Mail ohne Anhang an die Patientin; sonst zeigt die App den QR-Code zum Scannen in der Praxis und bietet das Zugangsblatt zum Drucken an.
- **Nicht archiviert:** Das archivierte Übungsblatt-PDF bleibt wie in Iteration 3 ohne Link. Zugangsblatt und E-Mail-Text werden nicht gespeichert, damit das Token nirgends im Klartext liegt. `OutgoingMail.attachment` in `src/lib/mail.ts` wird optional; die Zustellung nutzt die bestehenden Wiederholungen und speichert den Status in einer `HandoutDelivery`-ähnlichen Zeile `AccessLinkDelivery` (ohne Token).

### D5: Bestätigung mit dem Geburtsdatum
Beim Öffnen des Links auf einem Gerät ohne gültige Sitzung fragt die App nach dem Geburtsdatum (TT.MM.JJJJ, drei Felder mit numerischer Tastatur) und vergleicht es mit `Patient.dateOfBirth`. Das Geburtsjahr allein hat rund 100 plausible Werte und wäre mit den Sperren unten in wenigen Runden zu erraten; das ganze Datum hat rund 36 500. Von der Praxis am 14.10.2026 bestätigt.
- **Sperre pro Link:** nach 5 Fehlversuchen 15 Minuten gesperrt; nach 10 Fehlversuchen blockiert, bis die Praxis einen neuen Link ausstellt. Ein Erfolg setzt den Zähler zurück.
- **Begrenzung pro IP-Adresse:** höchstens 20 Bestätigungsversuche pro Stunde über alle Links, gespeichert in `PatientZoneAttempt` (`ipHash` als HMAC mit Secret, `linkId`, `success`, `at`; Einträge nach 30 Tagen gelöscht durch den Migrationsjob).
- **Neutrale Meldungen:** Unbekannter, abgelaufener, ersetzter und gesperrter Link zeigen dieselbe Seite "Dieser Link ist nicht gültig. Bitte wenden Sie sich an die Praxis." Ein falsches Datum zeigt "Die Angabe stimmt nicht.", eine Sperre "Zu viele Versuche. Bitte versuchen Sie es später erneut." Die Seite verrät weder Name noch Existenz der Patientin.

### D6: Gerätesitzung
Nach erfolgreicher Bestätigung legt die App eine Sitzung in `PatientZoneSession` an (`idHash`, `linkId`, `patientId`, `createdAt`, `expiresAt` = +30 Tage, `endedAt`, `lastSeenAt`) und setzt ein Cookie mit einer zufälligen Sitzungs-ID (`HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, Max-Age 30 Tage), danach Weiterleitung auf `/` ohne Token in der Adresse. Die Sitzung endet nach 30 Tagen, mit "Abmelden", wenn die Praxis den Link sperrt oder der Link abläuft. Wird der Link nur ersetzt (neuer Versand), bleiben bestehende Sitzungen gültig, damit die Patientin auf ihrem Telefon angemeldet bleibt.

### D7: Inhalt der Patienten-Zone
- **Heute:** Übungen des aktuellen Heimprogramms mit Hauptbild, Code, Name in der Sprache der Patientin (`Exercise.nameDe`/`nameEn`), Wiederholung, Dauer einer Ausführung und Stand ("heute 1 von 2", bei wöchentlichen Übungen "diese Woche 3 von 5").
- **Eintrag:** "Gemacht?" ja/nein, bei "ja" "Wie gut konnten Sie die Übung ausführen?" 1 bis 10 als Segmentschalter (1 = gar nicht, 10 = sehr gut), Datum und Zeit vorbelegt mit jetzt (änderbar, nicht in der Zukunft, nicht vor der Konsultation der Verordnung), Bemerkung optional, höchstens 500 Zeichen.
- **Schnelleintrag:** "Alle heutigen Übungen erledigt" erfasst für jede tägliche Übung die heute noch offenen Ausführungen als "gemacht" ohne Bewertung; die Bewertung lässt sich innerhalb von 24 Stunden ergänzen.
- **Letzte 14 Tage:** eigene Einträge, neueste zuerst; Korrigieren und Löschen innerhalb von 24 Stunden nach dem Erfassen.
- **Nicht sichtbar:** Diagnose, Schmerzwerte, klinische Fotos, Bemerkungen der Therapeutin zur Verordnung, Dokumente.
- Die Bilder liefert die Patienten-Zone unter `/media/{code}` nur an gültige Sitzungen und nur für Übungen des aktuellen Programms aus.

### D8: Übungstagebuch im Datenmodell
Neue Tabelle `ExerciseLogEntry` (`id`, `patientId`, `consultationId`, `exerciseCode` mit Fremdschlüssel auf `HomePrescription(consultationId, exerciseCode)`, `sessionId`, `performedAt`, `done`, `rating` 1 bis 10 oder null, `note` höchstens 500, `quick` (Schnelleintrag), `createdAt`, `correctedAt`, `deletedAt`). Datenbank-Constraints: `rating BETWEEN 1 AND 10`, `rating IS NULL OR done`, `char_length(note) <= 500`. Löschen setzt nur `deletedAt`; jede Korrektur und jedes Löschen schreibt ein Audit-Ereignis mit Vorher und Nachher. Die Praxis liest nur, sie ändert keine Einträge.

### D9: Einhaltung (Adhärenz)
Gemeinsame, reine Funktion in `packages/shared` (Unit-Tests), genutzt von Praxis-App und Patienten-Zone:
- **Soll pro Woche** je Übung aus `perWeek()`: täglich n = 7n, wöchentlich n = n. Liegt die Konsultation weniger als 7 Tage zurück, wird das Soll anteilig gerechnet (Tage seit der Konsultation / 7, aufgerundet).
- **Ist:** Einträge mit "gemacht", nicht gelöscht, `performedAt` in den letzten 7 Tagen, je Übung höchstens bis zum Soll gezählt (Mehrausführungen gleichen keine andere Übung aus).
- **Einhaltung** = Summe Ist / Summe Soll, ganzzahlig in Prozent, je Übung und gesamt.
- **Trend:** Einhaltung pro Kalenderwoche seit der Konsultation.
- **Hinweise:** "Einhaltung unter 50 %" (frühestens ab Tag 3 nach der Konsultation) und "Seit 3 Tagen kein Eintrag" (seit dem letzten Eintrag oder, ohne Eintrag, seit der Konsultation).

### D10: Cockpit und Akte
- **Kachel "Heimprogramm"** auf dem Dashboard (unabhängige Kachel nach der Anforderung "Erweiterbarkeit" aus Iteration 1): Patientinnen mit aktivem Heimprogramm, Hinweise zuerst, mit Einhaltung der letzten 7 Tage als Balken, Trend, letztem Eintrag, Durchschnitt der Bewertung und Link-Status; Klick öffnet den Reiter "Übungstagebuch".
- **Reiter "Übungstagebuch"** in der Akte: Kennzahlen gesamt, Tabelle pro Übung (Soll, Ist, Einhaltung, Durchschnitt der Bewertung, letzter Eintrag), Verlauf der Bewertung pro Übung als Diagramm, Liste der Einträge mit Bemerkungen, Status des Links mit "Link senden" und "Link sperren".
- Nur für die Rollen Therapeut:in und Administration; das Öffnen des Reiters wird protokolliert wie das Öffnen der Akte.

### D11: Separate App im Monorepo
npm-Workspaces, ohne die bestehende App zu verschieben:
- **Wurzel:** Praxis-App wie bisher, `prisma/` bleibt die einzige Quelle für Schema und Migrationen.
- **`packages/shared`** (`@pain-therapy/shared`): Prisma-Client-Fabrik mit Datenbank-URL als Parameter, Wiederholungen und Zeitbedarf (aus `src/lib/home-program.ts` verschoben, dort re-exportiert), Einhaltung (D9), Token-Hash, Validierung der Einträge (zod).
- **`apps/patient-zone`:** eigenes Next.js 15 mit `output: 'standalone'`, eigene Übersetzungen (next-intl, de und en), eigenes `Dockerfile`, Gesundheitsprüfung `/api/health` (Datenbankabfrage mit der eigenen Rolle). Kein Auth.js, keine Entra-Konfiguration, keine Abhängigkeit von `src/`.
- Gestaltung mit denselben Design-Tokens wie die Praxis-App (Ayanta-Gold `#B99438`, Text-Gold `#8a6a1c`, Inter), mobil zuerst.

### D12: Datenbankrolle `patient_zone`
Der Migrationsjob legt nach `prisma migrate deploy` die Rolle idempotent an und setzt die Rechte neu (`prisma/patient-zone-role.sql`, Passwort aus Key Vault):
- `SELECT` auf `Patient(id, firstName, preferredLanguage, dateOfBirth, status)`, `Treatment(id, patientId)`, `Consultation(id, treatmentId, at)`, `HomePrescription`, `Exercise(code, nameDe, nameEn)`, `ExerciseSheet(exerciseCode, mainImage, stretchSecondsPerSide, sides, rollingSeconds)`.
- `SELECT` und `UPDATE (failedAttempts, lockedUntil, blockedAt, lastUsedAt)` auf `PatientAccessLink`.
- `SELECT, INSERT, UPDATE` auf `PatientZoneSession`, `ExerciseLogEntry`; `SELECT, INSERT` auf `PatientZoneAttempt`; `INSERT` auf `AuditEvent`.
- Kein `DELETE`, kein Zugriff auf Anamnese, Diagnosen, Fotos, Dokumente, E-Mail-Adressen und Telefonnummern. Ein Test prüft die Rechte gegen eine Liste.
Audit-Ereignisse der Patienten-Zone tragen `userId = "patient-zone"` und `userName = "Patienten-Zone"`, die Patientin über `patientId`, den Link über `details.linkId`.

### D13: Infrastruktur und Deployment
- **Bicep:** zweite Container App `ca-pain-therapy-zone` in `cae-pain-therapy`, Ingress extern, Parameter `zoneCustomDomain` (`patient.pain-therapy.ayanta.ch`) und `zoneCustomDomainMode` wie bei der Haupt-App, `minReplicas: 0`, `maxReplicas: 2`; eigene Identität `id-pain-therapy-zone` mit `AcrPull`, `Key Vault Secrets User` nur auf ihren Secrets und `Storage Blob Data Reader` nur auf dem Container `exercise-media`.
- **Key Vault:** `patient-zone-database-url` (Rolle `patient_zone`), `patient-zone-db-password` (für den Migrationsjob), `patient-zone-secret` (HMAC für IP-Hashes). Neuer Parameter und GitHub-Secret `PATIENT_ZONE_DB_PASSWORD`.
- **Haupt-App:** neue Variable `PATIENT_ZONE_URL` für Links, E-Mail und QR-Code.
- **Workflow:** `deploy.yml` baut zwei Images (`pain-therapy`, `pain-therapy-zone`) mit demselben Tag, führt die Migration einmal aus, deployt Bicep mit beiden Images und prüft `/api/health` beider Apps. Die Patienten-Zone führt keine Migrationen aus.
- **DNS:** CNAME und TXT-Eintrag für den Hostnamen und das verwaltete Zertifikat richtet die Praxis ein, wie bei `pain-therapy.ayanta.ch`.

### D14: Sicherheit und Datenschutz der Patienten-Zone
- Strenge CSP mit Nonce (`default-src 'self'`, `frame-ancestors 'none'`, keine Drittanbieter), `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, HSTS.
- Keine Personendaten in Adressen ausser dem Token in `/l/<token>`; das Token wird nach der Bestätigung durch die Sitzung ersetzt und in Logs maskiert.
- Ein kurzer Datenschutzhinweis (wer die Daten sieht, wozu, wie lange, Kontakt der Praxis) ist auf der Bestätigungsseite und in der Fusszeile erreichbar.
- Jeder Zugriff (Bestätigung, Ansicht, Eintrag, Korrektur, Abmelden) wird protokolliert.

Mockup: [`mockups/patienten-zone.html`](mockups/patienten-zone.html) (Ansichten 1 Bestätigung, 2 Heute und letzte 14 Tage, 3 Cockpit-Kachel "Heimprogramm", 4 Akte "Übungstagebuch").

## Risks / Trade-offs

- [Geburtsdatum ist vielen Personen bekannt] → Zweiter Faktor nur zusammen mit dem geheimen Link; Sperren und IP-Begrenzung; die Zone zeigt nur das Heimprogramm, keine Diagnose. Ein stärkerer Faktor (Code per SMS) wäre mehr Aufwand und braucht einen SMS-Dienst.
- [Link in unverschlüsselter E-Mail] → Nur mit Einwilligung; Link allein reicht nicht ohne Geburtsdatum; Sperren und Ersetzen jederzeit in der Akte.
- [Eigene Datenbankrolle muss nach jeder Migration passen] → Rechte werden bei jedem Migrationslauf neu gesetzt; Test der Rechte in CI gegen Postgres.
- [Einträge nicht überprüfbar] → Die Praxis sieht Selbstauskünfte; die Übersicht zeigt sie neutral als "erfasst", nicht als Erfolg.
- [Kaltstart mit `minReplicas: 0`] → Wenige Sekunden beim ersten Öffnen; akzeptiert für geringere Kosten.

## Migration Plan

Additive Migration für die neuen Tabellen und Constraints. Vor dem ersten Deployment: GitHub-Secret `PATIENT_ZONE_DB_PASSWORD` anlegen. Der Workflow baut beide Images, der Migrationsjob legt Tabellen und Rolle an, Bicep erzeugt die zweite Container App zuerst ohne eigenen Hostnamen (`zoneCustomDomainMode = off`), danach DNS durch die Praxis und `bind`. Bis der Hostname gebunden ist, bleiben "Link senden" und die Checkbox ausgeblendet (`PATIENT_ZONE_URL` leer). Rollback: vorherige Revision beider Apps aktivieren; die Tabellen bleiben.

## Decisions confirmed by the practice (14.10.2026)

- **Zweiter Faktor:** das ganze Geburtsdatum, nicht nur das Geburtsjahr.
- **Hostname:** `patient.pain-therapy.ayanta.ch`.
- **Dauer des aktiven Heimprogramms:** 12 Wochen nach der letzten Konsultation mit Verordnung.
- **Link mit dem Übungsblatt:** Checkbox "Link zur Patienten-Zone mitsenden" standardmässig an.
- **Grenzwerte der Hinweise:** Einhaltung unter 50 % oder kein Eintrag seit 3 Tagen.

## Open Questions

Diese Punkte gelten wie beschrieben, bis die Praxis etwas anderes entscheidet:
- **Sperren:** 5 Fehlversuche → 15 Minuten, 10 → blockiert bis zum neuen Link; Gerätesitzung 30 Tage; Link höchstens 6 Monate.
- **Parallele Behandlungen:** Das Heimprogramm folgt der jüngsten Konsultation mit Verordnung über alle Behandlungen; Verordnungen einer älteren Behandlung entfallen damit in der Patienten-Zone.
