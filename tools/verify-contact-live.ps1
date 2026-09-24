param(
  [Parameter(Mandatory=$true)][string]$ProjectUrl,
  [Parameter(Mandatory=$true)][string]$PublishableKey,
  [string]$Origin = 'http://localhost:8000',
  [switch]$Send
)
$ErrorActionPreference = 'Stop'
$uri = $ProjectUrl.TrimEnd('/') + '/functions/v1/send-contact'

function Invoke-Probe([string]$Method, [string]$ProbeOrigin, [string]$Body = '') {
  $arguments = @{
    Method = $Method; Uri = $uri; UseBasicParsing = $true
    Headers = @{ apikey = $PublishableKey; Origin = $ProbeOrigin }
  }
  if ($Body) { $arguments.Body = $Body; $arguments.ContentType = 'application/json' }
  try {
    $response = Invoke-WebRequest @arguments
    return [pscustomobject]@{ Status = [int]$response.StatusCode; Headers = $response.Headers; Body = $response.Content }
  } catch {
    if (-not $_.Exception.Response) { throw }
    return [pscustomobject]@{
      Status = [int]$_.Exception.Response.StatusCode
      Headers = $_.Exception.Response.Headers
      Body = ''
    }
  }
}

$preflight = Invoke-Probe 'Options' $Origin
if ($preflight.Status -notin @(200, 204)) { throw "Expected successful preflight, got $($preflight.Status)." }
if ($preflight.Headers['Access-Control-Allow-Origin'] -ne $Origin) { throw 'Preflight origin was not echoed.' }
if ((Invoke-Probe 'Options' 'https://attacker.example').Status -ne 403) { throw 'Disallowed origin was not rejected.' }
if ((Invoke-Probe 'Post' $Origin '{}').Status -ne 400) { throw 'Invalid contact body was not rejected.' }

if ($Send) {
  $payload = @{ name = 'Local delivery check'; email = 'furkanmertaksakal@gmail.com';
    message = 'Contact delivery verification ' + [DateTime]::UtcNow.ToString('o'); website = '' } | ConvertTo-Json
  $sent = Invoke-Probe 'Post' $Origin $payload
  if ($sent.Status -ne 200 -or $sent.Body -notmatch '"ok"\s*:\s*true') {
    throw "Live contact send failed with HTTP $($sent.Status)."
  }
}
Write-Output 'Contact Edge Function live checks passed.'
