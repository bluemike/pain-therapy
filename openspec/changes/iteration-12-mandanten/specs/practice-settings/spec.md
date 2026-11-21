# Spec Delta

## ADDED Requirements

### Requirement: Praxis-Einstellungen
The system SHALL let a Praxis-Admin maintain the practice name, address, phone, contact e-mail, default place, document Kürzel and logo (PNG or SVG, at most 500 KB). PDFs, e-mails and the patient zone SHALL use these values; without a logo they SHALL show the practice name as text.

#### Scenario: Adresse im PDF
- **WHEN** die Praxis-Admin die Adresse ändert und danach ein Haftungsausschluss unterschrieben wird
- **THEN** zeigt das neue PDF die neue Adresse in der Fusszeile, bereits archivierte PDFs bleiben unverändert

#### Scenario: Logo in der Zone
- **WHEN** eine Patientin der Praxis mit Logo die Patienten-Zone öffnet
- **THEN** zeigt die Kopfzeile das Logo und den Namen ihrer Praxis

#### Scenario: Nur Praxis-Admin
- **WHEN** eine Therapeutin ohne Rolle Praxis-Admin die Einstellungen öffnen will
- **THEN** zeigt das System «Kein Zugriff»

### Requirement: Haftungsausschluss und Datenschutzhinweis pro Praxis
The system SHALL keep the disclaimer text and the zone privacy notice per Praxis, versioned as today. A new Praxis SHALL start with a copy of the current template with its name filled in.

#### Scenario: Neue Praxis
- **WHEN** der Plattform-Admin die Praxis «Physio Muster» anlegt
- **THEN** hat sie Version 1 des Haftungsausschlusses mit «Physio Muster» als Praxisname

#### Scenario: Neue Version
- **WHEN** die Praxis-Admin den Text ändert und veröffentlicht
- **THEN** gilt die neue Version für neue Unterschriften dieser Praxis, andere Praxen sind nicht betroffen

### Requirement: Keine fest verdrahteten Praxisangaben
The code SHALL NOT contain practice-specific addresses, places or sender addresses; the Ayanta logo and Ayanta references SHALL be replaced by the neutral platform name «Pain Therapy».

#### Scenario: Zone ohne Ayanta
- **WHEN** ein ungültiger Link in der Zone geöffnet wird
- **THEN** nennt die Seite keine Ayanta-Adresse, sondern bittet, sich an die eigene Praxis zu wenden
