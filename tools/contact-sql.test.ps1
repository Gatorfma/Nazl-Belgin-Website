$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$migrationPath = Join-Path $root 'supabase/05_contact_delivery.sql'
$verifyPath = Join-Path $root 'supabase/06_verify_contact_delivery.sql'
if (-not (Test-Path -LiteralPath $migrationPath)) { throw 'Missing contact delivery migration.' }
if (-not (Test-Path -LiteralPath $verifyPath)) { throw 'Missing contact delivery verifier.' }
$migration = Get-Content -LiteralPath $migrationPath -Raw -Encoding UTF8
$verify = Get-Content -LiteralPath $verifyPath -Raw -Encoding UTF8
foreach ($fragment in @(
  'create table if not exists public.contact_rate_limits',
  'enable row level security',
  'create or replace function public.consume_contact_rate_limit',
  'pg_advisory_xact_lock',
  'consume_contact_rate_limit.client_hash',
  'on conflict on constraint contact_rate_limits_pkey',
  'checked_at timestamptz := clock_timestamp()',
  "window_started_at < checked_at - interval '1 day'",
  "interval '10 minutes'",
  'attempt_count + 1',
  'revoke all on table public.contact_rate_limits from anon, authenticated',
  'revoke all on function public.consume_contact_rate_limit(text) from public, anon, authenticated',
  'grant execute on function public.consume_contact_rate_limit(text) to service_role'
)) {
  if ($migration -notmatch [regex]::Escape($fragment)) { throw "Missing SQL contract: $fragment" }
}
foreach ($fragment in @('has_table_privilege', 'has_function_privilege', 'Expected rate-limit call 6 to be rejected')) {
  if ($verify -notmatch [regex]::Escape($fragment)) { throw "Missing verification contract: $fragment" }
}
Write-Output 'Contact rate-limit SQL contract checks passed.'
