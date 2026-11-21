# Spec Delta

## ADDED Requirements

### Requirement: Fotos mit dem Smartphone aufnehmen
The system SHALL offer «Mit Smartphone aufnehmen» in the photo field of treatments and sessions. It SHALL show a QR code with a one-time link, a four-character check code and the remaining time. The link SHALL be valid for 15 minutes and for at most 10 photos, and the practice SHALL be able to end it at once.

#### Scenario: QR-Code zeigen
- **WHEN** die Therapeutin in der Sitzung «Mit Smartphone aufnehmen» tippt
- **THEN** zeigt das System einen QR-Code, den Prüfcode und «gültig noch 15 Minuten»

### Requirement: Foto-Seite ohne Anmeldung
The system SHALL serve the photo page of a valid link without sign-in. It SHALL show only the practice name and the check code, never patient data. It SHALL open the camera, reduce the photos in the browser and upload them. It SHALL refuse expired, ended or exhausted links and anything other than JPEG up to 8 MB, and SHALL limit attempts per IP address.

#### Scenario: Abgelaufener Link
- **WHEN** jemand den Link nach 15 Minuten öffnet
- **THEN** zeigt die Seite «Dieser Link ist abgelaufen» und nimmt nichts an

#### Scenario: Keine Daten sichtbar
- **WHEN** das Smartphone die Foto-Seite öffnet
- **THEN** sieht es den Praxisnamen und den Prüfcode, aber weder Namen noch Fotos der Patientin

### Requirement: Übernahme ins Formular
The system SHALL show photos uploaded from the phone in the open form within a few seconds, marked «vom Smartphone», and SHALL attach them to the treatment or session only when the form is saved. Photos not saved within 24 hours SHALL be deleted. Every handoff and every upload SHALL be logged.

#### Scenario: Speichern
- **WHEN** zwei Fotos vom Smartphone im Formular erscheinen und die Therapeutin speichert
- **THEN** gehören beide Fotos zur Sitzung, mit Aufnahmezeit

#### Scenario: Nicht gespeichert
- **WHEN** die Therapeutin das Formular ohne Speichern verlässt
- **THEN** löscht das System die hochgeladenen Fotos spätestens nach 24 Stunden
