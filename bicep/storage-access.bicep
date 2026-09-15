targetScope = 'resourceGroup'

param storageName string
param principalId string

resource storage 'Microsoft.Storage/storageAccounts@2025-08-01' existing = {
  name: storageName
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

// The Functions host persists diagnostic events in tables. This does not
// provision application tables or grant access to another storage account.
resource hostTableAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, principalId, tableWriterRoleId)
  scope: storage
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: tableWriterRoleId
  }
}
