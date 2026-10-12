create table public.store_settings (
  id boolean primary key default true check (id),
  free_shipping_threshold integer not null default 100000,
  shipping_fee integer not null default 3000,
  point_rate numeric(5,4) not null default 0,
  point_expiry_days integer not null default 365,
  point_use_limit_percent integer not null default 100 check(point_use_limit_percent between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into public.store_settings(id) values(true);
alter table public.store_settings enable row level security;

-- Runs with a service-role connection. The API has already verified the buyer's token.
create or replace function public.prepare_checkout(p_user uuid, p_lines jsonb, p_address jsonb, p_coupon text, p_points integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_profile public.profiles%rowtype;
  v_order_id uuid := gen_random_uuid();
  v_order_code text := 'FL-' || upper(substr(replace(v_order_id::text,'-',''),1,20));
  v_item jsonb; v_row record; v_qty integer; v_units integer;
  v_subtotal integer := 0; v_shipping integer := 0; v_discount integer := 0;
  v_eligible_subtotal integer:=0; v_eligible_discount integer:=0; v_eligible_count integer:=0;
  v_eligible_seen integer:=0; v_points_allocated integer:=0; v_coupon_allocated integer:=0; v_line_seen integer:=0;
  v_total integer := 0; v_coupon public.coupons%rowtype; v_coupon_id uuid;
  v_one_plus_one boolean := false; v_line_total integer; v_coupon_share integer; v_points_share integer;
  v_settings public.store_settings%rowtype;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 50 then raise exception '상품 목록이 올바르지 않습니다.'; end if;
  if p_points < 0 then raise exception '포인트가 올바르지 않습니다.'; end if;
  if coalesce(p_address->>'recipient','')='' or coalesce(p_address->>'phone','')='' or coalesce(p_address->>'postalCode','')='' or coalesce(p_address->>'address','')='' then raise exception '배송 정보를 입력해 주세요.'; end if;
  perform public.expire_customer_points(p_user);
  select * into v_profile from public.profiles where id=p_user and status='active' for update;
  if not found then raise exception '구매 가능한 회원이 아닙니다.'; end if;
  select * into v_settings from public.store_settings where id=true;
  for v_item in select * from jsonb_array_elements(p_lines) loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 99 then raise exception '수량이 올바르지 않습니다.'; end if;
    select v.id variant_id,v.stock,v.size,v.color,p.id product_id,p.name,p.price,p.image_urls,(p.one_plus_one or exists(select 1 from public.promotions m where m.kind='one_plus_one' and m.product_id=p.id and m.active and m.starts_at<=now() and m.ends_at>=now())) as one_plus_one,p.is_preorder,p.preorder_limit,p.preorder_reserved,p.status,p.points_eligible
      into v_row from public.product_variants v join public.products p on p.id=v.product_id
      where v.id=(v_item->>'variantId')::uuid for update of v,p;
    if not found or v_row.status <> 'active' then raise exception '판매 중인 상품이 아닙니다.'; end if;
    v_units := v_qty * (case when v_row.one_plus_one then 2 else 1 end);
    if v_row.is_preorder then
      if v_row.preorder_reserved + v_units > v_row.preorder_limit then raise exception '예약 가능 수량이 부족합니다.'; end if;
      update public.products set preorder_reserved=preorder_reserved+v_units where id=v_row.product_id;
    else
      update public.product_variants set stock=stock-v_units where id=v_row.variant_id and stock>=v_units;
      if not found then raise exception '상품 재고가 부족합니다.'; end if;
    end if;
    v_one_plus_one := v_one_plus_one or v_row.one_plus_one;
    v_subtotal := v_subtotal + v_row.price*v_qty;
    if v_row.points_eligible then v_eligible_subtotal:=v_eligible_subtotal+v_row.price*v_qty;v_eligible_count:=v_eligible_count+1;end if;
  end loop;
  if p_coupon is not null and trim(p_coupon)<>'' then
    if v_one_plus_one then raise exception '1+1 상품에는 쿠폰을 함께 사용할 수 없습니다.'; end if;
    select * into v_coupon from public.coupons where upper(code)=upper(trim(p_coupon)) for update;
    if not found or not v_coupon.active or (v_coupon.starts_at is not null and v_coupon.starts_at>now()) or (v_coupon.ends_at is not null and v_coupon.ends_at<now()) or v_subtotal<v_coupon.min_spend or (v_coupon.usage_limit is not null and v_coupon.used_count>=v_coupon.usage_limit) then raise exception '사용할 수 없는 쿠폰입니다.'; end if;
    v_coupon_id := v_coupon.id;
    if v_coupon.discount_type='fixed' then v_discount:=least(v_subtotal,v_coupon.discount_value);
    else v_discount:=least(v_subtotal,floor(v_subtotal*v_coupon.discount_value/100.0)::integer); end if;
    if v_coupon.max_discount is not null then v_discount:=least(v_discount,v_coupon.max_discount); end if;
    update public.coupons set used_count=used_count+1 where id=v_coupon_id;
  end if;
  v_eligible_discount:=case when v_subtotal>0 then floor(v_discount*v_eligible_subtotal::numeric/v_subtotal)::integer else 0 end;
  if p_points > greatest(0,v_profile.points_balance)
    or p_points > floor((v_eligible_subtotal-v_eligible_discount)*v_settings.point_use_limit_percent/100.0)::integer
    then raise exception '사용 가능한 포인트를 확인해 주세요.'; end if;
  v_shipping := case when v_subtotal >= v_settings.free_shipping_threshold then 0 else v_settings.shipping_fee end;
  v_total := v_subtotal-v_discount-p_points+v_shipping;
  insert into public.orders(id,order_code,user_id,subtotal,coupon_discount,points_used,shipping_fee,total_amount,coupon_id,shipping_address,expires_at)
    values(v_order_id,v_order_code,p_user,v_subtotal,v_discount,p_points,v_shipping,v_total,v_coupon_id,p_address,now()+interval '15 minutes');
  for v_item in select * from jsonb_array_elements(p_lines) loop
    v_qty := (v_item->>'quantity')::integer;
    select v.id variant_id,v.size,v.color,p.id product_id,p.name,p.price,p.image_urls,p.points_eligible,(p.one_plus_one or exists(select 1 from public.promotions m where m.kind='one_plus_one' and m.product_id=p.id and m.active and m.starts_at<=now() and m.ends_at>=now())) as one_plus_one into v_row
      from public.product_variants v join public.products p on p.id=v.product_id where v.id=(v_item->>'variantId')::uuid;
    v_line_seen:=v_line_seen+1;
    v_line_total := v_row.price*v_qty;
    v_coupon_share := case when v_line_seen=jsonb_array_length(p_lines) then v_discount-v_coupon_allocated when v_subtotal>0 then floor(v_discount*v_line_total::numeric/v_subtotal)::integer else 0 end;
    v_coupon_allocated:=v_coupon_allocated+v_coupon_share;
    v_points_share:=0;
    if v_row.points_eligible then
      v_eligible_seen:=v_eligible_seen+1;
      v_points_share:=case when v_eligible_seen=v_eligible_count then p_points-v_points_allocated
        when v_eligible_subtotal-v_eligible_discount>0 then least(p_points-v_points_allocated,floor(p_points*(v_line_total-v_coupon_share)::numeric/(v_eligible_subtotal-v_eligible_discount))::integer) else 0 end;
      v_points_allocated:=v_points_allocated+v_points_share;
    end if;
    insert into public.order_items(order_id,product_id,variant_id,product_name,variant_label,image_url,unit_price,quantity,free_quantity,line_total,coupon_share,points_share)
      values(v_order_id,v_row.product_id,v_row.variant_id,v_row.name,v_row.color||' / '||v_row.size,coalesce(v_row.image_urls[1],''),v_row.price,v_qty,case when v_row.one_plus_one then v_qty else 0 end,v_line_total,v_coupon_share,v_points_share);
  end loop;
  if p_points>0 then
    update public.profiles set points_balance=points_balance-p_points where id=p_user;
    insert into public.point_ledger(user_id,order_id,delta,reason) values(p_user,v_order_id,-p_points,'checkout_reserve');
  end if;
  return jsonb_build_object('orderId',v_order_code,'amount',v_total,'customerKey',v_profile.customer_key::text,'orderName',(select product_name from public.order_items where order_id=v_order_id order by id limit 1)||case when jsonb_array_length(p_lines)>1 then ' 외 '||(jsonb_array_length(p_lines)-1)::text||'건' else '' end,'subtotal',v_subtotal,'shippingFee',v_shipping,'couponDiscount',v_discount,'pointsUsed',p_points);
end $$;

create or replace function public.release_checkout(p_order_code text) returns void language plpgsql security definer set search_path=public as $$
declare v_order public.orders%rowtype; v_item record;
begin
  select * into v_order from public.orders where order_code=p_order_code for update;
  if not found or v_order.status<>'payment_pending' then return; end if;
  for v_item in select i.variant_id,i.quantity,i.free_quantity,i.product_id,p.is_preorder from public.order_items i join public.products p on p.id=i.product_id where i.order_id=v_order.id loop
    if v_item.is_preorder then update public.products set preorder_reserved=greatest(0,preorder_reserved-v_item.quantity-v_item.free_quantity) where id=v_item.product_id;
    else update public.product_variants set stock=stock+v_item.quantity+v_item.free_quantity where id=v_item.variant_id; end if;
  end loop;
  if v_order.points_used>0 then update public.profiles set points_balance=points_balance+v_order.points_used where id=v_order.user_id; insert into public.point_ledger(user_id,order_id,delta,reason) values(v_order.user_id,v_order.id,v_order.points_used,'checkout_release'); end if;
  if v_order.coupon_id is not null then update public.coupons set used_count=greatest(0,used_count-1) where id=v_order.coupon_id; end if;
  update public.orders set status='cancelled' where id=v_order.id;
end $$;

create or replace function public.release_expired_checkouts() returns integer language plpgsql security definer set search_path=public as $$
declare v_order record; v_count integer:=0;
begin
  for v_order in select order_code from public.orders where status='payment_pending' and expires_at<now() for update skip locked loop
    perform public.release_checkout(v_order.order_code); v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

create or replace function public.confirm_checkout(p_order_code text,p_payment_key text,p_response jsonb) returns text language plpgsql security definer set search_path=public as $$
declare v_order public.orders%rowtype; v_new_status text;
begin
  select * into v_order from public.orders where order_code=p_order_code for update;
  if not found then raise exception '주문을 찾을 수 없습니다.'; end if;
  if v_order.status <> 'payment_pending' then
    if exists(select 1 from public.payments where order_id=v_order.id and payment_key=p_payment_key) then return v_order.status; end if;
    raise exception '이미 처리된 주문입니다.';
  end if;
  if v_order.expires_at<now() then raise exception '결제 유효 시간이 지났습니다.'; end if;
  if (p_response->>'totalAmount')::integer <> v_order.total_amount or p_response->>'status'<>'DONE' then raise exception '결제 금액 또는 상태가 일치하지 않습니다.'; end if;
  v_new_status := case when exists(select 1 from public.order_items i join public.products p on p.id=i.product_id where i.order_id=v_order.id and p.is_preorder) then 'preorder_waiting' else 'paid' end;
  insert into public.payments(order_id,payment_key,status,amount,receipt_url,raw_response) values(v_order.id,p_payment_key,'DONE',v_order.total_amount,p_response#>>'{receipt,url}',p_response);
  update public.orders set status=v_new_status,paid_at=now(),expires_at=null where id=v_order.id;
  return v_new_status;
end $$;

create or replace function public.confirm_zero_checkout(p_order_code text) returns text language plpgsql security definer set search_path=public as $$
declare v_order public.orders%rowtype; v_status text;
begin
  select * into v_order from public.orders where order_code=p_order_code for update;
  if not found or v_order.total_amount<>0 or v_order.status<>'payment_pending' then raise exception '포인트 결제 주문 상태가 올바르지 않습니다.'; end if;
  v_status:=case when exists(select 1 from public.order_items i join public.products p on p.id=i.product_id where i.order_id=v_order.id and p.is_preorder) then 'preorder_waiting' else 'paid' end;
  insert into public.payments(order_id,method,status,amount) values(v_order.id,'points','DONE',0);
  update public.orders set status=v_status,paid_at=now(),expires_at=null where id=v_order.id;
  return v_status;
end $$;

-- Only the server's service role can execute checkout mutations.
revoke all on function public.prepare_checkout(uuid,jsonb,jsonb,text,integer) from public,anon,authenticated;
revoke all on function public.release_checkout(text) from public,anon,authenticated;
revoke all on function public.release_expired_checkouts() from public,anon,authenticated;
revoke all on function public.confirm_checkout(text,text,jsonb) from public,anon,authenticated;
revoke all on function public.confirm_zero_checkout(text) from public,anon,authenticated;
grant execute on function public.prepare_checkout(uuid,jsonb,jsonb,text,integer),public.release_checkout(text),public.release_expired_checkouts(),public.confirm_checkout(text,text,jsonb),public.confirm_zero_checkout(text) to service_role;

create or replace function public.award_delivery_points() returns trigger language plpgsql security definer set search_path=public as $$
declare v_rate numeric; v_days integer; v_points integer;
begin
  if new.status='delivered' and old.status<>'delivered' then
    select point_rate,point_expiry_days into v_rate,v_days from public.store_settings where id=true;
    select floor(coalesce(sum((i.line_total-i.coupon_share-i.points_share)*(i.quantity-i.refunded_quantity)::numeric/i.quantity),0)*v_rate)::integer into v_points
      from public.order_items i join public.products p on p.id=i.product_id
      where i.order_id=new.id and p.points_eligible;
    if v_points>0 then
      update public.profiles set points_balance=points_balance+v_points where id=new.user_id;
      insert into public.point_ledger(user_id,order_id,delta,reason,expires_at) values(new.user_id,new.id,v_points,'delivery_reward',now()+make_interval(days=>v_days));
    end if;
  end if;
  return new;
end $$;
create trigger on_order_delivered after update of status on public.orders for each row execute function public.award_delivery_points();
