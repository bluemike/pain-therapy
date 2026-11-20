# Sicherheitsreview Iteration 12 (Aufgabe 7.4)

Stand 19.11.2026, vor dem Anlegen der ersten fremden Praxis. Geprüft wurde der Code der Draft-PR (Phasen 1 bis 6), nicht die laufende Produktion.

## Trennung der Praxen

| Prüfung | Ergebnis |
| --- | --- |
| Jede Tabelle mit `practiceId` hat Row-Level Security mit Policy | ja, ausser `Invitation`, `PracticeMembership` (Anmeldung sucht per E-Mail, bevor die Praxis feststeht; `src/lib/team.ts` filtert jede Abfrage nach Praxis) und `PendingBlobDeletion` (keine Rechte für `practice_app`). Unit-Test `tenancy.test.ts` schlägt fehl, sobald eine neue Tabelle mit `practiceId` ohne Policy dazukommt. |
| `practice_app` umgeht RLS nicht | kein Eigentümer, kein `BYPASSRLS`, kein Superuser (Unit-Test) |
| Abfrage ohne Praxis | liefert nichts (Unit-Test) |
| Schreiben in fremde Praxis | abgelehnt (Unit-Test) |
| Seiten, Dateien und APIs mit IDs der fremden Praxis | 404 bzw. 403, nie Inhalt (E2E `isolation.spec.ts`: Akte, Bearbeiten, Behandlung, Sitzung, Übungsblatt, PDF, Foto, Vorschaubild, Einwilligungsstatus, Export) |
| E2E läuft wie in Azure als `practice_app` | **Befund, behoben:** E2E und CI liefen bisher als Tabelleneigentümer, für den RLS nicht gilt. Der neue Trennungstest zeigte das sofort (die fremde Praxis sah die Patientin). `playwright.config.ts` startet die Praxis-App jetzt als `practice_app` mit `DATABASE_ADMIN_URL` für den Eigentümer, CI legt die Rolle an. |
| Patienten-Zone | Praxis nur über Link bzw. Sitzung (`zone_practice_of_link`, `zone_practice_of_session`); gesperrte und gelöschte Praxen ergeben keine Praxis, die Zone zeigt dann «Link ungültig». |
| Export-Download | nur Praxis-Admin der eigenen Praxis oder Plattform-Admin, nur 24 Stunden, `no-store` |
| Praxis löschen | nur Plattform-Admin, nur gesperrte Praxis mit Export der letzten 7 Tage und Bestätigung per Kurzname; Funktion `platform_purge_practice` ist für `practice_app` nicht ausführbar (Unit-Test) |

## Anmeldung und Rechte

- Rollen, Praxis und Praxisstatus werden bei jeder Anfrage aus der Datenbank gelesen; eine gesperrte Praxis meldet ihre Mitglieder ab.
- Team-Aktionen: nur Praxis-Admin, alle Änderungen auf die eigene Praxis beschränkt, letzte Praxis-Admin kann nicht entfernt werden, Personen mit aktiver Mitgliedschaft in einer anderen Praxis können nicht eingeladen werden.
- Plattform-Seiten und -Aktionen: `requirePlatformAdmin()`; der Plattform-Admin sieht keine Patientendaten (keine Praxis im Kontext).
- Entwickler-Anmeldung ist in Azure immer aus (`CONTAINER_APP_NAME`).
- Alte Hostnamen leiten auf `AUTH_URL` weiter, damit Passkeys und Cookies an genau einem Host hängen.

## Mail

- Nur Links, keine Gesundheitsdaten und keine Anhänge; Betreff und Text nennen nur die Praxis.
- Absender fest `noreply@pain-therapy.online`, Anzeigename = Praxisname (Nodemailer kodiert ihn), Reply-To = geprüfte Kontaktadresse der Praxis.

## Härtung in diesem Review

- `/api/patients/[id]/consent-state` antwortete für fremde IDs mit 200 und einem leeren Status (keine Daten, aber kein «nicht gefunden»); jetzt 404.
- `practice_app` darf den Therapiekatalog nur lesen (`REVOKE INSERT, UPDATE, DELETE`); geschrieben wird er nur von `catalog:sync` als Eigentümer.

## Verbleibende Risiken (bewusst akzeptiert)

- `practice_app` hat Schreibrechte auf `User`, `Passkey`, `RecoveryCode`, `LoginCode`, `Invitation`, `PracticeMembership` und `Practice`, weil die Anmeldung vor der Praxiswahl darauf zugreift. Ein Fehler im Code der Anmeldung oder des Teams könnte praxisübergreifend wirken. Gegenmassnahmen: Prisma (keine SQL-Injektion), explizite Praxis-Filter in `team.ts`, Tests. Eine eigene Rolle nur für die Anmeldung wäre der nächste Schritt, falls nötig.
- Lokale Entwicklung und `docker compose` laufen weiterhin als Eigentümer, also ohne RLS. Massgeblich für die Trennung sind E2E und CI.
- Bicep konnte in dieser Umgebung nicht kompiliert werden; der erste Workflow-Lauf oder `az deployment group what-if` prüft es.
