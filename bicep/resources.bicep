targetScope = 'resourceGroup'

param location string
param baseTags object
param functionAppName string
param functionPlanName string
param storageName string
param uiStorageName string
param insightsName string
param workspaceName string
param packageContainerName string

@minValue(1)
@maxValue(1000)
param maxInstances int

@allowed([512, 2048, 4096])
param instanceMemoryMb int

param auth object

var apiTags = union(baseTags, { Component: 'Api' })
var monitoringTags = union(baseTags, { Component: 'Monitoring' })

module uiStorage './ui-storage.bicep' = {
  name: 'ui-storage'
  params: {
    location: location
    storageName: uiStorageName
    tags: union(baseTags, { Component: 'Ui' })
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2025-08-01' = {
  name: storageName
  location: location
  tags: union(baseTags, { Component: 'Function' })
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowCrossTenantReplication: false
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2025-08-01' = {
  parent: storage
  name: 'default'
  properties: {}
}

resource packageContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2025-08-01' = {
  parent: blobService
  name: packageContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource workspace 'Microsoft.OperationalInsights/workspaces@2025-02-01' = {
  name: workspaceName
  location: location
  tags: monitoringTags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: insightsName
  location: location
  tags: monitoringTags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
  }
}

resource functionPlan 'Microsoft.Web/serverfarms@2024-11-01' = {
  name: functionPlanName
  location: location
  tags: apiTags
  kind: 'functionapp'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2024-11-01' = {
  name: functionAppName
  location: location
  tags: apiTags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: functionPlan.id
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    siteConfig: {
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'Auth__Instance'
          value: auth.instance
        }
        {
          name: 'Auth__TenantId'
          value: auth.tenantId
        }
        {
          name: 'Auth__ClientId'
          value: auth.clientId
        }
        {
          name: 'Auth__Issuer'
          value: auth.issuer
        }
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storage.name
        }
        {
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: insights.properties.ConnectionString
        }
      ]
    }
    functionAppConfig: {
      runtime: {
        name: 'dotnet-isolated'
        version: '10.0'
      }
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${packageContainer.name}'
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      scaleAndConcurrency: {
        instanceMemoryMB: instanceMemoryMb
        maximumInstanceCount: maxInstances
        // The current Avalonia renderer serializes work within each worker.
        triggers: {
          http: {
            perInstanceConcurrency: 1
          }
        }
        alwaysReady: []
      }
    }
  }
}

// A module makes the new principal ID available when RBAC names are evaluated.
// Including that ID allows a recreated app to receive fresh role assignments.
module storageAccess './storage-access.bicep' = {
  name: 'storage-access'
  params: {
    storageName: storage.name
    principalId: functionApp.identity.principalId
  }
}

output functionAppName string = functionApp.name
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output uiStorageName string = uiStorage.outputs.storageName
output uiWebsiteUrl string = uiStorage.outputs.websiteUrl
