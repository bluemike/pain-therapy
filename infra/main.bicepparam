using './main.bicep'

// Non-secret settings. Secrets come from environment variables, set by the deploy workflow
// from GitHub environment secrets, or exported in the shell for a manual deployment.

// Iteration 12 (design D10): pain-therapy.online; the former host names stay bound during the switch
param domain = 'pain-therapy.online'
param domainMode = readEnvironmentVariable('DOMAIN_MODE', 'off')
param customDomain = 'pain-therapy.ayanta.ch'
param customDomainMode = readEnvironmentVariable('CUSTOM_DOMAIN_MODE', 'off')
param imageTag = readEnvironmentVariable('IMAGE_TAG', '')
param authSecret = readEnvironmentVariable('AUTH_SECRET')
param postgresAdminPassword = readEnvironmentVariable('POSTGRES_ADMIN_PASSWORD')

// Iteration 12: role practice_app, key of the authenticator secrets, SMTP at Infomaniak
param practiceAppDbPassword = readEnvironmentVariable('PRACTICE_APP_DB_PASSWORD')
param authEncryptionKey = readEnvironmentVariable('AUTH_ENCRYPTION_KEY')
param smtpPassword = readEnvironmentVariable('SMTP_PASSWORD')

// Patient zone (iteration 4; new host name in iteration 12)
param zoneDomain = 'patient.pain-therapy.online'
param zoneDomainMode = readEnvironmentVariable('ZONE_DOMAIN_MODE', 'off')
param zoneCustomDomain = 'patient.pain-therapy.ayanta.ch'
param zoneCustomDomainMode = readEnvironmentVariable('ZONE_CUSTOM_DOMAIN_MODE', 'off')
param zoneImageTag = readEnvironmentVariable('ZONE_IMAGE_TAG', '')
param patientZoneDbPassword = readEnvironmentVariable('PATIENT_ZONE_DB_PASSWORD')
