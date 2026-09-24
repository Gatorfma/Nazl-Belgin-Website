create table if not exists public.contact_rate_limits (
  client_hash text primary key check (length(client_hash) = 64),
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count > 0)
);

alter table public.contact_rate_limits enable row level security;
revoke all on table public.contact_rate_limits from public;
revoke all on table public.contact_rate_limits from anon, authenticated;

create or replace function public.consume_contact_rate_limit(client_hash text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  checked_at timestamptz := clock_timestamp();
  allowed boolean;
begin
  if consume_contact_rate_limit.client_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid contact client hash' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(consume_contact_rate_limit.client_hash, 0));
  delete from public.contact_rate_limits
  where window_started_at < checked_at - interval '1 day';

  insert into public.contact_rate_limits as limits
    (client_hash, window_started_at, attempt_count)
  values (consume_contact_rate_limit.client_hash, checked_at, 1)
  on conflict on constraint contact_rate_limits_pkey do update set
    window_started_at = case
      when limits.window_started_at <= checked_at - interval '10 minutes' then checked_at
      else limits.window_started_at
    end,
    attempt_count = case
      when limits.window_started_at <= checked_at - interval '10 minutes' then 1
      else limits.attempt_count + 1
    end
  returning limits.attempt_count <= 5 into allowed;

  return allowed;
end;
$$;

revoke all on function public.consume_contact_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_contact_rate_limit(text) to service_role;
