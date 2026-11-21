# Spec Delta

## ADDED Requirements

### Requirement: Aufnahmen in drei Sprachen
The system SHALL offer every recording of an exercise (FRM, Standardübung, each variant) in Hochdeutsch, Mundart and English. When a recording is missing in the chosen language, the system SHALL play the Hochdeutsch recording and show «Mundart folgt» or «English coming soon».

#### Scenario: Englisch fehlt
- **WHEN** eine Patientin mit Sprache Englisch bei 3C «Listen» tippt und die englische Datei fehlt
- **THEN** spielt das System die Hochdeutsch-Aufnahme und zeigt «English coming soon»

### Requirement: Audiosprache in der Praxis
The system SHALL play recordings in the practice app in the language of «Mein Profil»: English for the English interface; for the German interface the audio language chosen there (Hochdeutsch or Mundart, default Hochdeutsch).

#### Scenario: Mundart im Profil
- **WHEN** die Therapeutin unter «Mein Profil» «Mundart» wählt und bei 2A «Anhören» tippt
- **THEN** spielt das System die Mundart-Aufnahme

### Requirement: Audiosprache der Patientin
The system SHALL play recordings in the patient zone in English for patients with preferred language English. For German it SHALL use the audio language of the patient record (Hochdeutsch or Mundart, default Hochdeutsch), which the therapist sets and the patient may change in the zone. A change in the zone SHALL be stored and logged.

#### Scenario: Patientin stellt um
- **WHEN** eine Patientin mit Sprache Deutsch in der Zone die Audiosprache auf «Mundart» stellt
- **THEN** spielen alle Übungen in Mundart, auch beim nächsten Besuch, und das Protokoll enthält die Änderung
