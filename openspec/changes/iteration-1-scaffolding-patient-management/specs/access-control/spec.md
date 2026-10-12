# Spec Delta

## Purpose

Stellt sicher, dass nur angemeldete Ayanta-Benutzer mit einer passenden Rolle auf die App und die Patientendaten zugreifen und dass Zugriffe auf Patientendaten nachvollziehbar bleiben.

## ADDED Requirements

### Requirement: Anmeldung über Ayanta Entra ID
The system SHALL authenticate users exclusively through single sign-on with the Ayanta Entra ID tenant and SHALL NOT offer local accounts or passwords.

#### Scenario: Aufruf ohne Anmeldung
- **WHEN** eine nicht angemeldete Person https://pain-therapy.ayanta.ch aufruft
- **THEN** leitet das System zur Microsoft-Anmeldung von Ayanta weiter und zeigt keine Daten der App

#### Scenario: Erfolgreiche Anmeldung
- **WHEN** ein Ayanta-Benutzer mit zugewiesener App-Rolle sich bei Microsoft anmeldet
- **THEN** gelangt er auf das Dashboard und sieht seinen Namen in der Kopfzeile

### Requirement: Nur Ayanta-Benutzer
The system MUST reject sign-ins from accounts outside the Ayanta tenant, including guest and personal Microsoft accounts.

#### Scenario: Fremdes Konto
- **WHEN** sich jemand mit einem privaten Microsoft-Konto oder einem Konto eines anderen Tenants anmeldet
- **THEN** verweigert das System den Zugang und zeigt "Kein Zugang"

### Requirement: Rollen aus Entra ID
The system SHALL take each user's role from the app roles assigned in Entra ID. It SHALL support the roles "Therapeut:in" and "Administration"; a user without one of these roles MUST NOT get access.

#### Scenario: Ayanta-Benutzer ohne Rolle
- **WHEN** ein Ayanta-Benutzer ohne zugewiesene App-Rolle sich anmeldet
- **THEN** zeigt das System "Kein Zugang" mit dem Hinweis, die Rolle bei der Administration zu beantragen

#### Scenario: Rolle wird entzogen
- **WHEN** einem Benutzer die App-Rolle in Entra ID entzogen wird
- **THEN** erhält er spätestens bei der nächsten Anmeldung keinen Zugang mehr

### Requirement: Berechtigungen der Rollen
The system SHALL allow both roles to create, view, change, deactivate and reactivate patients and to start the signing process. Only Administration SHALL manage the disclaimer texts.

#### Scenario: Therapeut:in ändert Formulartext
- **WHEN** ein Benutzer mit der Rolle Therapeut:in die Verwaltung der Formulartexte aufruft
- **THEN** verweigert das System den Zugriff

### Requirement: Zugriffsprotokoll
The system MUST log every view and every change of a patient record with user, time, patient and action, and users MUST NOT be able to change or delete log entries.

#### Scenario: Akte wird geöffnet
- **WHEN** eine Therapeutin die Akte eines Patienten öffnet
- **THEN** enthält das Protokoll einen Eintrag mit ihrem Benutzer, dem Zeitpunkt, dem Patienten und "angesehen"

### Requirement: Abmeldung
The system SHALL let users sign out and SHALL end a session after 30 minutes without activity.

#### Scenario: Inaktivität
- **WHEN** ein angemeldeter Benutzer 30 Minuten nichts tut
- **THEN** beendet das System die Sitzung und verlangt beim nächsten Klick eine neue Anmeldung
