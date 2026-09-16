#Requires -Version 7.2
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-DevCli {
    param(
        [ValidateSet('az', 'gh')][string]$Tool,
        [string[]]$Arguments,
        [AllowNull()][string]$InputText,
        [string]$Operation = 'CLI operation'
    )
    $process = $null
    $started = $false
    $output = $null
    $errors = $null
    try {
        $command = Get-Command $Tool -CommandType Application -ErrorAction Stop | Select-Object -First 1
        $info = [Diagnostics.ProcessStartInfo]::new()
        $info.FileName = $command.Source
        # Bypass the MSI batch shim: ArgumentList never passes through a shell.
        if ($IsWindows -and $Tool -eq 'az' -and $command.Source.EndsWith('.cmd')) {
            $info.FileName = Join-Path (Split-Path (Split-Path $command.Source)) 'python.exe'
            foreach ($part in @('-IBm', 'azure.cli')) { $info.ArgumentList.Add($part) }
        }
        foreach ($argument in $Arguments) { $info.ArgumentList.Add($argument) }
        $info.UseShellExecute = $false
        $info.CreateNoWindow = $true
        $info.RedirectStandardInput = $true
        $info.RedirectStandardOutput = $true
        $info.RedirectStandardError = $true
        $info.StandardInputEncoding = [Text.UTF8Encoding]::new($false)
        $info.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
        # Prevent inherited debug settings from logging CLI request bodies.
        $info.Environment.Remove('GH_DEBUG') | Out-Null
        $info.Environment['AZURE_CORE_LOG_LEVEL'] = 'critical'
        $process = [Diagnostics.Process]::new()
        $process.StartInfo = $info
        $null = $process.Start()
        $started = $true
        $output = $process.StandardOutput.ReadToEndAsync()
        $errors = $process.StandardError.ReadToEndAsync()
        if ($null -ne $InputText) { $process.StandardInput.Write($InputText) }
        $process.StandardInput.Close()
        if (-not $process.WaitForExit(120000)) {
            $process.Kill($true)
            throw 'CLI timeout'
        }
        $result = $output.GetAwaiter().GetResult()
        $null = $errors.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) {
            throw "$Operation failed (exit $($process.ExitCode))."
        }
        return $result
    }
    catch {
        # Never forward native stderr, arguments, stdin, or exception payloads.
        $code = if ($started -and $process.HasExited) { $process.ExitCode } else { 'unavailable' }
        throw "$Operation failed (exit $code)."
    }
    finally {
        $InputText = $null
        $result = $null
        $output = $null
        $errors = $null
        if ($null -ne $process) { $process.Dispose() }
    }
}

function Assert-DevGuid {
    param([string]$Value)
    $parsed = [guid]::Empty
    if (-not [guid]::TryParseExact($Value, 'D', [ref]$parsed) -or $parsed -eq [guid]::Empty) {
        throw 'Invalid Azure identifier.'
    }
}

function Get-DevContext {
    param(
        [Parameter(Mandatory)][string]$SubscriptionId,
        [string]$ResourceGroup = 'rg-tempics-dev',
        [string]$IdentityName = 'id-tempics-gh-dev',
        [string]$FunctionAppName = 'func-tempics-api-dev',
        [string]$Repository = 'george-pov/tempics',
        [string]$EnvironmentName = 'dev'
    )
    Assert-DevGuid $SubscriptionId
    if ($ResourceGroup -cne 'rg-tempics-dev' -or $IdentityName -cne 'id-tempics-gh-dev' -or
        $FunctionAppName -cne 'func-tempics-api-dev' -or $Repository -cne 'george-pov/tempics' -or
        $EnvironmentName -cne 'dev') { throw 'Only the reviewed Tempics dev target is allowed.' }
    $account = Invoke-DevCli az @('account', 'show', '--subscription', $SubscriptionId,
        '--query', '{id:id,tenantId:tenantId}', '-o', 'json') -Operation 'Read subscription' | ConvertFrom-Json
    if ($account.id -ne $SubscriptionId) { throw 'Subscription mismatch.' }
    Assert-DevGuid $account.tenantId
    $scope = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup"
    $group = Invoke-DevCli az @('group', 'show', '--subscription', $SubscriptionId, '-n', $ResourceGroup,
        '--query', '{id:id,location:location}', '-o', 'json') -Operation 'Read resource group' | ConvertFrom-Json
    if ($group.id -ine $scope -or $group.location -ne 'westus2') { throw 'Resource group mismatch.' }
    $identity = Invoke-DevCli az @('identity', 'show', '--subscription', $SubscriptionId, '-g', $ResourceGroup,
        '-n', $IdentityName, '--query', '{id:id,clientId:clientId,principalId:principalId,tenantId:tenantId}', '-o', 'json') -Operation 'Read deployment identity' | ConvertFrom-Json
    if ($identity.id -ine "$scope/providers/Microsoft.ManagedIdentity/userAssignedIdentities/$IdentityName" -or
        $identity.tenantId -ne $account.tenantId) { throw 'Identity or tenant mismatch.' }
    Assert-DevGuid $identity.clientId
    Assert-DevGuid $identity.principalId
    $appId = "$scope/providers/Microsoft.Web/sites/$FunctionAppName"
    $app = Invoke-DevCli az @('resource', 'show', '--ids', $appId, '--subscription', $SubscriptionId,
        '--api-version', '2024-04-01', '--query', '{id:id,kind:kind,sku:properties.sku,host:properties.defaultHostName,runtime:properties.functionAppConfig.runtime}',
        '-o', 'json') -Operation 'Read Function metadata' | ConvertFrom-Json
    if ($app.id -ine $appId -or $app.kind -notmatch '(^|,)linux(,|$)' -or $app.sku -ne 'FlexConsumption' -or
        $app.runtime.name -ne 'dotnet-isolated' -or $app.runtime.version -ne '10.0' -or
        $app.host -notmatch '^func-tempics-api-dev(?:-[a-z0-9]+)?(?:\.[a-z0-9-]+)?\.azurewebsites\.net$') {
        throw 'Function metadata mismatch.'
    }
    $repo = Invoke-DevCli gh @('api', "repos/$Repository", '--jq', '{full_name,default_branch}') -Operation 'Read repository' | ConvertFrom-Json
    if ($repo.full_name -cne $Repository -or $repo.default_branch -cne 'main') { throw 'Repository mismatch.' }
    return @{
        Repository = $Repository; EnvironmentName = $EnvironmentName
        SubscriptionId = $SubscriptionId; ResourceGroup = $ResourceGroup; FunctionAppName = $FunctionAppName
        Variables = [ordered]@{
            AZURE_CLIENT_ID = $identity.clientId; AZURE_TENANT_ID = $identity.tenantId
            AZURE_SUBSCRIPTION_ID = $SubscriptionId; AZURE_RESOURCE_GROUP = $ResourceGroup
            AZURE_FUNCTION_APP = $FunctionAppName; TP_ENV = 'dev'; TP_API_URL = "https://$($app.host)/api"
        }
    }
}

function Get-DevPolicy {
    param($Context)
    $path = "repos/$($Context.Repository)/environments"
    $pages = Invoke-DevCli gh @('api', "${path}?per_page=100", '--paginate', '--slurp') -Operation 'Read environments' | ConvertFrom-Json
    $environment = @($pages | ForEach-Object { $_.environments } | Where-Object { $null -ne $_ -and $_.name -ceq 'dev' })
    if ($environment.Count -eq 0) { return @{ Exists = $false; Main = $false } }
    $details = Invoke-DevCli gh @('api', "$path/dev") -Operation 'Read dev policy' | ConvertFrom-Json
    if ($null -eq $details.deployment_branch_policy -or
        $details.deployment_branch_policy.protected_branches -ne $false -or
        $details.deployment_branch_policy.custom_branch_policies -ne $true) {
        throw 'Incompatible dev branch policy; review it before changing setup.'
    }
    $pages = Invoke-DevCli gh @('api', "$path/dev/deployment-branch-policies?per_page=100", '--paginate', '--slurp') -Operation 'Read branch rules' | ConvertFrom-Json
    $rules = @($pages | ForEach-Object { $_.branch_policies } | Where-Object { $null -ne $_ })
    if (@($rules | Where-Object { $_.name -cne 'main' -or $_.type -cne 'branch' }).Count -gt 0 -or $rules.Count -gt 1) {
        throw 'Incompatible dev branch rules; existing rules were preserved.'
    }
    return @{ Exists = $true; Main = ($rules.Count -eq 1) }
}

function Set-DevEnvironment {
    param($Context)
    $policy = Get-DevPolicy $Context
    $path = "repos/$($Context.Repository)/environments/dev"
    if (-not $policy.Exists) {
        $body = @{ deployment_branch_policy = @{ protected_branches = $false; custom_branch_policies = $true } } | ConvertTo-Json -Depth 5 -Compress
        $null = Invoke-DevCli gh @('api', $path, '--method', 'PUT', '--input', '-') -InputText $body -Operation 'Create dev environment'
    }
    # Existing environments are never PUT: reviewers, timers and custom rules stay intact.
    if (-not $policy.Main) {
        $body = @{ name = 'main'; type = 'branch' } | ConvertTo-Json -Compress
        $null = Invoke-DevCli gh @('api', "$path/deployment-branch-policies", '--method', 'POST', '--input', '-') -InputText $body -Operation 'Set main branch rule'
    }
    $verified = Get-DevPolicy $Context
    if (-not $verified.Exists -or -not $verified.Main) { throw 'Dev policy readback failed.' }
}

function Set-DevVariable {
    param($Context, [string]$Name, [string]$Value)
    if (-not $Context.Variables.Contains($Name) -or $Context.Variables[$Name] -cne $Value) {
        throw 'Variable is outside the verified allowlist.'
    }
    $null = Invoke-DevCli gh @('variable', 'set', $Name, '--repo', $Context.Repository,
        '--env', 'dev') -InputText $Value -Operation "Set $Name"
    $readback = Invoke-DevCli gh @('api', "repos/$($Context.Repository)/environments/dev/variables/$Name") -Operation "Verify $Name" | ConvertFrom-Json
    if ($readback.name -cne $Name -or $readback.value -cne $Value) { throw 'Variable readback mismatch.' }
}

function Set-DevSecret {
    param($Context, [Parameter(Mandatory)][string]$KeyName)
    if ($KeyName -notmatch '^[A-Za-z0-9_-]{1,128}$') { throw 'Invalid existing key name.' }
    $policy = Get-DevPolicy $Context
    if (-not $policy.Exists -or -not $policy.Main) { throw 'Configure the protected dev environment first.' }
    $key = $null
    try {
        $key = Invoke-DevCli az @('functionapp', 'function', 'keys', 'list', '--subscription', $Context.SubscriptionId,
            '-g', $Context.ResourceGroup, '-n', $Context.FunctionAppName, '--function-name', 'RenderSample',
            '--query', ('"' + $KeyName + '"'), '-o', 'tsv', '--only-show-errors') -Operation 'Read scoped Function key'
        $key = $key.Trim()
        if ([string]::IsNullOrWhiteSpace($key) -or $key -eq 'null') { throw 'Selected Function key is absent.' }
        $null = Invoke-DevCli gh @('secret', 'set', 'AZURE_FUNCTION_KEY', '--repo', $Context.Repository,
            '--env', 'dev') -InputText $key -Operation 'Transfer Function key'
        $metadata = Invoke-DevCli gh @('api', "repos/$($Context.Repository)/environments/dev/secrets/AZURE_FUNCTION_KEY",
            '--jq', '{name,updated_at}') -Operation 'Verify secret metadata' | ConvertFrom-Json
        if ($metadata.name -cne 'AZURE_FUNCTION_KEY' -or [string]::IsNullOrWhiteSpace($metadata.updated_at)) {
            throw 'Secret metadata readback failed.'
        }
        return $metadata
    }
    finally { $key = $null }
}

Export-ModuleMember -Function Invoke-DevCli, Get-DevContext, Get-DevPolicy, Set-DevEnvironment, Set-DevVariable, Set-DevSecret
