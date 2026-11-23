# Proposal

## Why

Mike Franz hat am 23.11.2026 drei Wünsche formuliert:

1. **Datenschutzhinweis:** Die Vorlage einer anderen Praxis (Datenschutz.pdf) ist in einigen Punkten vollständiger als unser Text im Unterschriftsformular (Zwecke, Datensicherheit, externe Dienstleister, Recht auf Löschung, Gelegenheit für Fragen, verantwortliche Person mit Kontakt). Unser Text ist dafür präziser bei Aufbewahrung (20 Jahre), Inkasso, Kopie und Bestreitungsvermerk und der Einwilligung für unverschlüsselte E-Mail. Mike will eine «Symbiose» aus beiden, mit Feldern wie «Praxisname», die die App aus den Praxisangaben ausfüllt.
2. **Plattform-Admin:** Pro Praxis sehen, wann sie zuletzt angemeldet war, wann sie zuletzt etwas geändert hat, und wie viele Patientinnen und Patienten, Behandlungen und Sitzungen erfasst sind. Angefangene zählen nicht.
3. **Freemium-Limite:** Jede Praxis kann 20 Patientinnen und Patienten behandeln. Danach endet Freemium und die Praxis braucht ein Premium-Modell (kommerzielle Bedingungen noch offen). Die Modelle verwaltet der Plattform-Admin (Freemium 20, Unlimited, später weitere).

## What Changes

- **Neue Vorlage für das Unterschriftsformular** mit dem zusammengeführten Datenschutzhinweis (Deutsch und Englisch, Sie-Form), Text siehe `design.md` D2.
- **Felder im Formulartext:** `«Praxisname»`, `«Adresse»`, `«E-Mail»`, `«Telefon»`, `«Verantwortliche Person»` (englisch `«Practice name»`, `«Address»`, `«Email»`, `«Phone»`, `«Responsible person»`). Die App setzt beim Anzeigen und im unterschriebenen PDF die aktuellen Praxisangaben ein. Unter «Formulartexte» sieht die Praxis-Admin die Liste der Felder und eine Vorschau mit ihren Werten. Unbekannte Felder verhindern das Veröffentlichen.
- **Neues Praxisfeld «Verantwortliche Person (Datenschutz)»** unter «Praxisangaben», vorbelegt mit dem Namen der ersten Praxis-Admin.
- **Bestehende Praxen** erhalten die Vorlage nicht automatisch (eine neue Version verlangt von allen Patientinnen und Patienten eine neue Unterschrift). Sie sehen unter «Formulartexte» den Hinweis «Neue Vorlage verfügbar» und übernehmen sie mit einem Klick als neue Version. Neue Praxen starten mit der neuen Vorlage als Version 1.
- **Datenschutzhinweis der Patienten-Zone** erhält dieselben Inhalte (Zwecke, Schutz, Dienstleister, Löschung), solange die Praxis keinen eigenen Text hat.
- **Plattform-Übersicht pro Praxis:** «Zuletzt angemeldet», «Zuletzt geändert», Zähler «Patient:innen / Behandlungen / Sitzungen» (nur abgeschlossene, Regeln in D5), Modell und Auslastung («Freemium · 14 von 20»).
- **Modelle (Plan):** Neue Tabelle mit Name und Patientenlimite (leer = unbegrenzt). Vorhanden: «Freemium» (20, Standard für neue Praxen) und «Unlimited». Der Plattform-Admin weist jeder Praxis ein Modell zu und kann weitere Modelle anlegen.
- **Limite durchsetzen:** Ist die Limite erreicht, kann die Praxis keine neuen Patientinnen und Patienten mehr anlegen. Bestehende behandelt sie unverändert weiter. Ab 80 % sieht die Praxis-Admin einen Hinweis, bei 100 % eine Meldung mit Kontakt zur Plattform. Der Plattform-Admin erhält eine E-Mail, wenn eine Praxis die Limite erreicht.

## Nicht Teil dieser Änderung

- Preise, Zahlung, Rechnungen, Selbstbedienung beim Wechsel auf Premium (Commercial Terms to be discussed).
- Limiten für andere Grössen (Therapeut:innen, Speicher, SMS).
- Statistiken über die Zeit (Verläufe, Diagramme); die Übersicht zeigt den aktuellen Stand.
- Rechtliche Prüfung des neuen Textes (bleibt Aufgabe der Praxis, wie bisher Task 6.1 von Iteration 5).

## Impact

- Datenbank: `Plan` (id, name, patientLimit?, sortOrder, active), `Practice.planId` (Standard Freemium), `Practice.planChangedAt`, `Practice.privacyOfficer`, `Practice.limitNotifiedAt`; `SignatureSession.fieldValues` (eingesetzte Werte beim Unterschreiben).
- Geteiltes Paket: `packages/shared/consent-fields.ts` (Felder ersetzen, prüfen), genutzt von Praxis-App, Patienten-Zone und PDF.
- Praxis-App: «Formulartexte» (Feldliste, Vorschau, Hinweis neue Vorlage), «Praxisangaben» (Verantwortliche Person, Modell und Auslastung lesend), «Neuer Patient» (Limite), Plattform-Seite (Spalten, Modell zuweisen, Modelle verwalten).
- Patienten-Zone: Unterschriftsformular mit eingesetzten Feldern, Datenschutzhinweis-Vorlage.
- Keine neue Infrastruktur.
- Aufwand geschätzt: 3 bis 4 Personentage.

Mockup: `mockups/iteration-17.html` (online: https://claude.ai/artifact/CFEbeQqVcb2VjpdZVn1pbR)
