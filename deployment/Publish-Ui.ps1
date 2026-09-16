#Requires -Version 7.2
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$PackagePath,
    [Parameter(Mandatory)][string]$BlobMapPath,
    [switch]$InspectOnly
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-NoLinks([string]$Path) {
    $part = [IO.Path]::GetFullPath($Path)
    while ($part) {
        $item = Get-Item -LiteralPath $part -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Links are forbidden in the package path.' }
        $parent = [IO.Path]::GetDirectoryName($part)
        if ($parent -eq $part) { break }
        $part = $parent
    }
}
function Assert-Name([string]$Name) {
    if (-not $Name -or $Name.Length -gt 512 -or $Name -match '(^|/)(local\.settings\.json|config\.json\..*|blobs\.json|manifest\.json|package(?:-lock)?\.json)$|\.map$') {
        throw 'Forbidden package name.'
    }
    foreach ($segment in $Name.Split('/')) {
        if ($segment -cnotmatch '^[A-Za-z0-9_-][A-Za-z0-9_.-]*$' -or $segment.EndsWith('.')) { throw 'Invalid package path.' }
    }
}
$root = [IO.Path]::GetFullPath($PackagePath).TrimEnd([IO.Path]::DirectorySeparatorChar)
Assert-NoLinks $root
Assert-NoLinks $BlobMapPath
if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw 'Missing package directory.' }
$map = Get-Content -LiteralPath $BlobMapPath -Raw | ConvertFrom-Json -NoEnumerate
if ($map -isnot [array] -or $map.Count -lt 5) { throw 'Incomplete blob map.' }
$mime = @{
    '.html'='text/html'; '.json'='application/json'; '.js'='text/javascript'; '.css'='text/css'
    '.svg'='image/svg+xml'; '.woff2'='font/woff2'; '.woff'='font/woff'; '.ttf'='font/ttf'; '.otf'='font/otf'
    '.png'='image/png'; '.ico'='image/x-icon'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'
    '.webp'='image/webp'; '.gif'='image/gif'; '.txt'='text/plain'; '.md'='text/markdown'
}
$destinations = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
$sources = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
$checked = [Collections.Generic.List[object]]::new()
foreach ($entry in $map) {
    if (($entry.PSObject.Properties.Name | Sort-Object) -join ',' -cne 'cacheControl,contentType,name,sha256,source') { throw 'Invalid map fields.' }
    foreach ($value in @($entry.source, $entry.name, $entry.contentType, $entry.cacheControl, $entry.sha256)) {
        if ($value -isnot [string]) { throw 'Invalid map value type.' }
    }
    Assert-Name $entry.source
    Assert-Name $entry.name
    if (-not $destinations.Add($entry.name)) { throw 'Duplicate blob destination.' }
    $null = $sources.Add($entry.source)
    $expectedNames = if ($entry.source -ceq 'index.html') { @('index.html','component-lab','component-lab/index.html') } else { @($entry.source) }
    if ($entry.name -cnotin $expectedNames -or
        ($entry.name -cin @('component-lab','component-lab/index.html') -and $entry.source -cne 'index.html')) { throw 'Unexpected blob alias.' }
    $expectedType = $mime[[IO.Path]::GetExtension($entry.source).ToLowerInvariant()]
    if (-not $expectedType -or $entry.contentType -cne $expectedType -or $entry.cacheControl -cne 'no-store' -or
        $entry.sha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'Invalid MIME, cache policy or hash.' }
    $file = [IO.Path]::GetFullPath((Join-Path $root $entry.source))
    if (-not $file.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Source escapes package.' }
    Assert-NoLinks $file
    if (-not (Test-Path -LiteralPath $file -PathType Leaf) -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256) {
        throw 'Package file or hash mismatch.'
    }
    $order = if ($entry.name -ceq 'index.html') { 3 } elseif ($entry.source -ceq 'index.html') { 2 } elseif ($entry.name -cin @('404.html','config.json')) { 1 } else { 0 }
    $checked.Add(@{ File=$file; Entry=$entry; Order=$order })
}
foreach ($required in @('index.html','component-lab','component-lab/index.html','config.json','404.html')) {
    if (-not $destinations.Contains($required)) { throw 'Required route or document is missing.' }
}
$allFiles = @(Get-ChildItem -LiteralPath $root -Recurse -Force)
foreach ($file in $allFiles) {
    if ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked package entry.' }
    $name = [IO.Path]::GetRelativePath($root, $file.FullName).Replace('\','/')
    Assert-Name $name
    if (-not $file.PSIsContainer -and -not $sources.Contains($name)) { throw 'Undeclared package file.' }
}
$config = Get-Content -LiteralPath (Join-Path $root 'config.json') -Raw | ConvertFrom-Json
if (($config.PSObject.Properties.Name | Sort-Object) -join ',' -cne 'apiBaseUrl,environment' -or $config.environment -cne 'dev' -or
    $config.apiBaseUrl -cnotmatch '^https://[^/@?#\s\\]+/[^?#\s\\]*$') { throw 'Invalid public dev configuration.' }
$errorDoc = Get-Content -LiteralPath (Join-Path $root '404.html') -Raw
if ($errorDoc.Replace("`r`n", "`n") -cne (Get-Content -LiteralPath (Join-Path $PSScriptRoot '../src/ui/scripts/404.html') -Raw).Replace("`r`n", "`n")) { throw 'Unexpected error document.' }
$ordered = @($checked | Sort-Object Order, @{ Expression = { $_.Entry.name } })
if ($InspectOnly) {
    $ordered | ForEach-Object { [pscustomobject]@{ Source=$_.Entry.source; Blob=$_.Entry.name; ContentType=$_.Entry.contentType; Cache=$_.Entry.cacheControl } }
    return
}
$subscription = $env:AZURE_SUBSCRIPTION_ID
$parsed = [guid]::Empty
if (-not [guid]::TryParseExact($subscription, 'D', [ref]$parsed) -or $parsed -eq [guid]::Empty -or $env:AZURE_UI_STORAGE -cne 'sttempicsuidev') {
    throw 'Invalid dev upload target.'
}
if ($config.apiBaseUrl -cnotmatch '^https://func-tempics-api-dev(?:-[a-z0-9]+)?(?:\.[a-z0-9-]+)?\.azurewebsites\.net/api$') { throw 'Unexpected dev API target.' }
Import-Module (Join-Path $PSScriptRoot 'DevSetup.psm1') -Force
$uploaded = 0
try {
    foreach ($item in $ordered) {
        $entry = $item.Entry
        $null = Invoke-DevCli az @('storage','blob','upload','--subscription',$subscription,
            '--account-name',$env:AZURE_UI_STORAGE,'--container-name','$web','--auth-mode','login',
            '--name',$entry.name,'--file',$item.File,'--overwrite','true','--content-type',$entry.contentType,
            '--content-cache-control',$entry.cacheControl,'--only-show-errors','--output','none') -Operation 'Upload UI blob'
        $uploaded++
        Write-Output "Uploaded $uploaded/$($ordered.Count): $($entry.name)"
    }
} catch { throw "UI upload failed after $uploaded/$($ordered.Count) blobs. Partial publication may exist; rerun the reviewed package." }
