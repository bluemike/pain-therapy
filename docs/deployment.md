# Deployment nach Azure

Ziel: `https://pain-therapy.ayanta.ch`, alle Daten in **Switzerland North**. Die Infrastruktur steht in [`infra/main.bicep`](../infra/main.bicep), das Deployment läuft über [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

## Was angelegt wird

| Ressource | Zweck |
| --- | --- |
| Container App `ca-pain-therapy` | die App (Next.js), 1–2 Replikate, eigene Domain mit verwaltetem Zertifikat |
| Container App `ca-pain-therapy-zone` | Patienten-Zone (ab Iteration 4): Heimprogramm und Übungstagebuch für Patient:innen, ohne Entra-Anmeldung, 0–2 Replikate, eigene Domain `patient.pain-therapy.ayanta.ch` |
| Container Apps Job `caj-pain-therapy-migrate` | `prisma/migrate.sh` vor jeder neuen Revision: `prisma migrate deploy`, Rolle `patient_zone` mit ihren Rechten, danach `catalog:sync` (Therapiekatalog) |
| Container Registry | Images aus GitHub Actions |
| PostgreSQL Flexible Server 16 (B1ms) | Datenbank, 35 Tage Backup, nur Azure-Dienste dürfen verbinden |
| Storage Account (ZRS), Container `signed-documents` | PDF-Archiv mit Versionierung und unveränderlicher Aufbewahrung (20 Jahre) |
| Container `clinical-photos` im selben Storage Account | Fotos von Behandlungen und Konsultationen, privat, Versionierung und Soft Delete (365 Tage), ohne Unveränderlichkeit; *Entfernen* in der App blendet nur aus |
| Container `exercise-media` im selben Storage Account | Bilder und Texte der digitalisierten L&B-Übungsblätter, privat, von Hand geladen (siehe Iteration 3); die App liefert die Bilder nur an angemeldete Benutzer:innen aus |
| Key Vault | `AUTH_SECRET`, Client Secret, Datenbank-URL; ab Iteration 4 `patient-zone-database-url`, `patient-zone-db-password`, `patient-zone-secret`; ab Iteration 5 `zone-internal-secret` |
| User-assigned Managed Identity `id-pain-therapy` | Zugriff auf Registry, Key Vault, Blob Storage und Graph (E-Mail) |
| User-assigned Managed Identity `id-pain-therapy-zone` | nur für die Patienten-Zone: *AcrPull*, *Key Vault Secrets User* nur auf ihren zwei Secrets, *Storage Blob Data Reader* nur auf `exercise-media` |
| Log Analytics | Logs der Container Apps, 90 Tage |

Die App greift mit der Managed Identity auf Blob Storage, Key Vault und Graph zu. Für PostgreSQL nutzt sie Benutzer und Passwort aus dem Key Vault; Prisma kann keine Entra-Tokens für Postgres erneuern (Abweichung von design.md D2, siehe offene Punkte).

## Einmalige Einrichtung

Voraussetzungen: Azure CLI ≥ 2.60, Rechte *Owner* auf der Subscription (für Rollenzuweisungen), Zugriff auf die DNS-Zone `ayanta.ch`.

### 1. Entra ID

App-Registrierung, Rollen und Client Secret nach [entra.md](entra.md) Schritte 1–5 anlegen.

### 2. Ressourcengruppe und erstes Deployment

```bash
az login
az group create -n rg-pain-therapy -l switzerlandnorth

export ENTRA_TENANT_ID=<tenant-id> ENTRA_CLIENT_ID=<client-id> ENTRA_CLIENT_SECRET=<secret>
export AUTH_SECRET=$(openssl rand -base64 32)
export POSTGRES_ADMIN_PASSWORD=$(openssl rand -base64 24)
export MAIL_SENDER=pain-therapy@ayanta.ch
# IMAGE_TAG leer lassen: die Container App startet mit einem Platzhalter-Image
az deployment group create -g rg-pain-therapy -n main -f infra/main.bicep -p infra/main.bicepparam
```

`AUTH_SECRET` und `POSTGRES_ADMIN_PASSWORD` gleich als GitHub-Secrets speichern (Schritt 5), sie werden bei jedem Deployment wieder gesetzt.

Die Ausgaben ansehen: `az deployment group show -g rg-pain-therapy -n main --query properties.outputs`

### 3. DNS

In der Zone `ayanta.ch`:

| Typ | Name | Wert |
| --- | --- | --- |
| CNAME | `pain-therapy` | Ausgabe `appFqdn` |
| TXT | `asuid.pain-therapy` | Ausgabe `customDomainVerificationId` |

Azure prüft den TXT-Eintrag, sobald die Domain an der App hängt; deshalb kommt sie erst jetzt dazu. Sobald beide Einträge auflösen (`dig +short TXT asuid.pain-therapy.ayanta.ch`), in zwei Läufen erst die Domain hinzufügen und dann das verwaltete Zertifikat ausstellen und binden:

```bash
CUSTOM_DOMAIN_MODE=add  az deployment group create -g rg-pain-therapy -n main -f infra/main.bicep -p infra/main.bicepparam
CUSTOM_DOMAIN_MODE=bind az deployment group create -g rg-pain-therapy -n main -f infra/main.bicep -p infra/main.bicepparam
```

Danach die GitHub-Variable `CUSTOM_DOMAIN_MODE` auf `bind` setzen.

### 4. E-Mail

Graph-Berechtigung und Beschränkung auf das Absenderpostfach nach [entra.md](entra.md) Schritt 6.

### 5. GitHub: OIDC und Umgebung

1. App-Registrierung für GitHub Actions anlegen (z. B. `github-pain-therapy-deploy`), *Federated credential* → *GitHub Actions deploying Azure resources*: Organisation `bluemike`, Repository `pain-therapy`, Entity *Environment*, Name `production`.
2. Dieser App auf der Ressourcengruppe die Rollen *Contributor*, *User Access Administrator* (für die Rollenzuweisungen im Bicep, eingeschränkt auf die vier Rollen AcrPull, Key Vault Secrets User, Storage Blob Data Contributor, Storage Blob Data Reader) und auf der Registry *AcrPush* geben.
3. Im Repository unter *Settings → Environments* die Umgebung `production` anlegen (empfohlen: *Required reviewers*) mit
   - **Variables:** `AZURE_CLIENT_ID` (GitHub-App), `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP` = `rg-pain-therapy`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `MAIL_SENDER`, `CUSTOM_DOMAIN_MODE`, ab Iteration 4 `ZONE_CUSTOM_DOMAIN_MODE`
   - **Secrets:** `ENTRA_CLIENT_SECRET`, `AUTH_SECRET`, `POSTGRES_ADMIN_PASSWORD`, ab Iteration 4 `PATIENT_ZONE_DB_PASSWORD`
4. Repository-Variable `AZURE_DEPLOY_ENABLED` = `true`. Ab dann deployt jeder Push auf `main`; manuell über *Actions → Deploy to Azure → Run workflow*.

## Ablauf eines Deployments

0. Ab Iteration 4: Abbruch mit klarer Meldung, wenn das GitHub-Secret `PATIENT_ZONE_DB_PASSWORD` fehlt, bevor etwas gebaut oder in Azure geändert wird.
1. Images bauen und als `pain-therapy:<commit>` und `pain-therapy-zone:<commit>` in die Registry schieben.
2. Migrationsjob mit dem neuen Image starten (`sh prisma/migrate.sh`: Migrationen, Rolle `patient_zone`, dann Therapiekatalog aus `prisma/catalog/`) und auf Erfolg warten. Schlägt er fehl, bricht das Deployment ab und die alte Revision läuft weiter. Ein frisches Deployment hat danach den vollständigen Katalog; erneutes Einspielen ändert nichts.
3. Bicep anwenden: Infrastruktur abgleichen (ab Iteration 2 inklusive Container `clinical-photos` und `AZURE_STORAGE_PHOTO_CONTAINER`, ab Iteration 3 Container `exercise-media`, `AZURE_STORAGE_EXERCISE_CONTAINER` und Blob-Zugriff des Migrationsjobs) und neue Revision mit dem neuen Image ausrollen.
4. Smoke-Test auf `/api/health` beider Apps.

**Rollback:** `az containerapp revision list -g rg-pain-therapy -n ca-pain-therapy -o table`, dann die vorherige Revision aktivieren oder den Workflow mit dem alten Commit erneut starten. Migrationen sind nur additiv (Iteration 2: neue Tabellen für Katalog, Behandlungen, Konsultationen und Fotos), ein Rollback der App braucht kein Rollback der Datenbank.

## Iteration 2 (Behandlungen, Konsultationen, Fotos)

Vor dem ersten Deployment mit Iteration 2 einmal prüfen, dass Bicep nur den neuen Container und die neue Umgebungsvariable ändert:

```bash
az deployment group what-if -g rg-pain-therapy -n main -f infra/main.bicep -p infra/main.bicepparam
```

Erwartet: *Create* `…/blobServices/default/containers/clinical-photos`, *Modify* der Container App (`AZURE_STORAGE_PHOTO_CONTAINER`, neues Image) und des Migrationsjobs (Kommando `sh prisma/migrate.sh`). Die bestehende Rolle *Storage Blob Data Contributor* gilt für den ganzen Storage Account und deckt den neuen Container ab. Formulare mit Fotos dürfen bis 25 MB gross sein (`serverActions.bodySizeLimit`); bei der Abnahme einmal 10 Fotos auf einmal speichern, um auch die Grenze des Ingress zu prüfen.

## Iteration 3 (Selbstausführung, Übungsblatt)

Die Bilder und Texte der Übungsblätter gehören Liebscher & Bracht und liegen **nie** im Repository oder im Image. Sie kommen einmalig von Hand aus OneDrive (`Ayanta Home - Dokumente/pain-therapy/exercises/digitalisiert/`) in den privaten Container `exercise-media`. Fehlen sie, läuft die App trotzdem: Bilder zeigen "Bild nicht verfügbar", das PDF druckt die Texte oder "Blatt nicht verfügbar", und der Zeitbedarf kommt ohnehin aus `prisma/catalog/exercise-sheets.json`.

### 1. Bicep prüfen

```bash
az deployment group what-if -g rg-pain-therapy -n main -f infra/main.bicep -p infra/main.bicepparam
```

Erwartet: *Create* `…/blobServices/default/containers/exercise-media`, *Modify* der Container App (`AZURE_STORAGE_EXERCISE_CONTAINER`, neues Image) und des Migrationsjobs (Umgebungsvariablen `AZURE_CLIENT_ID`, `STORAGE_DRIVER`, `AZURE_STORAGE_ACCOUNT_URL`, `AZURE_STORAGE_EXERCISE_CONTAINER`). Sonst nichts. Die Managed Identity hat über *Storage Blob Data Contributor* auf dem Storage Account bereits Lesezugriff auf den neuen Container.

### 2. Medien hochladen

Der Container ist flach, ohne Unterordner. Die Dateinamen stehen pro Übung in `prisma/catalog/exercise-sheets.json` (`mainImage`, `sheetImage`) und müssen genau so heissen (Gross-/Kleinschreibung beachten):

```
exercise-media/
  1A.jpg  1A-blatt.png      Hauptbild (JPEG) und ganzes Blatt (PNG), je Code
  1B.jpg  1B-blatt.png
  …                          1A–1F, 2A–2F, 3A–3H, 4A–4G (27 Übungen, 54 Bilder)
  4G.jpg  4G-blatt.png
  exercises-content.json    Texte der Abschnitte
```

`uebersicht-hauptbilder.png` wird nicht gebraucht und kann mitkommen oder wegbleiben. `exercises-content.json` hat diese Form (die Leseroutine in `prisma/catalog/sync.mjs` akzeptiert auch `{ "exercises": [...] }`, ein Objekt mit dem Code als Schlüssel, `sections` als Unterobjekt und Schritte als reine Texte):

```json
[
  {
    "code": "1A",
    "rolling": "Text des Abschnitts Faszien-Rollmassage",
    "steps": [{ "label": "Schritt 1", "text": "…" }, { "label": "Schritt 2", "text": "…" }],
    "variants": "Text der Varianten oder null"
  }
]
```

Hochladen mit einem Konto, das auf dem Storage Account die Rolle *Storage Blob Data Contributor* hat (einmalig zuweisen: `az role assignment create --assignee <upn> --role "Storage Blob Data Contributor" --scope <storageAccountId>`):

```bash
az storage blob upload-batch --account-name <storageAccountName> --auth-mode login \
  -d exercise-media -s "<OneDrive>/pain-therapy/exercises/digitalisiert" \
  --pattern "*" --overwrite
az storage blob list --account-name <storageAccountName> --auth-mode login -c exercise-media --query "length(@)"
```

Erwartet: 55 Blobs (56 mit der Übersicht). Neu digitalisieren lässt sich mit `scripts/import-exercise-sheets.py` aus dem PDF der Sammelmappe; das Skript schreibt dieselben Dateinamen.

### 3. Texte einspielen

`catalog:sync` im Migrationsjob liest `exercises-content.json` aus dem Container. Beim ersten Deployment mit Iteration 3 läuft der Job noch vor Bicep, also ohne die neuen Umgebungsvariablen; er meldet dann `exercises-content.json: not found; exercise texts unchanged` und lässt die Texte leer. Nach dem Deployment (und nach jedem späteren Upload neuer Texte) den Job einmal von Hand starten:

```bash
az containerapp job start -g rg-pain-therapy -n caj-pain-therapy-migrate
```

Prüfen: *Katalog → Übungen → 2A* zeigt Hauptbild, Abschnitte, Zeitbedarf und das ganze Blatt. Bilder ersetzen braucht keinen Neustart (die Browser halten sie höchstens eine Stunde im Cache); geänderte Texte brauchen den Job.

## Iteration 4 (Patienten-Zone)

Die Patienten-Zone ist eine zweite Container App (`apps/patient-zone`, Image `pain-therapy-zone`) mit eigener Identität und eigener Datenbankrolle `patient_zone`, die nur die nötigen Spalten lesen und nur eigene Einträge schreiben darf (`prisma/patient-zone-role.sql`). Alles ist additiv: bestehende Ressourcen behalten Namen und Verhalten, die Praxis-App bekommt nur die Variable `PATIENT_ZONE_URL`. Solange sie leer ist (bis der Hostname gebunden ist), bleiben *Link senden* und die Checkbox *Link zur Patienten-Zone mitsenden* ausgeblendet.

### 1. Vor dem ersten Deployment (Praxis)

1. **GitHub-Secret** `PATIENT_ZONE_DB_PASSWORD` in der Umgebung `production` anlegen, nur Buchstaben und Ziffern:
   ```bash
   openssl rand -base64 32 | tr -d '/+='
   ```
   Fehlt es, bricht der Workflow im ersten Schritt mit der Meldung *Missing secret* ab, ohne etwas zu ändern.
2. **Rolle der GitHub-App erweitern:** Die neue Identität braucht *Storage Blob Data Reader* (auf `exercise-media`). Ist *User Access Administrator* der Deploy-App auf bestimmte Rollen eingeschränkt (Einrichtung Schritt 5.2), *Storage Blob Data Reader* zur Bedingung hinzufügen. Sonst scheitert das Bicep-Deployment an der Rollenzuweisung.
3. Optional prüfen, was Bicep ändert (mit den Secrets als Umgebungsvariablen wie in Schritt 2 der Einrichtung, zusätzlich `PATIENT_ZONE_DB_PASSWORD`):
   ```bash
   az deployment group what-if -g rg-pain-therapy -n main -f infra/main.bicep -p infra/main.bicepparam
   ```
   Erwartet: *Create* Identität `id-pain-therapy-zone`, drei Key-Vault-Secrets, vier Rollenzuweisungen, Container App `ca-pain-therapy-zone`; *Modify* der Container App `ca-pain-therapy` (nur `PATIENT_ZONE_URL`, leer, und das Image) und des Migrationsjobs (Secret und Variable `PATIENT_ZONE_DB_PASSWORD`). Sonst nichts.

### 2. Erstes Deployment: Reihenfolge

Der Workflow erledigt das allein; diese Reihenfolge ist nötig, weil der Migrationsjob vor dem Bicep-Lauf startet und das Passwort der Rolle sonst noch nicht kennt:

1. Prüfen, dass `PATIENT_ZONE_DB_PASSWORD` gesetzt ist.
2. Beide Images bauen und pushen.
3. **Nur beim ersten Mal** (der Migrationsjob hat noch keine Variable `PATIENT_ZONE_DB_PASSWORD`): Bicep mit dem Image-Tag, das gerade live ist, und ohne Zonen-Image. Das legt Secrets, Identität, die Variable des Migrationsjobs und eine Platzhalter-Zone an; die Praxis-App läuft mit ihrem bisherigen Image weiter.
4. Migrationsjob mit dem neuen Image: neue Tabellen, Rolle `patient_zone` mit Passwort und Rechten, Katalog.
5. Bicep mit beiden neuen Images.
6. Smoke-Test `/api/health` beider Apps (die Zone skaliert auf 0, der erste Aufruf dauert einige Sekunden).

Ab dem zweiten Deployment entfällt Schritt 3. Von Hand (ohne Workflow) dieselbe Reihenfolge: `IMAGE_TAG=<live-Tag> ZONE_IMAGE_TAG= az deployment group create …`, dann `az containerapp job start -g rg-pain-therapy -n caj-pain-therapy-migrate`, dann `IMAGE_TAG=<neu> ZONE_IMAGE_TAG=<neu> az deployment group create …`.

### 3. DNS und Hostname (später, durch die Praxis)

Erst wenn die Praxis bereit ist, in der Zone `ayanta.ch`:

| Typ | Name | Wert |
| --- | --- | --- |
| CNAME | `patient.pain-therapy` | Ausgabe `zoneFqdn` |
| TXT | `asuid.patient.pain-therapy` | Ausgabe `customDomainVerificationId` (dieselbe wie für die Praxis-App) |

Sobald beide auflösen, wie bei der Praxis-App in zwei Läufen: GitHub-Variable `ZONE_CUSTOM_DOMAIN_MODE` = `add`, Workflow starten; dann `bind`, Workflow erneut starten. Mit `bind` setzt Bicep `PATIENT_ZONE_URL=https://patient.pain-therapy.ayanta.ch` in der Praxis-App, und *Link senden* sowie die Checkbox erscheinen.

### 4. Vor dem Go-live der Zone (Praxis)

- **Datenschutzhinweis** der Zone (`apps/patient-zone/messages/de.json` und `en.json`, Abschnitt `privacy`) und den kurzen Hinweis unter der Bestätigung (`common.privacyShort`) prüfen und bestätigen.
- **Text der E-Mails** mit dem Link (`messages/de.json` und `en.json`: `accessLinkEmail.body` und `handoutEmail.bodyWithLink`) sowie das Zugangsblatt (`accessSheet`) prüfen und bestätigen.
- Einmal durchspielen: Übungsblatt mit Link an eine Test-Patientin senden, Link auf dem Telefon öffnen, Geburtsdatum bestätigen, Einträge erfassen, *Heimprogramm* im Cockpit und *Übungstagebuch* in der Akte prüfen, *Link sperren*.

**Rollback:** vorherige Revision beider Apps aktivieren (`az containerapp revision list -n ca-pain-therapy-zone …`). Die neuen Tabellen und die Rolle bleiben; die alte Praxis-App kennt sie nicht und stört sich nicht daran. Die Zone lässt sich jederzeit abschalten, indem `ZONE_CUSTOM_DOMAIN_MODE` auf `off` zurückgeht (blendet die Link-Funktionen aus) oder bis zum nächsten Deployment die Rolle `patient_zone` gesperrt wird (`ALTER ROLE patient_zone NOLOGIN`; der Migrationsjob setzt `LOGIN` wieder).

## Iteration 5 (Unterschrift in der Patienten-Zone)

Die Patientin unterschreibt den Haftungsausschluss auf dem eigenen Telefon. Die Zone speichert nur Unterschrift und Einwilligungen; PDF, Archiv und E-Mail macht weiterhin die Praxis-App. Alles ist additiv, ohne neuen Parameter und ohne neues GitHub-Secret:

- **Key Vault:** Secret `zone-internal-secret` (aus `AUTH_SECRET` und `PATIENT_ZONE_DB_PASSWORD` abgeleitet), gelesen von der Praxis-App (Rolle auf dem Vault wie bisher) und von der Zone (neue Rollenzuweisung *Key Vault Secrets User* nur auf diesem Secret).
- **Praxis-App:** Variable `ZONE_INTERNAL_SECRET`. Die Routen `/api/internal/signatures/…` sind von der Entra-Anmeldung ausgenommen und nehmen nur Aufrufe mit gültigem HMAC an.
- **Zone:** Variablen `ZONE_INTERNAL_SECRET` und `PRACTICE_INTERNAL_URL` (Standard-Hostname `ca-pain-therapy.<Umgebung>.azurecontainerapps.io`, unabhängig vom eigenen Hostnamen). Nach einer Unterschrift ruft sie die Praxis-App auf, die das PDF erzeugt.
- **Job** `caj-pain-therapy-finalize` (Zeitplan alle 5 Minuten, Image und Identität der Praxis-App, `node scripts/finalize-pending.mjs`): erzeugt das PDF für Unterschriften, bei denen der direkte Aufruf nicht geklappt hat.
- **Datenbank:** additive Migration `20261015120000_zone_consent`; der Migrationsjob erweitert die Rechte der Rolle `patient_zone` (Personalien zur Prüfung, Formulartexte, Unterschrift schreiben; keine Dokumente, keine Unterschriftsbilder).

`az deployment group what-if` erwartet: *Create* Secret `zone-internal-secret`, eine Rollenzuweisung, Job `caj-pain-therapy-finalize`; *Modify* der beiden Container Apps (Secret und Variablen). Die Einladung erscheint in der Akte nur, wenn `PATIENT_ZONE_URL` gesetzt ist.

**Vor dem Go-live (Praxis):** Texte der Einladungs-E-Mail (`messages/*.json`, `signatureInviteEmail`), des Zugangsblatts zur Unterschrift (`accessSheet.introSign`, `step3Sign`, `validitySign`) und der Seiten in der Zone (`apps/patient-zone/messages/*.json`, `signTask`, `signForm`, `signThanks`) bestätigen. Einmal durchspielen: neue Test-Patientin per E-Mail einladen, auf dem Telefon unterschreiben, PDF unter *Dokumente* (Kanal *Patienten-Zone*) und die E-Mail prüfen.

**Rollback:** vorherige Revisionen beider Apps aktivieren. Unterschriften aus der Zone ohne PDF verarbeitet der Job nach dem erneuten Ausrollen; der Job selbst lässt sich mit `az containerapp job stop`/`update --trigger-type Manual` anhalten.

## Nach dem Go-live

- **Aufbewahrung sperren:** Die Retention-Policy des Containers `signed-documents` ist zunächst entsperrt, damit sie korrigiert werden kann. Nach der Abnahme sperren (nicht umkehrbar):
  ```bash
  az storage container immutability-policy lock --account-name <storageAccountName> -c signed-documents \
    --if-match $(az storage container immutability-policy show --account-name <storageAccountName> -c signed-documents --query etag -o tsv)
  ```
- **Formulartexte:** Version 1 wird beim ersten Aufruf automatisch angelegt. Vor dem Go-live die Texte rechtlich prüfen lassen und unter *Formulartexte* eine neue Version veröffentlichen.
- **Entwickler-Anmeldung:** ist in Azure immer aus (`CONTAINER_APP_NAME` ist gesetzt), auch wenn `AUTH_DEV_LOGIN` versehentlich gesetzt wäre.

## Offene Punkte

- Datenbankzugriff per Entra-Token statt Passwort, sobald Prisma Token-Erneuerung unterstützt; bis dahin Passwort im Key Vault und Rotation per neuem Deployment.
- Netzwerkisolation (VNet-Integration, Private Endpoints für Postgres, Storage, Key Vault), falls Ayanta das für Gesundheitsdaten verlangt. Die Container Apps Umgebung müsste dazu mit VNet neu angelegt werden.
- Läuft der bestehende Ayanta-Container als App Service statt Container App, ändern sich nur Bicep und Workflow (design.md, offene Fragen).
