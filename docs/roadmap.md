# Roadmap

Jede Iteration wird als eigener OpenSpec-Change unter `openspec/changes/` spezifiziert, sobald sie ansteht.

## Iteration 1 (in Betrieb, Abnahme offen)

Web-App-Grundgerüst, Anmeldung über Ayanta Entra ID, Ayanta-Design, Deutsch und Englisch, Dashboard, Patientenverwaltung und Unterschrift des Haftungsausschlusses auf dem iPad mit PDF-Archiv und E-Mail. Siehe `openspec/changes/iteration-1-scaffolding-patient-management`.

## Iteration 2 (spezifiziert)

Behandlungen (1 bis n pro Patient, je Bereich) mit Diagnose, Bereich, Schmerzgrad und Fotos; Konsultationen (1 bis n pro Behandlung) mit dem digitalen Behandlungsbogen des Bereichs; Therapiekatalog mit 12 Bereichen, 72 Osteopressur-Punkten und 27 Engpassdehnungen als Referenzdaten. Siehe `openspec/changes/iteration-2-treatments`.

## Iteration 3 (spezifiziert)

Übungsblätter der Sammelmappe digitalisiert (Bild, Texte und Dauer pro Übung, Übungsdetail im Katalog), Abschnitt "Selbstausführung" in der Konsultation mit Häufigkeit und Zeitbedarf, Übungsblatt als PDF per E-Mail (mit Einwilligung) oder zum Ausdrucken. Siehe `openspec/changes/iteration-3-home-exercises`.

## Später (noch nicht eingeplant)

- **Schmerzbeschwerden:** bis zu 3 aktive Beschwerden pro Patient mit Ort, Qualität, Intensität, Tiefe, Verlauf, Körperschema, SZ-Geschichte, Zusammenhängen und SZ-Referenzen.
- **Therapiekatalog verwalten:** Bereiche, Punkte, Übungen und Übungsblätter in der App pflegen.
- **Behandlungsbogen als PDF** und Abschluss einer Behandlung.
- **Heimprogramm erweitern:** Intensität und Schritte als weitere Verordnungsfelder pro Übung.
- **Erfolgsprotokoll und Verlauf:** Bewertungen nach Stunden, erster Nacht, Tag 1 und Tag 2, Verlauf pro Beschwerde, Hinweis ab der fünften Behandlung, neutrale Darstellung ohne Heilversprechen.
- **Aufbewahrung und Datenschutz:** 20 Jahre nach der letzten Behandlung, Datenexport (JSON und PDF), Berichtigung und Bestreitungsvermerk.
- **Patientenzone (Portal oder App):** Patientinnen und Patienten sehen ihr aktuelles Heimprogramm und protokollieren Ausführung und Fortschritt der Übungen selbst (ausgeführt, Intensität 0 bis 9, "Übung fällt") sowie das Erfolgsprotokoll.
- **Zugang ausserhalb von Ayanta:** weitere Tenants oder Praxen.

