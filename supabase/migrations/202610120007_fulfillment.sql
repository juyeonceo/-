create or replace function public.dispatch_order(p_order uuid,p_carrier text,p_tracking text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_status text; v_shipment uuid;
begin
  select status into v_status from public.orders where id=p_order for update;
  if v_status<>'preparing' then raise exception '출고 가능한 주문이 아닙니다.'; end if;
  if trim(p_carrier)='' or trim(p_tracking)='' then raise exception '택배사와 송장번호가 필요합니다.'; end if;
  insert into public.shipments(order_id,carrier,tracking_number)
    values(p_order,trim(p_carrier),trim(p_tracking)) returning id into v_shipment;
  update public.orders set status='shipped' where id=p_order;
  return v_shipment;
end $$;

create or replace function public.complete_delivery(p_order uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_status text;
begin
  select status into v_status from public.orders where id=p_order for update;
  if v_status<>'shipped' then raise exception '배송 중인 주문이 아닙니다.'; end if;
  update public.shipments set status='delivered',delivered_at=now()
    where order_id=p_order and status='shipped';
  update public.orders set status='delivered' where id=p_order;
end $$;

create or replace function public.receive_purchase(p_purchase uuid,p_actor uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_status text; v_item record; v_count integer:=0;
begin
  select status into v_status from public.purchase_orders where id=p_purchase for update;
  if v_status not in ('draft','ordered') then raise exception '입고 가능한 발주서가 아닙니다.'; end if;
  for v_item in select * from public.purchase_order_items where purchase_order_id=p_purchase loop
    if v_item.variant_id is not null then
      update public.product_variants set stock=stock+v_item.quantity where id=v_item.variant_id;
    else
      update public.materials set stock=stock+v_item.quantity where id=v_item.material_id;
    end if;
    insert into public.inventory_movements(variant_id,material_id,delta,reason,actor_id)
      values(v_item.variant_id,v_item.material_id,v_item.quantity,'purchase_receipt:'||p_purchase::text,p_actor);
    v_count:=v_count+1;
  end loop;
  if v_count=0 then raise exception '발주 품목이 없습니다.'; end if;
  update public.purchase_orders set status='received' where id=p_purchase;
  return v_count;
end $$;

create or replace function public.ensure_purchase_editable()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_status text;
begin
  select status into v_status from public.purchase_orders where id=new.purchase_order_id for update;
  if v_status not in ('draft','ordered') then raise exception '입고 완료된 발주서는 수정할 수 없습니다.'; end if;
  return new;
end $$;
create trigger purchase_item_editable before insert or update on public.purchase_order_items
  for each row execute function public.ensure_purchase_editable();

revoke all on function public.dispatch_order(uuid,text,text),public.complete_delivery(uuid),public.receive_purchase(uuid,uuid) from public,anon,authenticated;
grant execute on function public.dispatch_order(uuid,text,text),public.complete_delivery(uuid),public.receive_purchase(uuid,uuid) to service_role;
