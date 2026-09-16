targetScope = 'resourceGroup'

@allowed(['westus2'])
param location string
@allowed(['dev'])
param environmentName string
@allowed(['id-tempics-gh-dev'])
param identityName string
@allowed(['func-tempics-api-dev'])
param functionAppName string
@allowed(['george-pov/tempics'])
param repository string = 'george-pov/tempics'
@allowed(['repo:george-pov@287842525/tempics@1368115642'])
param subjectPrefix string

resource deployIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: identityName
  location: location
  properties: {
    isolationScope: 'None'
  }
  tags: {
    Application: 'Tempics'
    Environment: environmentName
    Region: location
    Repository: repository
    Component: 'Deployment'
    ManagedBy: 'Bicep'
  }
}

resource githubCredential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2024-11-30' = {
  parent: deployIdentity
  name: 'github-dev'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    audiences: ['api://AzureADTokenExchange']
    subject: '${subjectPrefix}:environment:${environmentName}'
  }
}

module githubAccess './github-access.bicep' = {
  name: 'github-access'
  params: {
    principalId: deployIdentity.properties.principalId
    functionAppName: functionAppName
  }
}

output clientId string = deployIdentity.properties.clientId
output principalId string = deployIdentity.properties.principalId
output tenantId string = deployIdentity.properties.tenantId
