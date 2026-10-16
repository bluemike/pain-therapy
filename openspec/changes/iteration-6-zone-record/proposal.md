# Proposal

## Why

Seit Iteration 5 unterschreibt die Patientin den Haftungsausschluss auf dem eigenen Telefon in der Patienten-Zone. Der Patientenmodus auf dem iPad ("An Patient übergeben") aus Iteration 1 ist damit überflüssig und mit der neuen Entra-Anmeldung beim Verlassen mühsam. Gleichzeitig erhält die Patientin ihre Unterlagen heute nur per E-Mail oder auf Papier, und von ihren Behandlungen sieht sie in der Zone nichts. Die Praxis wünscht (Anfrage von Mike Franz), die Patienten-Zone zu einer kleinen Patientenakte auszubauen, wie man sie von Arztpraxen kennt: unterschriebene Dokumente, Übungsblätter, Behandlungen und Konsultationen strukturiert abgelegt. Ausserdem soll die Patientin vergessene Übungen für vergangene Tage nachtragen können.

## What Changes

- **"An Patient übergeben" entfällt:** Der Patientenmodus auf dem iPad wird komplett entfernt, mit Schaltflächen in Akte, Erfolgsdialog nach dem Erfassen, Cockpit und Sperrhinweis bei neuer Behandlung sowie den Seiten unter `/sign`. Unterschrieben wird nur noch in der Patienten-Zone ("Zur Unterschrift einladen" per E-Mail, QR-Code oder Zugangsblatt). Bestehende iPad-Unterschriften und ihre PDFs bleiben unverändert gültig.
- **Dokumente in der Patienten-Zone:** Unter "Dokumente" findet die Patientin alle ihre unterschriebenen Haftungsausschlüsse und alle Übungsblätter als PDF, nach Art und Datum geordnet, mit Dokumentnummer. Sie kann sie ansehen und herunterladen. Jeder Abruf wird protokolliert.
- **Behandlungen und Konsultationen in der Patienten-Zone:** Unter "Behandlungen" sieht die Patientin ihre Behandlungen (Beginn, Region, Diagnose, Schmerz zu Beginn) und darin jede Konsultation (Datum, Nr., Diagnose, Schmerz vorher und nachher, Vergleich, Osteopressur-Punkte, Übungen in der Praxis, Faszien-Rollmassage, Heimprogramm mit Übungsblatt), nur lesend.
- **Zugang zur Zone:** Der Zugangslink gilt neu für jede aktive Patientin mit mindestens einer Behandlung oder einem Dokument, nicht nur bei aktivem Heimprogramm oder ausstehender Unterschrift. Höchstdauer 6 Monate, Bestätigung mit dem Geburtsdatum und Sperren bleiben. Das Übungstagebuch erscheint weiterhin nur bei aktivem Heimprogramm.
- **Nacherfassen vergangener Tage:** Im Übungstagebuch wählt die Patientin einen Tag zwischen dem Datum der Konsultation mit dem aktuellen Heimprogramm und heute. Sie sieht die Übungen dieses Tages mit Stand und erfasst Ausführungen für diesen Tag, einzeln oder mit "Alle Übungen dieses Tages erledigt". Die Liste der Einträge zeigt das ganze Heimprogramm statt nur die letzten 14 Tage. In der Praxis-App sind nachgetragene Einträge als "nachgetragen" erkennbar.
- **Navigation der Zone:** "Übungen" (bei aktivem Heimprogramm), "Behandlungen" und "Dokumente" als Reiter, für das Telefon gestaltet.

Mockup: `mockups/patientenakte-zone.html` (klickbar: https://claude.ai/artifact/MhDeGo22RdxeSLdxutrcFw).

**Nicht im Umfang (Out of scope), siehe docs/roadmap.md:**
- Unterschrift für Patientinnen ohne eigenes Telefon und ohne E-Mail auf einem Gerät der Praxis (ein neuer Ausweg wäre eine eigene Iteration).
- Klinische Fotos in der Patienten-Zone.
- Anamnese, Verlauf (Audit) und interne Bemerkungen der Praxis in der Patienten-Zone.
- Dokumente oder Nachrichten von der Patientin an die Praxis (Upload, Chat).
- Nacherfassen für abgelaufene frühere Heimprogramme.
- Änderung der E-Mail-Zustellung: PDF und Übungsblatt gehen weiterhin wie bisher per E-Mail (mit Einwilligung) oder auf Papier.

## Capabilities

### New Capabilities
- `signing-zone-only`: Entfernen des Patientenmodus auf dem iPad; Unterschrift ausschliesslich über die Patienten-Zone; Umgang mit bestehenden iPad-Unterschriften.
- `zone-documents`: Unterschriebene Dokumente und Übungsblätter in der Patienten-Zone ansehen und herunterladen, mit Zugriffsschutz und Protokoll.
- `zone-record`: Behandlungen und Konsultationen in der Patienten-Zone, Navigation der Zone und erweiterte Gültigkeit des Zugangslinks.
- `zone-exercise-backfill`: Nacherfassen von Ausführungen für vergangene Tage des aktuellen Heimprogramms, Kennzeichnung in der Praxis-App.

### Modified Capabilities
- Keine geänderten Anforderungen in `openspec/specs/`, weil die Changes der Iterationen 1 bis 5 noch nicht archiviert sind (wie in Iteration 4 und 5). Inhaltlich ändert diese Iteration:
  - `consent-signing` (Iteration 1): "Patientenmodus" und "Unterschriftsablauf starten" auf dem iPad entfallen (in `signing-zone-only`).
  - `patient-access` (Iteration 4) und `zone-consent-invitation` (Iteration 5), "Gültigkeit des Links": gilt zusätzlich mit Behandlung oder Dokument (in `zone-record`).
  - `patient-zone-app` (Iteration 4) und `zone-consent-signing` (Iteration 5), "Rechte der Rolle patient_zone" und "keine Dokumente in der Zone": die Zone liest neu Dokumente, Behandlungen und Konsultationen der eigenen Person (in `zone-documents` und `zone-record`).
  - `exercise-log` (Iteration 4), "Letzte 14 Tage" und Datum der Ausführung: Tagesauswahl und ganze Programmdauer (in `zone-exercise-backfill`).

## Impact

- Praxis-App: Entfernen von `src/app/sign/`, `src/lib/patient-mode.ts`, `PatientModeBar`, der Patientenmodus-Sperre in `src/middleware.ts` und `src/auth.ts`, von `startSigning()` und der Schaltflächen "An Patient übergeben"; `SigningForm` nur noch in der Zone. Kennzeichnung "nachgetragen" im Übungstagebuch der Akte.
- Patienten-Zone (`apps/patient-zone`): neue Seiten `/behandlungen`, `/behandlungen/[id]`, `/dokumente`, Route für PDF-Abruf, Tagesauswahl im Übungstagebuch, Reiter-Navigation; de und en.
- Rolle `patient_zone` (`prisma/patient-zone-role.sql`): zusätzliche Leserechte auf ausgewählte Spalten von Behandlung, Konsultation, Punkten, Übungen, Rollmassage, Dokumenten und Übungsblättern; der Rechte-Test wird erweitert. Keine Schreibrechte neu.
- Datenmodell: keine neue Tabelle; Prisma-Migration nur für Indizes, falls nötig.
- Betrieb: Rolle "Storage Blob Data Reader" der Zonen-Identität zusätzlich auf dem Container `signed-documents` (nur lesen) in `infra/main.bicep`.
