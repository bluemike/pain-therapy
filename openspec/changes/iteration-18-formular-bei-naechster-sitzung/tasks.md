# Tasks

## 1. Datenmodell

- [ ] 1.1 `ConsentTextVersion.resignRequired` (bestehende `true`), `Patient.signatureRequiredVersion`; Rolle `patient_zone` darf beide lesen

## 2. Logik

- [ ] 2.1 Verlangte Version (D1) in `packages/shared/src/signing.ts`, genutzt von Cockpit, Liste, Akte, `openingBlocker` und Zone
- [ ] 2.2 `openingBlocker(…, { forNewVisit: true })` setzt die verlangte Version (D2), Audit `consent.resignRequested`

## 3. Oberfläche

- [ ] 3.1 «Formulartexte»: Auswahl beim Veröffentlichen, zwei Zahlen im Hinweis
- [ ] 3.2 Akte: Hinweis «neue Version bei der nächsten Behandlung oder Sitzung»

## 4. Test

- [ ] 4.1 Unit: Version mit/ohne `resignRequired`, Auslöser bei neuer Sitzung, Zone ohne Umleitung
- [ ] 4.2 Abnahme durch Mike
