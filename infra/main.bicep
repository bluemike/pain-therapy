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

@description('false for the first deployment (before the DNS records exist), true once DNS points to the app. See docs/deployment.md.')
param bindCertificate bool = false

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

@description('Mailbox that sends the signed PDFs (Graph sendMail), e.g. praxis@ayanta.ch.')
param mailSender string

@description('Default place shown on the signing page.')
param defaultPlace string = 'Mettmenstetten'

@description('Retention of signed PDFs in days; 7300 days = 20 years after signing.')
param documentRetentionDays int = 7300

param tags object = { app: 'pain-therapy' }

var suffix = uniqueString(resourceGroup().id)
var dbName = 'pain_therapy'
var image = empty(imageTag) ? 'mcr.microsoft.com/k8se/quickstart:latest' : '${registry.properties.loginServer}/pain-therapy:${imageTag}'
var appPort = empty(imageTag) ? 80 : 3000

var roles = {
  acrPull: '7f951dda-4ed3-4680-a7ca-43fe172d538d'
  keyVaultSecretsUser: '4633458b-17de-408a-b874-0445c86b69e6'
  storageBlobDataContributor: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
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

// ---------- Document archive (Blob Storage with immutability) ----------

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

resource blobContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, identity.id, roles.storageBlobDataContributor)
  scope: storage
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.storageBlobDataContributor)
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

resource certificate 'Microsoft.App/managedEnvironments/managedCertificates@2024-03-01' = if (bindCertificate) {
  parent: environment
  name: 'cert-${replace(customDomain, '.', '-')}'
  location: location
  tags: tags
  properties: {
    subjectName: customDomain
    domainControlValidation: 'CNAME'
  }
}

var secrets = [
  { name: 'database-url', keyVaultUrl: secretDatabaseUrl.properties.secretUri, identity: identity.id }
  { name: 'auth-secret', keyVaultUrl: secretAuth.properties.secretUri, identity: identity.id }
  { name: 'entra-client-secret', keyVaultUrl: secretEntra.properties.secretUri, identity: identity.id }
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
  { name: 'MAIL_DRIVER', value: 'graph' }
  { name: 'MAIL_SENDER', value: mailSender }
  { name: 'DEFAULT_PLACE', value: defaultPlace }
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
        customDomains: [
          {
            name: customDomain
            bindingType: bindCertificate ? 'SniEnabled' : 'Disabled'
            certificateId: bindCertificate ? certificate.id : null
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

// Runs `prisma migrate deploy` with the same image before each new revision (started by .github/workflows/deploy.yml).
resource migrateJob 'Microsoft.App/jobs@2024-03-01' = {
  name: 'caj-${name}-migrate'
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
      triggerType: 'Manual'
      replicaTimeout: 600
      replicaRetryLimit: 0
      manualTriggerConfig: { parallelism: 1, replicaCompletionCount: 1 }
      secrets: [secrets[0]]
      registries: [{ server: registry.properties.loginServer, identity: identity.id }]
    }
    template: {
      containers: [
        {
          name: 'migrate'
          image: image
          command: empty(imageTag) ? [] : ['prisma', 'migrate', 'deploy']
          env: [{ name: 'DATABASE_URL', secretRef: 'database-url' }]
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
