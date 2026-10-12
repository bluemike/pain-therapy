# Entra ID einrichten

Die App meldet Mitarbeitende über Ayanta Entra ID an (Single Tenant) und versendet die unterschriebenen PDFs über Microsoft Graph. Dafür braucht es eine App-Registrierung und eine Berechtigung für die Managed Identity der Container App. Die Schritte brauchen die Rolle *Application Administrator* (App-Registrierung) und *Privileged Role Administrator* oder *Global Administrator* (Graph-Berechtigung), für Schritt 6 Exchange-Administration.

## 1. App-Registrierung anlegen

Entra Admin Center → *Applications* → *App registrations* → *New registration*

- Name: `Ayanta Schmerztherapie`
- Supported account types: *Accounts in this organizational directory only (Single tenant)*
- Redirect URI, Plattform *Web*: `https://pain-therapy.ayanta.ch/api/auth/callback/microsoft-entra-id`
  Für lokale Tests mit echter Anmeldung zusätzlich `http://localhost:3000/api/auth/callback/microsoft-entra-id`.

Notieren: *Application (client) ID* → `ENTRA_CLIENT_ID`, *Directory (tenant) ID* → `ENTRA_TENANT_ID`.

## 2. Client Secret

*Certificates & secrets* → *New client secret*, Laufzeit 24 Monate. Den Wert als GitHub-Secret `ENTRA_CLIENT_SECRET` hinterlegen (siehe [deployment.md](deployment.md)) und einen Kalendereintrag für die Erneuerung setzen.

## 3. App-Rollen

*App roles* → *Create app role*, zweimal:

| Display name | Value | Allowed member types | Beschreibung |
| --- | --- | --- | --- |
| Therapeut:in | `Therapist` | Users/Groups | Patient:innen verwalten, Unterschrift starten |
| Administration | `Admin` | Users/Groups | Zusätzlich Formulartexte veröffentlichen |

Die App liest den Claim `roles` aus dem ID-Token. Wer keine der beiden Rollen hat, sieht «Kein Zugang» mit dem Hinweis, die Rolle anzufragen.

## 4. Optionaler Claim `acct`

*Token configuration* → *Add optional claim* → Token type *ID* → `acct` auswählen. Damit erkennt die App Gastkonten (`acct = 1`) und weist sie ab, auch wenn sie im Tenant eingeladen sind.

## 5. Benutzer:innen zuweisen

*Enterprise applications* → `Ayanta Schmerztherapie` → *Properties*: *Assignment required?* = **Yes**. Danach unter *Users and groups* die Therapeut:innen der Rolle *Therapeut:in* und die Praxisleitung zusätzlich der Rolle *Administration* zuweisen (am einfachsten über zwei Gruppen).

## 6. E-Mail-Versand über Graph

Die App sendet als Postfach `MAIL_SENDER` (z. B. `praxis@ayanta.ch`) über `POST /users/{MAIL_SENDER}/sendMail`. Sie meldet sich dafür mit der Managed Identity der Container App an, es gibt kein Passwort.

1. Der Managed Identity die Graph-Anwendungsberechtigung `Mail.Send` geben. Die Principal ID steht nach dem ersten Deployment in der Ausgabe `identityPrincipalId`:

   ```bash
   MI=<identityPrincipalId>
   GRAPH=$(az ad sp show --id 00000003-0000-0000-c000-000000000000 --query id -o tsv)
   ROLE=$(az ad sp show --id 00000003-0000-0000-c000-000000000000 --query "appRoles[?value=='Mail.Send'].id" -o tsv)
   az rest --method POST \
     --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$MI/appRoleAssignments" \
     --body "{\"principalId\":\"$MI\",\"resourceId\":\"$GRAPH\",\"appRoleId\":\"$ROLE\"}"
   ```

2. `Mail.Send` gilt ohne Einschränkung für alle Postfächer. In Exchange Online auf das Absenderpostfach beschränken (RBAC for Applications):

   ```powershell
   Connect-ExchangeOnline
   New-ServicePrincipal -AppId <identityClientId> -ObjectId <identityPrincipalId> -DisplayName "pain-therapy mail"
   New-ManagementScope -Name "pain-therapy sender" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'praxis@ayanta.ch'"
   New-ManagementRoleAssignment -App <identityClientId> -Role "Application Mail.Send" -CustomResourceScope "pain-therapy sender"
   ```

   Danach die Graph-Berechtigung aus Schritt 1 wieder entfernen, denn die Exchange-Rollenzuweisung ersetzt sie (siehe Microsoft-Doku «Role Based Access Control for Applications in Exchange Online»). Alternativ die ältere *Application Access Policy* mit `New-ApplicationAccessPolicy -AccessRight RestrictAccess` verwenden und die Graph-Berechtigung behalten.

3. Testen: in der App eine Unterschrift mit E-Mail-Einwilligung abschliessen. Die Zustellung erscheint in der Akte unter *Dokumente*; ein Fehler steht dort und im Verlauf.

## Was die App prüft

- Tenant: Nur Tokens mit `tid` = `ENTRA_TENANT_ID` werden akzeptiert (Issuer ist auf den Tenant festgelegt).
- Gastkonten (`acct = 1`) und Konten aus anderen Identity Providern (`idp`-Claim) werden abgewiesen.
- Rollen: `Therapist` oder `Admin`; Formulartexte nur mit `Admin`.
- Sitzung: 30 Minuten ohne Aktivität, danach neue Anmeldung.
- Patientenmodus verlassen: neue Anmeldung mit `prompt=login`, eine bestehende Microsoft-Sitzung reicht nicht.
