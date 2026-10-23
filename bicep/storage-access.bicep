targetScope = 'resourceGroup'

param storageName string
param templateStorageName string
param principalId string

resource storage 'Microsoft.Storage/storageAccounts@2025-08-01' existing = {
  name: storageName
}

resource templateStorage 'Microsoft.Storage/storageAccounts@2025-08-01' existing = {
  name: templateStorageName
}

var blobOwnerRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
)
var tableWriterRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
)

// Host blobs and deployment packages share this account. Blob Data Owner
// covers both; a second Blob Data Contributor grant would be redundant.
resource hostBlobAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, principalId, blobOwnerRoleId)
  scope: storage
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: blobOwnerRoleId
  }
}

// The Functions host persists diagnostic events in its own storage tables.
resource hostTableAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, principalId, tableWriterRoleId)
  scope: storage
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: tableWriterRoleId
  }
}

// Saved templates use a separate account and only need table data access.
resource templateTableAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(templateStorage.id, principalId, tableWriterRoleId)
  scope: templateStorage
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: tableWriterRoleId
  }
}
