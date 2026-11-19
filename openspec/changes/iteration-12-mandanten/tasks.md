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
- [ ] 1.5 `DocumentCounter` und `ConsentTextVersion` pro Praxis (erledigt), Dateipfade `<practiceId>/…` (offen, mit Phase 3)

## 2. Anmeldung (3 bis 4 PT)

- [x] 2.1 E-Mail-Code (Hash, 10 Minuten, Sperre nach 5 Fehlern)
- [x] 2.2 Passkeys mit `@simplewebauthn`, TOTP mit verschlüsseltem Geheimnis, Wiederherstellungscodes
- [x] 2.3 Einladung annehmen, Faktoren einrichten, Anmeldung zurücksetzen (Funktion; Knopf auf der Team-Seite mit 5.2)
- [x] 2.4 Entra-Anbieter und `entraOid`-Pflicht entfernen, Rollen aus der Mitgliedschaft

## 3. Praxis-Einstellungen (2 bis 3 PT)

- [ ] 3.1 Seite «Praxis» mit Name, Adresse, Kontakt, Standardort, Kürzel, Logo
- [ ] 3.2 PDFs, Mails und Zone lesen die Praxisangaben; Konstanten aus `config.ts` und `Invalid.tsx` entfernen
- [ ] 3.3 Haftungsausschluss und Datenschutzhinweis pro Praxis mit Versionen
- [ ] 3.4 Neutrale Plattform-Marke «Pain Therapy» statt Ayanta

## 4. E-Mail nur mit Links (1 bis 2 PT)

- [ ] 4.1 SMTP-Mailer (Nodemailer, Infomaniak), Reply-To der Praxis, Graph-Mailer entfernen
- [ ] 4.2 Anhänge entfernen; Haftungsausschluss und Übungsblatt als Link in die Zone «Dokumente»
- [ ] 4.3 Mailtexte ohne Gesundheitsangaben (de/en)

## 5. Onboarding und Plattform (3 bis 4 PT)

- [ ] 5.0 Plattform-Admin-Konto `admin@pain-therapy.online` per Seed, ohne Praxis-Mitgliedschaft
- [ ] 5.1 Plattform-Übersicht: Praxen anlegen, Status, sperren, reaktivieren
- [ ] 5.2 Team: einladen, Rollen, deaktivieren, mindestens eine Praxis-Admin
- [ ] 5.3 Export als ZIP im Hintergrund-Job, Download-Link 24 Stunden
- [ ] 5.4 Löschen mit Export-Pflicht und Vormerkung der WORM-Dokumente

## 6. Domain und Infrastruktur (1 bis 2 PT)

- [ ] 6.1 Custom Domains `pain-therapy.online`, `www`, `patient.pain-therapy.online` mit verwalteten Zertifikaten (Bicep, Deploy-Workflow)
- [ ] 6.2 Weiterleitungen von `pain-therapy.ayanta.ch` und `patient.pain-therapy.ayanta.ch`
- [ ] 6.3 Neue Datenbankrollen-Passwörter in Key Vault und GitHub-Umgebung

## 7. Tests und Sicherheit (3 bis 4 PT)

- [ ] 7.0 «Test-Praxis» mit `test-therapist@pain-therapy.online` auf Produktion für die Abnahme der Trennung
- [ ] 7.1 E2E mit zwei Praxen: jede Seite und API gegen IDs der fremden Praxis
- [ ] 7.2 Unit-Tests RLS (Abfrage ohne Praxis, Schreiben in fremde Praxis)
- [x] 7.3 Tests Anmeldung (Passkey virtuell, E-Mail-Code, TOTP, Sperre)
- [ ] 7.4 Sicherheitsreview vor dem Anlegen der ersten fremden Praxis

## 8. Umstellung und Abnahme (1 bis 2 PT)

- [ ] 8.1 Deployment mit Migration, Chrissie (`christina.franz@`) als Praxis-Admin von Falera einladen
- [ ] 8.2 Abnahme durch die Praxis Falera am iPad
- [ ] 8.3 Entra-Anmeldung abschalten, `Mail.Send` und Entra-App entfernen
- [ ] 8.4 Erste fremde Praxis anlegen
- [ ] 8.5 Dokumentation (docs/deployment.md, docs/entra.md ersetzen durch docs/anmeldung.md)
