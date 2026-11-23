# Spec Delta

## ADDED Requirements

### Requirement: Felder im Formulartext
The system SHALL replace the fields «Praxisname», «Adresse», «E-Mail», «Telefon» and «Verantwortliche Person» (English «Practice name», «Address», «Email», «Phone», «Responsible person») in the consent form text with the current practice details wherever the text is shown to a patient or written into the signed PDF. The stored text version SHALL keep the fields. A list item or paragraph whose only field is empty SHALL be omitted. The values used SHALL be stored with the signature session.

#### Scenario: Adresse im Formular
- **WHEN** die Praxis «Pain Therapy Falera» mit Adresse «Via Prau da Cuort 5, 7153 Falera» einer Patientin das Formular auf dem iPad zeigt
- **THEN** steht im Datenschutzhinweis «Via Prau da Cuort 5, 7153 Falera» statt «Adresse», und das unterschriebene PDF enthält denselben Text

#### Scenario: Keine Telefonnummer
- **WHEN** die Praxis keine Telefonnummer hinterlegt hat
- **THEN** fehlt die Zeile «Telefon: …» im angezeigten Text und im PDF

#### Scenario: Adresse ändert sich später
- **WHEN** die Praxis-Admin nach einer Unterschrift die Adresse ändert
- **THEN** zeigen neue Formulare die neue Adresse ohne neue Textversion, und das bereits unterschriebene PDF bleibt unverändert

### Requirement: Felder beim Bearbeiten prüfen
The Formulartexte page SHALL list the allowed fields with the practice's current values, offer a preview with the fields filled in, and SHALL refuse to publish a version that contains an unknown field in guillemets.

#### Scenario: Tippfehler im Feld
- **WHEN** die Praxis-Admin «Praxisnam» in den Text schreibt und «Veröffentlichen» tippt
- **THEN** zeigt das System «Unbekanntes Feld «Praxisnam». Erlaubt sind: «Praxisname», «Adresse», «E-Mail», «Telefon», «Verantwortliche Person».» und veröffentlicht nichts

### Requirement: Zusammengeführter Datenschutzhinweis als Vorlage
The platform template of the consent form SHALL contain a privacy notice that names the responsible person with address and contact (fields), the data categories, the purposes, the data security measures, the external providers (Microsoft Azure in Switzerland, Infomaniak), the 20-year retention, the debt-collection note, the rights including erasure, and a confirmation that the patient had the opportunity to ask questions. New practices SHALL start with this template as version 1.

#### Scenario: Neue Praxis
- **WHEN** der Plattform-Admin eine neue Praxis anlegt
- **THEN** ist die Vorlage mit den Feldern deren Version 1 und die Felder zeigen die Angaben der neuen Praxis

### Requirement: Neue Vorlage für bestehende Praxen anbieten
The system SHALL NOT publish the new template automatically for existing practices. It SHALL show the practice admin a notice «Neue Vorlage verfügbar» with a comparison and the actions «Als neue Version übernehmen» (editable before publishing) and «Nicht übernehmen».

#### Scenario: Falera übernimmt die Vorlage
- **WHEN** Chrissie unter «Formulartexte» «Als neue Version übernehmen» und dann «Veröffentlichen» tippt
- **THEN** ist die Vorlage Version 3 von Falera und neue Formulare verwenden sie; bisherige Unterschriften gelten bis zur nächsten Unterschrift als veraltete Version wie bei jeder neuen Version

### Requirement: Verantwortliche Person
Practice details SHALL include an optional «Verantwortliche Person (Datenschutz)», editable by the practice admin and the platform admin, prefilled on migration with the name of the first active practice admin.

#### Scenario: Feld leer
- **WHEN** die Verantwortliche Person leer ist
- **THEN** zeigt der Datenschutzhinweis unter «Verantwortlich» nur den Praxisnamen
