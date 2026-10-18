# Design

## Context

Iteration 8 ist seit dem 18.10.2026 live. Mike Franz hat sie am selben Tag in Produktion durchgespielt und 16 Punkte diktiert. Die Sammlung liegt unter `/mnt/project-files/specs/kleine-aenderungen-2026-10-18.md`; den Punkt «Kamera am Mac» hat er gestrichen. Nach seiner Antwort gilt: Die Sitzung schreibt nie in die Behandlung zurück, die Seiten hängen von der Körperseite der Behandlung ab, und Seite und Empfindlichkeit werden gemeinsam geprüft.

## Goals / Non-Goals

**Goals:**
- Flüssiger Ablauf am iPad: weniger Tabs, Dialoge mittig, Rückmeldung ohne Neuladen.
- Dokumente nur noch über die Patienten-Zone.
- Sitzung klar gegliedert und vollständig geprüft.

**Non-Goals:**
- Neues Datenmodell für Behandlungen oder Sitzungen.
- Änderungen an Azure-Ressourcen.

## Decisions

- **D1 Profilmenü:** ein `<details>`/Popover-Menü am Initialen-Button in der Kopfzeile, tastaturbedienbar (Escape schliesst). Die bisherigen Links in der Kopfzeile entfallen.
- **D2 Dialoge:** Die Dialoge nutzen schon `<dialog>` mit `showModal()`. Eine gemeinsame Regel für alle `dialog` in Praxis-App und Zone stellt die Zentrierung sicher: `position: fixed; inset: 0; margin: auto; max-height: calc(100dvh - 32px)`, mit innerem Scrollen. Welche bestehende Regel die Zentrierung heute aufhebt (z.B. `inset: auto; margin: 0` wie bei `.trendpop`), wird in der Umsetzung im Browser geprüft. Die Bildvorschau (`dialog.lightbox`) bekommt dieselbe Regel.
- **D3 PDF-Ansicht:** eine Route `/pdf?src=…` (Zone: `/dokumente/[nr]/ansehen`), die das PDF mit pdf.js seitenweise als Canvas rendert. Safari auf dem iPad zeigt eingebettete PDFs sonst oft nur mit der ersten Seite. «Zurück» nutzt `history.back()` mit Rückfall auf die aufrufende Seite. «Drucken/Herunterladen» lädt die Originaldatei. `src` ist nur eine relative, app-eigene Dokument-URL; andere Werte werden abgelehnt.
- **D4 Mails ohne Anhang:** Der Versand des unterschriebenen Haftungsausschusses an den Patienten entfällt (Job `caj-pain-therapy-finalize` erzeugt weiter das PDF). Die Übungsblatt-Mail sendet nur den Zonen-Link. Hat ein Patient keine E-Mail-Einwilligung, bleibt der QR-Ausdruck wie heute.
- **D5 Unterschrift-Status:** Eine Client-Komponente fragt alle 15 s eine schlanke Route (`/api/patients/[id]/signature-status`) ab, solange der Status «offen» ist. Sie stoppt bei einem Endstatus, beim Verlassen der Seite und pausiert, wenn der Tab im Hintergrund ist. Bei einer Änderung lädt sie die Seite mit `router.refresh()` neu.
- **D6 Körperseite:** Der Wert `UNSPECIFIED` bleibt in der Datenbank und heisst in allen Texten «beidseitig». Die Prüfung beim Speichern läuft in `consultationSchema` (Server) mit denselben Fehlern im Formular.
- **D7 Minuten:** `formatMinutes` rundet immer auf ganze Minuten (`Math.round`). Die Summen werden vor dem Runden addiert.
- **D8 Zone pro Behandlung:** Das Heimprogramm wird pro laufender Behandlung aus deren letzter Sitzung mit Verordnung bestimmt. Die Regel «neueste Verordnung gewinnt» gilt nur noch innerhalb einer Behandlung. Tagebucheinträge hängen schon an der Verordnung und brauchen keine Migration.

## Risks / Trade-offs

- pdf.js vergrössert die Bundles. Es wird nur auf der PDF-Seite geladen (dynamischer Import).
- Abfragen alle 15 s erzeugen Last nur, solange eine Einladung offen ist und die Seite sichtbar ist.
- Ohne E-Mail-Anhang braucht der Patient die Zone. Ohne E-Mail bleibt der Ausdruck.
