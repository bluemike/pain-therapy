# Tasks

## 0. Voraussetzungen (Mike)

- [x] 0.1 Domain `pain-therapy.online` kaufen (Swizzonic, DNS dort)
- [x] 0.2 Infomaniak Mail Service: `admin@`, `christina.franz@`, `noreply@`, `test-therapist@`; MX, SPF, DKIM, DMARC (`p=none`)
- [ ] 0.3 SMTP-Passwort als Key-Vault-Geheimnis `smtp-password` hinterlegen

## 1. Datenmodell und Trennung (6 bis 8 PT)

- [x] 1.1 `Practice`, `PracticeMembership`, `Invitation`; `practiceId` auf allen Praxis-Tabellen, Migration A mit «Pain Therapy Falera»
- [x] 1.2 Rollen `practice_app` und `platform_admin`, RLS-Policies, Rolle `patient_zone` unter RLS
- [x] 1.3 Prisma-Extension: `SET LOCAL app.practice_id` pro Anfrage in Praxis-App und Zone
- [x] 1.4 Alle Abfragen, Server-Actions und API-Routen auf die Praxis der Session umstellen (über RLS und Spalten-Default statt Änderung jeder Abfrage; interne Routen und Finalize-Job mit `runInPractice`)
- [x] 1.5 `DocumentCounter` und `ConsentTextVersion` pro Praxis, Dateipfade `<practiceId>/…` (ältere Dateien bleiben unter `<patientId>/…` lesbar)

## 2. Anmeldung (3 bis 4 PT)

- [x] 2.1 E-Mail-Code (Hash, 10 Minuten, Sperre nach 5 Fehlern)
- [x] 2.2 Passkeys mit `@simplewebauthn`, TOTP mit verschlüsseltem Geheimnis, Wiederherstellungscodes
- [x] 2.3 Einladung annehmen, Faktoren einrichten, Anmeldung zurücksetzen (Funktion; Knopf auf der Team-Seite mit 5.2)
- [x] 2.4 Entra-Anbieter und `entraOid`-Pflicht entfernen, Rollen aus der Mitgliedschaft

## 3. Praxis-Einstellungen (2 bis 3 PT)

- [x] 3.1 Seite «Praxis» mit Name, Adresse, Kontakt, Standardort, Kürzel, Logo
- [x] 3.2 PDFs, Mails und Zone lesen die Praxisangaben; Konstanten aus `config.ts` und `Invalid.tsx` entfernen (Absender der Mails mit Phase 4)
- [x] 3.3 Haftungsausschluss und Datenschutzhinweis pro Praxis mit Versionen (Haftungsausschluss mit Versionen pro Praxis; Datenschutzhinweis als eigener Text der Praxis ohne Versionen, sonst die Vorlage)
- [x] 3.4 Neutrale Plattform-Marke «Pain Therapy» statt Ayanta

## 4. E-Mail nur mit Links (1 bis 2 PT)

- [x] 4.1 SMTP-Mailer (Nodemailer, Infomaniak), Reply-To der Praxis, Graph-Mailer entfernen (Bicep, Deploy und Doku mit Phase 6)
- [x] 4.2 Anhänge entfernen; Haftungsausschluss und Übungsblatt als Link in die Zone «Dokumente» (Übungsblatt-Link öffnet die Startseite mit dem neuen Heimprogramm; bei der Unterschrift in der Zone keine Mail)
- [x] 4.3 Mailtexte ohne Gesundheitsangaben (de/en)

## 5. Onboarding und Plattform (3 bis 4 PT)

- [x] 5.0 Plattform-Admin-Konto `admin@pain-therapy.online` per Seed, ohne Praxis-Mitgliedschaft (der 5-Minuten-Job lädt `PLATFORM_ADMIN_EMAIL` ein, solange kein Plattform-Admin existiert)
- [x] 5.1 Plattform-Übersicht: Praxen anlegen, Status, sperren, reaktivieren
- [x] 5.2 Team: einladen, Rollen, deaktivieren, mindestens eine Praxis-Admin
- [x] 5.3 Export als ZIP im Hintergrund-Job, Download-Link 24 Stunden (nach der Anfrage im Hintergrund, Rückfall im 5-Minuten-Job; neuer Container `practice-exports`)
- [x] 5.4 Löschen mit Export-Pflicht und Vormerkung der WORM-Dokumente

## 6. Domain und Infrastruktur (1 bis 2 PT)

- [x] 6.1 Custom Domains `pain-therapy.online`, `www`, `patient.pain-therapy.online` mit verwalteten Zertifikaten (Bicep, Deploy-Workflow) — Variablen `DOMAIN_MODE`/`ZONE_DOMAIN_MODE` (off → add → bind), Apex per HTTP-Validierung, Ausgabe `environmentStaticIp` für den A-Eintrag; Bicep lokal nicht kompiliert (kein Bicep-CLI in der Umgebung), prüft der erste Workflow-Lauf bzw. `what-if`
- [x] 6.2 Weiterleitungen von `pain-therapy.ayanta.ch` und `patient.pain-therapy.ayanta.ch` — App: 308 auf `AUTH_URL` für `LEGACY_HOSTS` (`src/lib/legacy-host.ts`, ab `bind`); Zone: alter Hostname bleibt gebunden und bedient alte Links (D10), Abschalten nach höchstens 6 Monaten per `ZONE_CUSTOM_DOMAIN_MODE=off`
- [x] 6.3 Neue Datenbankrollen-Passwörter in Key Vault und GitHub-Umgebung — Bicep legt `practice-app-db-password`, `practice-app-database-url`, `auth-encryption-key`, `smtp-password` an; Workflow prüft die GitHub-Secrets und bereitet den ersten Lauf vor. Die Werte setzt Mike vor dem Deployment (docs/deployment.md, Iteration 12)

## 7. Tests und Sicherheit (3 bis 4 PT)

- [ ] 7.0 «Test-Praxis» mit `test-therapist@pain-therapy.online` auf Produktion für die Abnahme der Trennung
- [x] 7.1 E2E mit zwei Praxen: jede Seite und API gegen IDs der fremden Praxis — `tests/e2e/isolation.spec.ts`; die ganze E2E-Suite läuft jetzt als `practice_app` (45 Tests grün); `/api/patients/[id]/consent-state` gibt für fremde IDs jetzt 404 statt eines leeren Status
- [x] 7.2 Unit-Tests RLS (Abfrage ohne Praxis, Schreiben in fremde Praxis) — `tenancy.test.ts`, zusätzlich: jede Tabelle mit `practiceId` hat eine Policy, `practice_app` umgeht RLS nicht, Katalog nur lesbar, Löschfunktion nicht ausführbar
- [x] 7.3 Tests Anmeldung (Passkey virtuell, E-Mail-Code, TOTP, Sperre)
- [x] 7.4 Sicherheitsreview vor dem Anlegen der ersten fremden Praxis — [security-review.md](security-review.md); Befund: E2E lief als Eigentümer ohne RLS, behoben

## 8. Umstellung und Abnahme (1 bis 2 PT)

- [ ] 8.1 Deployment mit Migration, Chrissie (`christina.franz@`) als Praxis-Admin von Falera einladen
- [ ] 8.2 Abnahme durch die Praxis Falera am iPad
- [ ] 8.3 Entra-Anmeldung abschalten, `Mail.Send` und Entra-App entfernen
- [ ] 8.4 Erste fremde Praxis anlegen
- [ ] 8.5 Dokumentation (docs/deployment.md, docs/entra.md ersetzen durch docs/anmeldung.md)
