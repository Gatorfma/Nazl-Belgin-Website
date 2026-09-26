-- Create and confirm the single email/password user in Supabase Auth first.
-- Change this one email literal if the artist's login differs from her contact email.
do $$
declare
  target_email constant text := 'nazlibelgin@gmail.com';
  matched_ids uuid[];
begin
  select array_agg(id) into matched_ids
  from auth.users
  where lower(email) = lower(target_email);

  if coalesce(cardinality(matched_ids), 0) <> 1 then
    raise exception 'Expected exactly one Auth user for %, found %',
      target_email, coalesce(cardinality(matched_ids), 0);
  end if;

  insert into public.studio_users(user_id)
  values (matched_ids[1])
  on conflict (user_id) do nothing;
end $$;
