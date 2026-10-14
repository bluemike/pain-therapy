# Roadmap

Jede Iteration wird als eigener OpenSpec-Change unter `openspec/changes/` spezifiziert, sobald sie ansteht.

## Iteration 1 (in Betrieb, Abnahme offen)

Web-App-Grundgerüst, Anmeldung über Ayanta Entra ID, Ayanta-Design, Deutsch und Englisch, Dashboard, Patientenverwaltung und Unterschrift des Haftungsausschlusses auf dem iPad mit PDF-Archiv und E-Mail. Siehe `openspec/changes/iteration-1-scaffolding-patient-management`.

## Iteration 2 (in Betrieb)

Behandlungen (1 bis n pro Patient, je Bereich) mit Diagnose, Bereich, Schmerzgrad und Fotos; Konsultationen (1 bis n pro Behandlung) mit dem digitalen Behandlungsbogen des Bereichs; Therapiekatalog mit 12 Bereichen, 72 Osteopressur-Punkten und 27 Engpassdehnungen als Referenzdaten. Siehe `openspec/changes/iteration-2-treatments`.

## Iteration 3 (in Betrieb)

Digitalisierte Übungsblätter (27 Übungen mit Hauptbild, Blatt, Inhalten und Zeitbedarf), Block "Selbstausführung" in der Konsultation mit Wiederholungen und Gesamtzeitbedarf, persönliches Übungsblatt als PDF per E-Mail oder Ausdruck. Siehe `openspec/changes/iteration-3-home-exercises`.

## Iteration 4 (spezifiziert)

Patienten-Zone als eigene App ohne Entra-Anmeldung auf derselben Datenbank: persönlicher Link mit Bestätigung über das Geburtsdatum, Übungstagebuch der Patientin (gemacht ja/nein, Bewertung 1 bis 10, Datum und Zeit, Bemerkung), Kachel "Heimprogramm" im Cockpit und Reiter "Übungstagebuch" in der Akte mit der Einhaltung der verordneten Wiederholungen. Siehe `openspec/changes/iteration-4-patient-zone`.

## Später (noch nicht eingeplant)

- **Schmerzbeschwerden:** bis zu 3 aktive Beschwerden pro Patient mit Ort, Qualität, Intensität, Tiefe, Verlauf, Körperschema, SZ-Geschichte, Zusammenhängen und SZ-Referenzen.
- **Therapiekatalog verwalten:** Bereiche, Punkte und Übungen in der App pflegen, Übungsblätter mit Rollmassage und Varianten für alle 27 Übungen.
- **Behandlungsbogen als PDF** und Abschluss einer Behandlung.
- **Erfolgsprotokoll und Verlauf:** Bewertungen nach Stunden, erster Nacht, Tag 1 und Tag 2, Verlauf pro Beschwerde, Hinweis ab der fünften Behandlung, neutrale Darstellung ohne Heilversprechen.
- **Aufbewahrung und Datenschutz:** 20 Jahre nach der letzten Behandlung, Datenexport (JSON und PDF), Berichtigung und Bestreitungsvermerk.
- **Patienten-Zone erweitern:** Erinnerungen an die Übungen und Erfolgsprotokoll der Patientin nach Stunden, erster Nacht, Tag 1 und Tag 2.
- **Zugang ausserhalb von Ayanta:** weitere Tenants oder Praxen.

