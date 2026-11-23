# Spec Delta

## ADDED Requirements

### Requirement: Modelle verwalten
The platform admin SHALL manage plans with a name and a patient limit (empty = unlimited). The system SHALL provide «Freemium» (20 patients, default for new practices) and «Unlimited». The platform admin SHALL be able to add plans, rename them, change their limit, and deactivate a plan that no practice uses.

#### Scenario: Neues Modell
- **WHEN** Mike unter «Modelle» «Premium 100» mit Limite 100 anlegt
- **THEN** erscheint es in der Liste und in der Modellauswahl jeder Praxis

#### Scenario: Modell in Gebrauch
- **WHEN** Mike «Freemium» deaktivieren will, das noch drei Praxen nutzen
- **THEN** zeigt das System «Dieses Modell nutzen noch 3 Praxen» und deaktiviert es nicht

### Requirement: Modell pro Praxis
Each practice SHALL have exactly one plan. The platform admin SHALL change it on the practice card; every change SHALL be written to the practice's audit log. Existing practices SHALL be migrated to Freemium, except Pain Therapy Falera to Unlimited.

#### Scenario: Wechsel auf Unlimited
- **WHEN** Mike für die Testpraxis «Unlimited» wählt und speichert
- **THEN** zeigt die Karte «Unlimited · 21 Patient:innen» und die Praxis kann wieder neue Patient:innen anlegen

### Requirement: Patientenlimite durchsetzen
When the number of counted patients (signed consent form, including deactivated) reaches the plan's limit, the system SHALL refuse to create new patients in that practice and SHALL explain why. Existing patients, including those created but not yet signed, SHALL remain fully usable. Lowering a limit SHALL never delete or block existing data.

#### Scenario: Limite erreicht
- **WHEN** eine Freemium-Praxis 20 Patient:innen mit Unterschrift hat und die Therapeutin «Neuer Patient» wählt
- **THEN** ist die Schaltfläche deaktiviert und das System zeigt «Die Freemium-Limite von 20 Patient:innen ist erreicht. Bestehende Patient:innen behandeln Sie weiter wie bisher. Für weitere Patient:innen melden Sie sich bei admin@pain-therapy.online.»

#### Scenario: Bestehende weiter behandeln
- **WHEN** dieselbe Praxis eine neue Sitzung für eine bestehende Patientin erfasst
- **THEN** speichert das System die Sitzung wie bisher

### Requirement: Hinweise zur Auslastung
The system SHALL show the practice its plan and usage on the practice details page, a notice from 80% of the limit, and SHALL send the platform admin one e-mail when a practice reaches its limit (again only after a plan change).

#### Scenario: 16 von 20
- **WHEN** die Praxis die 16. Patientin mit Unterschrift hat
- **THEN** zeigt das Cockpit «Freemium: 16 von 20 Patient:innen erfasst»

#### Scenario: Mail an den Plattform-Admin
- **WHEN** eine Praxis die 20. Patientin mit Unterschrift erreicht
- **THEN** erhält admin@pain-therapy.online einmal die E-Mail «Pain Therapy Muster hat die Freemium-Limite (20) erreicht.»
