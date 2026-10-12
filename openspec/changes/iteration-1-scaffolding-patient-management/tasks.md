# Tasks

## 1. Projektgerüst und Betrieb

- [ ] 1.1 Next.js-Projekt mit TypeScript, ESLint, Prettier, Vitest und Playwright anlegen; `npm run build` und `npm test` laufen durch
- [ ] 1.2 Dockerfile (Next.js standalone) und docker-compose mit PostgreSQL und Azurite für die lokale Entwicklung; `docker compose up` startet die App lokal
- [ ] 1.3 Prisma einrichten und erste Migration anlegen; `prisma migrate deploy` läuft gegen die lokale Datenbank
- [ ] 1.4 Azure-Ressourcen in Switzerland North als Bicep beschreiben (Container App, Container Registry, PostgreSQL, Blob Storage mit Immutable Storage, Key Vault, Managed Identity); `az deployment group what-if` läuft ohne Fehler
- [ ] 1.5 GitHub Actions: Lint, Typprüfung und Tests auf jedem PR; Build und Deployment auf `main` per OIDC; Workflow läuft auf einem PR grün
- [ ] 1.6 Domain `pain-therapy.ayanta.ch` mit verwaltetem Zertifikat einrichten und HTTP auf HTTPS umleiten; Aufruf über HTTP landet auf HTTPS

## 2. Anmeldung und Rollen (access-control)

- [ ] 2.1 Entra-App-Registrierung (Single-Tenant, App-Rollen Therapist und Admin) dokumentieren in docs/entra.md; Registrierung ist im Ayanta-Tenant angelegt
- [ ] 2.2 Auth.js mit Entra ID, Abweisung fremder Tenants und Gastkonten sowie Benutzer ohne Rolle umsetzen; Tests für fremdes Konto und fehlende Rolle
- [ ] 2.3 Rollenprüfung in Server Actions und Seiten umsetzen; Test, dass Therapeut:in die Formulartextverwaltung nicht aufrufen kann
- [ ] 2.4 Gleitende Sitzung von 30 Minuten und Abmelden umsetzen; Test mit simulierter Inaktivität
- [ ] 2.5 Audit-Service mit nur anfügbarem `AuditEvent` umsetzen; Test, dass Ansehen und Ändern einer Akte je einen Eintrag erzeugen

## 3. Oberfläche und Sprachen (app-shell, localization)

- [ ] 3.1 Design-Tokens (Farben, Schriften) und Logo von ayanta.ch übernehmen und von Ayanta abnehmen lassen
- [ ] 3.2 Layout mit Kopfzeile, Navigation und mobilem Menü umsetzen; Playwright-Screenshots auf iPhone-, iPad- und Desktop-Grösse
- [ ] 3.3 next-intl mit Deutsch und Englisch, Sprachwahl pro Benutzer und Schweizer Datumsformat umsetzen; Test, der fehlende Schlüssel in einer Sprache als Fehler meldet
- [ ] 3.4 Zugänglichkeitsprüfung mit axe in den Playwright-Tests einbauen; keine Verstösse der Stufe AA

## 4. Dashboard (dashboard)

- [ ] 4.1 Dashboard mit Begrüssung, Schnellaktionen und Suche umsetzen; Komponententest für die Begrüssung
- [ ] 4.2 Kacheln für Anzahl aktiver Patienten, zuletzt bearbeitete Patienten und "Unterschrift ausstehend" umsetzen; Test mit leerem System und mit einer offenen Unterschrift

## 5. Patientenverwaltung (patient-records)

- [ ] 5.1 Modelle `Patient` und `Anamnesis` mit zod-Schemas aus dem Anamnesebogen anlegen; Tests für Pflichtfelder, E-Mail-Format und "andere" mit Freitext
- [ ] 5.2 Formular "Neue Patientin / neuer Patient" mit Dublettenwarnung umsetzen; Test für die Dublette
- [ ] 5.3 Patientenliste mit Suche und Filter aktiv/inaktiv/alle umsetzen; Tests für Suche und Filter
- [ ] 5.4 Akte ansehen und ändern mit Änderungshistorie umsetzen; Test, dass eine geänderte Adresse alt und neu zeigt
- [ ] 5.5 Deaktivieren mit Grund und Reaktivieren umsetzen, ohne Löschfunktion; Test für beide Richtungen

## 6. Unterschrift auf dem iPad (consent-signing)

- [ ] 6.1 Formulartexte (Haftungsausschluss, Patienteninformation, Datenschutzhinweis) als erste Version auf Deutsch aus den Praxisformularen erfassen und auf Englisch übersetzen lassen; Texte rechtlich prüfen lassen
- [ ] 6.2 Verwaltung der Textversionen für Administration umsetzen; Test, dass eine neue Version ältere Unterschriften als "Neue Unterschrift nötig" markiert
- [ ] 6.3 Patientenmodus ohne Navigation, mit Verlassen nur nach erneuter Entra-Anmeldung umsetzen; Playwright-Test, dass andere Seiten im Patientenmodus nicht erreichbar sind
- [ ] 6.4 Formularansicht mit Personalien, Anmerkungsfeld, Scroll-bis-zum-Ende-Sperre und Einwilligungen umsetzen; Tests für gesperrtes Unterschriftsfeld und fehlende Pflicht-Einwilligung
- [ ] 6.5 Unterschriftsfeld mit perfect-freehand (Finger und Apple Pencil, Löschen, leeres Feld abweisen) umsetzen; manuell auf einem iPad testen
- [ ] 6.6 Abschluss mit Speicherung von Einwilligungen, Unterschrift, Ort und Zeit umsetzen; Test für den vollständigen Ablauf

## 7. Dokument und E-Mail (consent-documents)

- [ ] 7.1 PDF mit @react-pdf/renderer in der Sprache des Patienten erzeugen; Snapshot-Test des PDF-Textinhalts in Deutsch und Englisch
- [ ] 7.2 PDF im unveränderlichen Blob-Container mit SHA-256 archivieren und in der Akte unter "Dokumente" anzeigen; Test, dass Prüfsumme und Datei übereinstimmen
- [ ] 7.3 Versand über Microsoft Graph mit Einwilligungsprüfung, 3 Wiederholungen und erneutem Senden umsetzen; Tests für Versand, fehlende Einwilligung und Fehlschlag (Graph gemockt)

## 8. Gesamtprüfung

- [ ] 8.1 End-to-End-Test: anmelden, Patient anlegen, an Patient übergeben, lesen, unterschreiben, zurückgeben, PDF in der Akte, E-Mail-Versand vermerkt, deaktivieren
- [ ] 8.2 Abnahme mit der Praxis auf einem iPad unter https://pain-therapy.ayanta.ch

## Workflow follow-up

- Change nach der Abnahme mit `openspec archive iteration-1-scaffolding-patient-management` archivieren, damit die Specs nach `openspec/specs/` übernommen werden.
