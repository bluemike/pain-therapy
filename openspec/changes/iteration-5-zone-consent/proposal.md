# Proposal

## Why

Seit Iteration 1 unterschreibt die Patientin den Haftungsausschluss mit Patienteninformation und Datenschutzhinweis auf dem iPad der Praxis. Damit niemand sonst in die App schaut, verlässt die Therapeutin den Patientenmodus nur mit einer neuen Anmeldung über Entra ID. Das ist bei jeder Aufnahme und bei jeder neuen Textversion mühsam. Seit Iteration 4 hat jede Patientin mit einem persönlichen Link und dem Geburtsdatum einen eigenen, sicheren Zugang. Die Praxis wünscht (Anfrage von Mike Franz), die Patienten-Zone auszubauen: Als erster Schritt, noch vor den Übungen, unterschreibt die Patientin dort den Haftungsausschluss auf dem eigenen Telefon.

## What Changes

- **Einladung zur Unterschrift:** Nach der Aufnahme oder wenn eine neue Textversion gilt, lädt die Praxis die Patientin mit "Zur Unterschrift einladen" in die Patienten-Zone ein: per E-Mail an die erfasste Adresse oder als QR-Code am Bildschirm der Praxis, den die Patientin mit dem eigenen Telefon scannt. Ein Zugangsblatt zum Ausdrucken bleibt möglich.
- **Link auch ohne Heimprogramm:** Der Zugangslink aus Iteration 4 gilt neu auch, solange eine Unterschrift aussteht, nicht nur während eines aktiven Heimprogramms. Bestätigung mit dem Geburtsdatum, Sperren und Gerätesitzung bleiben unverändert.
- **Unterschrift zuerst:** Solange eine Unterschrift aussteht, zeigt die Patienten-Zone nur die Aufgabe "Haftungsausschluss unterschreiben". Übungen und Übungstagebuch erscheinen erst nach der Unterschrift.
- **Unterschreiben in der Patienten-Zone:** Dasselbe Formular wie auf dem iPad, für das Telefon gestaltet: Personalien prüfen mit Anmerkung, Text der gültigen Version in der Sprache der Patientin, Lesen bis zum Ende, Pflicht-Einwilligungen, optionale Einwilligung in unverschlüsselte E-Mail, Unterschrift mit dem Finger, Bestätigung.
- **PDF, Archiv und Zustellung wie bisher:** Die Praxis-App erzeugt nach jeder Unterschrift in der Patienten-Zone das unveränderbare PDF, archiviert es in der Akte und stellt es wie in Iteration 1 per E-Mail zu oder bietet es zum Ausdrucken an. Die Patienten-Zone selbst erhält keinen Zugriff auf Dokumente.
- **Status für die Praxis:** Die Akte und die Liste "Unterschrift ausstehend" im Cockpit zeigen, ob die Patientin eingeladen ist, den Link geöffnet oder unterschrieben hat und ob sie Personalien angemerkt hat.
- **iPad bleibt als Ausweg:** Der Patientenmodus auf dem iPad aus Iteration 1 bleibt unverändert für Patientinnen ohne Telefon oder E-Mail.

**Nicht im Umfang (Out of scope), siehe docs/roadmap.md:**
- Anamnese durch die Patientin ausfüllen lassen (Fragebogen in der Patienten-Zone).
- Selbstregistrierung neuer Patientinnen ohne Erfassung durch die Praxis.
- Personalien durch die Patientin direkt ändern; sie kann sie nur anmerken.
- Qualifizierte elektronische Signatur; es bleibt bei der einfachen elektronischen Unterschrift wie auf dem iPad.
- Erinnerungen an eine ausstehende Unterschrift.
- Weitere Dokumente zur Unterschrift (zum Beispiel Behandlungsverträge).

## Capabilities

### New Capabilities
- `zone-consent-invitation`: Einladung zur Unterschrift aus der Akte per E-Mail oder QR-Code, Gültigkeit des Links bei ausstehender Unterschrift, Status der Einladung in Akte und Cockpit.
- `zone-consent-signing`: Unterschrift des Haftungsausschlusses in der Patienten-Zone mit Vorrang vor den Übungen, Formular für das Telefon, Übergabe an die Praxis-App für PDF, Archiv und Zustellung, Datenrechte der Patienten-Zone dafür.

### Modified Capabilities
- Keine geänderten Anforderungen in `openspec/specs/`. Die Changes der Iterationen 1 bis 4 sind noch nicht archiviert, `openspec/specs/` ist leer; MODIFIED-Deltas gegen sie lassen sich erst nach dem Archivieren validieren (wie in Iteration 4). Inhaltlich erweitert diese Iteration drei Anforderungen früherer Iterationen; die neuen Regeln stehen in den neuen Capabilities:
  - `patient-access` (Iteration 4), "Gültigkeit des Links": gilt zusätzlich bei ausstehender Unterschrift.
  - `patient-zone-app` (Iteration 4), "Rechte der Rolle patient_zone": liest zusätzlich die Personalien, die das Formular zur Prüfung zeigt, die gültige Textversion und schreibt die Unterschrift.
  - `consent-signing` (Iteration 1), "Unterschriftsablauf starten": zusätzlich als Einladung in die Patienten-Zone.

## Impact

- Datenmodell: `SignatureSession` bekommt einen Kanal (iPad oder Patienten-Zone), die Sitzung der Patienten-Zone und den Zeitpunkt der PDF-Erzeugung; neue Tabelle für Einladungen ist nicht nötig, die Zustellung nutzt `AccessLinkDelivery` mit einem Zweck. Prisma-Migration nur additiv.
- Patienten-Zone (`apps/patient-zone`): neue Seiten für Aufgabe, Formular und Bestätigung; gemeinsamer Unterschriftscode (`src/lib/signature.ts`, Formular-Logik) wandert nach `packages/shared`.
- Praxis-App: "Zur Unterschrift einladen" in der Akte und nach der Aufnahme, interner Endpunkt und Hintergrundlauf, die unterschriebene Sitzungen der Patienten-Zone zu PDF, Archiv und E-Mail verarbeiten.
- Rolle `patient_zone` (`prisma/patient-zone-role.sql`): zusätzliche Spaltenrechte; der Rechte-Test wird erweitert.
- Betrieb: ein gemeinsames Secret zwischen den beiden Apps für den internen Aufruf und ein geplanter Container-Apps-Job als Rückfall; beide in `infra/main.bicep`.
- E-Mail: neuer Text "Bitte unterschreiben Sie den Haftungsausschluss" (de und en) aus `pain-therapy@ayanta.ch`.
