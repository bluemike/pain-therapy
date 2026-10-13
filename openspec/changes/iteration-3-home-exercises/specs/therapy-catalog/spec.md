# Spec Delta

## MODIFIED Requirements

### Requirement: Katalog ansehen
The system SHALL offer users with the role Therapist or Admin a read-only view "Katalog" in the main navigation that lists the treatment areas, the Osteopressur points (filterable by area, with main and relevant points marked as on the paper form), the stretching exercises with their areas and the time for one execution, and the fascia rolling tools. Each stretching exercise SHALL open a detail view with the image, the texts and the time from its digitized exercise sheet, a derived time marked as "berechnet". Values not yet captured SHALL be shown as "noch nicht erfasst", exercises without a digitized sheet as "noch nicht digitalisiert". The view MUST NOT offer editing.

#### Scenario: Punkte eines Bereichs ansehen
- **WHEN** der Arzt im Katalog die Osteopressur-Punkte öffnet und den Bereich "Lendenwirbelsäule, Bauch" wählt
- **THEN** sieht er die 15 Punkte dieses Bereichs in der Reihenfolge des Bogens, Hauptpunkte hervorgehoben

#### Scenario: Übungsdetail
- **WHEN** ein Benutzer in den Engpassdehnungen die Übung 2A öffnet
- **THEN** sieht er das Bild aus dem Übungsblatt, die Bereiche, Rollmassage, Schritte, Varianten und die Dauer einer Ausführung

#### Scenario: Übung ohne digitalisiertes Blatt
- **WHEN** ein Benutzer eine Übung öffnet, deren Blatt noch nicht digitalisiert ist
- **THEN** sieht er Code, Name und Bereiche und den Vermerk "noch nicht digitalisiert"

#### Scenario: Keine Bearbeitung
- **WHEN** ein Benutzer mit der Rolle Admin den Katalog oder ein Übungsdetail ansieht
- **THEN** bietet das System keine Funktion zum Ändern, Hinzufügen oder Entfernen an
