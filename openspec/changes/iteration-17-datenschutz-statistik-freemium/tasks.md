# Tasks

## 1. Datenmodell (0.5 PT)

- [x] 1.1 `Plan` mit Seed `freemium` (20) und `unlimited` (leer); `Practice.planId`, `planChangedAt`, `planChangedBy`, `limitNotifiedAt`, `privacyOfficer`, `templateSeen`
- [x] 1.2 Migration: `prc_falera` auf `unlimited`, übrige auf `freemium`; `privacyOfficer` aus der ersten aktiven Praxis-Admin
- [x] 1.3 `SignatureSession.fieldValues Json?`

## 2. Felder im Formulartext (1 PT)

- [x] 2.1 `packages/shared/consent-fields.ts`: `fillFields`, `unknownFields`, Regeln für leere Felder (D1), Unit-Tests
- [x] 2.2 Felder einsetzen auf dem iPad, in der Patienten-Zone und im PDF; Werte in `fieldValues` speichern (umgesetzt: gespeichert beim Erstellen des PDFs, das den Text festhält)
- [x] 2.3 «Formulartexte»: Feldliste mit Werten, Vorschau, Prüfung beim Veröffentlichen
- [x] 2.4 Neue Vorlage (D2) als `INITIAL_TEXTS` de/en, `TEMPLATE_VERSION`; Hinweis «Neue Vorlage verfügbar» mit Übernehmen, Nicht übernehmen (umgesetzt: «Vorlage ansehen» zeigt den ganzen Text statt einer Vergleichstabelle)
- [x] 2.5 «Verantwortliche Person» in Praxisangaben und Plattform-Formular
- [x] 2.6 Vorlage des Zonen-Datenschutzhinweises (Übersetzungen) inhaltlich angleichen

## 3. Plattform-Statistik (0.5 PT)

- [x] 3.1 `practicesOverview`: zuletzt angemeldet (mit Name), zuletzt geändert (D6), Zähler (D5), Modell und Auslastung
- [x] 3.2 Darstellung in den Praxiskarten, Markierung «inaktiv seit 30 Tagen»

## 4. Modelle und Limite (1 PT)

- [x] 4.1 Bereich «Modelle» auf der Plattform-Seite (anlegen, ändern, deaktivieren) und Modell pro Praxis zuweisen, Audit `practice.planChanged`
- [x] 4.2 Limite in `createPatient` und auf «Neuer Patient», Hinweise ab 80 % und bei 100 %
- [x] 4.3 E-Mail an den Plattform-Admin beim Erreichen der Limite

## 5. Test und Abnahme (0.5 PT)

- [x] 5.1 E2E: Felder in Vorschau und PDF, unbekanntes Feld, Limite bei 20 (Testpraxis), Zähler zählen angefangene nicht
- [x] 5.2 Doku (`docs/`) zu Modellen und Feldern
- [ ] 5.3 Abnahme durch Mike: neue Vorlage für Falera übernehmen, Plattform-Übersicht prüfen
