param([string]$OutputDirectory = "../astro-audit-evidence")
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$source = Join-Path $PSScriptRoot '../tests/reference/nina-standard-parser.cs'
Add-Type -Path $source
$positive = [CustomHorizon]::FromReader_Standard([System.IO.StringReader]::new("# Az Alt`r`n0 14`r`n90 20`r`n180 30`r`n270 20`r`n360 14"))
$incomplete = [CustomHorizon]::FromReader_Standard([System.IO.StringReader]::new("0 10`n30 11`n60 12`n90 13`n120 14"))
if ($positive.Azimuths.Count -ne 5 -or $incomplete.Azimuths.Count -ne 6 -or $incomplete.Azimuths[-1] -ne 360 -or $incomplete.Altitudes[-1] -ne 10) { throw 'Actual NINA standard parser behavior differs from reference' }
$report = @{
  classification = 'PASS_WITH_KNOWN_GAPS'
  scope = 'Unchanged pinned NINA Standard parser/grooming methods executed with minimal constructor/logger scaffold; full desktop application NOT_EXECUTED'
  upstreamCommit = '5f137612aba9a4360f365232763525bfd8d4a866'
  executableSourceSHA256 = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
  runtime = [System.Runtime.InteropServices.RuntimeInformation]::FrameworkDescription
  positiveCount = $positive.Azimuths.Count
  incompleteAzimuthsAfterGrooming = $incomplete.Azimuths
  incompleteAltitudesAfterGrooming = $incomplete.Altitudes
  implication = 'NINA repairs/interpolates incomplete numerical profiles; producer must deny uncertified export'
}
$report | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $OutputDirectory 'nina-parser-execution.json')
$report | ConvertTo-Json -Depth 8
