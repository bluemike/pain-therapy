using './main.bicep'

// Non-secret settings. Secrets come from environment variables, set by the deploy workflow
// from GitHub environment secrets, or exported in the shell for a manual deployment.
param customDomain = 'pain-therapy.ayanta.ch'
param bindCertificate = bool(readEnvironmentVariable('BIND_CERTIFICATE', 'false'))
param imageTag = readEnvironmentVariable('IMAGE_TAG', '')
param entraTenantId = readEnvironmentVariable('ENTRA_TENANT_ID')
param entraClientId = readEnvironmentVariable('ENTRA_CLIENT_ID')
param entraClientSecret = readEnvironmentVariable('ENTRA_CLIENT_SECRET')
param authSecret = readEnvironmentVariable('AUTH_SECRET')
param postgresAdminPassword = readEnvironmentVariable('POSTGRES_ADMIN_PASSWORD')
param mailSender = readEnvironmentVariable('MAIL_SENDER')
param defaultPlace = 'Mettmenstetten'
