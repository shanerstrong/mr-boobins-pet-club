[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$report = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json

if ($report.schemaVersion -ne 1) { throw 'schemaVersion must equal 1.' }
if ($report.status -notin @('pass', 'fail', 'needs-decision')) { throw 'Invalid status.' }
if ($report.reviewPass -lt 1 -or $report.reviewPass -gt 3) { throw 'reviewPass must be between 1 and 3.' }
if ($report.fixRoundsUsed -lt 0 -or $report.fixRoundsUsed -gt 2) { throw 'fixRoundsUsed must be between 0 and 2.' }
if ($null -eq $report.checks -or $null -eq $report.findings) { throw 'checks and findings are required.' }

Write-Output 'Review report is valid.'
