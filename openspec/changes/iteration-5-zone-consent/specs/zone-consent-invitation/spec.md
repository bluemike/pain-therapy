# Spec Delta

## Purpose

Lässt die Praxis eine Patientin zur Unterschrift des Haftungsausschlusses in die Patienten-Zone einladen, per E-Mail oder QR-Code, und zeigt den Stand der Einladung in Akte und Cockpit.

## ADDED Requirements

### Requirement: Ausstehende Unterschrift
The system SHALL consider a signature pending for an active patient who has no completed signature or whose most recent signature is of an older text version than the current one in her language.

#### Scenario: Neue Patientin
- **WHEN** die Therapeutin eine Patientin neu erfasst hat
- **THEN** gilt für sie eine Unterschrift als ausstehend

#### Scenario: Neue Textversion
- **WHEN** die Administration eine neue Version des Haftungsausschlusses veröffentlicht
- **THEN** gilt für alle aktiven Patientinnen mit älterer Unterschrift eine Unterschrift als ausstehend

### Requirement: Zur Unterschrift einladen
The system SHALL offer "Zur Unterschrift einladen" to users with the role Therapist or Admin in the patient record while a signature is pending, and right after creating a patient next to "An Patient übergeben". The invitation SHALL issue a new access link to the patient zone, replacing the previous one, and SHALL use the delivery channels of the access link: email to the stored address, QR code on screen, or access sheet for printing.

#### Scenario: Nach der Aufnahme per E-Mail
- **WHEN** die Therapeutin nach dem Speichern einer neuen Patientin "Zur Unterschrift einladen" und "Per E-Mail" wählt
- **THEN** erhält die Patientin eine E-Mail mit dem Link zur Patienten-Zone, und die Akte zeigt "Einladung versendet" mit Zeitpunkt

#### Scenario: QR-Code am Empfang
- **WHEN** die Therapeutin "Zur Unterschrift einladen" und "QR-Code anzeigen" wählt
- **THEN** zeigt das System den QR-Code, die Patientin scannt ihn mit dem eigenen Telefon, und das iPad bleibt in der Praxis-App angemeldet

#### Scenario: Keine Unterschrift ausstehend
- **WHEN** die Patientin die gültige Version bereits unterschrieben hat
- **THEN** bietet die Akte "Zur Unterschrift einladen" nicht an

### Requirement: Einladung per E-Mail
The system SHALL send the invitation email from pain-therapy@ayanta.ch in the patient's language with the practice name, a short request to read and sign the liability waiver, the link and a note that the date of birth is needed. The email MUST NOT contain health data or the liability waiver text.

#### Scenario: Inhalt der Einladung
- **WHEN** die Einladung an eine Patientin mit Sprache Englisch versendet wird
- **THEN** ist die E-Mail auf Englisch und enthält Praxisname, Bitte, Link und den Hinweis auf das Geburtsdatum, aber keine Diagnose und keinen Formulartext

### Requirement: Einladung ohne E-Mail-Einwilligung
The system SHALL send the invitation email to the stored email address even when the patient has not yet granted consent to unencrypted email. All other emails SHALL keep requiring that consent.

#### Scenario: Ohne Einwilligung
- **WHEN** eine neue Patientin noch keine Einwilligung in unverschlüsselte E-Mail erteilt hat
- **THEN** versendet das System trotzdem die Einladung, aber kein Übungsblatt und kein unterschriebenes PDF per E-Mail

### Requirement: Zustellung der Einladung
The system SHALL retry a failed delivery of the invitation and SHALL show the delivery status in the record.

#### Scenario: Zustellung fehlgeschlagen
- **WHEN** die Einladung nach mehreren Versuchen nicht zugestellt werden kann
- **THEN** zeigt die Akte "Einladung nicht zugestellt" und bietet "Erneut senden" und "QR-Code anzeigen" an

### Requirement: Gültigkeit des Links bei ausstehender Unterschrift
The system SHALL accept an access link to the patient zone, in addition to the rules of the patient zone, while a signature is pending for the patient, even without an active home program. All other rules of the access link SHALL stay unchanged: at most 6 months, confirmation with the full date of birth, locks after failed attempts, revoking and replacing.

#### Scenario: Neue Patientin ohne Heimprogramm
- **WHEN** eine neue Patientin ohne Konsultation den Einladungslink öffnet und ihr Geburtsdatum richtig eingibt
- **THEN** öffnet sich die Patienten-Zone mit der Aufgabe "Haftungsausschluss unterschreiben"

#### Scenario: Nach der Unterschrift ohne Heimprogramm
- **WHEN** die Patientin unterschrieben hat und noch kein Heimprogramm hat
- **THEN** zeigt die Patienten-Zone "Vielen Dank, Ihre Unterschrift ist bei der Praxis", und der Link wird ungültig, bis ein Heimprogramm verordnet oder eine neue Unterschrift nötig ist

### Requirement: Stand der Einladung in der Akte
The system SHALL show in the patient record the state of the pending signature: not invited, invitation sent (with channel and time), link opened, signed in the patient zone (with time), or delivery failed. When the patient added a remark on her personal details, the record SHALL show it as a notice to the therapist until a user marks it as done.

#### Scenario: Link geöffnet, noch nicht unterschrieben
- **WHEN** die Patientin den Link geöffnet und ihr Geburtsdatum bestätigt, aber noch nicht unterschrieben hat
- **THEN** zeigt die Akte "Link geöffnet, noch nicht unterschrieben" mit Zeitpunkt

#### Scenario: Anmerkung zu den Personalien
- **WHEN** die Patientin beim Unterschreiben anmerkt, dass ihre Adresse nicht stimmt
- **THEN** zeigt die Akte die Anmerkung als Hinweis, bis die Therapeutin "Erledigt" wählt

### Requirement: Unterschrift ausstehend im Cockpit
The system SHALL show in the dashboard list "Unterschrift ausstehend" the state of the invitation per patient, so that the practice sees who still has to sign before the next appointment.

#### Scenario: Liste im Cockpit
- **WHEN** die Therapeutin das Cockpit öffnet und zwei Patientinnen eingeladen sind, von denen eine den Link schon geöffnet hat
- **THEN** zeigt die Liste beide mit "Einladung versendet" beziehungsweise "Link geöffnet"

### Requirement: Patientenmodus auf dem iPad bleibt
The system SHALL keep the patient mode on the iPad from iteration 1 unchanged as an alternative. A signature completed on either channel SHALL end the pending state; an open invitation SHALL stay valid until the link expires or is replaced.

#### Scenario: Doch auf dem iPad
- **WHEN** eine eingeladene Patientin ohne Telefon in der Praxis auf dem iPad unterschreibt
- **THEN** ist die Unterschrift erledigt, und die Patienten-Zone zeigt beim Öffnen des Links keine Aufgabe mehr

### Requirement: Protokoll der Einladung
The system SHALL record in the patient's history issuing and delivering the invitation, opening the link, the completed signature in the patient zone and marking a remark as done, each with time and user or "Patienten-Zone".

#### Scenario: Verlauf
- **WHEN** ein Benutzer den Reiter "Verlauf" einer Patientin öffnet, die über die Patienten-Zone unterschrieben hat
- **THEN** sieht er Einladung, Zustellung, Öffnen des Links und Unterschrift mit Zeitpunkt
