# Proposal

## Why

Die Praxis dokumentiert die Liebscher & Bracht-Therapie heute auf Papier. Iteration 1 legt das technische Fundament der Web-App (Betrieb bei Ayanta, Anmeldung über Entra ID, Ayanta-Design, Deutsch und Englisch) und digitalisiert den ersten Schritt jeder Behandlung: Patientin oder Patient aufnehmen und den Haftungsausschluss samt Einwilligungen auf dem iPad unterschreiben lassen. Damit entfällt der Papier-Anamnesebogen, und das unterschriebene Formular liegt sofort revisionssicher in der Akte.

## What Changes

- Neue Browser-Web-App, responsiv für Desktop, iPad und iPhone, betrieben im Ayanta-Azure-Container unter `https://pain-therapy.ayanta.ch`.
- Anmeldung und Rollen über Ayanta Entra ID; nur Ayanta-Benutzer haben Zugang.
- Oberfläche im Corporate Design von ayanta.ch.
- Mehrsprachigkeit Deutsch und Englisch von Anfang an, umschaltbar pro Benutzer.
- Dashboard als Startseite, vorerst mit Begrüssung, Schnellaktionen und wenigen Kennzahlen.
- Patientenverwaltung: anlegen, ansehen, ändern, deaktivieren und reaktivieren, mit den Angaben aus dem Anamnesebogen; neue Patientinnen und Patienten sind standardmässig aktiv.
- Unterschriftsablauf auf dem iPad: Nach der Aufnahme wird der Patientin der Haftungsausschluss mit Patienteninformation und Datenschutzhinweis gezeigt; sie muss ihn bis zum Ende lesen und unterschreibt in einem Unterschriftsfeld.
- Nach der Unterschrift wird ein PDF des unterschriebenen Formulars erzeugt, unveränderbar in der Akte archiviert und an die E-Mail-Adresse der Patientin geschickt.

**Nicht im Umfang (Out of scope), siehe docs/roadmap.md:**
- Schmerzbeschwerden und Körperschema, Therapiekatalog, Behandlungsbogen, Heimprogramm, Erfolgsprotokoll und Verlauf.
- Aufbewahrungsfristen, Datenexport und Berichtigungsvermerke (das Archiv der unterschriebenen PDFs wird aber schon so angelegt, dass nichts verloren geht).
- Zugang für Personen ausserhalb von Ayanta und ein Patientenportal.
- Native Apps für iPad oder iPhone.
- Terminplanung, Abrechnung und Versicherungsschnittstellen.

## Capabilities

### New Capabilities
- `access-control`: Anmeldung über Ayanta Entra ID, Rollen und Zugriffsprotokoll.
- `app-shell`: Grundgerüst der Oberfläche mit Navigation, responsivem Layout und Ayanta-Design.
- `localization`: Deutsche und englische Oberfläche und Wahl der Sprache.
- `dashboard`: Startseite nach der Anmeldung.
- `patient-records`: Patientinnen und Patienten mit den Angaben des Anamnesebogens anlegen, ansehen, ändern, deaktivieren und reaktivieren.
- `consent-signing`: Haftungsausschluss und Einwilligungen auf dem iPad lesen und unterschreiben lassen.
- `consent-documents`: PDF des unterschriebenen Formulars erzeugen, in der Akte archivieren und per E-Mail zustellen.

### Modified Capabilities
- Keine; das Repository hat noch keine Specs.

## Impact

- Neues Repository ohne bestehenden Code; Architektur und Azure-Ressourcen in design.md.
- Benötigt eine App-Registrierung in Ayanta Entra ID mit App-Rollen, eine Azure Container App, eine Datenbank, einen Blob-Speicher und einen Absender für E-Mails.
- Die App bearbeitet Gesundheitsdaten (Anamnese); alle Azure-Ressourcen liegen in der Region Switzerland North.
- Die Texte von Haftungsausschluss, Patienteninformation und Datenschutzhinweis müssen auf Deutsch und Englisch vorliegen.
