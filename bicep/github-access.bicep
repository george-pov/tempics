targetScope = 'resourceGroup'

param principalId string
param functionAppName string

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
