# Proposal

## Why

Mike Franz hat am 17.11.2026 entschieden, die App für weitere, unabhängige Praxen zu öffnen: Freundinnen von Christina Franz wollen sie als selbständige Therapeutinnen nutzen. Statt einer Kopie pro Praxis wird die bestehende App unter `pain-therapy.ayanta.ch` mandantenfähig umgebaut und läuft künftig unter der neuen Domain `pain-therapy.online`, weiterhin im bestehenden Azure-Container (rg-pain-therapy, Switzerland North).

Entscheide von Mike (17.11.2026):
- Neue Domain `pain-therapy.online` (kauft Mike). Die Benutzerinnen erhalten ein E-Mail-Konto `…@pain-therapy.online` bei Infomaniak.
- Anmeldung ohne Entra: mit der E-Mail-Adresse und einem zweiten Faktor.
- Lizenz Liebscher & Bracht und Datenschutz sind geklärt: Die Übungsbilder, Texte und Audios dürfen allen Praxen gezeigt werden.
- Die App versendet per E-Mail nur noch Links zu Gesundheits- und Patientendokumenten, nie die Dokumente selbst.

## What Changes

- **Mandanten (Praxen):** Neue Entität `Praxis`. Alle Patienten-, Behandlungs-, Dokument-, Zonen- und Protokolldaten gehören genau einer Praxis. Die Trennung erzwingt die App und zusätzlich PostgreSQL Row-Level Security. Der Katalog (Bereiche, Punkte, Übungen, Medien) bleibt für alle Praxen gemeinsam. **BREAKING**
- **Anmeldung:** Entra ID entfällt. Anmeldung mit Passkey (Face ID, Touch ID) oder mit E-Mail-Code plus Authenticator-App (TOTP). Zugang nur auf Einladung. **BREAKING**
- **Rollen pro Praxis:** «Praxis-Admin» und «Therapeut/in» gelten innerhalb einer Praxis. Neu gibt es «Plattform-Admin» (Mike) für Praxen anlegen und sperren, ohne Zugriff auf Patientendaten.
- **Praxis-Einstellungen:** Name, Adresse, Logo, Kontakt-E-Mail, Standardort, Text des Haftungsausschlusses und Datenschutzhinweis pro Praxis. Die fest verdrahtete Adresse in Falera und der Absender `pain-therapy@ayanta.ch` verschwinden aus dem Code.
- **Onboarding:** Der Plattform-Admin legt eine Praxis an und lädt ihre erste Praxis-Admin ein; diese lädt ihr Team ein. Praxis sperren, Daten einer Praxis exportieren und löschen (ersetzt das Löschskript auf Mikes Mac).
- **E-Mail nur mit Links:** Unterschriebener Haftungsausschluss und Übungsblatt gehen nicht mehr als Anhang, sondern als Link in die Patienten-Zone (Tab «Dokumente»), geschützt wie bisher durch das Geburtsdatum. Versand über SMTP von Infomaniak mit Absender `noreply@pain-therapy.online` und Antwortadresse der Praxis. Microsoft Graph entfällt. **BREAKING**
- **Domain:** Praxis-App unter `https://pain-therapy.online`, Patienten-Zone unter `https://patient.pain-therapy.online`. Die Zone erkennt die Praxis am Link. Die alten Adressen unter `ayanta.ch` leiten während einer Übergangszeit weiter.
- **Daten von Falera:** Alle bestehenden Daten gehen an die Praxis «Pain Therapy Falera». Mike und Chrissie werden dort mit ihren neuen Adressen eingeladen.

## Nicht Teil dieser Änderung

- Kalender und Termine (inkl. .ics-Einladungen in die Kalender der Therapeutinnen): eigener Change.
- Rechnungsstellung an die Praxen: vorerst manuell, ausserhalb der App.
- Eigene Domain oder eigener Absender pro Praxis, eigene Farben pro Praxis.
- Eine Benutzerin in mehreren Praxen.
- Supportzugriff des Plattform-Admins auf Patientendaten.
- Verträge (Auftragsbearbeitungsvertrag, Datenschutzerklärung der Plattform): von Mike geklärt, nicht Teil der App.
- Freihand-Bemerkungen (Iteration 10, eigener Change).

## Impact

- Datenbank: neue Tabellen `Practice`, `PracticeMembership`, `Invitation`, `Passkey`, `TotpSecret`, `LoginCode`; Spalte `practiceId` auf rund 20 Tabellen; RLS-Policies; `DocumentCounter` und `ConsentTextVersion` pro Praxis; `User.entraOid` wird optional.
- Praxis-App: Anmeldung (`src/auth.ts`), Session, alle Datenzugriffe (rund 190 Abfragen), PDFs, Mails, neue Seiten Einstellungen, Team, Plattform.
- Patienten-Zone: Praxis aus dem Link, Kopfzeile und Kontakt aus den Praxis-Einstellungen, Dokumente statt Anhang.
- Infrastruktur: Custom Domains und Zertifikate für `pain-therapy.online`, SMTP-Geheimnis im Key Vault, Graph-Berechtigung und Entra-App werden nach der Umstellung entfernt.
- Aufwand geschätzt: 22 bis 30 Personentage.

Mockup: `mockups/mandanten.html` (online: https://claude.ai/artifact/4U5CXvHuLrWiwvkVJis2fk)
