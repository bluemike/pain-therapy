// Azure resources for pain-therapy.ayanta.ch (design D2, D3, D8). Deploy into a resource group in Switzerland North:
//   az deployment group create -g rg-pain-therapy -f infra/main.bicep -p infra/main.bicepparam
// See docs/deployment.md for the first deployment, DNS and the managed certificate.

targetScope = 'resourceGroup'

@description('All data stays in Switzerland North.')
@allowed(['switzerlandnorth'])
param location string = 'switzerlandnorth'

@description('Short name used in resource names.')
param name string = 'pain-therapy'

@description('Public host name of the app.')
param customDomain string = 'pain-therapy.ayanta.ch'

@description('''Custom domain on the app: off for the first deployment (before the DNS records exist),
add once DNS resolves (Azure verifies the TXT record), bind to issue and bind the managed certificate. See docs/deployment.md.''')
@allowed(['off', 'add', 'bind'])
param customDomainMode string = 'off'

@description('Container image tag in the registry. Empty on the very first deployment, before any image was pushed.')
param imageTag string = ''

@description('Ayanta Entra ID tenant.')
param entraTenantId string

@description('Client ID of the "Ayanta Schmerztherapie" app registration (docs/entra.md).')
param entraClientId string

@secure()
@description('Client secret of the app registration.')
param entraClientSecret string

@secure()
@description('Random secret for signing session cookies, at least 32 characters (openssl rand -base64 32).')
param authSecret string

@description('Administrator login of the PostgreSQL server.')
param postgresAdminLogin string = 'painadmin'

@secure()
param postgresAdminPassword string

@description('Mailbox that sends the signed PDFs (Graph sendMail), e.g. pain-therapy@ayanta.ch.')
param mailSender string

@description('Default place shown on the signing page.')
param defaultPlace string = 'Falera'

@description('Retention of signed PDFs in days; 7300 days = 20 years after signing.')
param documentRetentionDays int = 7300

// ---------- Patient zone (iteration 4, design D13) ----------

@description('Public host name of the patient zone (second Container App).')
param zoneCustomDomain string = 'patient.pain-therapy.ayanta.ch'

@description('''Custom domain on the patient zone, like customDomainMode: off until the DNS records exist, then add,
then bind. Until bind, PATIENT_ZONE_URL of the practice app stays empty and the link features stay hidden.''')
@allowed(['off', 'add', 'bind'])
param zoneCustomDomainMode string = 'off'

@description('Image tag of pain-therapy-zone in the registry. Empty until the first zone image was pushed.')
param zoneImageTag string = ''

@secure()
@description('Password of the database role patient_zone, set by the migration job (prisma/patient-zone-role.mjs).')
param patientZoneDbPassword string

param tags object = { app: 'pain-therapy' }

var suffix = uniqueString(resourceGroup().id)
var dbName = 'pain_therapy'
var image = empty(imageTag) ? 'mcr.microsoft.com/k8se/quickstart:latest' : '${registry.properties.loginServer}/pain-therapy:${imageTag}'
var appPort = empty(imageTag) ? 80 : 3000
var zoneImage = empty(zoneImageTag)
  ? 'mcr.microsoft.com/k8se/quickstart:latest'
  : '${registry.properties.loginServer}/pain-therapy-zone:${zoneImageTag}'
var zonePort = empty(zoneImageTag) ? 80 : 3000
// Shown to the practice app only once the host name of the zone is bound (design D13)
var patientZoneUrl = zoneCustomDomainMode == 'bind' ? 'https://${zoneCustomDomain}' : ''
// Address of the practice app for the zone and the finalize job (iteration 5, design D11): its default host name in
// the Container Apps environment, so the calls do not depend on the custom domain. /api/internal/* takes only calls
// signed with zone-internal-secret.
var practiceInternalUrl = 'https://ca-${name}.${environment.properties.defaultDomain}'

var roles = {
  acrPull: '7f951dda-4ed3-4680-a7ca-43fe172d538d'
  keyVaultSecretsUser: '4633458b-17de-408a-b874-0445c86b69e6'
  storageBlobDataContributor: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
  storageBlobDataReader: '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'
}

// ---------- Monitoring and identity ----------

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${name}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 90
  }
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${name}'
  location: location
  tags: tags
}

// The patient zone has its own identity with the least rights: pull its image, read its two secrets, read the
// exercise media (iteration 4, design D13)
resource zoneIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${name}-zone'
  location: location
  tags: tags
}

// ---------- Container registry ----------

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: 'acrpaintherapy${suffix}'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, identity.id, roles.acrPull)
  scope: registry
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.acrPull)
  }
}

resource zoneAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, zoneIdentity.id, roles.acrPull)
  scope: registry
  properties: {
    principalId: zoneIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.acrPull)
  }
}

// ---------- Key Vault ----------

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-pain-${suffix}'
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
  }
}

resource vaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, identity.id, roles.keyVaultSecretsUser)
  scope: vault
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsUser)
  }
}

resource secretAuth 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'auth-secret'
  properties: { value: authSecret }
}

resource secretEntra 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'entra-client-secret'
  properties: { value: entraClientSecret }
}

resource secretDatabaseUrl 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'database-url'
  properties: {
    value: 'postgresql://${postgresAdminLogin}:${uriComponent(postgresAdminPassword)}@${postgres.properties.fullyQualifiedDomainName}:5432/${dbName}?sslmode=require'
  }
}

// Patient zone (iteration 4, design D12, D13): own database role patient_zone with column-level grants. The migration
// job sets the password of the role from patient-zone-db-password; the zone connects with patient-zone-database-url.
resource secretZoneDbPassword 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'patient-zone-db-password'
  properties: { value: patientZoneDbPassword }
}

resource secretZoneDatabaseUrl 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'patient-zone-database-url'
  properties: {
    value: 'postgresql://patient_zone:${uriComponent(patientZoneDbPassword)}@${postgres.properties.fullyQualifiedDomainName}:5432/${dbName}?sslmode=require'
  }
}

// HMAC key for the IP addresses of confirmation attempts; derived from two secrets, so no further parameter is needed
resource secretZone 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'patient-zone-secret'
  properties: {
    value: '${guid(authSecret, patientZoneDbPassword, 'patient-zone-ip-hash')}${guid(patientZoneDbPassword, authSecret, 'patient-zone-ip-hash')}'
  }
}

// Key of the internal calls from the patient zone and the finalize job to the practice app (iteration 5, design D7,
// D11); derived like patient-zone-secret, so no further parameter is needed
resource secretZoneInternal 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'zone-internal-secret'
  properties: {
    value: '${guid(authSecret, patientZoneDbPassword, 'zone-internal')}${guid(patientZoneDbPassword, authSecret, 'zone-internal')}'
  }
}

// Key Vault Secrets User on the three secrets of the zone only, not on the vault
resource zoneSecretUserDatabaseUrl 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(secretZoneDatabaseUrl.id, zoneIdentity.id, roles.keyVaultSecretsUser)
  scope: secretZoneDatabaseUrl
  properties: {
    principalId: zoneIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsUser)
  }
}

resource zoneSecretUserSecret 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(secretZone.id, zoneIdentity.id, roles.keyVaultSecretsUser)
  scope: secretZone
  properties: {
    principalId: zoneIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsUser)
  }
}

resource zoneSecretUserInternal 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(secretZoneInternal.id, zoneIdentity.id, roles.keyVaultSecretsUser)
  scope: secretZoneInternal
  properties: {
    principalId: zoneIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsUser)
  }
}

// ---------- PostgreSQL ----------

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: 'psql-${name}-${suffix}'
  location: location
  tags: tags
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: 32, autoGrow: 'Enabled' }
    backup: { backupRetentionDays: 35, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
    authConfig: { passwordAuth: 'Enabled', activeDirectoryAuth: 'Disabled' }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: dbName
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

// Only Azure services (the Container Apps environment) can connect; no client IPs are allowed.
resource postgresAzureAccess 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

// ---------- Document archive (Blob Storage with immutability) and clinical photos ----------

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'stpain${suffix}'
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_ZRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    publicNetworkAccess: 'Enabled'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    isVersioningEnabled: true
    deleteRetentionPolicy: { enabled: true, days: 365 }
    containerDeleteRetentionPolicy: { enabled: true, days: 365 }
  }
}

resource documents 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'signed-documents'
  properties: {
    publicAccess: 'None'
    immutableStorageWithVersioning: { enabled: true }
  }
}

// Time-based retention: a signed PDF cannot be changed or deleted for documentRetentionDays.
// The policy starts unlocked so it can still be corrected; lock it after go-live (docs/deployment.md).
resource documentRetention 'Microsoft.Storage/storageAccounts/blobServices/containers/immutabilityPolicies@2023-05-01' = {
  parent: documents
  name: 'default'
  properties: {
    immutabilityPeriodSinceCreationInDays: documentRetentionDays
    allowProtectedAppendWrites: false
  }
}

// Clinical photos (iteration 2, design D6): private, versioning and soft delete (365 days) from the blob service
// above, no immutability so mistaken photos can be hidden. Removing a photo in the app never deletes the blob.
resource photos 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'clinical-photos'
  properties: {
    publicAccess: 'None'
  }
}

// Exercise media (iteration 3, design D2): L&B pictures and texts of the digitised exercise sheets, uploaded by
// hand (docs/deployment.md), never part of the repository or the image. Private: the app serves them only to
// signed-in users, catalog:sync in the migration job reads exercises-content.json from here.
resource exerciseMedia 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'exercise-media'
  properties: {
    publicAccess: 'None'
  }
}

resource blobContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, identity.id, roles.storageBlobDataContributor)
  scope: storage
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.storageBlobDataContributor)
  }
}

// The patient zone reads the exercise images and, since iteration 6 (design D4), the archived PDFs of its own
// patient; nothing else in the storage account, and never writes
resource zoneBlobReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(exerciseMedia.id, zoneIdentity.id, roles.storageBlobDataReader)
  scope: exerciseMedia
  properties: {
    principalId: zoneIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.storageBlobDataReader)
  }
}

resource zoneDocumentReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(documents.id, zoneIdentity.id, roles.storageBlobDataReader)
  scope: documents
  properties: {
    principalId: zoneIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.storageBlobDataReader)
  }
}

// ---------- Container Apps ----------

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-${name}'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [{ name: 'Consumption', workloadProfileType: 'Consumption' }]
  }
}

resource certificate 'Microsoft.App/managedEnvironments/managedCertificates@2024-03-01' = if (customDomainMode == 'bind') {
  parent: environment
  name: 'cert-${replace(customDomain, '.', '-')}'
  location: location
  tags: tags
  properties: {
    subjectName: customDomain
    domainControlValidation: 'CNAME'
  }
}

resource zoneCertificate 'Microsoft.App/managedEnvironments/managedCertificates@2024-03-01' = if (zoneCustomDomainMode == 'bind') {
  parent: environment
  name: 'cert-${replace(zoneCustomDomain, '.', '-')}'
  location: location
  tags: tags
  properties: {
    subjectName: zoneCustomDomain
    domainControlValidation: 'CNAME'
  }
}

var secrets = [
  { name: 'database-url', keyVaultUrl: secretDatabaseUrl.properties.secretUri, identity: identity.id }
  { name: 'auth-secret', keyVaultUrl: secretAuth.properties.secretUri, identity: identity.id }
  { name: 'entra-client-secret', keyVaultUrl: secretEntra.properties.secretUri, identity: identity.id }
  { name: 'zone-internal-secret', keyVaultUrl: secretZoneInternal.properties.secretUri, identity: identity.id }
]

var appEnv = [
  { name: 'DATABASE_URL', secretRef: 'database-url' }
  { name: 'AUTH_SECRET', secretRef: 'auth-secret' }
  { name: 'AUTH_URL', value: 'https://${customDomain}' }
  { name: 'AUTH_MICROSOFT_ENTRA_ID_ID', value: entraClientId }
  { name: 'AUTH_MICROSOFT_ENTRA_ID_SECRET', secretRef: 'entra-client-secret' }
  { name: 'AUTH_MICROSOFT_ENTRA_ID_TENANT_ID', value: entraTenantId }
  { name: 'FORCE_HTTPS', value: 'true' }
  { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
  { name: 'STORAGE_DRIVER', value: 'azure' }
  { name: 'AZURE_STORAGE_ACCOUNT_URL', value: storage.properties.primaryEndpoints.blob }
  { name: 'AZURE_STORAGE_CONTAINER', value: documents.name }
  { name: 'AZURE_STORAGE_PHOTO_CONTAINER', value: photos.name }
  { name: 'AZURE_STORAGE_EXERCISE_CONTAINER', value: exerciseMedia.name }
  { name: 'MAIL_DRIVER', value: 'graph' }
  { name: 'MAIL_SENDER', value: mailSender }
  { name: 'DEFAULT_PLACE', value: defaultPlace }
  { name: 'PATIENT_ZONE_URL', value: patientZoneUrl }
  { name: 'ZONE_INTERNAL_SECRET', secretRef: 'zone-internal-secret' }
]

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-${name}'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  dependsOn: [acrPull, vaultSecretsUser, blobContributor]
  properties: {
    environmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      secrets: secrets
      registries: [{ server: registry.properties.loginServer, identity: identity.id }]
      ingress: {
        external: true
        targetPort: appPort
        transport: 'auto'
        allowInsecure: false
        customDomains: customDomainMode == 'off'
          ? []
          : [
              {
                name: customDomain
                bindingType: customDomainMode == 'bind' ? 'SniEnabled' : 'Disabled'
                certificateId: customDomainMode == 'bind' ? certificate.id : null
              }
            ]
      }
    }
    template: {
      containers: [
        {
          name: 'app'
          image: image
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: empty(imageTag) ? [] : appEnv
          probes: empty(imageTag)
            ? []
            : [
                { type: 'Liveness', httpGet: { path: '/api/health', port: 3000 }, periodSeconds: 30 }
                { type: 'Readiness', httpGet: { path: '/api/health', port: 3000 }, periodSeconds: 10 }
              ]
        }
      ]
      // One replica stays warm so the iPad does not wait for a cold start during signing.
      scale: { minReplicas: 1, maxReplicas: 2 }
    }
  }
}

// Runs `prisma migrate deploy` and then `catalog:sync` (prisma/migrate.sh) with the same image before each new
// revision (started by .github/workflows/deploy.yml).
resource migrateJob 'Microsoft.App/jobs@2024-03-01' = {
  name: 'caj-${name}-migrate'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  dependsOn: [acrPull, vaultSecretsUser, blobContributor]
  properties: {
    environmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 600
      replicaRetryLimit: 0
      manualTriggerConfig: { parallelism: 1, replicaCompletionCount: 1 }
      secrets: [
        secrets[0]
        {
          name: 'patient-zone-db-password'
          keyVaultUrl: secretZoneDbPassword.properties.secretUri
          identity: identity.id
        }
      ]
      registries: [{ server: registry.properties.loginServer, identity: identity.id }]
    }
    template: {
      containers: [
        {
          name: 'migrate'
          image: image
          command: empty(imageTag) ? [] : ['sh', 'prisma/migrate.sh']
          // The exercise texts for catalog:sync come from the exercise-media container
          env: [
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
            { name: 'STORAGE_DRIVER', value: 'azure' }
            { name: 'AZURE_STORAGE_ACCOUNT_URL', value: storage.properties.primaryEndpoints.blob }
            { name: 'AZURE_STORAGE_EXERCISE_CONTAINER', value: exerciseMedia.name }
            { name: 'PATIENT_ZONE_DB_PASSWORD', secretRef: 'patient-zone-db-password' }
          ]
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
        }
      ]
    }
  }
}

// Patient zone (iteration 4, design D13): no Entra sign-in, own identity and database role, always one replica
resource zoneApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-${name}-zone'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${zoneIdentity.id}': {} }
  }
  dependsOn: [
    zoneAcrPull
    zoneSecretUserDatabaseUrl
    zoneSecretUserSecret
    zoneSecretUserInternal
    zoneBlobReader
    zoneDocumentReader
  ]
  properties: {
    environmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      secrets: [
        { name: 'database-url', keyVaultUrl: secretZoneDatabaseUrl.properties.secretUri, identity: zoneIdentity.id }
        { name: 'patient-zone-secret', keyVaultUrl: secretZone.properties.secretUri, identity: zoneIdentity.id }
        {
          name: 'zone-internal-secret'
          keyVaultUrl: secretZoneInternal.properties.secretUri
          identity: zoneIdentity.id
        }
      ]
      registries: [{ server: registry.properties.loginServer, identity: zoneIdentity.id }]
      ingress: {
        external: true
        targetPort: zonePort
        transport: 'auto'
        allowInsecure: false
        customDomains: zoneCustomDomainMode == 'off'
          ? []
          : [
              {
                name: zoneCustomDomain
                bindingType: zoneCustomDomainMode == 'bind' ? 'SniEnabled' : 'Disabled'
                certificateId: zoneCustomDomainMode == 'bind' ? zoneCertificate.id : null
              }
            ]
      }
    }
    template: {
      containers: [
        {
          name: 'zone'
          image: zoneImage
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: empty(zoneImageTag)
            ? []
            : [
                { name: 'DATABASE_URL', secretRef: 'database-url' }
                { name: 'PATIENT_ZONE_SECRET', secretRef: 'patient-zone-secret' }
                { name: 'FORCE_HTTPS', value: 'true' }
                { name: 'AZURE_CLIENT_ID', value: zoneIdentity.properties.clientId }
                { name: 'STORAGE_DRIVER', value: 'azure' }
                { name: 'AZURE_STORAGE_ACCOUNT_URL', value: storage.properties.primaryEndpoints.blob }
                { name: 'AZURE_STORAGE_EXERCISE_CONTAINER', value: exerciseMedia.name }
                // Signed disclaimers and exercise sheets in "Dokumente" (iteration 6, design D4), read only
                { name: 'AZURE_STORAGE_CONTAINER', value: documents.name }
                // After a signature the zone asks the practice app for the PDF (iteration 5, design D7)
                { name: 'PRACTICE_INTERNAL_URL', value: practiceInternalUrl }
                { name: 'ZONE_INTERNAL_SECRET', secretRef: 'zone-internal-secret' }
              ]
          probes: empty(zoneImageTag)
            ? []
            : [
                { type: 'Liveness', httpGet: { path: '/api/health', port: 3000 }, periodSeconds: 30 }
                { type: 'Readiness', httpGet: { path: '/api/health', port: 3000 }, periodSeconds: 10 }
              ]
        }
      ]
      // Always one replica: patients open the zone from an email link, a cold start took too long (2026-10-16)
      scale: { minReplicas: 1, maxReplicas: 2 }
    }
  }
}

// Rückfall of design D7 (iteration 5): every 5 minutes, the PDF of signatures from the patient zone that are still
// without one, e.g. because the practice app restarted at that moment. Same image and identity as the practice app.
resource finalizeJob 'Microsoft.App/jobs@2024-03-01' = {
  name: 'caj-${name}-finalize'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  dependsOn: [acrPull, vaultSecretsUser]
  properties: {
    environmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: 300
      replicaRetryLimit: 0
      scheduleTriggerConfig: { cronExpression: '*/5 * * * *', parallelism: 1, replicaCompletionCount: 1 }
      secrets: [secrets[3]]
      registries: [{ server: registry.properties.loginServer, identity: identity.id }]
    }
    template: {
      containers: [
        {
          name: 'finalize'
          image: image
          command: empty(imageTag) ? [] : ['node', 'scripts/finalize-pending.mjs']
          env: [
            { name: 'PRACTICE_INTERNAL_URL', value: practiceInternalUrl }
            { name: 'ZONE_INTERNAL_SECRET', secretRef: 'zone-internal-secret' }
          ]
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
        }
      ]
    }
  }
}

output registryLoginServer string = registry.properties.loginServer
output registryName string = registry.name
output appName string = app.name
output migrateJobName string = migrateJob.name
output appFqdn string = app.properties.configuration.ingress.fqdn
output customDomainVerificationId string = environment.properties.customDomainConfiguration.customDomainVerificationId
output identityPrincipalId string = identity.properties.principalId
output identityClientId string = identity.properties.clientId
output storageAccountName string = storage.name
output keyVaultName string = vault.name
output zoneAppName string = zoneApp.name
output zoneFqdn string = zoneApp.properties.configuration.ingress.fqdn
output zoneIdentityClientId string = zoneIdentity.properties.clientId
