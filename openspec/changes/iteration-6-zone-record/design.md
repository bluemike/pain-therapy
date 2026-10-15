# Design

## Context

- **Patientenmodus (Iteration 1):** `startSigning()` legt eine `SignatureSession` mit Kanal `IPAD` an, das Gerät zeigt nur `/sign/[sid]` (`src/app/sign/`), `src/lib/patient-mode.ts` signiert die Sitzung, `src/middleware.ts` sperrt alle anderen Pfade, und `PatientModeBar` sowie `/sign/[sid]/leave` verlangen eine neue Entra-Anmeldung. Schaltflächen "An Patient übergeben" stehen im Erfolgsdialog nach dem Erfassen, in der Akte, im Cockpit und in `OpeningBlocked`.
- **Patienten-Zone (Iterationen 4 und 5):** eigene App `apps/patient-zone` mit Datenbankrolle `patient_zone` (Spaltenrechte in `prisma/patient-zone-role.sql`). Der Link gilt bei `purposeActive = homeProgramActive || signaturePending` (`packages/shared/src/access.ts`). Die Zone liest heute weder Dokumente noch Behandlungen; Bilder der Übungen holt sie mit ihrer Identität aus dem Container `exercise-media` (Rolle "Storage Blob Data Reader" nur auf diesem Container).
- **Dokumente:** `SignedDocument` (Haftungsausschluss) und `ExerciseHandout` (Übungsblatt, Version pro Konsultation) liegen beide im unveränderbaren Container `signed-documents` unter `{patientId}/{documentNumber}.pdf`. Das archivierte Übungsblatt enthält bewusst keinen Zugangslink (Iteration 4, D4).
- **Übungstagebuch:** Das Formular hat schon ein Datumsfeld; `performedAtProblem()` erlaubt vergangene Zeitpunkte bis zur Konsultation. Es fehlen eine Tagesansicht für vergangene Tage, "Alle erledigt" für einen vergangenen Tag und Einträge älter als 14 Tage. `progress()` und `openToday()` in `packages/shared/src/adherence.ts` rechnen bereits für einen beliebigen Referenzzeitpunkt.

## Goals / Non-Goals

**Goals:**
- Unterschrift nur noch in der Zone, weniger Code und keine Entra-Neuanmeldung mehr in der Praxis.
- Die Patientin findet ihre Unterlagen und ihren Behandlungsverlauf jederzeit an einem Ort.
- Vergessene Übungen lassen sich ohne Umwege nachtragen; die Praxis erkennt nachgetragene Einträge.
- Die Zone bleibt nur lesend und minimal berechtigt, ausser beim Übungstagebuch und der Unterschrift wie bisher.

**Non-Goals:**
- Ausweg für Patientinnen ohne eigenes Telefon und ohne E-Mail, klinische Fotos, Anamnese, Upload oder Nachrichten (Roadmap).
- Änderungen an PDF-Inhalt, Archivierung oder E-Mail-Zustellung.

## Decisions

### D1: Capabilities
Vier neue Capabilities (`signing-zone-only`, `zone-documents`, `zone-record`, `zone-exercise-backfill`). Die Änderungen an Anforderungen der Iterationen 1, 4 und 5 stehen als neue Anforderungen darin, weil diese Changes noch nicht archiviert sind (wie Iteration 4, D1 und Iteration 5, D1).

### D2: Patientenmodus entfernen
- Gelöscht: `src/app/sign/` (Seite, Dank, Verlassen, Actions), `src/lib/patient-mode.ts`, `PatientModeBar`, `SigningForm` der Praxis-App, `startSigning()` und `completeSigning()`, die Patientenmodus-Prüfung in `src/middleware.ts` und die zugehörigen Felder im Sitzungs-Token (`src/auth.ts`, `src/lib/session.ts`), Übersetzungen und Tests des Patientenmodus.
- Bleibt: `finalizeSignature()`, `finalizePending()`, die interne Route und der Job aus Iteration 5; Enum-Wert `IPAD` in `SignatureChannel` für bestehende Unterschriften (keine Migration, kein Datenverlust).
- Schaltflächen "An Patient übergeben" werden durch den Dialog "Zur Unterschrift einladen" aus Iteration 5 ersetzt (Erfolgsdialog, Akte, Cockpit, `OpeningBlocked`).
- Offene `SignatureSession` mit Kanal `IPAD` (angefangen, nicht abgeschlossen) setzt die Migration auf `ABORTED`, damit nichts mehr auf sie verweist.

### D3: Gültigkeit des Links
`purposeActive = homeProgramActive || signaturePending || hasRecord`, wobei `hasRecord` heisst: mindestens eine `Treatment` oder ein `SignedDocument` der Patientin. Höchstdauer 6 Monate, Bestätigung, Sperren, Ersetzen bleiben. Die Gerätesitzung (30 Tage) bleibt. Damit kann die Praxis auch nach dem Heimprogramm einen Link für die Unterlagen senden; die Akte zeigt dafür "Zugang zur Patienten-Zone senden" wie bisher beim Übungsblatt, neu auch ohne Heimprogramm.

### D4: Dokumente lesen
- **Liste:** Die Rolle `patient_zone` liest von `SignedDocument` die Spalten `id`, `documentNumber`, `patientId`, `textVersion`, `language`, `createdAt`, `sessionId` und von `ExerciseHandout` `id`, `documentNumber`, `patientId`, `consultationId`, `version`, `language`, `createdAt`. Nicht: `blobPath`, `sha256`, Zustellungen.
- **Abruf:** Route `GET /dokumente/{documentNumber}` in der Zone. Sie sucht das Dokument mit `documentNumber` **und** `patientId` der Sitzung (sonst 404), bildet den Pfad `{patientId}/{documentNumber}.pdf` selbst und liest das Blob mit der Zonen-Identität. Antwort `application/pdf`, `Content-Disposition: inline; filename="{documentNumber}.pdf"`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`.
- **Speicher:** neue Rollenzuweisung "Storage Blob Data Reader" der Zonen-Identität auf dem Container `signed-documents` (nur lesen; das Archiv ist ohnehin unveränderbar). Diese Rolle darf die Deploy-Identität seit Iteration 4 vergeben.
- **Ausstehendes PDF:** Eine `SIGNED`-Sitzung ohne Dokument erscheint als "wird erstellt"; dafür reicht das bestehende Leserecht auf `SignatureSession`.
- **Protokoll:** Audit `document.viewedInZone` mit `patientId`, `documentNumber`, Sitzung; im Verlauf der Akte sichtbar.

### D5: Behandlungen und Konsultationen lesen
- Neue Spaltenrechte (nur `SELECT`): `Treatment` (`id`, `patientId`, `startedAt`, `regionId`, `diagnosis`, `painStart`), `Consultation` (`id`, `treatmentId`, `number`, `at`, `diagnosis`, `painBefore`, `painAfter`, `comparison`), `ConsultationPoint`, `ConsultationExercise`, `ConsultationRolling` (Bezug und Werte, ohne Benutzerfelder) sowie die Katalogtabellen `Region`, `OsteopressurePoint`, `RollingTool` (Namen). Nicht: `createdBy`, `updatedBy`, `ClinicalPhoto`, `Anamnesis`, `AuditEvent`.
- Abfragen der Zone filtern immer über `patientId` der Sitzung (`Treatment.patientId`, bei Konsultationen über die Behandlung). Ein Test pro Route prüft, dass eine fremde ID wie eine unbekannte behandelt wird. Row-Level-Security bleibt auf der Roadmap.
- Darstellung: Übersicht als Karten, Detail als Zeitstrahl der Konsultationen mit kleinem Schmerzverlauf (vorher und nachher pro Konsultation, als Balken mit Textwerten, ohne Diagrammbibliothek, CSP ohne Inline-Styles: Breiten über Klassen in 10er-Schritten).

### D6: Navigation der Zone
Reiterleiste oben unter dem Kopf: "Übungen" (nur mit `programSession`), "Behandlungen", "Dokumente". `/` leitet ohne aktives Heimprogramm auf `/behandlungen` um. Der Vorrang der Unterschrift (Iteration 5, D5) bleibt vor allem anderen; `/dokumente` und `/behandlungen` leiten bei ausstehender Unterschrift ebenfalls auf `/unterschrift` um.

### D7: Nacherfassen
- `?tag=YYYY-MM-DD` auf `/` wählt den Tag (Zürcher Zeit), begrenzt auf `[Datum der Konsultation, heute]`; ungültig oder ausserhalb heisst heute. Pfeile "Vorheriger Tag" und "Nächster Tag" plus Datumsfeld.
- Die Tagesansicht nutzt `progress(p, entries, ref)` mit `ref` = 12:00 des gewählten Tages; wöchentliche Ziele zählen die Woche dieses Tages.
- Das Formular setzt das Datum des gewählten Tages vor; bei heute die aktuelle Uhrzeit, sonst 12:00. `performedAtProblem()` bleibt die Prüfung; neue Fehlermeldung für `beforeConsultation` in Patientensprache.
- "Alle Übungen dieses Tages erledigt": `quickEntry(s, now, day)` mit `performedAt` 12:00 des Tages (heute: jetzt) und `openToday(..., ref)`.
- Liste: `recentEntries()` ab Datum der Konsultation statt 14 Tage; Gruppierung nach Tag bleibt.
- Praxis-App: `nachgetragen`, wenn `createdAt - performedAt > 24 h`; Anzeige im Übungstagebuch der Akte. Adhärenz rechnet wie bisher über `performedAt`.

### D8: Tests
- Unit (Zone, Rolle `patient_zone`): Dokumentliste und Abruf nur eigener Dokumente, fremde Dokumentnummer 404, Behandlung einer anderen Patientin 404, keine Fotos; Tagesansicht und Nacherfassen mit Grenzen; Link gültig nach Ablauf des Heimprogramms mit Behandlung.
- Rechte-Test: neue erlaubte Spalten, weiterhin verweigert für Fotos, Anamnese, `blobPath`, Zustellungen, Benutzerfelder und alle Änderungen an Behandlungen und Dokumenten.
- Praxis-App: keine Route unter `/sign` mehr, Erfolgsdialog ohne Übergabe, Kennzeichnung "nachgetragen".
- Playwright auf 390 px: Reiter, Behandlung mit Konsultationen, Dokument öffnen (PDF-Antwort), gestern nachtragen; axe ohne Verstösse.

## Risks / Trade-offs

- **Patientinnen ohne Telefon und ohne E-Mail** können nach dem Entfernen des Patientenmodus nicht mehr digital unterschreiben, und ohne Unterschrift sperrt die App neue Behandlungen. Abhilfe heute: QR-Code auf dem Telefon einer Begleitperson oder Zugangsblatt. Ein eigener Ausweg (zum Beispiel Kiosk-Gerät der Praxis) steht auf der Roadmap. Entscheid der Praxis, siehe Open Questions.
- **Mehr Daten in der Zone:** Die Zone liest neu Gesundheitsdaten (Diagnosen, Schmerzwerte). Abgesichert durch Geburtsdatum, Sperren, Spaltenrechte, Filter auf die Sitzung und Protokoll. Die Rolle bleibt ohne Schreibrechte auf diese Tabellen.
- **Längere Gültigkeit:** Der Link gilt neu auch ohne Heimprogramm, höchstens 6 Monate. Wer ihn nicht mehr braucht, wird von der Praxis mit "Zugang sperren" beendet (Iteration 4).

## Migration Plan

1. Migration: offene `IPAD`-Sitzungen auf `ABORTED`; Rolle `patient_zone` mit neuen Spaltenrechten (`prisma/patient-zone-role.sql` läuft im Migrations-Job).
2. Bicep: Rollenzuweisung der Zonen-Identität auf `signed-documents`.
3. Deployment wie üblich über `main`; keine manuellen Schritte, keine neuen Secrets.
4. Rückweg: Revert des Merge-Commits; die Daten bleiben unverändert, nur abgebrochene iPad-Sitzungen bleiben abgebrochen.

## Open Questions

- Brauchen Patientinnen ohne eigenes Telefon und ohne E-Mail einen Ausweg in dieser Iteration? Vorschlag: nein, Roadmap.
- Soll die Zone auch klinische Fotos zeigen? Vorschlag: nein (Fotos sind Arbeitsmaterial der Praxis).
