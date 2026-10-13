# Deployment nach Azure

Ziel: `https://pain-therapy.ayanta.ch`, alle Daten in **Switzerland North**. Die Infrastruktur steht in [`infra/main.bicep`](../infra/main.bicep), das Deployment läuft über [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

## Was angelegt wird

| Ressource | Zweck |
| --- | --- |
| Container App `ca-pain-therapy` | die App (Next.js), 1–2 Replikate, eigene Domain mit verwaltetem Zertifikat |
| Container Apps Job `caj-pain-therapy-migrate` | `prisma/migrate.sh` vor jeder neuen Revision: `prisma migrate deploy`, danach `catalog:sync` (Therapiekatalog) |
| Container Registry | Images aus GitHub Actions |
| PostgreSQL Flexible Server 16 (B1ms) | Datenbank, 35 Tage Backup, nur Azure-Dienste dürfen verbinden |
| Storage Account (ZRS), Container `signed-documents` | PDF-Archiv mit Versionierung und unveränderlicher Aufbewahrung (20 Jahre) |
| Container `clinical-photos` im selben Storage Account | Fotos von Behandlungen und Konsultationen, privat, Versionierung und Soft Delete (365 Tage), ohne Unveränderlichkeit; *Entfernen* in der App blendet nur aus |
| Key Vault | `AUTH_SECRET`, Client Secret, Datenbank-URL |
| User-assigned Managed Identity | Zugriff auf Registry, Key Vault, Blob Storage und Graph (E-Mail) |
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
2. Dieser App auf der Ressourcengruppe die Rollen *Contributor*, *User Access Administrator* (für die Rollenzuweisungen im Bicep, eingeschränkt auf die drei Rollen AcrPull, Key Vault Secrets User, Storage Blob Data Contributor) und auf der Registry *AcrPush* geben.
3. Im Repository unter *Settings → Environments* die Umgebung `production` anlegen (empfohlen: *Required reviewers*) mit
   - **Variables:** `AZURE_CLIENT_ID` (GitHub-App), `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP` = `rg-pain-therapy`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `MAIL_SENDER`, `CUSTOM_DOMAIN_MODE`
   - **Secrets:** `ENTRA_CLIENT_SECRET`, `AUTH_SECRET`, `POSTGRES_ADMIN_PASSWORD`
4. Repository-Variable `AZURE_DEPLOY_ENABLED` = `true`. Ab dann deployt jeder Push auf `main`; manuell über *Actions → Deploy to Azure → Run workflow*.

## Ablauf eines Deployments

1. Image bauen und als `pain-therapy:<commit>` in die Registry schieben.
2. Migrationsjob mit dem neuen Image starten (`sh prisma/migrate.sh`: Migrationen, dann Therapiekatalog aus `prisma/catalog/`) und auf Erfolg warten. Schlägt er fehl, bricht das Deployment ab und die alte Revision läuft weiter. Ein frisches Deployment hat danach den vollständigen Katalog; erneutes Einspielen ändert nichts.
3. Bicep anwenden: Infrastruktur abgleichen (ab Iteration 2 inklusive Container `clinical-photos` und `AZURE_STORAGE_PHOTO_CONTAINER`) und neue Revision mit dem neuen Image ausrollen.
4. Smoke-Test auf `/api/health`.

**Rollback:** `az containerapp revision list -g rg-pain-therapy -n ca-pain-therapy -o table`, dann die vorherige Revision aktivieren oder den Workflow mit dem alten Commit erneut starten. Migrationen sind nur additiv (Iteration 2: neue Tabellen für Katalog, Behandlungen, Konsultationen und Fotos), ein Rollback der App braucht kein Rollback der Datenbank.

## Iteration 2 (Behandlungen, Konsultationen, Fotos)

Vor dem ersten Deployment mit Iteration 2 einmal prüfen, dass Bicep nur den neuen Container und die neue Umgebungsvariable ändert:

```bash
az deployment group what-if -g rg-pain-therapy -n main -f infra/main.bicep -p infra/main.bicepparam
```

Erwartet: *Create* `…/blobServices/default/containers/clinical-photos`, *Modify* der Container App (`AZURE_STORAGE_PHOTO_CONTAINER`, neues Image) und des Migrationsjobs (Kommando `sh prisma/migrate.sh`). Die bestehende Rolle *Storage Blob Data Contributor* gilt für den ganzen Storage Account und deckt den neuen Container ab. Formulare mit Fotos dürfen bis 25 MB gross sein (`serverActions.bodySizeLimit`); bei der Abnahme einmal 10 Fotos auf einmal speichern, um auch die Grenze des Ingress zu prüfen.

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
