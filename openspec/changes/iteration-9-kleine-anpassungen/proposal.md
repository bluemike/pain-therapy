# Proposal

## Why

Mike Franz hat am 18.10.2026 Iteration 8 in Produktion durchgespielt und seine Beobachtungen diktiert: Anmelden, Patient erfassen, Haftungsausschuss, Behandlung, Sitzung und Übungsblatt. Viele kleine Stellen bremsen den Ablauf am iPad. Dazu gehören Dialoge in der Ecke, PDFs in neuen Tabs, eine fehlende Rückmeldung nach der Unterschrift, eine schwer auffindbare Sitzung, Teilminuten und Audio am falschen Ort. Weil die Patienten ihre Dokumente in der Patienten-Zone sehen, sind PDF-Anhänge in E-Mails nicht mehr nötig.

## What Changes

- **Profilmenü:** Der Initialen-Button (z.B. «MF») öffnet ein Menü mit «Mein Profil» und «Abmelden». Die separaten Einträge entfallen.
- **Dialoge zentriert:** Alle Dialoge der Praxis-App und der Patienten-Zone erscheinen mittig mit abgedunkeltem Hintergrund, auch die Bildvorschau.
- **PDFs in der App:** Alle PDFs öffnen in einer Vollbildansicht mit «Zurück», statt in einem neuen Tab. Das gilt in der Praxis-App und der Patienten-Zone. Alle Seiten sind scrollbar, auch auf dem iPad.
- **Keine PDF-Anhänge an Patienten:** **BREAKING:**
  - Die E-Mail mit dem unterschriebenen Haftungsausschuss entfällt.
  - Die E-Mail zum Übungsblatt enthält nur noch den Link in die Patienten-Zone.
  - Drucken bleibt in der Praxis möglich.
- **Unterschrift-Status live:** Solange eine Einladung offen ist, prüft die Patientenseite alle 15 Sekunden den Stand. Sie zeigt ohne Neuladen, ob unterschrieben oder abgelehnt wurde, und hört danach auf zu prüfen.
- **Geburtsdatum in der Zone:** Nach 2 Ziffern Tag bzw. Monat springt der Cursor weiter. Die Felder bleiben korrigierbar. Nach 4 Ziffern Jahr wird automatisch bestätigt.
- **Sitzung:**
  - Die neue Sitzung übernimmt die Angaben der Behandlung als Vorschlag. Sie sind anpassbar, ohne die Behandlung zu ändern.
  - «Vergleich mit der letzten Sitzung» ist in Sitzung 1 ausgeblendet.
  - «Schmerz vorher» und «Schmerz nachher» zeigen die 11 Knöpfe in einer Reihe über die volle Breite.
  - Osteopressur: Die Seiten richten sich nach der Körperseite der Behandlung. **BREAKING:** «nicht spezifiziert» heisst neu «beidseitig» und bietet li und re an. Beim Speichern gilt: Seite gewählt ⇔ Empfindlichkeit erfasst, sonst wird nicht gespeichert und der Punkt markiert.
  - Sitzungen sind unter der Behandlung mit einem dunkelgoldenen Trenner abgesetzt. Die Behandlung hat «Ändern» und «+ Sitzung», jede Sitzung heisst ausgeschrieben «Sitzung Nr. 1» und hat einen eigenen Knopf «Ändern» statt des Pfeils.
  - Beim Ändern einer Sitzung führt «Abbrechen» ohne Speichern zurück.
- **Übungen und Selbstausführung:**
  - «Anhören» gibt es nur noch in der Selbstausführung bei verordneten Übungen, nicht mehr bei den Übungen der Sitzung.
  - Alle Zeiten werden in ganzen Minuten angezeigt.
  - Ein Klick auf eine verordnete Übung zeigt ein auf den Patienten zugeschnittenes Übungsblatt: FRM plus die verordnete EPD (Standard oder Variante).
- **Patienten-Zone nach Behandlungen:** «Übungen» zeigt pro laufender Behandlung deren Heimprogramm, statt nur das der neuesten Verordnung. «Dokumente» ordnet Übungsblätter ihrer Behandlung und Sitzung zu.

**Nicht im Umfang (Out of scope):**
- Kamera am Mac (eigener Kameradialog): von Mike Franz am 18.10.2026 gestrichen. Am iPad öffnet «Foto aufnehmen» die Kamera.
- Passkey für die Anmeldung: Einstellung in Entra ID durch Mike Franz, kein App-Code.

## Capabilities

### New Capabilities
- `app-navigation`: Profilmenü, zentrierte Dialoge, PDF-Vollbildansicht.
- `zone-documents`: keine PDF-Anhänge an Patienten, Unterschrift-Status live.
- `zone-login`: schnellere Eingabe des Geburtsdatums.
- `session-form`: Übernahme ohne Rückschreiben, Sitzung 1, Schmerzknöpfe, Seiten und Prüfung der Osteopressur, Darstellung und Abbrechen.
- `home-exercises`: Anhören nur in der Selbstausführung, ganze Minuten, zugeschnittenes Übungsblatt.
- `zone-record`: Heimprogramme und Dokumente pro Behandlung.

## Impact

- Praxis-App: Kopfzeile, Dialog-Komponenten, Patientenseite, Behandlung/Sitzung, Selbstausführung, PDF-Links, Mailversand.
- Patienten-Zone: Bestätigung mit Geburtsdatum, Übungen, Dokumente, PDF-Links.
- `@pain-therapy/shared`: Minutenformat, Heimprogramm pro Behandlung.
- Datenmodell: Wert `UNSPECIFIED` der Körperseite wird als «beidseitig» bezeichnet (nur Text, keine Migration).
- Keine Änderung an Azure-Ressourcen.
