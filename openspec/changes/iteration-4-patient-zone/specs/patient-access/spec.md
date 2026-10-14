# Spec Delta

## Purpose

Gibt der Patientin einen persönlichen Link zur Patienten-Zone, schützt ihn mit einem zweiten Faktor (Geburtsdatum) und lässt die Praxis ihn versenden, anzeigen, sperren und ersetzen.

## ADDED Requirements

### Requirement: Zugangslink pro Patientin
The system SHALL issue per patient at most one valid access link containing a random token of at least 128 bits. The system MUST store only a hash of the token and MUST NOT store or log the token itself. Issuing a new link SHALL make the previous link invalid.

#### Scenario: Neuer Link ersetzt den alten
- **WHEN** die Therapeutin für eine Patientin mit gültigem Link einen neuen Link ausstellt
- **THEN** führt der alte Link auf die Seite "Dieser Link ist nicht gültig", und der neue Link funktioniert

#### Scenario: Kein Token in der Datenbank
- **WHEN** ein Link ausgestellt wird
- **THEN** enthält die Datenbank nur den Hash des Tokens, und kein Log enthält das Token

### Requirement: Gültigkeit des Links
The system SHALL accept an access link only while the patient is active, the patient has an active home program, the link is at most 6 months old and the link is neither replaced, revoked nor blocked. A home program SHALL be active while the most recent consultation with at least one prescription is at most 12 weeks old.

#### Scenario: Link älter als 6 Monate
- **WHEN** die Patientin einen Link öffnet, der vor mehr als 6 Monaten ausgestellt wurde
- **THEN** zeigt das System "Dieser Link ist nicht gültig" und keine Daten

#### Scenario: Kein aktives Heimprogramm
- **WHEN** die letzte Konsultation mit Verordnung mehr als 12 Wochen zurückliegt
- **THEN** akzeptiert das System den Link nicht, und die Akte zeigt den Link als abgelaufen

### Requirement: Link mit dem Übungsblatt
The system SHALL offer when completing an exercise sheet the option "Link zur Patienten-Zone mitsenden", selected by default. When the sheet is sent by email, the link SHALL be in the email text; when it is printed, the system SHALL print an access sheet with QR code and address together with the exercise sheet. The archived exercise sheet MUST NOT contain the link.

#### Scenario: Versand per E-Mail mit Link
- **WHEN** die Therapeutin das Übungsblatt mit vorgewählter Checkbox per E-Mail sendet
- **THEN** erhält die Patientin eine E-Mail mit dem Übungsblatt als Anhang und dem Link im Text

#### Scenario: Ausdruck mit Zugangsblatt
- **WHEN** die Patientin nicht in den E-Mail-Versand eingewilligt hat und die Therapeutin "Drucken" wählt
- **THEN** druckt das System das Übungsblatt und ein Zugangsblatt mit QR-Code, und das archivierte Übungsblatt enthält keinen Link

#### Scenario: Ohne Link
- **WHEN** die Therapeutin die Checkbox abwählt
- **THEN** stellt das System keinen neuen Link aus

### Requirement: Link senden aus der Akte
The system SHALL offer "Link senden" in the patient's record. With consent to unencrypted email and an email address it SHALL send an email with the link from pain-therapy@ayanta.ch and record the delivery status; otherwise it SHALL show the link as QR code on screen and offer the access sheet for printing.

#### Scenario: Link per E-Mail
- **WHEN** die Patientin in den unverschlüsselten E-Mail-Versand eingewilligt hat und die Therapeutin "Link senden" wählt
- **THEN** sendet das System eine E-Mail mit dem Link und zeigt den Zustellstatus in der Akte

#### Scenario: QR-Code in der Praxis
- **WHEN** die Patientin nicht eingewilligt hat und die Therapeutin "Link senden" wählt
- **THEN** zeigt das System einen QR-Code, den die Patientin mit dem Telefon scannt, und bietet "Zugangsblatt drucken" an

### Requirement: Link sperren
The system SHALL let users with the role Therapist or Admin revoke the patient's link with "Link sperren". Revoking SHALL make the link invalid immediately and SHALL end all device sessions opened with it.

#### Scenario: Link sperren
- **WHEN** die Therapeutin "Link sperren" wählt
- **THEN** führt der Link auf "Dieser Link ist nicht gültig", das Telefon der Patientin ist abgemeldet, und die Akte zeigt "gesperrt"

### Requirement: Bestätigung mit dem Geburtsdatum
The system SHALL require on each device without a valid session that the patient enters her full date of birth (TT.MM.JJJJ) before showing any personal data, and SHALL compare it with the date of birth in the record.

#### Scenario: Richtiges Geburtsdatum
- **WHEN** die Patientin den Link öffnet und ihr Geburtsdatum richtig eingibt
- **THEN** zeigt das System ihre Übungen von heute

#### Scenario: Falsches Geburtsdatum
- **WHEN** jemand ein falsches Datum eingibt
- **THEN** zeigt das System "Die Angabe stimmt nicht." ohne Namen oder andere Daten der Patientin

### Requirement: Sperre nach Fehlversuchen
The system SHALL lock a link for 15 minutes after 5 failed confirmations and SHALL block it after 10 failed confirmations until the practice issues a new link. A successful confirmation SHALL reset the counter. The system SHALL limit confirmations to 20 per hour per IP address across all links.

#### Scenario: Fünf Fehlversuche
- **WHEN** jemand fünfmal ein falsches Datum eingibt
- **THEN** nimmt das System 15 Minuten lang keine Eingabe an, auch nicht das richtige Datum, und zeigt "Zu viele Versuche. Bitte versuchen Sie es später erneut."

#### Scenario: Zehn Fehlversuche
- **WHEN** nach Ablauf der Sperre fünf weitere Fehlversuche folgen
- **THEN** ist der Link blockiert, und die Akte zeigt "blockiert, neuer Link nötig"

#### Scenario: Viele Versuche von einer Adresse
- **WHEN** von einer IP-Adresse innerhalb einer Stunde mehr als 20 Bestätigungen für verschiedene Links versucht werden
- **THEN** lehnt das System weitere Versuche dieser Adresse bis zum Ablauf der Stunde ab

### Requirement: Neutrale Fehlermeldungen
The system SHALL show the same message for unknown, expired, replaced, revoked and blocked links, and MUST NOT reveal whether a patient or link exists.

#### Scenario: Unbekannter Link
- **WHEN** jemand eine Adresse mit einem erfundenen Token aufruft
- **THEN** zeigt das System dieselbe Seite wie bei einem gesperrten Link

### Requirement: Gerätesitzung
The system SHALL after a successful confirmation keep the device signed in for 30 days with a session cookie (HttpOnly, Secure, SameSite=Strict) and SHALL remove the token from the address. The session SHALL end with "Abmelden", after 30 days, or when the link is revoked or expires. Replacing the link by a new one SHALL NOT end existing sessions.

#### Scenario: Wiederkehren
- **WHEN** die Patientin die Patienten-Zone 10 Tage nach der Bestätigung auf demselben Telefon öffnet
- **THEN** sieht sie ihre Übungen ohne erneute Eingabe des Geburtsdatums

#### Scenario: Abmelden
- **WHEN** die Patientin "Abmelden" wählt
- **THEN** endet die Sitzung, und der Link verlangt beim nächsten Öffnen wieder das Geburtsdatum

### Requirement: Protokoll der Link-Ereignisse
The system SHALL record issuing, sending, showing as QR code, printing the access sheet, replacing, revoking, successful and failed confirmations, locks and blocks of a link in the patient's history.

#### Scenario: Verlauf in der Akte
- **WHEN** ein Benutzer den Reiter "Verlauf" einer Patientin öffnet, deren Link gesperrt wurde
- **THEN** sieht er Ausstellung, Versand, Bestätigungen und Sperre mit Zeitpunkt und Benutzer
