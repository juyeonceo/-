alter table public.point_ledger add column expired_at timestamptz;
create index point_ledger_expiry_idx on public.point_ledger(user_id,expires_at) where expires_at is not null and expired_at is null and delta > 0;

-- Spend oldest points first. A remaining balance covered by newer credits does
-- not contain an older credit, so only its unspent remainder is expired.
create or replace function public.expire_customer_points(p_user uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_balance integer; v_credit record; v_newer integer; v_expire integer; v_total integer:=0;
begin
  select points_balance into v_balance from public.profiles where id=p_user for update;
  if not found then return 0; end if;
  for v_credit in
    select id,delta,created_at,expires_at from public.point_ledger
    where user_id=p_user and delta>0 and expires_at<=now() and expired_at is null
    order by created_at,id
    for update
  loop
    select coalesce(sum(delta),0) into v_newer from public.point_ledger
    where user_id=p_user and delta>0 and expired_at is null
      and (created_at,id)>(v_credit.created_at,v_credit.id);
    v_expire:=least(v_credit.delta,greatest(0,v_balance-v_newer));
    update public.point_ledger set expired_at=now() where id=v_credit.id;
    if v_expire>0 then
      update public.profiles set points_balance=points_balance-v_expire where id=p_user;
      insert into public.point_ledger(user_id,delta,reason)
        values(p_user,-v_expire,'point_expired:'||v_credit.id::text);
      v_balance:=v_balance-v_expire;
      v_total:=v_total+v_expire;
    end if;
  end loop;
  return v_total;
end $$;

create or replace function public.expire_all_points()
returns integer language plpgsql security definer set search_path=public as $$
declare v_user record; v_total integer:=0;
begin
  for v_user in select distinct user_id from public.point_ledger
    where delta>0 and expires_at<=now() and expired_at is null
  loop
    v_total:=v_total+public.expire_customer_points(v_user.user_id);
  end loop;
  return v_total;
end $$;

revoke all on function public.expire_customer_points(uuid),public.expire_all_points() from public,anon,authenticated;
grant execute on function public.expire_customer_points(uuid),public.expire_all_points() to service_role;
