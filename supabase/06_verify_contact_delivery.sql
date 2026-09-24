do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.contact_rate_limits'::regclass) then
    raise exception 'RLS is disabled on contact_rate_limits';
  end if;
  if has_table_privilege('anon', 'public.contact_rate_limits', 'select')
     or has_table_privilege('authenticated', 'public.contact_rate_limits', 'select') then
    raise exception 'Browser roles can read contact rate limits';
  end if;
  if has_function_privilege('anon', 'public.consume_contact_rate_limit(text)', 'execute')
     or has_function_privilege('authenticated', 'public.consume_contact_rate_limit(text)', 'execute') then
    raise exception 'Browser roles can execute the contact rate limit';
  end if;
  if not has_function_privilege('service_role', 'public.consume_contact_rate_limit(text)', 'execute') then
    raise exception 'service_role cannot execute the contact rate limit';
  end if;
end $$;

do $$
declare
  test_hash text := repeat('a', 64);
  call_number integer;
  allowed boolean;
begin
  delete from public.contact_rate_limits where client_hash = test_hash;
  for call_number in 1..6 loop
    allowed := public.consume_contact_rate_limit(test_hash);
    -- Expected rate-limit call 6 to be rejected.
    if allowed is distinct from (call_number <= 5) then
      raise exception 'Expected rate-limit call % to be %', call_number,
        case when call_number <= 5 then 'allowed' else 'rejected' end;
    end if;
  end loop;
  delete from public.contact_rate_limits where client_hash = test_hash;
end $$;

select 'contact email rate limit ready' as verification;
