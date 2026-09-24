param(
  [string]$ProjectUrl,
  [string]$PublishableKey,
  [switch]$DryRun,
  [switch]$FunctionsOnly,
  [string]$RowsFile
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$repoPrefix = $repoRoot.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$bucket = 'site-media'

function Get-MimeInfo([string]$Path) {
  switch ([IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    '.jpg'  { return [pscustomobject]@{ Mime = 'image/jpeg'; Extension = 'jpg' } }
    '.jpeg' { return [pscustomobject]@{ Mime = 'image/jpeg'; Extension = 'jpg' } }
    '.png'  { return [pscustomobject]@{ Mime = 'image/png'; Extension = 'png' } }
    '.webp' { return [pscustomobject]@{ Mime = 'image/webp'; Extension = 'webp' } }
    '.mp4'  { return [pscustomobject]@{ Mime = 'video/mp4'; Extension = 'mp4' } }
    '.webm' { return [pscustomobject]@{ Mime = 'video/webm'; Extension = 'webm' } }
    default { throw "Unsupported media extension: $([IO.Path]::GetExtension($Path))" }
  }
}

function Get-StoragePath($Row, $MimeInfo) {
  $folder = if ($Row.kind -eq 'artwork') { 'artworks' } else { 'media/' + ([string]$Row.kind).Replace('_', '-') }
  return "$folder/$($Row.id).$($MimeInfo.Extension)"
}

function Resolve-LegacyPath([string]$LegacyPath) {
  if ([string]::IsNullOrWhiteSpace($LegacyPath)) { throw 'Row has no legacy_path.' }
  $candidate = [IO.Path]::GetFullPath((Join-Path $repoRoot $LegacyPath))
  if (-not $candidate.StartsWith($repoPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "legacy_path leaves the repository: $LegacyPath"
  }
  return $candidate
}

function ConvertTo-ObjectUrlPath([string]$Path) {
  return (($Path -split '/') | ForEach-Object { [uri]::EscapeDataString($_) }) -join '/'
}

function Get-StatusCode($ErrorRecord) {
  try { return [int]$ErrorRecord.Exception.Response.StatusCode } catch { return 0 }
}

function Get-RowUri([string]$Table, [string]$Id) {
  return "$ProjectUrl/rest/v1/${Table}?id=eq.$([uri]::EscapeDataString($Id))"
}

function Get-RemoteStoragePath([string]$Table, [string]$Id, $Headers) {
  $uri = "$(Get-RowUri $Table $Id)&select=storage_path"
  $rows = @(Invoke-RestMethod -Method Get -Uri $uri -Headers $Headers)
  if ($rows.Count -eq 1) { return [string]$rows[0].storage_path }
  return ''
}

function Test-RemoteObjectMatches([string]$EncodedPath, [string]$SourcePath, $MimeInfo) {
  $downloadPath = [IO.Path]::GetTempFileName()
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Method Head -Uri "$ProjectUrl/storage/v1/object/public/$bucket/$EncodedPath"
    $remoteLength = [int64]$response.Headers['Content-Length']
    $remoteType = ([string]$response.Headers['Content-Type']).Split(';')[0].Trim()
    $localLength = (Get-Item -LiteralPath $SourcePath).Length
    if ($remoteLength -ne $localLength -or $remoteType -ne $MimeInfo.Mime) { return $false }
    Invoke-WebRequest -UseBasicParsing -Uri "$ProjectUrl/storage/v1/object/public/$bucket/$EncodedPath" -OutFile $downloadPath | Out-Null
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $downloadPath).Hash -eq
      (Get-FileHash -Algorithm SHA256 -LiteralPath $SourcePath).Hash
  } catch {
    return $false
  } finally {
    if (Test-Path -LiteralPath $downloadPath) { Remove-Item -LiteralPath $downloadPath -Force }
  }
}

function Get-LiveRows($Headers) {
  $artworks = @(Invoke-RestMethod -Method Get -Uri "$ProjectUrl/rest/v1/artworks?select=id,legacy_path,storage_path" -Headers $Headers)
  $media = @(Invoke-RestMethod -Method Get -Uri "$ProjectUrl/rest/v1/media_items?select=id,kind,legacy_path,storage_path" -Headers $Headers)
  $rows = @()
  foreach ($row in $artworks) {
    $rows += [pscustomobject]@{
      id = $row.id; table = 'artworks'; kind = 'artwork'
      legacy_path = $row.legacy_path; storage_path = $row.storage_path
    }
  }
  foreach ($row in $media) {
    $rows += [pscustomobject]@{
      id = $row.id; table = 'media_items'; kind = $row.kind
      legacy_path = $row.legacy_path; storage_path = $row.storage_path
    }
  }
  return $rows
}

if ($FunctionsOnly) { return }

if ($RowsFile) {
  $resolvedRowsFile = (Resolve-Path -LiteralPath $RowsFile).Path
  $rows = @((Get-Content -LiteralPath $resolvedRowsFile -Raw -Encoding UTF8 | ConvertFrom-Json))
} else {
  $rows = $null
}

$headers = $null
if (-not $DryRun) {
  if ([string]::IsNullOrWhiteSpace($ProjectUrl)) { $ProjectUrl = Read-Host 'Supabase project URL' }
  if ([string]::IsNullOrWhiteSpace($PublishableKey)) { $PublishableKey = Read-Host 'Supabase publishable key' }
  $ProjectUrl = $ProjectUrl.TrimEnd('/')
  $email = Read-Host 'Artist email'
  $securePassword = Read-Host 'Artist password' -AsSecureString
  $plainPassword = $null
  $passwordPointer = [IntPtr]::Zero
  try {
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $authBody = @{ email = $email; password = $plainPassword } | ConvertTo-Json
    $auth = Invoke-RestMethod -Method Post -Uri "$ProjectUrl/auth/v1/token?grant_type=password" -Headers @{
      apikey = $PublishableKey
      'Content-Type' = 'application/json'
    } -Body $authBody
  } finally {
    $plainPassword = $null
    $authBody = $null
    if ($passwordPointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
  }
  if (-not $auth.access_token) { throw 'Supabase Auth did not return an access token.' }
  $headers = @{ apikey = $PublishableKey; Authorization = "Bearer $($auth.access_token)" }
  if ($null -eq $rows) { $rows = @(Get-LiveRows $headers) }
} elseif ($null -eq $rows) {
  throw '-DryRun requires -RowsFile so it can run without Supabase credentials.'
}

$migrated = 0
$skipped = 0
$failed = 0

foreach ($row in $rows) {
  $id = [string]$row.id
  $table = [string]$row.table
  $kind = [string]$row.kind
  if ($table -notin @('artworks', 'media_items')) {
    Write-Output "FAIL $id invalid table '$table'"
    $failed++
    continue
  }
  if ($kind -eq 'youtube' -or -not [string]::IsNullOrWhiteSpace([string]$row.storage_path)) {
    Write-Output "SKIP $id already migrated or external"
    $skipped++
    continue
  }

  try {
    $sourcePath = Resolve-LegacyPath ([string]$row.legacy_path)
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
      throw "File not found: $($row.legacy_path)"
    }
    $mime = Get-MimeInfo $sourcePath
    $storagePath = Get-StoragePath $row $mime

    if ($DryRun) {
      Write-Output "MIGRATE $id $($row.legacy_path) -> $storagePath"
      Write-Output "PATCH $(Get-RowUri $table $id) storage_path=$storagePath"
      $migrated++
      continue
    }

    $encodedPath = ConvertTo-ObjectUrlPath $storagePath
    try {
      Invoke-RestMethod -Method Post -Uri "$ProjectUrl/storage/v1/object/$bucket/$encodedPath" -Headers @{
        apikey = $PublishableKey
        Authorization = $headers.Authorization
        'x-upsert' = 'false'
      } -InFile $sourcePath -ContentType $mime.Mime | Out-Null
    } catch {
      $conflict = (Get-StatusCode $_) -eq 409 -or $_.Exception.Message -match 'duplicate|already exists|conflict'
      if ($conflict -and (Get-RemoteStoragePath $table $id $headers) -eq $storagePath) {
        Write-Output "SKIP $id database already references $storagePath"
        $skipped++
        continue
      }
      if ($conflict -and (Test-RemoteObjectMatches $encodedPath $sourcePath $mime)) {
        Write-Output "RESUME $id verified existing object $storagePath"
      } else {
        throw
      }
    }

    $patchBody = @{ storage_path = $storagePath } | ConvertTo-Json
    Invoke-RestMethod -Method Patch -Uri (Get-RowUri $table $id) -Headers @{
      apikey = $PublishableKey
      Authorization = $headers.Authorization
      Prefer = 'return=minimal'
      'Content-Type' = 'application/json'
    } -Body $patchBody | Out-Null
    Write-Output "MIGRATED $id -> $storagePath"
    $migrated++
  } catch {
    Write-Output "FAIL $id $($_.Exception.Message)"
    $failed++
  }
}

Write-Output "Migration summary: migrated=$migrated skipped=$skipped failed=$failed"
if ($failed -gt 0) { exit 1 }
exit 0
