# Spec Delta

## ADDED Requirements

### Requirement: Nutzung pro Praxis in der Plattform-Übersicht
The platform overview SHALL show per practice the last sign-in of an active member (time and member name), the last change made by the practice, and the counts of patients, treatments and sessions. Only completed records SHALL count: a patient once a consent form is signed (also when deactivated later), a treatment once it has at least one saved session, a session once saved with a date not in the future. The overview SHALL show numbers only, never names or other patient data.

#### Scenario: Übersicht Falera
- **WHEN** Mike die Plattform-Seite öffnet
- **THEN** zeigt die Karte «Pain Therapy Falera» z.B. «Zuletzt angemeldet: 22.11.2026 18:04 · Christina Franz», «Zuletzt geändert: 22.11.2026 17:58», «14 Patient:innen · 19 Behandlungen · 47 Sitzungen»

#### Scenario: Angefangene zählen nicht
- **WHEN** eine Praxis eine Patientin angelegt hat, deren Formular noch nicht unterschrieben ist, und eine Behandlung ohne Sitzung
- **THEN** erhöhen beide die Zähler nicht

#### Scenario: Lesen ist keine Änderung
- **WHEN** eine Therapeutin nur eine Patientenakte öffnet
- **THEN** bleibt «Zuletzt geändert» unverändert, «Zuletzt angemeldet» zeigt ihre Anmeldung

### Requirement: Inaktive Praxen markieren
The overview SHALL mark practices with no sign-in for 30 days.

#### Scenario: 30 Tage ohne Anmeldung
- **WHEN** sich seit 31 Tagen niemand der Testpraxis angemeldet hat
- **THEN** trägt deren Karte den Hinweis «inaktiv seit 31 Tagen»
