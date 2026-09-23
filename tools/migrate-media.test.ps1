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

  $rows = @(
    [ordered]@{ id = '90000000-0000-4000-8000-000000000001'; table = 'artworks'; kind = 'artwork'; legacy_path = $firstPath; storage_path = $null },
    [ordered]@{ id = '90000000-0000-4000-8000-000000000002'; table = 'artworks'; kind = 'artwork'; legacy_path = $firstPath; storage_path = 'artworks/already.jpg' },
    [ordered]@{ id = '90000000-0000-4000-8000-000000000003'; table = 'media_items'; kind = 'portrait'; legacy_path = $missingPath; storage_path = $null }
  )
  $rowsFile = Join-Path $fixtureRoot 'rows.json'
  $rows | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $rowsFile -Encoding UTF8

  Assert-Run (Invoke-DryRun $rowsFile) 1 'migrated=1 skipped=1 failed=1'

  [IO.File]::WriteAllBytes((Join-Path $fixtureRoot 'missing.png'), [byte[]](4, 5, 6))
  Assert-Run (Invoke-DryRun $rowsFile) 0 'migrated=2 skipped=1 failed=0'

  $fullRowsFile = Join-Path $PSScriptRoot 'fixtures/current-media-rows.json'
  $fullRows = @((Get-Content -LiteralPath $fullRowsFile -Raw -Encoding UTF8 | ConvertFrom-Json))
  if ($fullRows.Count -ne 60) { throw "Expected 60 committed media rows, got $($fullRows.Count)." }
  Assert-Run (Invoke-DryRun $fullRowsFile) 0 'migrated=60 skipped=0 failed=0'

  Write-Output 'Migration dry-run failure, rerun and 60-file inventory checks passed.'
}
finally {
  if (Test-Path -LiteralPath $fixtureRoot) {
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
  }
}
