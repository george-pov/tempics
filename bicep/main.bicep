targetScope = 'subscription'

@description('Azure region for the resource group and all regional resources.')
param location string

@allowed(['dev'])
param environmentName string

@minLength(1)
@maxLength(24)
param resourceGroupName string

@minLength(2)
@maxLength(24)
param functionAppName string

@minLength(1)
@maxLength(24)
param functionPlanName string

@description('Globally unique lowercase letters and digits only.')
@minLength(3)
@maxLength(24)
param storageName string

@description('Globally unique UI website account, separate from Function storage.')
@minLength(3)
@maxLength(24)
param uiStorageName string

@minLength(1)
@maxLength(24)
param insightsName string

@minLength(4)
@maxLength(24)
param workspaceName string

@minValue(1)
@maxValue(1000)
param maxInstances int = 10

@allowed([512, 2048, 4096])
param instanceMemoryMb int = 2048

var baseTags = {
  Application: 'Tempics'
  Environment: environmentName
  Region: location
  ManagedBy: 'Bicep'
  Repository: 'george-pov/tempics'
}

resource resourceGroup 'Microsoft.Resources/resourceGroups@2025-04-01' = {
  name: resourceGroupName
  location: location
  tags: union(baseTags, { Component: 'Environment' })
}

module resources './resources.bicep' = {
  name: 'tempics-${environmentName}'
  scope: resourceGroup
  params: {
    location: location
    baseTags: baseTags
    functionAppName: functionAppName
    functionPlanName: functionPlanName
    storageName: storageName
    uiStorageName: uiStorageName
    insightsName: insightsName
    workspaceName: workspaceName
    packageContainerName: 'app-package-${environmentName}'
    maxInstances: maxInstances
    instanceMemoryMb: instanceMemoryMb
  }
}

output resourceGroupName string = resourceGroup.name
output functionAppName string = resources.outputs.functionAppName
output functionAppUrl string = resources.outputs.functionAppUrl
output uiStorageName string = resources.outputs.uiStorageName
output uiWebsiteUrl string = resources.outputs.uiWebsiteUrl
