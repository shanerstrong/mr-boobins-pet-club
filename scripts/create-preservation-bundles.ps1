param(
    [Parameter(Mandatory = $true)]
    [string]$OutputRoot,
    [int64]$MaxUncompressedBundleBytes = 134217728,
    [int64]$MaxFinalBundleBytes = 0,
    [ValidatePattern('^[a-z0-9-]*$')]
    [string]$BundleNameTag = '',
    [switch]$ColdOnly,
    [switch]$Resume
)

$ErrorActionPreference = 'Stop'

function Get-RelativeSha256Record {
    param([string]$RelativePath)
    $item = Get-Item -LiteralPath $RelativePath
    [pscustomobject]@{
        path = $RelativePath.Replace('\', '/')
        bytes = [int64]$item.Length
        sha256 = (Get-FileHash -LiteralPath $RelativePath -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}

function New-ZipBundle {
    param(
        [string]$BundlePath,
        [object[]]$Members
    )

    if (Test-Path -LiteralPath $BundlePath) {
        throw "Refusing to overwrite bundle: $BundlePath"
    }

    $stream = [IO.File]::Open($BundlePath, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    try {
        $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create, $true)
        try {
            foreach ($member in $Members) {
                $entry = $archive.CreateEntry($member.path, [IO.Compression.CompressionLevel]::Optimal)
                $entry.LastWriteTime = [DateTimeOffset]::new(1980, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
                $source = [IO.File]::OpenRead($member.path)
                try {
                    $destination = $entry.Open()
                    try {
                        $source.CopyTo($destination)
                    }
                    finally {
                        $destination.Dispose()
                    }
                }
                finally {
                    $source.Dispose()
                }
            }
        }
        finally {
            $archive.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }

    $bundle = Get-Item -LiteralPath $BundlePath
    if ($MaxFinalBundleBytes -gt 0 -and [int64]$bundle.Length -ge $MaxFinalBundleBytes) {
        throw "Final bundle exceeds the strict size limit (${MaxFinalBundleBytes} bytes): $BundlePath ($($bundle.Length) bytes)"
    }
    [pscustomobject]@{
        name = $bundle.Name
        memberCount = $Members.Count
        originalBytes = [int64](($Members | Measure-Object bytes -Sum).Sum)
        bundleBytes = [int64]$bundle.Length
        bundleSha256 = (Get-FileHash -LiteralPath $BundlePath -Algorithm SHA256).Hash.ToLowerInvariant()
        members = $Members
    }
}

function Test-ZipBundle {
    param(
        [string]$BundlePath,
        [object[]]$ExpectedMembers
    )

    $expected = @{}
    foreach ($member in $ExpectedMembers) {
        $expected[$member.path] = $member
    }

    $stream = [IO.File]::OpenRead($BundlePath)
    try {
        $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Read, $false)
        try {
            if ($archive.Entries.Count -ne $ExpectedMembers.Count) {
                throw "Entry count mismatch for $BundlePath"
            }
            foreach ($entry in $archive.Entries) {
                $path = $entry.FullName.Replace('\', '/')
                if (-not $expected.ContainsKey($path)) {
                    throw "Unexpected archive entry in ${BundlePath}: $path"
                }
                $member = $expected[$path]
                if ([int64]$entry.Length -ne [int64]$member.bytes) {
                    throw "Archive entry size mismatch in ${BundlePath}: $path"
                }
                $entryStream = $entry.Open()
                try {
                    $hasher = [Security.Cryptography.SHA256]::Create()
                    try {
                        $hash = ([BitConverter]::ToString($hasher.ComputeHash($entryStream))).Replace('-', '').ToLowerInvariant()
                    }
                    finally {
                        $hasher.Dispose()
                    }
                }
                finally {
                    $entryStream.Dispose()
                }
                if ($hash -ne $member.sha256) {
                    throw "Archive entry hash mismatch in ${BundlePath}: $path"
                }
            }
        }
        finally {
            $archive.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

Add-Type -AssemblyName System.IO.Compression

$workspaceRoot = [IO.Path]::GetFullPath((Get-Location).Path)
$resolvedOutput = [IO.Path]::GetFullPath($OutputRoot)
$systemTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$workspaceStaging = [IO.Path]::GetFullPath((Join-Path $workspaceRoot 'preservation-staging'))
$inSystemTemp = $resolvedOutput.StartsWith($systemTemp, [StringComparison]::OrdinalIgnoreCase)
$inWorkspaceStaging = $resolvedOutput.StartsWith($workspaceStaging, [StringComparison]::OrdinalIgnoreCase)
if (-not $inSystemTemp -and -not $inWorkspaceStaging) {
    throw "OutputRoot must remain under the system temporary directory or workspace preservation-staging root."
}
if (Test-Path -LiteralPath $resolvedOutput) {
    if (-not $Resume) {
        throw "Refusing to overwrite existing preservation root without -Resume: $resolvedOutput"
    }
}

$classificationPath = 'docs/production/V0.6-V0.8_ASSET_CLASSIFICATION.json'
$classification = Get-Content -LiteralPath $classificationPath -Raw | ConvertFrom-Json
$coldGroup = $classification.groups | Where-Object { $_.id -eq 'proposed-cold-archive' }
$privateGroup = $classification.groups | Where-Object { $_.id -eq 'local-only-private' }
$canonicalGroup = $classification.groups | Where-Object { $_.id -eq 'canonical-editable-lfs-pending' }

if (@($coldGroup.files).Count -ne 291) { throw 'Cold archive group drifted from approved count 291.' }
if (@($privateGroup.files).Count -ne 59) { throw 'Private group drifted from approved count 59.' }
if (@($canonicalGroup.files).Count -ne 5) { throw 'Canonical group drifted from approved count 5.' }

foreach ($record in @($coldGroup.files) + @($privateGroup.files) + @($canonicalGroup.files)) {
    $current = Get-RelativeSha256Record $record.path
    if ($current.bytes -ne $record.bytes -or $current.sha256 -ne $record.sha256) {
        throw "Original-byte drift before packaging: $($record.path)"
    }
}

if (-not (Test-Path -LiteralPath $resolvedOutput)) {
    New-Item -ItemType Directory -Path $resolvedOutput | Out-Null
}
$coldRootPath = Join-Path $resolvedOutput 'Cold Archive'
$privateRootPath = Join-Path $resolvedOutput 'Private Backup'
if (-not (Test-Path -LiteralPath $coldRootPath)) { New-Item -ItemType Directory -Path $coldRootPath | Out-Null }
if (-not $ColdOnly -and -not (Test-Path -LiteralPath $privateRootPath)) { New-Item -ItemType Directory -Path $privateRootPath | Out-Null }
$coldRoot = Get-Item -LiteralPath $coldRootPath
if (-not $ColdOnly) { $privateRoot = Get-Item -LiteralPath $privateRootPath }

$coldMembers = @($coldGroup.files | Sort-Object path)
$coldParts = @()
$currentPart = @()
$currentBytes = [int64]0
foreach ($member in $coldMembers) {
    if ($currentPart.Count -gt 0 -and $currentBytes + [int64]$member.bytes -gt $MaxUncompressedBundleBytes) {
        $coldParts += ,@($currentPart)
        $currentPart = @()
        $currentBytes = [int64]0
    }
    $currentPart += $member
    $currentBytes += [int64]$member.bytes
}
if ($currentPart.Count -gt 0) { $coldParts += ,@($currentPart) }

$coldBundles = @()
for ($index = 0; $index -lt $coldParts.Count; $index += 1) {
    $namePrefix = if ($BundleNameTag) { "mr-boobins-cold-archive-$BundleNameTag" } else { 'mr-boobins-cold-archive' }
    $name = "$namePrefix-part-{0:D3}.zip" -f ($index + 1)
    $path = Join-Path $coldRoot.FullName $name
    if (Test-Path -LiteralPath $path) {
        if (-not $Resume) { throw "Refusing to reuse existing bundle without -Resume: $path" }
        Test-ZipBundle -BundlePath $path -ExpectedMembers $coldParts[$index]
        $item = Get-Item -LiteralPath $path
        if ($MaxFinalBundleBytes -gt 0 -and [int64]$item.Length -ge $MaxFinalBundleBytes) {
            throw "Final bundle exceeds the strict size limit (${MaxFinalBundleBytes} bytes): $path ($($item.Length) bytes)"
        }
        $bundle = [pscustomobject]@{
            name = $item.Name
            memberCount = $coldParts[$index].Count
            originalBytes = [int64](($coldParts[$index] | Measure-Object bytes -Sum).Sum)
            bundleBytes = [int64]$item.Length
            bundleSha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
            members = $coldParts[$index]
        }
    }
    else {
        $bundle = New-ZipBundle -BundlePath $path -Members $coldParts[$index]
        Test-ZipBundle -BundlePath $path -ExpectedMembers $coldParts[$index]
    }
    $coldBundles += $bundle
}

$privateMembers = @()
$privateBundle = $null
if (-not $ColdOnly) {
    $privateMembers = @($privateGroup.files | Sort-Object path) + @($canonicalGroup.files | Sort-Object path)
    $privatePath = Join-Path $privateRoot.FullName 'mr-boobins-private-backup.zip'
    if (Test-Path -LiteralPath $privatePath) {
        if (-not $Resume) { throw "Refusing to reuse existing private bundle without -Resume: $privatePath" }
        Test-ZipBundle -BundlePath $privatePath -ExpectedMembers $privateMembers
        $privateItem = Get-Item -LiteralPath $privatePath
        $privateBundle = [pscustomobject]@{
            name = $privateItem.Name
            memberCount = $privateMembers.Count
            originalBytes = [int64](($privateMembers | Measure-Object bytes -Sum).Sum)
            bundleBytes = [int64]$privateItem.Length
            bundleSha256 = (Get-FileHash -LiteralPath $privatePath -Algorithm SHA256).Hash.ToLowerInvariant()
            members = $privateMembers
        }
    }
    else {
        $privateBundle = New-ZipBundle -BundlePath $privatePath -Members $privateMembers
        Test-ZipBundle -BundlePath $privatePath -ExpectedMembers $privateMembers
    }
}

$createdAt = [DateTimeOffset]::UtcNow.ToString('o')
$classificationHash = (Get-FileHash -LiteralPath $classificationPath -Algorithm SHA256).Hash.ToLowerInvariant()
$coldManifest = [ordered]@{
    schemaVersion = 1
    kind = 'cold-archive-private-manifest'
    createdAt = $createdAt
    sourceClassificationPath = $classificationPath.Replace('\', '/')
    sourceClassificationSha256 = $classificationHash
    approvedMemberCount = 291
    approvedOriginalBytes = [int64](($coldMembers | Measure-Object bytes -Sum).Sum)
    maxUncompressedBundleBytes = $MaxUncompressedBundleBytes
    bundles = $coldBundles
    verification = 'Every ZIP entry was reopened, counted, size-checked, decompressed, and SHA-256 matched to the source classification.'
}
$coldManifestPath = Join-Path $coldRoot.FullName 'cold-archive-manifest.private.json'
$coldManifest | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $coldManifestPath -Encoding utf8
if (-not $ColdOnly) {
    $privateManifest = [ordered]@{
        schemaVersion = 1
        kind = 'private-backup-private-manifest'
        createdAt = $createdAt
        sourceClassificationPath = $classificationPath.Replace('\', '/')
        sourceClassificationSha256 = $classificationHash
        privateMemberCount = 59
        canonicalDefenseInDepthMemberCount = 5
        totalMemberCount = $privateMembers.Count
        originalBytes = [int64](($privateMembers | Measure-Object bytes -Sum).Sum)
        bundle = $privateBundle
        privacy = 'Contains non-public paths. Keep only in the restricted Private Backup folder; do not commit or place in the phone-review mirror.'
        verification = 'Every ZIP entry was reopened, counted, size-checked, decompressed, and SHA-256 matched to the source classification.'
    }
    $privateManifestPath = Join-Path $privateRoot.FullName 'private-backup-manifest.private.json'
    $privateManifest | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $privateManifestPath -Encoding utf8
}

$result = [ordered]@{
    outputRoot = $resolvedOutput
    cold = [ordered]@{
        bundleCount = $coldBundles.Count
        memberCount = 291
        originalBytes = $coldManifest.approvedOriginalBytes
        bundleBytes = [int64](($coldBundles | Measure-Object bundleBytes -Sum).Sum)
        manifestPath = $coldManifestPath
        manifestBytes = (Get-Item -LiteralPath $coldManifestPath).Length
        manifestSha256 = (Get-FileHash -LiteralPath $coldManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
        bundles = @($coldBundles | Select-Object name, memberCount, originalBytes, bundleBytes, bundleSha256)
    }
}

if (-not $ColdOnly) {
    $result.private = [ordered]@{
        memberCount = $privateMembers.Count
        originalBytes = $privateManifest.originalBytes
        bundleName = $privateBundle.name
        bundleBytes = $privateBundle.bundleBytes
        bundleSha256 = $privateBundle.bundleSha256
        manifestPath = $privateManifestPath
        manifestBytes = (Get-Item -LiteralPath $privateManifestPath).Length
        manifestSha256 = (Get-FileHash -LiteralPath $privateManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}

$result | ConvertTo-Json -Depth 20
