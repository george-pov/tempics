#Requires -Version 7.2
# Hermetic CLI fixtures: this harness never resolves or invokes az or gh.
$ErrorActionPreference = 'Stop'
$module = Import-Module (Join-Path $PSScriptRoot 'DevSetup.psm1') -Force -PassThru
& $module {
    $script:Passed = 0
    function Assert([bool]$Condition, [string]$Message) {
        if (-not $Condition) { throw $Message }
    }
    function Reject([scriptblock]$Action) {
        $failed = $false
        try { & $Action | Out-Null } catch {
            $failed = $true
            Assert (-not $_.ToString().Contains($script:FakeKey)) 'Error disclosed fixture credential.'
        }
        Assert $failed 'Expected operation to fail.'
    }
    $script:FakeKey = 'fixture-' + [guid]::NewGuid().ToString('N')
    # Exercise the real process boundary using only the current PowerShell executable.
    $script:ShellPath = (Get-Process -Id $PID).Path
    function script:Get-Command { return [pscustomobject]@{ Source = $script:ShellPath } }
    Reject {
        Invoke-DevCli gh @('-NoProfile', '-NonInteractive', '-Command',
            '[Console]::Error.Write([Console]::In.ReadToEnd()); exit 42') -InputText $script:FakeKey -Operation 'Fixture native failure'
    }
    $script:Passed++
    # Multiple executable matches must not become one combined process path.
    function script:Get-Command {
        [pscustomobject]@{ Source = $script:ShellPath }
        [pscustomobject]@{ Source = 'missing-second-match' }
    }
    $echo = Invoke-DevCli gh @('-NoProfile', '-NonInteractive', '-Command',
        '[Console]::Out.Write([Console]::In.ReadToEnd())') -InputText $script:FakeKey -Operation 'Fixture stdin roundtrip'
    Assert ($echo -ceq $script:FakeKey) 'Native stdin transfer failed.'
    $echo = $null
    $savedPath = $script:ShellPath
    $script:ShellPath = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString('N'))
    Reject { Invoke-DevCli gh @() -Operation 'Fixture startup failure' }
    $script:ShellPath = $savedPath
    $script:Passed += 2
    function script:Invoke-DevCli {
        param([string]$Tool, [string[]]$Arguments, [AllowNull()][string]$InputText, [string]$Operation)
        $script:Calls.Add(@{ Tool = $Tool; Arguments = $Arguments; InputText = $InputText; Operation = $Operation })
        if ($script:Fail -eq $Operation) { throw "$Operation failed (exit 42)." }
        $value = switch ($Operation) {
            'Read subscription' { $script:Account; break }
            'Read resource group' { $script:Group; break }
            'Read deployment identity' { $script:Identity; break }
            'Read Function metadata' { $script:App; break }
            'Read repository' { $script:Repo; break }
            'Read OIDC subject' { $script:Oidc; break }
            'Read environments' { ,@(@{ environments = $(if ($script:Exists) { @(@{ name = 'dev' }) } else { @() }) }); break }
            'Read dev policy' { @{ deployment_branch_policy = $script:Policy; protection_rules = $script:Reviewers }; break }
            'Read branch rules' { ,@(@{ branch_policies = $script:Rules }); break }
            'Create dev environment' {
                $script:Exists = $true
                $script:Policy = ($InputText | ConvertFrom-Json).deployment_branch_policy
                @{}; break
            }
            'Set main branch rule' { $script:Rules = @(($InputText | ConvertFrom-Json)); @{}; break }
            'Read scoped Function key' { return $script:KeyOutput }
            'Transfer Function key' { return '' }
            'Verify secret metadata' { @{ name = 'AZURE_FUNCTION_KEY'; updated_at = '2026-09-15T00:00:00Z' }; break }
            default {
                if ($Operation -like 'Set *') { $script:Variables[$Arguments[2]] = $InputText; return '' }
                if ($Operation -like 'Verify *') {
                    $name = $Operation.Substring(7)
                    @{ name = $name; value = $script:Variables[$name] }; break
                }
                throw 'Unexpected fixture CLI operation.'
            }
        }
        ConvertTo-Json -InputObject $value -Depth 12 -Compress
    }
    function Reset {
        $script:Sub = '11111111-1111-1111-1111-111111111111'
        $tenant = '22222222-2222-2222-2222-222222222222'
        $scope = "/subscriptions/$script:Sub/resourceGroups/rg-tempics-dev"
        $script:Account = @{ id = $script:Sub; tenantId = $tenant }
        $script:Group = @{ id = $scope; location = 'westus2' }
        $script:Identity = @{ id = "$scope/providers/Microsoft.ManagedIdentity/userAssignedIdentities/id-tempics-gh-dev";
            clientId = '33333333-3333-3333-3333-333333333333'; principalId = '44444444-4444-4444-4444-444444444444'; tenantId = $tenant }
        $script:App = @{ id = "$scope/providers/Microsoft.Web/sites/func-tempics-api-dev"; kind = 'functionapp,linux'; sku = 'FlexConsumption';
            host = 'func-tempics-api-dev.azurewebsites.net'; runtime = @{ name = 'dotnet-isolated'; version = '10.0' } }
        $script:Repo = @{ full_name = 'george-pov/tempics'; default_branch = 'main' }
        $script:Oidc = @{ use_default = $true; use_immutable_subject = $true; sub_claim_prefix = 'repo:george-pov@287842525/tempics@1368115642' }
        $script:Exists = $false
        $script:Policy = @{ protected_branches = $false; custom_branch_policies = $true }
        $script:Rules = @()
        $script:Reviewers = @(@{ type = 'required_reviewers'; reviewers = @(@{ id = 7 }) })
        $script:Variables = @{}
        $script:Fail = ''
        $script:KeyOutput = $script:FakeKey
        $script:Calls = [Collections.Generic.List[object]]::new()
    }
    foreach ($mutate in @(
        { $script:Account.id = '55555555-5555-5555-5555-555555555555' },
        { $script:Identity.tenantId = '55555555-5555-5555-5555-555555555555' },
        { $script:Identity.clientId = 'bad' },
        { $script:Identity.id = '/wrong' },
        { $script:Fail = 'Read deployment identity' },
        { $script:Fail = 'Read Function metadata' },
        { $script:App.id = '/wrong' },
        { $script:App.host = 'attacker.example' },
        { $script:App.host = 'func-tempics-api-dev.azurewebsites.net?x' },
        { $script:App.runtime.version = '8.0' },
        { $script:App.sku = 'Dynamic' },
        { $script:Group.location = 'eastus' },
        { $script:Repo.full_name = 'other/tempics' },
        { $script:Repo.default_branch = 'other' }
        { $script:Oidc.sub_claim_prefix = 'repo:other@1/tempics@2' },
        { $script:Oidc.use_immutable_subject = $false }
    )) {
        Reset; & $mutate
        Reject { Get-DevContext -SubscriptionId $script:Sub }
        Assert (-not @($script:Calls | Where-Object Operation -Like 'Set *').Count) 'Validation performed a write.'
        $script:Passed++
    }
    Reset
    Reject { Get-DevContext -SubscriptionId 'bad' }
    Reject { Get-DevContext -SubscriptionId $script:Sub -Repository 'other/tempics' }
    Assert ($script:Calls.Count -eq 0) 'Invalid input reached CLI.'
    $script:Passed++
    Reset
    $context = Get-DevContext -SubscriptionId $script:Sub
    Assert ($context.Variables.TP_API_URL -ceq 'https://func-tempics-api-dev.azurewebsites.net/api') 'Wrong API URL.'
    Set-DevEnvironment $context
    foreach ($item in $context.Variables.GetEnumerator()) { Set-DevVariable $context $item.Key $item.Value }
    $first = $script:Variables | ConvertTo-Json -Compress
    Set-DevEnvironment $context
    foreach ($item in $context.Variables.GetEnumerator()) { Set-DevVariable $context $item.Key $item.Value }
    Assert (($script:Variables | ConvertTo-Json -Compress) -ceq $first) 'Repeated setup drifted.'
    Assert (@($script:Calls | Where-Object Operation -EQ 'Create dev environment').Count -eq 1) 'Environment was overwritten.'
    Assert (@($script:Calls | Where-Object Operation -EQ 'Set main branch rule').Count -eq 1) 'Branch rule was duplicated.'
    Reject { Set-DevVariable $context 'UNAPPROVED' 'x' }
    $script:Passed++
    foreach ($mutate in @(
        { $script:Policy = $null },
        { $script:Policy.protected_branches = $true },
        { $script:Rules = @(@{ name = '*'; type = 'branch' }) },
        { $script:Rules = @(@{ name = 'main'; type = 'tag' }) }
    )) {
        Reset; $script:Exists = $true; & $mutate
        Reject { Set-DevEnvironment $context }
        Assert (-not @($script:Calls | Where-Object Operation -Match '^(Set|Create) ').Count) 'Incompatible policy was changed.'
        $script:Passed++
    }
    Reset; $script:Exists = $true; $script:Rules = @(@{ name = 'main'; type = 'branch' })
    Set-DevEnvironment $context
    Assert (-not @($script:Calls | Where-Object Operation -Match '^(Set|Create) ').Count) 'Existing protection was rewritten.'
    Assert ($script:Reviewers[0].reviewers[0].id -eq 7) 'Reviewer changed.'
    $script:Passed++
    $script:Fail = 'Set AZURE_CLIENT_ID'
    Reject { Set-DevVariable $context 'AZURE_CLIENT_ID' $context.Variables.AZURE_CLIENT_ID }
    $script:Passed++
    Reset; $script:Exists = $true; $script:Rules = @(@{ name = 'main'; type = 'branch' })
    $metadata = Set-DevSecret $context 'existing-key'
    Assert ($metadata.name -ceq 'AZURE_FUNCTION_KEY') 'Missing secret metadata.'
    $transfer = @($script:Calls | Where-Object Operation -EQ 'Transfer Function key')
    Assert ($transfer.Count -eq 1 -and $transfer[0].InputText -ceq $script:FakeKey) 'Secret was not transferred through stdin.'
    Assert (-not (($script:Calls.Arguments | ConvertTo-Json -Compress).Contains($script:FakeKey))) 'Secret leaked into arguments.'
    Assert (-not ($transfer[0].Arguments -contains '--body')) 'Secret body argument used.'
    $read = @($script:Calls | Where-Object Operation -EQ 'Read scoped Function key')[0]
    Assert (($read.Arguments -contains 'RenderSample') -and ($read.Arguments -contains '"existing-key"')) 'Key scope or selector changed.'
    Assert (-not $read.Arguments.Contains('host')) 'Host key API used.'
    Assert (-not (($metadata | ConvertTo-Json).Contains($script:FakeKey))) 'Secret leaked into result.'
    $script:Passed++
    foreach ($operation in @('Read scoped Function key', 'Transfer Function key', 'Verify secret metadata')) {
        Reset; $script:Exists = $true; $script:Rules = @(@{ name = 'main'; type = 'branch' }); $script:Fail = $operation
        Reject { Set-DevSecret $context 'existing-key' }
        $script:Passed++
    }
    Reset; $script:Exists = $true; $script:Rules = @(@{ name = 'main'; type = 'branch' }); $script:KeyOutput = ''
    Reject { Set-DevSecret $context 'missing' }
    Assert (-not @($script:Calls | Where-Object Operation -EQ 'Transfer Function key').Count) 'Empty key was transferred.'
    $script:Passed++
    Reset
    Reject { Set-DevSecret $context 'existing-key' }
    Assert (-not @($script:Calls | Where-Object Operation -EQ 'Read scoped Function key').Count) 'Key read before environment protection.'
    $script:Passed++
    $script:Calls.Clear()
    $script:KeyOutput = $null
    $script:FakeKey = $null
    Write-Output "Setup tests passed: $script:Passed assertions/scenarios; no Azure or GitHub processes invoked."
}
Remove-Module $module
