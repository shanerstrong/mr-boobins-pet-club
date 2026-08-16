param(
    [Parameter(Mandatory = $true)]
    [string]$OutputRoot
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression

$candidatePath = 'docs/production/V0.6-V0.8_CHECKPOINT_CANDIDATE.json'
$approvedPaths = @(
    'assets/3d/jack/animations/clip-manifest.json',
    'assets/3d/jack/animations/jack-rig-animation-metrics.json',
    'assets/3d/jack/blockout-metrics.json',
    'assets/3d/jack/hero-metrics.json',
    'assets/3d/jack/skins/jack-baby-metrics.json',
    'assets/3d/jack/skins/jack-teen-metrics.json',
    'assets/3d/jack/tools/build_hero_geometry.py',
    'assets/3d/jack/tools/receive_meshy_bridge.py',
    'assets/3d/jack/tools/render_evidence.py',
    'assets/3d/jack/tools/render_videos.py',
    'assets/3d/jack/tools/validate_blockout.py',
    'assets/3d/jack/tools/validate_character.py',
    'assets/3d/jack/v2/source/third-party/quaternius-ultimate-animated-animals-cc0/License.txt',
    'docs/GAME_PRODUCTION_PLAN.md',
    'docs/audits/2026-08-14-3d-jack-pass1.md',
    'docs/production/V0.6-V0.8_CHECKPOINT_REPORT.md',
    'evidence/3d-jack/v2/contract-validation.json',
    'evidence/3d-jack/v2/full-frame-deformation-validation.json',
    'evidence/3d-jack/v2/glb-contract-validation.json',
    'evidence/3d-jack/v2/runtime-playback-validation.json',
    'evidence/3d-jack/v2/v2-package-validation.json'
) | Sort-Object

if ($approvedPaths.Count -ne 21 -or @($approvedPaths | Select-Object -Unique).Count -ne 21) {
    throw 'The approved baseline text preservation set must contain exactly 21 unique paths.'
}

$workspaceRoot = [IO.Path]::GetFullPath((Get-Location).Path)
$workspaceStaging = [IO.Path]::GetFullPath((Join-Path $workspaceRoot 'preservation-staging'))
$resolvedOutput = [IO.Path]::GetFullPath($OutputRoot)
if (-not $resolvedOutput.StartsWith($workspaceStaging, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'OutputRoot must remain under workspace preservation-staging.'
}
if (Test-Path -LiteralPath $resolvedOutput) {
    throw "Refusing to overwrite existing preservation output: $resolvedOutput"
}

$candidate = Get-Content -LiteralPath $candidatePath -Raw | ConvertFrom-Json
$candidateByPath = @{}
foreach ($entry in $candidate.candidate.files) { $candidateByPath[$entry.path] = $entry }

$members = @()
foreach ($path in $approvedPaths) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing approved text original: $path" }
    if (-not $candidateByPath.ContainsKey($path)) { throw "Approved text original is absent from frozen candidate: $path" }
    $item = Get-Item -LiteralPath $path
    $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    $frozen = $candidateByPath[$path]
    if ([int64]$item.Length -ne [int64]$frozen.bytes -or $hash -ne $frozen.sha256) {
        throw "Approved text original drifted from frozen candidate: $path"
    }
    $members += [pscustomobject]@{ path = $path; bytes = [int64]$item.Length; sha256 = $hash }
}

[void](New-Item -ItemType Directory -Path $resolvedOutput)
$bundlePath = Join-Path $resolvedOutput 'mr-boobins-baseline-text-originals-pre-normalization.zip'
$manifestPath = Join-Path $resolvedOutput 'baseline-text-originals-manifest.private.json'

$stream = [IO.File]::Open($bundlePath, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
try {
    $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create, $true)
    try {
        foreach ($member in $members) {
            $entry = $archive.CreateEntry($member.path, [IO.Compression.CompressionLevel]::Optimal)
            $entry.LastWriteTime = [DateTimeOffset]::new(1980, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
            $source = [IO.File]::OpenRead($member.path)
            try {
                $destination = $entry.Open()
                try { $source.CopyTo($destination) }
                finally { $destination.Dispose() }
            }
            finally { $source.Dispose() }
        }
    }
    finally { $archive.Dispose() }
}
finally { $stream.Dispose() }

$expected = @{}
foreach ($member in $members) { $expected[$member.path] = $member }
$stream = [IO.File]::OpenRead($bundlePath)
try {
    $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Read, $false)
    try {
        if ($archive.Entries.Count -ne 21) { throw "Bundle entry count mismatch: $($archive.Entries.Count)" }
        foreach ($entry in $archive.Entries) {
            $path = $entry.FullName.Replace('\', '/')
            if (-not $expected.ContainsKey($path)) { throw "Unexpected bundle member: $path" }
            $member = $expected[$path]
            if ([int64]$entry.Length -ne [int64]$member.bytes) { throw "Bundle member size mismatch: $path" }
            $entryStream = $entry.Open()
            try {
                $hasher = [Security.Cryptography.SHA256]::Create()
                try { $hash = ([BitConverter]::ToString($hasher.ComputeHash($entryStream))).Replace('-', '').ToLowerInvariant() }
                finally { $hasher.Dispose() }
            }
            finally { $entryStream.Dispose() }
            if ($hash -ne $member.sha256) { throw "Bundle member hash mismatch: $path" }
        }
    }
    finally { $archive.Dispose() }
}
finally { $stream.Dispose() }

$bundle = Get-Item -LiteralPath $bundlePath
$manifest = [ordered]@{
    schemaVersion = 1
    kind = 'baseline-text-originals-pre-normalization-private-manifest'
    createdAt = [DateTimeOffset]::UtcNow.ToString('o')
    frozenCandidatePath = $candidatePath
    frozenCandidateSha256 = (Get-FileHash -LiteralPath $candidatePath -Algorithm SHA256).Hash.ToLowerInvariant()
    memberCount = 21
    originalBytes = [int64](($members | Measure-Object bytes -Sum).Sum)
    bundle = [ordered]@{
        name = $bundle.Name
        bytes = [int64]$bundle.Length
        sha256 = (Get-FileHash -LiteralPath $bundlePath -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    members = $members
    verification = 'The ZIP was reopened; every member path, count, size, decompressed bytes, and SHA-256 matched the frozen candidate.'
}
$manifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $manifestPath -Encoding utf8

[ordered]@{
    outputRoot = $resolvedOutput
    memberCount = $manifest.memberCount
    originalBytes = $manifest.originalBytes
    bundlePath = $bundlePath
    bundleBytes = $manifest.bundle.bytes
    bundleSha256 = $manifest.bundle.sha256
    manifestPath = $manifestPath
    manifestBytes = (Get-Item -LiteralPath $manifestPath).Length
    manifestSha256 = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
} | ConvertTo-Json -Depth 5
