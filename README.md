# pain-therapy

Web-App zur Verwaltung von Patientinnen und Patienten einer Praxis, die nach der Methode Liebscher & Bracht behandelt: Anamnese, Einwilligungen, Behandlungsbögen, Heimprogramm und Erfolgsprotokoll.

Das Projekt wird spezifikationsgetrieben mit [OpenSpec](https://github.com/Fission-AI/OpenSpec) entwickelt.

## Aufbau

- `openspec/config.yaml`: Projektkontext und Regeln für alle Spezifikationen.
- `openspec/changes/`: offene Änderungsvorschläge (Proposal, Specs, Design, Tasks).
- `openspec/specs/`: gültige Spezifikationen; sie entstehen, sobald ein Change archiviert wird.
- `docs/research/`: fachliche Grundlage (Methode, Behandlungsbögen, Übungsblätter, Formulare).
- `docs/roadmap.md`: Funktionen späterer Iterationen.

## Iteration 1

`openspec/changes/iteration-1-scaffolding-patient-management` beschreibt das Grundgerüst (Betrieb unter pain-therapy.ayanta.ch, Anmeldung über Ayanta Entra ID, Ayanta-Design, Deutsch und Englisch), das Dashboard, die Patientenverwaltung und die Unterschrift des Haftungsausschlusses auf dem iPad mit PDF-Archiv und E-Mail. Spätere Iterationen stehen in `docs/roadmap.md`.

## Mit OpenSpec arbeiten

```bash
npm install -g @fission-ai/openspec
openspec list                                   # offene Changes
openspec show iteration-1-scaffolding-patient-management # Change ansehen
openspec validate --strict                      # prüfen
```

In Claude Code stehen die Befehle `/opsx:propose`, `/opsx:apply` und `/opsx:archive` zur Verfügung.
