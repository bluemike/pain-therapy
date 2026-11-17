# Spec Delta

## ADDED Requirements

### Requirement: Inhalt des Übungsblatts wählen
When creating an exercise sheet the system SHALL let the therapist choose its content: «Gesamtes Blatt» (default) shows the whole sheet of each prescribed exercise, «Nur verordnete Teile» shows the Faszien-Rollmassage and the chosen Engpassdehnung only. The preview SHALL follow the choice, and the choice SHALL be stored with the document.

#### Scenario: Standard ganzes Blatt
- **WHEN** die Therapeutin das Übungsblatt druckt, ohne den Inhalt zu ändern
- **THEN** zeigt das PDF für jede verordnete Übung ihr ganzes Übungsblatt

#### Scenario: Nur verordnete Teile
- **WHEN** die Therapeutin «Nur verordnete Teile» wählt und sendet
- **THEN** zeigt das PDF pro Übung die Faszien-Rollmassage und die gewählte Engpassdehnung

#### Scenario: Blatt fehlt
- **WHEN** «Gesamtes Blatt» gewählt ist, das Bild des ganzen Blatts aber nicht hochgeladen ist
- **THEN** zeigt das PDF die verordneten Teile
