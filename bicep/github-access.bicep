targetScope = 'resourceGroup'

param principalId string
param functionAppName string
param uiStorageName string

resource functionApp 'Microsoft.Web/sites@2024-04-01' existing = {
  name: functionAppName
}

var websiteRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'de139f84-1756-47ae-9be6-808fbbe84772')

resource apiDeployAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(functionApp.id, principalId, websiteRoleId)
  scope: functionApp
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: websiteRoleId
  }
}

resource uiStorage 'Microsoft.Storage/storageAccounts@2025-08-01' existing = {
  name: uiStorageName
}
resource uiBlobService 'Microsoft.Storage/storageAccounts/blobServices@2025-08-01' existing = {
  parent: uiStorage
  name: 'default'
}
resource webContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2025-08-01' existing = {
  parent: uiBlobService
  name: '$web'
}

var blobWriterRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')

resource uiDeployAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(webContainer.id, principalId, blobWriterRoleId)
  scope: webContainer
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: blobWriterRoleId
  }
}
