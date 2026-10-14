# Tasks

## 1. Datenmodell und Migrationen

- [x] 1.1 Modelle `PatientAccessLink`, `AccessLinkDelivery`, `PatientZoneSession`, `PatientZoneAttempt` und `ExerciseLogEntry` (Fremdschlüssel auf `HomePrescription`); additive Migration mit Constraints für Bewertung 1 bis 10, Bewertung nur bei "gemacht" und Bemerkung höchstens 500 Zeichen
- [x] 1.2 Neue Audit-Aktionen für Link, Bestätigung, Sitzung und Übungstagebuch in `src/lib/audit.ts`; Anzeige im Verlauf der Akte
- [x] 1.3 `prisma/patient-zone-role.sql`: Rolle `patient_zone` idempotent anlegen und Rechte nach D12 setzen; Aufruf in `prisma/migrate.sh` nach `prisma migrate deploy`; Löschen von `PatientZoneAttempt` älter als 30 Tage
- [x] 1.4 Test gegen Postgres: Rechte der Rolle entsprechen der erlaubten Liste, Diagnose und Anamnese nicht lesbar, kein `DELETE`

## 2. Monorepo und gemeinsamer Code

- [x] 2.1 npm-Workspaces einrichten: Praxis-App bleibt im Wurzelverzeichnis, `apps/patient-zone`, `packages/shared`; Build, Lint, Typecheck und Tests laufen für alle Workspaces
- [x] 2.2 `packages/shared`: Prisma-Client-Fabrik, Wiederholungen und Zeitbedarf aus `src/lib/home-program.ts` (dort re-exportiert), aktives Heimprogramm (D2), Token erzeugen und hashen, zod-Schema der Einträge
- [x] 2.3 Einhaltung nach D9 in `packages/shared`; Unit-Tests mit den Szenarien der Spec (Soll, Obergrenze pro Übung, anteiliges Soll, gelöschte Einträge, Hinweise)

## 3. Zugangslink und Bestätigung (patient-access)

- [x] 3.1 Link ausstellen, ersetzen und sperren in der Praxis-App; Gültigkeit (6 Monate, aktives Heimprogramm, aktive Patientin); Status für die Akte
- [x] 3.2 `src/lib/mail.ts`: Anhang optional; E-Mail mit Link (de und en) aus `pain-therapy@ayanta.ch` mit Wiederholungen und Zustellstatus, nur mit Einwilligung (`emailConsentOf`)
- [x] 3.3 Abschluss des Übungsblatts: Checkbox "Link zur Patienten-Zone mitsenden" (vorgewählt), Link im E-Mail-Text, Zugangsblatt mit QR-Code beim Drucken; archiviertes PDF ohne Link; ausgeblendet, solange `PATIENT_ZONE_URL` leer ist
- [x] 3.4 "Link senden" in der Akte: E-Mail oder QR-Code am Bildschirm und "Zugangsblatt drucken"
- [x] 3.5 Bestätigung mit dem Geburtsdatum in der Patienten-Zone: Sperre nach 5 und Blockierung nach 10 Fehlversuchen, 20 Versuche pro Stunde und IP-Adresse, neutrale Meldungen
- [x] 3.6 Gerätesitzung mit Cookie (HttpOnly, Secure, SameSite=Strict, 30 Tage), Weiterleitung ohne Token, "Abmelden", Ende bei Sperre und Ablauf

## 4. Patienten-Zone (patient-zone-app)

- [x] 4.1 Next.js-App `apps/patient-zone` mit `output: 'standalone'`, next-intl (de, en), Ayanta-Design mobil zuerst nach dem Mockup, eigenes `Dockerfile`, `/api/health`
- [x] 4.2 Sicherheitsheader: CSP mit Nonce, `Referrer-Policy: no-referrer`, HSTS, `X-Robots-Tag: noindex`; Token in Logs maskiert
- [x] 4.3 Bilder unter `/media/{code}` aus `exercise-media` nur für gültige Sitzungen und Übungen des aktuellen Programms
- [x] 4.4 Datenschutzhinweis auf der Bestätigungsseite und in der Fusszeile (Text von der Praxis bestätigen lassen)

## 5. Übungstagebuch (exercise-log)

- [x] 5.1 Ansicht "Heute" mit Stand pro Übung (heute bzw. diese Woche)
- [x] 5.2 Eintrag mit "gemacht", Bewertung 1 bis 10, Datum und Zeit (vorbelegt, nicht in der Zukunft, nicht vor der Konsultation) und Bemerkung
- [x] 5.3 Schnelleintrag "Alle heutigen Übungen erledigt"
- [x] 5.4 Liste der letzten 14 Tage; Korrigieren und Löschen innerhalb von 24 Stunden mit Audit-Ereignis und `deletedAt`

## 6. Cockpit und Akte (adherence-overview)

- [x] 6.1 Kachel "Heimprogramm" auf dem Dashboard: Patientinnen mit aktivem Programm, Hinweise zuerst, Einhaltung, Trend, letzter Eintrag, Bewertung, Link-Status
- [x] 6.2 Reiter "Übungstagebuch" in der Akte: Kennzahlen, Tabelle pro Übung, Verlauf der Bewertung, Einträge, Link-Status mit "Link senden" und "Link sperren"; nur lesen; Öffnen protokolliert
- [x] 6.3 Übersetzungen de und en für Kachel und Reiter

## 7. Infrastruktur und Deployment

- [x] 7.1 Bicep: Identität `id-pain-therapy-zone` mit `AcrPull`, Key-Vault-Zugriff nur auf ihre Secrets, `Storage Blob Data Reader` nur auf `exercise-media`
- [x] 7.2 Bicep: Secrets `patient-zone-database-url`, `patient-zone-db-password`, `patient-zone-secret`; Parameter `patientZoneDbPassword`; Migrationsjob bekommt das Passwort der Rolle
- [x] 7.3 Bicep: Container App `ca-pain-therapy-zone` (Ingress extern, `minReplicas: 0`, `maxReplicas: 2`, Proben auf `/api/health`), Parameter `zoneCustomDomain` und `zoneCustomDomainMode`; `PATIENT_ZONE_URL` für die Praxis-App; `what-if` zeigt nur die neuen Ressourcen und die neue Variable
- [x] 7.4 `deploy.yml`: zweites Image `pain-therapy-zone`, Migration einmal, Bicep mit beiden Images, Smoke-Test beider Apps; GitHub-Secret `PATIENT_ZONE_DB_PASSWORD`
- [x] 7.5 `docker-compose.yml` und docs/local-development.md: Patienten-Zone lokal mit der Rolle `patient_zone`

## 8. Tests

- [x] 8.1 Unit-Tests: Token und Hash, Gültigkeit, Sperren und Zähler, Validierung der Einträge, 24-Stunden-Regel, Einhaltung
- [x] 8.2 Sicherheitstests: Sperre nach 5 und 10 Fehlversuchen, IP-Begrenzung, abgelaufener, ersetzter und gesperrter Link mit gleicher Meldung, Sitzung endet bei Sperre, Bild ohne Sitzung und fremde Übung abgelehnt, kein Token in Logs und Datenbank
- [x] 8.3 End-to-End-Test: Übungsblatt mit Link senden (gemockter Graph), Link öffnen, Geburtsdatum bestätigen, Einträge erfassen und korrigieren, Einhaltung in Kachel und Reiter prüfen, Link sperren
- [x] 8.4 End-to-End-Test der Patienten-Zone im Telefon-Viewport (390 px) ohne seitliches Scrollen; axe-Prüfung für Bestätigung, Heute, letzte 14 Tage, Kachel und Reiter

## 9. Dokumentation

- [x] 9.1 docs/deployment.md: Abschnitt Iteration 4 mit zweiter Container App, Rolle `patient_zone`, Secrets, Reihenfolge des ersten Deployments und DNS
- [x] 9.2 docs/roadmap.md: Iteration 3 in Betrieb, Iteration 4, Patienten-Zone später nur noch Erinnerungen und Erfolgsprotokoll

## 10. Praxis

- [x] 10.1 Offene Fragen aus design.md entscheiden (Geburtsdatum, Hostname `patient.pain-therapy.ayanta.ch`, 12 Wochen, Checkbox an, Grenzwerte; bestätigt am 14.10.2026)
- [ ] 10.2 DNS: CNAME und TXT-Eintrag für den Hostnamen der Patienten-Zone, danach `zoneCustomDomainMode = bind` (Mike Franz)
- [ ] 10.3 Datenschutzhinweis und Text der E-Mail mit dem Link bestätigen
- [ ] 10.4 Abnahme auf einem Telefon (Link per E-Mail und per QR-Code, Bestätigung, Einträge) und im Cockpit auf dem iPad
