# Lokal entwickeln

Voraussetzungen: Node.js 22, Docker (für PostgreSQL), für die Playwright-Tests Chromium (`npx playwright install chromium`).

## Schnellstart

```bash
cp .env.example .env                      # AUTH_SECRET setzen: openssl rand -base64 32
docker compose up -d db                   # PostgreSQL 16 auf localhost:5432 (app/app)
npm install
npx prisma migrate deploy                 # Tabellen und Schutz-Trigger anlegen
npm run media:placeholders                # Platzhalter-Bilder und -Texte der Übungsblätter in data/exercise-media/
npm run catalog:sync                      # Therapiekatalog aus prisma/catalog/ einspielen (auch Teil von db:seed)
SEED_DEMO=true npm run db:seed            # optional: Formulartexte, Katalog und 4 Beispiel-Patient:innen
npm run dev                               # http://localhost:3000
```

Mit `AUTH_DEV_LOGIN=true` zeigt die Anmeldeseite zusätzlich die **Entwickler-Anmeldung**: Name, Rolle (Therapeut:in, Administration, keine) und Kontoart (Ayanta, Gast, fremder Tenant) frei wählbar. Damit lassen sich alle Zugriffsfälle durchspielen. In Azure ist sie immer aus.

Mails landen als `.json` mit dem PDF-Anhang daneben in `data/outbox/`, unterschriebene PDFs in `data/documents/`, Fotos von Behandlungen und Konsultationen in `data/clinical-photos/` (`STORAGE_PHOTO_LOCAL_DIR`), Übungsblätter (PDF) wie die unterschriebenen Dokumente in `data/documents/`. Die Bilder und Texte der L&B-Übungsblätter liest die App aus `data/exercise-media/` (`STORAGE_EXERCISE_LOCAL_DIR`); `npm run media:placeholders` legt dort synthetische Platzhalter an (gestreifte Bilder, Texte "Platzhalter …"), die echten Inhalte gehören nicht ins Repository (siehe [deployment.md](deployment.md#iteration-3-selbstausführung-übungsblatt)). Wer die echten Dateien lokal braucht, kopiert sie aus OneDrive in diesen Ordner und startet `npm run catalog:sync`. Neue Behandlungen und Konsultationen gibt es nur für aktive Patient:innen mit gültig unterschriebenem Haftungsausschluss; lokal also zuerst *Zur Unterschrift einladen* und in der Patienten-Zone (`npm run dev:zone`, Link aus `data/outbox/` oder QR-Code) unterschreiben. Telefon und iPad lassen sich im Browser mit den Entwicklerwerkzeugen (Gerätesimulation) oder mit einem echten Gerät im selben Netz (`http://<rechner-ip>:3000`) testen.

## Patienten-Zone (ab Iteration 4)

Die Patienten-Zone ist eine eigene Next.js-App in `apps/patient-zone` (npm-Workspace, gemeinsamer Code in `packages/shared`). Sie verbindet sich mit der Datenbankrolle `patient_zone`, die nur die nötigen Spalten lesen und nur eigene Einträge schreiben darf; die Rolle legt der Migrationsjob an (`prisma/patient-zone-role.mjs`, idempotent).

```bash
# einmal: Rolle anlegen (Superuser app aus docker compose), Passwort frei wählbar
PATIENT_ZONE_DB_PASSWORD=patient_zone node prisma/patient-zone-role.mjs
cp apps/patient-zone/.env.example apps/patient-zone/.env
# Praxis-App: Link-Funktionen einschalten
echo 'PATIENT_ZONE_URL=http://localhost:3100' >> .env
npm run dev          # Praxis-App, http://localhost:3000
npm run dev:zone     # Patienten-Zone, http://localhost:3100
```

Ein Übungsblatt mit *Link zur Patienten-Zone mitsenden* oder *Übungstagebuch → Link senden* in der Akte erzeugt den Link; mit E-Mail-Einwilligung steht er in der Mail in `data/outbox/`, sonst zeigt die Akte den QR-Code. Den Link öffnen und mit dem Geburtsdatum der Patientin bestätigen. Ohne `PATIENT_ZONE_URL` bleiben *Link senden* und die Checkbox ausgeblendet. Das Sitzungs-Cookie ist `Secure`; Browser akzeptieren es auf `localhost` auch ohne HTTPS, über die IP-Adresse im Netz dagegen nicht.

Nach einer Änderung an Tabellen, die die Zone liest, die Rechte in `prisma/patient-zone-role.sql` anpassen und das Skript erneut ausführen. Die Zone fragt Prisma immer mit explizitem `select` ab, sonst verweigert Postgres den Zugriff auf nicht freigegebene Spalten.

## Wie in Produktion

`docker compose up --build` baut das Produktions-Image und startet es mit PostgreSQL und Azurite (Blob-Storage-Emulator) auf http://localhost:3000, die Patienten-Zone (eigenes Image, Rolle `patient_zone`) auf http://localhost:3100. Migrationen und die Rolle laufen vorher im Dienst `migrate` (`PATIENT_ZONE_DB_PASSWORD`, Vorgabe `patient_zone`), die Mails liegen im Volume `outbox` (`docker compose exec app ls data/outbox`).

Mit echter Entra-Anmeldung: `AUTH_MICROSOFT_ENTRA_ID_ID`, `_SECRET` und `_TENANT_ID` in `.env` setzen und `http://localhost:3000/api/auth/callback/microsoft-entra-id` als Redirect-URI in der App-Registrierung eintragen ([entra.md](entra.md)).

## Tests

| Befehl | Was |
| --- | --- |
| `npm run lint`, `npm run typecheck`, `npx prettier --check .` | statische Prüfungen |
| `npm test` | Unit- und Datenbanktests (Vitest) gegen `pain_therapy_test`, auch für `packages/shared` und `apps/patient-zone`; die Datenbank wird bei jedem Lauf migriert und geleert, der Name muss auf `_test` enden. Die Tests der Zone und `tests/unit/patient-zone-role.test.ts` legen die Rolle `patient_zone` an (der Testbenutzer braucht `CREATEROLE`, sonst laufen sie mit dem Testbenutzer bzw. werden übersprungen) |
| `npm run test:e2e` | Playwright gegen `npm run dev` und `npm run dev:zone` (oder laufende Server auf Port 3000 und 3100): Anmeldung und Zugriff, Patientenverwaltung, Unterschrift auf iPad-Grösse, Patienten-Zone auf Telefon-Grösse (390 px), Barrierefreiheit (axe, WCAG 2.1 AA), Screenshots in `test-results/screenshots/` für iPhone, iPad und Desktop. Die Zone braucht die Rolle `patient_zone` mit Passwort `PATIENT_ZONE_DB_PASSWORD` (Vorgabe `patient_zone`); die Mails mit dem Link landen in `data/e2e-outbox/` |

Die Testdatenbank einmal anlegen: `docker compose exec db createdb -U app pain_therapy_test`.

## Datenbank ändern

```bash
# schema.prisma anpassen, dann
npm run db:dev -- --name <beschreibung>   # erzeugt eine neue Migration
```

Die Trigger in der ersten Migration verhindern Änderungen und Löschungen an `AuditEvent`, `SignedDocument`, `ConsentTextVersion` und `Consent` sowie das Löschen von Patient:innen. Die Migrationen aus Iteration 2 verhindern zusätzlich das Löschen von Katalogeinträgen, Behandlungen, Konsultationen und Fotos. Neue Migrationen bleiben additiv.

## Therapiekatalog ändern

Bereiche, Osteopressur-Punkte, Engpassdehnungen, Rollwerkzeuge und die Übungsblätter (Dateinamen, Schritte, Zeitbedarf) stehen in `prisma/catalog/` (JSON und CSV, Herkunft in `openspec/changes/iteration-2-treatments/reference/README.md`). Nach einer Änderung `npm run catalog:sync`: Das Skript schreibt nur geänderte Zeilen und löscht nichts. Was aus den Dateien verschwindet, bekommt `retiredAt`, erscheint nicht mehr auf neuen Bögen und bleibt in bestehenden Konsultationen sichtbar. Ein Eintrag, der wieder in den Dateien steht, wird reaktiviert.

## Aufbau

```
src/app/            Seiten (App Router) und Server Actions
  (app)/            angemeldeter Bereich: Dashboard, Patient:innen, Behandlungen, Konsultationen, Katalog, Formulartexte
  api/photos/[id]/  Auslieferung der Fotos (und /thumb) nur mit Anmeldung, ohne Cache
  api/exercise-media/[code]/[main|sheet]/  Bilder der Übungsblätter, nur mit Anmeldung
  (app)/patients/[id]/treatments/[tid]/consultations/[cid]/handout/  Abschluss: Übungsblatt senden oder drucken
  (app)/catalog/exercises/[code]/  Übung im Katalog
  documents/[id]/   PDF-Auslieferung mit Prüfsumme
src/lib/            Dienste: Patient:innen, Unterschrift, PDF, Ablage, Mail, Audit, Zugriff
src/components/     UI-Bausteine (Formular, Unterschriftsfeld, Dialoge)
messages/           Texte Deutsch und Englisch
prisma/             Schema, Migrationen, Seed, Therapiekatalog (catalog/) und migrate.sh für den Migrationsjob
infra/              Azure Bicep
tests/unit, tests/e2e
packages/shared/    gemeinsamer Code beider Apps: Zeit (Schweizer Zeit), Token, Zugangsregeln, Einhaltung, Einträge
apps/patient-zone/  Patienten-Zone (eigene Next.js-App, eigenes Image, Rolle patient_zone)
```
