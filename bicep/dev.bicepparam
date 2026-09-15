using './main.bicep'

param location = 'westus2'
param environmentName = 'dev'
param resourceGroupName = 'rg-tempics-dev'
param functionAppName = 'func-tempics-api-dev'
param functionPlanName = 'asp-tempics-api-dev'
param storageName = 'sttempicsfuncdev'
param uiStorageName = 'sttempicsuidev'
param insightsName = 'appi-tempics-api-dev'
param workspaceName = 'log-tempics-dev'
param maxInstances = 10
param instanceMemoryMb = 2048
