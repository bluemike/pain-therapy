# Spec Delta

## Purpose

Jede Übung besteht aus Faszien-Rollmassage (FRM) und Engpassdehnung (EPD); die EPD ist die Standardübung oder eine ihrer Varianten.

## ADDED Requirements

### Requirement: Teile einer Übung
For each of the 27 exercises the reference data SHALL hold the FRM (image band, text, audio, rolling tools linked to "Rollmassage-Werkzeuge", time), the EPD standard exercise (image band, steps, aids, audio, time) and 0 to n variants (number, image numbers, text, aids, audio, time). Variants SHALL be numbered 1…n per exercise and share one image band. Texts, image bands and audio SHALL come from the private container `exercise-media`, never from the repository.

#### Scenario: Übung in den L&B Basisdaten
- **WHEN** die Therapeutin die Übung 1A öffnet
- **THEN** sieht sie die Abschnitte "Faszien-Rollmassage" (Bild, Text, Werkzeuge MiKu und MiRo mit Link, Anhören), "Standardübung" (Bild, Schritte, Anhören) und "Varianten" (Bild, Variante 1 bis 4 mit je eigenem Anhören)

#### Scenario: Varianten über mehrere Bilder
- **WHEN** die Therapeutin die Varianten von 3C und 3E ansieht
- **THEN** ist 3C Variante 1 = Bilder 1+2, Variante 2 = Bilder 3+4, Variante 3 = Bild 5, und 3E Variante 1 = Bilder 1+2, Variante 2 = Bild 3

#### Scenario: Inhalte fehlen
- **WHEN** die Texte noch nicht hochgeladen sind
- **THEN** zeigt die App "noch nicht erfasst" und das Verordnen bleibt möglich

### Requirement: Zeit einer Ausführung
The duration of one execution SHALL be the FRM time plus the time of the chosen EPD: for the standard exercise seconds per side × sides, for a variant its own time if the sheet states one, otherwise the time of the standard exercise. Values not set by the practice SHALL be shown as missing, as in iteration 3.

#### Scenario: Standard
- **WHEN** 1D mit EPD Standard verordnet ist (FRM 2 min, 2 Seiten × 2 min)
- **THEN** dauert eine Ausführung 6 min
