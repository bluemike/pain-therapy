# Spec Delta

## ADDED Requirements

### Requirement: Neue Version ohne sofortige Neuunterschrift
When publishing a new version of the consent form the practice admin SHALL choose whether existing signatures stay valid until the next new treatment or session (default) or become invalid at once. A version published with the default SHALL NOT mark existing patients as needing a new signature, neither on the dashboard, in the record nor in the patient zone. New patients SHALL always sign the newest version.

#### Scenario: Neue Datenschutz-Vorlage ohne Neuunterschrift
- **WHEN** Chrissie die Vorlage als Version 3 mit «Bei der nächsten Behandlung oder Sitzung» veröffentlicht
- **THEN** bleiben alle Patient:innen mit Unterschrift der Version 2 im Cockpit «Unterschrieben», und ihre Patienten-Zone zeigt die Übungen ohne Umleitung zur Unterschrift

#### Scenario: Sofort von allen
- **WHEN** Chrissie eine Version mit «Sofort von allen» veröffentlicht
- **THEN** gelten alle früheren Unterschriften als «Neue Unterschrift nötig», wie bisher

### Requirement: Neuunterschrift bei der nächsten Behandlung oder Sitzung
When a therapist opens a new treatment or a new session for a patient whose latest signature is older than the newest version, the system SHALL from then on require the newest version for that patient, block the new treatment or session until it is signed, and offer the invitation to sign. Editing existing sessions SHALL NOT trigger this.

#### Scenario: Nächste Sitzung nach dem Freischalten
- **WHEN** die Therapeutin für Anna Muster (unterschrieben Version 2) nach dem Veröffentlichen von Version 3 «Neue Sitzung» wählt
- **THEN** zeigt die App «Bitte zuerst den aktuellen Haftungsausschluss unterschreiben lassen» mit «Zur Unterschrift einladen», das Cockpit führt Anna als «Neue Unterschrift nötig», und ihre Patienten-Zone zeigt das Formular der Version 3

#### Scenario: Akte ohne neue Sitzung
- **WHEN** die Therapeutin nur die Akte von Anna Muster öffnet
- **THEN** steht dort «Unterschrieben (Version 2), neue Version 3 bei der nächsten Behandlung oder Sitzung» und es wird nichts verlangt
