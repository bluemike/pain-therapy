# Design

## Context

Es gibt noch keinen Code. Fachliche Grundlage sind die Praxisformulare (Zusammenfassungen in `docs/research/`), für Iteration 1 vor allem der Anamnesebogen (Seite 2), die Patienteninformation (Seite 5) und der Datenschutzhinweis (Seite 6) aus `pdf3-anamnese-formulare.md`. Vorgaben von Ayanta: Betrieb im Ayanta-Azure-Container unter `pain-therapy.ayanta.ch`, Anmeldung über Ayanta Entra ID, Design nach ayanta.ch. Motivation siehe proposal.md.

## Goals / Non-Goals

**Goals:**
- Ein tragfähiges Grundgerüst, auf das spätere Iterationen (Behandlungsbogen, Heimprogramm, Verlauf) ohne Umbau aufsetzen.
- Daten und Dokumente ausschliesslich in Azure Switzerland North.
- Eine Codebasis, die auf Desktop, iPad und iPhone im Browser läuft und später als PWA oder native Hülle genutzt werden kann.

**Non-Goals:**
- Offline-Betrieb.
- Zugang für Personen ausserhalb des Ayanta-Tenants.
- Native Apps.

## Decisions

### D1: Next.js mit TypeScript als Fullstack
Next.js (App Router, React Server Components, Server Actions) für Oberfläche und Server in einer Codebasis und einem Container. Formulare werden mit zod auf Client und Server mit denselben Schemas validiert.
*Alternativen:* getrenntes React-SPA plus .NET-API (passt zu Azure, verdoppelt aber Build und Deployment); Django (zweite Sprache neben dem Frontend).

### D2: Azure Container Apps in Switzerland North
Ein Docker-Image, gebaut in GitHub Actions und in die Azure Container Registry geschoben, läuft als Azure Container App mit eigener Domain `pain-therapy.ayanta.ch` und verwaltetem TLS-Zertifikat. Geheimnisse liegen in Azure Key Vault, die App greift per Managed Identity auf Datenbank, Blob Storage und Key Vault zu.
*Alternative:* Azure App Service for Containers; ebenfalls möglich, falls der bestehende Ayanta-Container das ist. Die Specs ändern sich dadurch nicht.

### D3: Azure Database for PostgreSQL (Flexible Server) mit Prisma
Relationales Modell, weil spätere Iterationen (Katalog, Behandlungen) stark relational sind. Prisma für Schema und Migrationen; Migrationen laufen beim Deployment als eigener Job vor dem Start der neuen Version.

### D4: Anmeldung mit Auth.js und Microsoft Entra ID
Auth.js mit dem Provider Microsoft Entra ID, Single-Tenant (nur der Ayanta-Tenant, Gastkonten werden über den `acct`-Claim abgewiesen). Die Rollen kommen als App-Rollen `Therapist` und `Admin` im ID-Token (`roles`-Claim). Die Sitzung läuft 30 Minuten gleitend. Zum Verlassen des Patientenmodus wird eine neue Anmeldung mit `prompt=login` erzwungen.
*Alternative:* Easy Auth der Container App; verworfen, weil die erneute Anmeldung für den Patientenmodus und die Rollenprüfung in der App ohnehin nötig sind.

### D5: Datenmodell Iteration 1
- `Patient` (Personalien, `preferredLanguage`, `status` aktiv/inaktiv, `deactivatedAt`, `deactivationReason`)
- `Anamnesis` (medizinische Angaben, 1:1 zum Patienten in Iteration 1)
- `ConsentTextVersion` (Version, Sprache, Text in Markdown, veröffentlicht am)
- `SignatureSession` (Patient, Textversion, Status offen/abgebrochen/unterschrieben, Anmerkung des Patienten)
- `Consent` (Art, erteilt ja/nein, Zeitpunkt, `SignatureSession`)
- `SignedDocument` (Blob-Pfad, SHA-256, Dokumentnummer, `isCurrent`)
- `EmailDelivery` (Empfänger, Status, Versuche, Fehler)
- `AuditEvent` (Benutzer, Zeitpunkt, Patient, Aktion, vorher/nachher), nur anfügbar

Alle Schreibzugriffe laufen über eine Service-Schicht, die `AuditEvent` schreibt; so entstehen Änderungshistorie und Zugriffsprotokoll an einer Stelle.

### D6: Unterschrift mit perfect-freehand
Das Unterschriftsfeld zeichnet Pointer-Events (Finger und Apple Pencil, mit Druck) mit `perfect-freehand` zu glatten Strichen. Gespeichert werden die Rohpunkte (JSON) und ein daraus erzeugtes SVG; das SVG geht ins PDF. Das Scrollen bis zum Ende wird per IntersectionObserver auf einem Element am Textende erkannt.

### D7: PDF mit @react-pdf/renderer
Das PDF wird serverseitig mit `@react-pdf/renderer` aus denselben Texten erzeugt, die der Patient gesehen hat, und mit eingebetteten Ayanta-Schriften gesetzt. Das braucht keinen Browser im Container.
*Alternative:* HTML mit Chromium rendern; verworfen, weil es das Image stark vergrössert.

### D8: Dokumentarchiv in Azure Blob Storage
PDFs liegen in einem Container mit unveränderlicher Aufbewahrung (Immutable Storage, zeitbasierte Retention) und Versionierung. In der Datenbank stehen Pfad und SHA-256.

### D9: E-Mail über Microsoft Graph
Versand über Microsoft Graph `sendMail` aus einem Ayanta-Postfach (z. B. `pain-therapy@ayanta.ch`) mit Anwendungsberechtigung, beschränkt per Application Access Policy auf dieses eine Postfach. Der Versand läuft nach dem Speichern der Unterschrift asynchron mit bis zu 3 Wiederholungen; das Ergebnis steht in `EmailDelivery`.
*Alternative:* Azure Communication Services Email; braucht eine zusätzliche Domainverifizierung.

### D10: i18n mit next-intl
Übersetzungen als JSON pro Sprache (`messages/de.json`, `messages/en.json`), Sprache pro Benutzer in einem Cookie und in der Datenbank. Ein Test im Build vergleicht die Schlüssel beider Dateien. Formulartexte für Patienten liegen nicht in den JSON-Dateien, sondern versioniert in `ConsentTextVersion`.

### D11: UI mit Tailwind CSS und Design-Tokens
Tailwind CSS mit Design-Tokens (Farben, Schriften, Abstände), die aus ayanta.ch übernommen werden; Bausteine auf Basis von Radix UI für zugängliche Dialoge und Menüs. Das Ayanta-Logo liegt als SVG in Schwarz und Weiss vor.

## Risks / Trade-offs

- [Gesundheitsdaten per unverschlüsselter E-Mail] → Versand nur mit ausdrücklicher Einwilligung im Formular; ohne Einwilligung Ausdruck.
- [Ein geteiltes iPad zeigt Daten anderer Patienten] → Patientenmodus ohne Navigation; Verlassen nur nach erneuter Anmeldung.
- [Erneute Entra-Anmeldung auf dem iPad ist umständlich] → Mit der Praxis testen; als Alternative eine Freigabe per Authenticator-Push prüfen.
- [Formulartexte gehören der Praxis und liegen nur auf Deutsch vor] → Englische Übersetzung und rechtliche Prüfung vor dem Go-live einplanen (Aufgabe in tasks.md).
- [Farbwerte von ayanta.ch sind nicht dokumentiert] → Tokens aus dem Stylesheet von ayanta.ch übernehmen und von Ayanta abnehmen lassen.

## Migration Plan

Neuanlage ohne Datenübernahme. Reihenfolge: Azure-Ressourcen und Entra-App-Registrierung anlegen, DNS-Eintrag für `pain-therapy.ayanta.ch` setzen, erstes Deployment mit leerer Datenbank. Rollback durch Aktivieren der vorherigen Revision der Container App; Datenbankmigrationen sind in Iteration 1 nur additiv.

## Open Questions

- Ob der bestehende Ayanta-Container eine Azure Container App oder ein App Service ist (ändert nur die Pipeline).
- Welches Postfach als Absender dient.
- Welcher Ort ("Mettmenstetten" oder "Zürich") auf dem PDF steht; vorerst wählbar pro Benutzer.
