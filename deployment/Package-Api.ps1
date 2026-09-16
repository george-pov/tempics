#Requires -Version 7.2
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ArtifactPath,
    [string]$PublishPath,
    [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{40}$')][string]$SourceSha,
    [Parameter(Mandatory)][ValidatePattern('^[0-9]+$')][string]$RunId,
    [Parameter(Mandatory)][ValidatePattern('^[0-9]+$')][string]$RunAttempt,
    [switch]$VerifyOnly
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$zipPath = Join-Path $ArtifactPath 'function.zip'
$manifestPath = Join-Path $ArtifactPath 'manifest.json'
if (-not $VerifyOnly) {
    if (-not $PublishPath -or -not (Test-Path -LiteralPath $PublishPath -PathType Container)) { throw 'Missing publish directory.' }
    if (Test-Path -LiteralPath $ArtifactPath) { throw 'Artifact target must be fresh.' }
    $source = [IO.Path]::GetFullPath($PublishPath).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $target = [IO.Path]::GetFullPath($ArtifactPath).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if ($target.StartsWith($source, [StringComparison]::OrdinalIgnoreCase) -or $source.StartsWith($target, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Publish and artifact directories must not overlap.'
    }
    $files = @(Get-ChildItem -LiteralPath $PublishPath -Recurse -Force)
    if (@($files | Where-Object { $_.Name -ieq 'local.settings.json' -or $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) {
        throw 'Local settings or links are forbidden in the package.'
    }
    $null = New-Item -ItemType Directory -Path $ArtifactPath
    [IO.Compression.ZipFile]::CreateFromDirectory($PublishPath, $zipPath)
}
$zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $names = @($zip.Entries.FullName)
    if (@($names | Select-Object -Unique).Count -ne $names.Count) { throw 'Duplicate ZIP entries.' }
    foreach ($name in $names) {
        if ($name -match '(^|/)local\.settings\.json$|(^|/)\.\.(/|$)|^/|\\|:' -or
            $name -match '(^|/)(bin|obj|src)/') { throw 'Forbidden ZIP entry.' }
    }
    foreach ($required in @('host.json', 'functions.metadata', 'worker.config.json', 'libSkiaSharp.so', 'libHarfBuzzSharp.so', 'TP.AzureFunctions.dll')) {
        $entry = $zip.GetEntry($required)
        if ($null -eq $entry -or $entry.Length -eq 0) { throw "Missing package entry: $required" }
    }
    if (-not @($names | Where-Object { $_ -like '.azurefunctions/*' }).Count) { throw 'Missing hidden Functions metadata.' }
    $reader = [IO.StreamReader]::new($zip.GetEntry('functions.metadata').Open())
    try { $functions = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
    $sample = @($functions | Where-Object name -CEQ 'RenderSample')
    if ($sample.Count -ne 1 -or -not @($sample[0].bindings | Where-Object {
        $_.type -eq 'httpTrigger' -and $_.authLevel -eq 'Function' -and $_.route -eq 'renders/sample' -and 'post' -in $_.methods
    }).Count) { throw 'Missing protected RenderSample metadata.' }
} finally { $zip.Dispose() }
$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($VerifyOnly) {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.sourceSha -cne $SourceSha -or $manifest.runId -cne $RunId -or
        $manifest.runAttempt -cne $RunAttempt -or $manifest.packageSha256 -cne $hash) {
        throw 'Artifact revision or checksum mismatch.'
    }
    if (@(Get-ChildItem -LiteralPath $ArtifactPath -Force).Count -ne 2) { throw 'Unexpected artifact contents.' }
} else {
    [ordered]@{ sourceSha = $SourceSha; runId = $RunId; runAttempt = $RunAttempt; packageSha256 = $hash } |
        ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding utf8NoBOM
}
Write-Output "Verified Linux Function ZIP for $SourceSha (SHA-256 $hash)."
