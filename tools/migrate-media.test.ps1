$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$production = Join-Path $PSScriptRoot 'migrate-media.ps1'
$fixtureRoot = Join-Path $repoRoot ('.migration-test-' + [guid]::NewGuid().ToString('N'))

function Invoke-DryRun([string]$RowsFile) {
  $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $production -DryRun -RowsFile $RowsFile 2>&1
  return [pscustomobject]@{
    ExitCode = $LASTEXITCODE
    Output = ($output -join "`n")
  }
}

function Assert-Run($Run, [int]$ExitCode, [string]$Summary) {
  if ($Run.ExitCode -ne $ExitCode) {
    throw "Expected exit $ExitCode, got $($Run.ExitCode). Output:`n$($Run.Output)"
  }
  if ($Run.Output -notmatch [regex]::Escape($Summary)) {
    throw "Expected summary '$Summary'. Output:`n$($Run.Output)"
  }
}

try {
  if (-not (Test-Path -LiteralPath $production)) {
    throw "Production migration script is missing: $production"
  }

  New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
  $relativeRoot = [IO.Path]::GetFileName($fixtureRoot)
  $firstPath = "$relativeRoot/first.jpg"
  $missingPath = "$relativeRoot/missing.png"
  [IO.File]::WriteAllBytes((Join-Path $fixtureRoot 'first.jpg'), [byte[]](1, 2, 3))

  . $production -ProjectUrl 'https://project.supabase.co' -FunctionsOnly

  function Invoke-RestMethod {
    param([string]$Method, [string]$Uri, $Headers)
    if ($Uri -match '/artworks\?') {
      $response = [object[]]@(
        [pscustomobject]@{ id = 'a1'; legacy_path = 'art/a1.jpg'; storage_path = $null },
        [pscustomobject]@{ id = 'a2'; legacy_path = 'art/a2.jpg'; storage_path = $null }
      )
      Write-Output -NoEnumerate $response
      return
    }
    if ($Uri -match '/media_items\?') {
      $response = [object[]]@(
        [pscustomobject]@{ id = 'm1'; kind = 'portrait'; legacy_path = 'art/p.jpg'; storage_path = $null }
      )
      Write-Output -NoEnumerate $response
      return
    }
    throw "Unexpected REST URI in test: $Uri"
  }
  $liveRows = @(Get-LiveRows @{})
  if ($liveRows.Count -ne 3) {
    throw "Windows PowerShell REST arrays must become three migration rows; got $($liveRows.Count)."
  }
  if (($liveRows.id -join ',') -ne 'a1,a2,m1') {
    throw "Live migration rows were combined or reordered: $($liveRows.id -join ',')"
  }

  $script:remoteBytes = [byte[]](1, 2, 3)
  function Invoke-WebRequest {
    param([switch]$UseBasicParsing, [string]$Method, [string]$Uri, [string]$OutFile)
    if ($Method -eq 'Head') {
      return [pscustomobject]@{ Headers = @{ 'Content-Length' = '3'; 'Content-Type' = 'image/jpeg' } }
    }
    [IO.File]::WriteAllBytes($OutFile, $script:remoteBytes)
  }
  $mime = [pscustomobject]@{ Mime = 'image/jpeg'; Extension = 'jpg' }
  if (-not (Test-RemoteObjectMatches 'artworks/test.jpg' (Join-Path $fixtureRoot 'first.jpg') $mime)) {
    throw 'Matching remote object was not accepted for migration resume.'
  }
  $script:remoteBytes = [byte[]](3, 2, 1)
  if (Test-RemoteObjectMatches 'artworks/test.jpg' (Join-Path $fixtureRoot 'first.jpg') $mime) {
    throw 'Same-size remote object with different bytes was accepted for migration resume.'
  }

  $rows = @(
    [ordered]@{ id = '90000000-0000-4000-8000-000000000001'; table = 'artworks'; kind = 'artwork'; legacy_path = $firstPath; storage_path = $null },
    [ordered]@{ id = '90000000-0000-4000-8000-000000000002'; table = 'artworks'; kind = 'artwork'; legacy_path = $firstPath; storage_path = 'artworks/already.jpg' },
    [ordered]@{ id = '90000000-0000-4000-8000-000000000003'; table = 'media_items'; kind = 'portrait'; legacy_path = $missingPath; storage_path = $null }
  )
  $rowsFile = Join-Path $fixtureRoot 'rows.json'
  $rows | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $rowsFile -Encoding UTF8

  Assert-Run (Invoke-DryRun $rowsFile) 1 'migrated=1 skipped=1 failed=1'

  [IO.File]::WriteAllBytes((Join-Path $fixtureRoot 'missing.png'), [byte[]](4, 5, 6))
  $rerun = Invoke-DryRun $rowsFile
  Assert-Run $rerun 0 'migrated=2 skipped=1 failed=0'
  if ($rerun.Output -notmatch '/rest/v1/artworks\?id=eq\.90000000-0000-4000-8000-000000000001') {
    throw "Dry run did not report the exact artwork PATCH endpoint. Output:`n$($rerun.Output)"
  }
  if ($rerun.Output -match '/rest/v1/=eq\.') {
    throw "Dry run reported a malformed PATCH endpoint. Output:`n$($rerun.Output)"
  }

  $fullRowsFile = Join-Path $PSScriptRoot 'fixtures/current-media-rows.json'
  $fullRows = @((Get-Content -LiteralPath $fullRowsFile -Raw -Encoding UTF8 | ConvertFrom-Json))
  if ($fullRows.Count -ne 60) { throw "Expected 60 committed media rows, got $($fullRows.Count)." }
  Assert-Run (Invoke-DryRun $fullRowsFile) 0 'migrated=60 skipped=0 failed=0'

  Write-Output 'Migration recovery, dry-run failure, rerun and 60-file inventory checks passed.'
}
finally {
  if (Test-Path -LiteralPath $fixtureRoot) {
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
  }
}
