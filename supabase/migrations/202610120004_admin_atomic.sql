create or replace function public.adjust_inventory(p_variant_id uuid,p_material_id uuid,p_delta integer,p_reason text,p_actor uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_stock integer;
begin
  if p_delta=0 or (p_variant_id is null and p_material_id is null) or (p_variant_id is not null and p_material_id is not null) then raise exception '재고 조정 값이 올바르지 않습니다.'; end if;
  if p_variant_id is not null then
    update public.product_variants set stock=stock+p_delta where id=p_variant_id and stock+p_delta>=0 returning stock into v_stock;
  else
    update public.materials set stock=stock+p_delta where id=p_material_id and stock+p_delta>=0 returning stock into v_stock;
  end if;
  if not found then raise exception '재고가 부족하거나 품목이 없습니다.'; end if;
  insert into public.inventory_movements(variant_id,material_id,delta,reason,actor_id) values(p_variant_id,p_material_id,p_delta,p_reason,p_actor);
  return v_stock;
end $$;

create or replace function public.adjust_member_points(p_user uuid,p_delta integer,p_actor uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_balance integer;
begin
  if p_delta=0 then raise exception '포인트 조정 값이 올바르지 않습니다.'; end if;
  update public.profiles set points_balance=points_balance+p_delta where id=p_user and points_balance+p_delta>=0 returning points_balance into v_balance;
  if not found then raise exception '포인트 잔액이 부족하거나 회원이 없습니다.'; end if;
  insert into public.point_ledger(user_id,delta,reason) values(p_user,p_delta,'admin_adjustment:'||p_actor::text);
  return v_balance;
end $$;
revoke all on function public.adjust_inventory(uuid,uuid,integer,text,uuid),public.adjust_member_points(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.adjust_inventory(uuid,uuid,integer,text,uuid),public.adjust_member_points(uuid,integer,uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,5000000,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
