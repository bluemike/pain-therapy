# Design

## Ausgangslage

- Der Formulartext (Haftungsausschluss, Patienteninformation, Datenschutzhinweis, unverschlüsselte E-Mail) ist pro Praxis versioniert (`ConsentTextVersion`, Iteration 12). Jede neue Version verlangt von allen Patientinnen und Patienten eine neue Unterschrift (`consentStatusOf`).
- Neue Praxen erhalten `INITIAL_TEXTS` als Version 1 (`createPractice`).
- Abschnitt 3 sagt nur «Verantwortlich ist die Praxis». Name und Adresse setzt bisher nur der Datenschutzhinweis der Patienten-Zone ein (`privacy/page.tsx`).
- Die Plattform-Übersicht (`practicesOverview`) zeigt Mitglieder, letzte Aktivität (letzte Anmeldung eines Mitglieds), offene Einladungen, Export und Postfach-Kontingent. Sie liest nie Patientendaten (Iteration 12, D3).
- Behandlungen und Sitzungen haben keinen Entwurfszustand: sie entstehen beim Speichern vollständig.

## Entscheide

### D1 Felder im Formulartext

- Syntax mit Guillemets wie in Mikes Nachricht: `«Praxisname»`. Erlaubt sind:

| Feld (de) | Feld (en) | Quelle |
|---|---|---|
| `«Praxisname»` | `«Practice name»` | `Practice.name` |
| `«Adresse»` | `«Address»` | `street`, `zip city` (z.B. «Via Prau da Cuort 5, 7153 Falera») |
| `«E-Mail»` | `«Email»` | `Practice.contactEmail` |
| `«Telefon»` | `«Phone»` | `Practice.phone` |
| `«Verantwortliche Person»` | `«Responsible person»` | `Practice.privacyOfficer` (neu) |

- Beide Sprachen kennen alle zehn Namen; Gross- und Kleinschreibung zählt nicht.
- Leeres Feld: Ein Listenpunkt oder Absatz, der ein leeres Feld enthält, entfällt (Beispiel: keine Telefonnummer, dann keine Zeile «Telefon: …»). Steht das leere Feld mitten im Satz, entfällt nur das Feld samt einem folgenden Komma.
- Ersetzt wird beim Anzeigen (iPad, Patienten-Zone) und beim Erstellen des PDFs, in `packages/shared/consent-fields.ts` (`fillFields(body, values)`, `unknownFields(body)`). Gespeichert bleibt der Text mit Feldern; so wirkt eine neue Adresse sofort, ohne neue Version und ohne neue Unterschriften.
- Nachweis: Beim Unterschreiben speichert `SignatureSession.fieldValues` die eingesetzten Werte (JSON). Das archivierte PDF enthält ohnehin den eingesetzten Text. Eine spätere Adressänderung verändert unterschriebene Dokumente nicht.
- «Formulartexte»: Unter dem Editor eine Liste der Felder mit den aktuellen Werten der Praxis (Klick fügt das Feld ein) und eine Vorschau «So sieht der Text für Patient:innen aus». `«Unbekannt»` oder ein Tippfehler wie `«Praxisnam»` blockiert «Veröffentlichen» mit der Meldung «Unbekanntes Feld «Praxisnam». Erlaubt sind: …».
- Warum keine Pflicht für Felder: Die Praxis darf weiterhin festen Text schreiben.

### D2 Zusammengeführter Text (neue Vorlage)

Abschnitte 1, 2 und 4 bleiben inhaltlich wie bisher; in Abschnitt 1 ersetzt `«Praxisname»` das Wort «Zentrum». Abschnitt 3 wird neu, Abschnitt 5 kommt dazu. Das Format bleibt `## Titel`, `- Punkt`, Leerzeile.

```
## 3. Datenschutzhinweis
Der Schutz Ihrer persönlichen Daten ist uns wichtig. Wir behandeln alle Angaben vertraulich und halten uns an das Schweizer Datenschutzgesetz (DSG). Grundlage der Bearbeitung ist der Behandlungsvertrag.

Verantwortlich für die Bearbeitung Ihrer Daten:
- «Verantwortliche Person», «Praxisname»
- «Adresse»
- E-Mail: «E-Mail»
- Telefon: «Telefon»

Welche Daten wir bearbeiten: Personalien, Kontakt- und Versicherungsangaben, das Informationsgespräch, Gesundheitsdaten wie Beschwerden, Vorerkrankungen, Operationen, Medikamente, Diagnosen und Befunde, den Behandlungsverlauf mit den empfohlenen Übungen sowie Angaben zu Terminen und Rechnungen.

Wir verwenden Ihre Daten ausschliesslich für:
- die Planung und Durchführung der Behandlungen
- die Dokumentation des Behandlungsverlaufs
- die Beratung und Ihr persönliches Übungsprogramm
- Terminvereinbarungen und die Kommunikation mit Ihnen
- die Rechnungsstellung und gesetzliche Pflichten

Wir schützen Ihre Daten mit angemessenen technischen und organisatorischen Massnahmen vor unberechtigtem Zugriff, Verlust und Missbrauch. Zugriff haben nur berechtigte Personen der Praxis, soweit sie ihn für ihre Aufgabe brauchen.

Wir geben Daten an andere Fachpersonen, Versicherungen oder weitere Dritte nur weiter, wenn Sie eingewilligt haben oder das Gesetz es erlaubt oder verlangt. Angaben zu unbezahlten Rechnungen können an ein Inkassobüro gehen. Für die Patientenakte nutzen wir die Plattform Pain Therapy: Ihre Daten liegen verschlüsselt in Rechenzentren von Microsoft Azure in der Schweiz, E-Mails mit Zugangslinks versendet der Schweizer Anbieter Infomaniak. Diese Dienstleister sind vertraglich zum Datenschutz verpflichtet.

Wir bewahren Ihre Akte 20 Jahre nach der letzten Behandlung auf, länger nur mit Ihrer ausdrücklichen Einwilligung. Danach löschen oder anonymisieren wir sie.

Sie können jederzeit Auskunft und eine Kopie Ihrer Daten verlangen (in der Regel kostenlos), Ihre Daten in einem maschinenlesbaren Format erhalten, unrichtige Angaben berichtigen oder einen Bestreitungsvermerk anbringen lassen, die Löschung verlangen, soweit keine Aufbewahrungspflicht entgegensteht, und eine Einwilligung für die Zukunft widerrufen. Wenden Sie sich dafür an die oben genannte Stelle.

## 4. Unverschlüsselte E-Mail
(unverändert)

## 5. Bestätigung
Mit meiner Unterschrift bestätige ich, dass ich die Patienteninformation und den Datenschutzhinweis erhalten und verstanden habe und Gelegenheit hatte, Fragen zu stellen.
```

Englisch sinngemäss mit den englischen Feldnamen; der vollständige englische Text steht in `INITIAL_TEXTS.en` der Umsetzung.

Aus dem PDF bewusst nicht übernommen: Du-Form, Ich-Form der Therapeutin («ich behandle»), eigenes Blatt nur für den Datenschutz, vage Frist «so lange erforderlich».

### D3 Bestehende Praxen: Vorlage anbieten statt überschreiben

- Eine automatisch veröffentlichte Version würde bei Falera alle offenen Formulare ungültig machen und neue Unterschriften verlangen. Deshalb: Unter «Formulartexte» erscheint «Neue Vorlage verfügbar (23.11.2026)» mit «Vergleichen» (Abschnitte nebeneinander) und «Als neue Version übernehmen». Die Praxis-Admin kann die Vorlage vor dem Veröffentlichen anpassen.
- Die Vorlage hat eine eigene Nummer (`TEMPLATE_VERSION = 2`); der Hinweis verschwindet, wenn die Praxis sie übernommen oder mit «Nicht übernehmen» ausgeblendet hat (`Practice.templateSeen`).
- Neue Praxen: Version 1 = neue Vorlage.

### D4 Verantwortliche Person

- Neues Feld `Practice.privacyOfficer` (max. 100 Zeichen) unter «Praxisangaben» (Praxis-Admin) und im Plattform-Formular «Praxisangaben und Praxis-Admin».
- Migration: vorbelegt mit dem Namen der ersten aktiven Praxis-Admin (für Falera «Christina Franz»).
- Leer: der Listenpunkt mit `«Verantwortliche Person», «Praxisname»` wird zu «Praxisname» allein (Regel aus D1: nur das Feld samt Komma entfällt).

### D5 Was zählt (Statistik und Limite)

Mike: «angefangene zählen nicht». Festgelegt:

| Zähler | zählt, wenn … | zählt nicht |
|---|---|---|
| Patient:innen | ein Formular unterschrieben ist (`SignatureSession` mit Status `SIGNED`), auch wenn die Person später deaktiviert wurde | nur angelegt, Formular offen oder abgebrochen |
| Behandlungen | mindestens eine Sitzung gespeichert ist | angelegt ohne Sitzung |
| Sitzungen | gespeichert und das Datum nicht in der Zukunft liegt | (kein Entwurfszustand vorhanden) |

- Deaktivierte Patient:innen zählen weiter. Sonst liesse sich die Limite durch Deaktivieren umgehen.
- Die Zähler laufen als Aggregat über `rawDb` (Tabellenbesitzer), ohne Namen oder andere Patientendaten. Der Plattform-Admin sieht weiterhin keine Patientendaten, nur Zahlen. Der Datenschutzhinweis nennt die Plattform als Dienstleisterin (D2).

### D6 Zuletzt angemeldet, zuletzt geändert

- **Zuletzt angemeldet:** spätester `User.lastLoginAt` der aktiven, aktivierten Mitglieder (wie heute «letzte Aktivität», umbenannt), mit Name der Person: «22.11.2026 18:04 · Christina Franz».
- **Zuletzt geändert:** spätester Zeitpunkt aus `Patient.updatedAt`, `Treatment.updatedAt`, `Consultation.updatedAt`, `SignatureSession.completedAt`, `ExerciseHandout.createdAt` und den Audit-Einträgen der Praxis ohne reine Lese-Aktionen (`*.viewed`, `*.shown`) und ohne Aktionen des Plattform-Admins. Einträge der Patient:innen in der Zone (Übungstagebuch) zählen nicht als Änderung der Praxis.
- Angezeigt relativ und absolut: «vor 3 Tagen (20.11.2026 09:12)». Praxen ohne Anmeldung seit 30 Tagen sind in der Übersicht markiert («inaktiv seit 30 Tagen»).

### D7 Modelle (Plan)

- Tabelle `Plan`: `id`, `name`, `patientLimit Int?` (leer = unbegrenzt), `sortOrder`, `active`, `createdAt`. Seed: `freemium` «Freemium» 20, `unlimited` «Unlimited» leer.
- `Practice.planId` (Standard `freemium`), `planChangedAt`, `planChangedBy`. Jeder Wechsel kommt ins Audit der Praxis (`practice.planChanged`).
- Migration der bestehenden Praxen: alle `freemium`, ausser `prc_falera` (Mikes eigene Praxis) `unlimited`.
- Plattform-Seite, Bereich «Modelle»: Liste mit Name, Limite, Anzahl Praxen; «Modell anlegen» (Name, Limite oder «unbegrenzt»); umbenennen, Limite ändern, deaktivieren (nur wenn keine Praxis es nutzt). Pro Praxis eine Auswahl «Modell» in der Praxiskarte.
- Wird die Limite eines Modells gesenkt oder eine Praxis heruntergestuft, wird nichts gelöscht oder gesperrt; nur neue Patient:innen sind blockiert.
- Preise, Laufzeiten und Rechnungen gehören nicht ins Modell (offen).

### D8 Limite durchsetzen

- Geprüft wird beim Anlegen einer Patientin oder eines Patienten (`createPatient`, Server-seitig; die Schaltfläche «Neuer Patient» ist deaktiviert mit Begründung).
- Massgebend ist der Zähler aus D5 (Patient:innen mit Unterschrift). Bereits angelegte Personen ohne Unterschrift dürfen noch unterschreiben, auch wenn die Limite dadurch um wenige überschritten wird; das Unterschreiben vor der Patientin wird nie blockiert.
- Hinweise für die Praxis (nur Praxis-Admin und Therapeut:innen der Praxis): ab 80 % im Cockpit und unter «Praxisangaben» «Freemium: 16 von 20 Patient:innen». Bei 100 %: «Die Freemium-Limite von 20 Patient:innen ist erreicht. Bestehende Patient:innen behandeln Sie weiter wie bisher. Für weitere Patient:innen melden Sie sich bei admin@pain-therapy.online.»
- E-Mail an den Plattform-Admin einmalig beim Erreichen (`Practice.limitNotifiedAt`, zurückgesetzt bei Modellwechsel): «Pain Therapy Falera hat die Freemium-Limite (20) erreicht.»

## Risiken

- Der neue Datenschutzhinweis ist nicht juristisch geprüft. Die Praxis verantwortet den Text, wie bisher.
- Die Nennung von Azure und Infomaniak im Text muss angepasst werden, wenn sich die Dienstleister ändern. Das betrifft dann eine neue Vorlage, nicht die Felder.
- Zählung «mit Unterschrift»: Eine Praxis, die nie unterschreiben lässt, könnte unbegrenzt Patient:innen führen. Da Behandlungen ohne gültige Unterschrift gesperrt sind (`openingBlocker`), ist das kein realer Weg.
