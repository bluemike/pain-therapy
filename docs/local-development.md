# Lokal entwickeln

Voraussetzungen: Node.js 22, Docker (für PostgreSQL), für die Playwright-Tests Chromium (`npx playwright install chromium`).

## Schnellstart

```bash
cp .env.example .env                      # AUTH_SECRET setzen: openssl rand -base64 32
docker compose up -d db                   # PostgreSQL 16 auf localhost:5432 (app/app)
npm install
npx prisma migrate deploy                 # Tabellen und Schutz-Trigger anlegen
npm run catalog:sync                      # Therapiekatalog aus prisma/catalog/ einspielen (auch Teil von db:seed)
SEED_DEMO=true npm run db:seed            # optional: Formulartexte, Katalog und 4 Beispiel-Patient:innen
npm run dev                               # http://localhost:3000
```

Mit `AUTH_DEV_LOGIN=true` zeigt die Anmeldeseite zusätzlich die **Entwickler-Anmeldung**: Name, Rolle (Therapeut:in, Administration, keine) und Kontoart (Ayanta, Gast, fremder Tenant) frei wählbar. Damit lassen sich alle Zugriffsfälle durchspielen. In Azure ist sie immer aus.

Mails landen als `.json` mit dem PDF-Anhang daneben in `data/outbox/`, unterschriebene PDFs in `data/documents/`, Fotos von Behandlungen und Konsultationen in `data/clinical-photos/` (`STORAGE_PHOTO_LOCAL_DIR`). Neue Behandlungen und Konsultationen gibt es nur für aktive Patient:innen mit gültig unterschriebenem Haftungsausschluss; lokal also zuerst über *An Patient:in übergeben* unterschreiben. Das iPad lässt sich im Browser mit den Entwicklerwerkzeugen (Gerätesimulation) oder mit einem echten iPad im selben Netz (`http://<rechner-ip>:3000`) testen.

## Wie in Produktion

`docker compose up --build` baut das Produktions-Image und startet es mit PostgreSQL und Azurite (Blob-Storage-Emulator) auf http://localhost:3000. Migrationen laufen vorher im Dienst `migrate`, die Mails liegen im Volume `outbox` (`docker compose exec app ls data/outbox`).

Mit echter Entra-Anmeldung: `AUTH_MICROSOFT_ENTRA_ID_ID`, `_SECRET` und `_TENANT_ID` in `.env` setzen und `http://localhost:3000/api/auth/callback/microsoft-entra-id` als Redirect-URI in der App-Registrierung eintragen ([entra.md](entra.md)).

## Tests

| Befehl | Was |
| --- | --- |
| `npm run lint`, `npm run typecheck`, `npx prettier --check .` | statische Prüfungen |
| `npm test` | Unit- und Datenbanktests (Vitest) gegen `pain_therapy_test`; die Datenbank wird bei jedem Lauf migriert und geleert, der Name muss auf `_test` enden |
| `npm run test:e2e` | Playwright gegen `npm run dev` (oder einen laufenden Server auf Port 3000): Anmeldung und Zugriff, Patientenverwaltung, Unterschrift auf iPad-Grösse, Barrierefreiheit (axe, WCAG 2.1 AA), Screenshots in `test-results/screenshots/` für iPhone, iPad und Desktop |

Die Testdatenbank einmal anlegen: `docker compose exec db createdb -U app pain_therapy_test`.

## Datenbank ändern

```bash
# schema.prisma anpassen, dann
npm run db:dev -- --name <beschreibung>   # erzeugt eine neue Migration
```

Die Trigger in der ersten Migration verhindern Änderungen und Löschungen an `AuditEvent`, `SignedDocument`, `ConsentTextVersion` und `Consent` sowie das Löschen von Patient:innen. Die Migrationen aus Iteration 2 verhindern zusätzlich das Löschen von Katalogeinträgen, Behandlungen, Konsultationen und Fotos. Neue Migrationen bleiben additiv.

## Therapiekatalog ändern

Bereiche, Osteopressur-Punkte, Engpassdehnungen und Rollwerkzeuge stehen in `prisma/catalog/` (JSON und CSV, Herkunft in `openspec/changes/iteration-2-treatments/reference/README.md`). Nach einer Änderung `npm run catalog:sync`: Das Skript schreibt nur geänderte Zeilen und löscht nichts. Was aus den Dateien verschwindet, bekommt `retiredAt`, erscheint nicht mehr auf neuen Bögen und bleibt in bestehenden Konsultationen sichtbar. Ein Eintrag, der wieder in den Dateien steht, wird reaktiviert.

## Aufbau

```
src/app/            Seiten (App Router) und Server Actions
  (app)/            angemeldeter Bereich: Dashboard, Patient:innen, Behandlungen, Konsultationen, Katalog, Formulartexte
  api/photos/[id]/  Auslieferung der Fotos (und /thumb) nur mit Anmeldung, ohne Cache
  sign/             Patientenmodus auf dem iPad
  documents/[id]/   PDF-Auslieferung mit Prüfsumme
src/lib/            Dienste: Patient:innen, Unterschrift, PDF, Ablage, Mail, Audit, Zugriff
src/components/     UI-Bausteine (Formular, Unterschriftsfeld, Dialoge)
messages/           Texte Deutsch und Englisch
prisma/             Schema, Migrationen, Seed, Therapiekatalog (catalog/) und migrate.sh für den Migrationsjob
infra/              Azure Bicep
tests/unit, tests/e2e
```
