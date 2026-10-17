# Spec Delta

## Purpose

Begriffe der Praxis in App, Dokumenten, E-Mails und Patienten-Zone.

## ADDED Requirements

### Requirement: Begriffe
The app, documents, emails and patient zone SHALL use the practice's terms in German and English (design D10). Users SHALL never be called "Arzt" or "Ärztin".

#### Scenario: Begriffe in der Praxis-App
- **WHEN** die Therapeutin die App auf Deutsch nutzt
- **THEN** liest sie "Sitzung" statt "Konsultation", "L&B Basisdaten" statt "Katalog", "Arzt-Diagnose" statt "Weitere Diagnosen", "Schmerzlokalisation und Schmerzzustand" statt "Diagnose", "Schmerzbereich" für den Bereich einer Behandlung, "Bereich" statt "Gruppe" und "Osteopressurpunkt" statt "Muskel und Ansatz"

#### Scenario: Englisch
- **WHEN** sie die App auf Englisch nutzt
- **THEN** liest sie "Session", "L&B reference data", "Physician's diagnosis", "Pain location and condition", "Pain area", "Area" und "Osteopressure point"

#### Scenario: Patientenseite
- **WHEN** die Therapeutin eine Behandlung öffnet
- **THEN** heisst die Liste "Sitzungen" und die Schaltfläche "Sitzung", und die Behandlung zeigt "Schmerzlokalisation und Schmerzzustand"

#### Scenario: E-Mail
- **WHEN** ein Übungsblatt per E-Mail verschickt wird
- **THEN** spricht der Text von der "Sitzung vom <Datum>"

#### Scenario: Prüfung
- **WHEN** die Tests laufen
- **THEN** enthält keine deutsche Übersetzung "Konsultation" oder "Gruppe"
