alter table public.order_items add column refunded_quantity integer not null default 0;
alter table public.payments add column refunded_amount integer not null default 0;
alter table public.service_requests drop constraint service_requests_status_check;
alter table public.service_requests add constraint service_requests_status_check check(status in ('requested','processing','approved','rejected','collecting','completed'));
alter table public.profiles drop constraint profiles_points_balance_check;
drop policy requests_own_insert on public.service_requests;
create policy requests_own_insert on public.service_requests for insert to authenticated with check (
  user_id=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid())
  and (order_item_id is null or exists(select 1 from public.order_items i where i.id=order_item_id and i.order_id=order_id))
);

create or replace function public.claim_refund(p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_request public.service_requests%rowtype; v_order public.orders%rowtype; v_payment public.payments%rowtype;
  v_item public.order_items%rowtype; v_qty integer; v_remaining integer; v_points integer; v_cash integer;
begin
  select * into v_request from public.service_requests where id=p_request_id for update;
  if not found or v_request.status<>'requested' then raise exception '처리 가능한 요청이 아닙니다.'; end if;
  select * into v_order from public.orders where id=v_request.order_id for update;
  if v_order.status not in ('paid','preorder_waiting','preparing','shipped','delivered') then raise exception '환불할 수 없는 주문 상태입니다.'; end if;
  if v_request.kind='cancel' and v_order.status in ('shipped','delivered') then raise exception '배송 시작 후에는 반품으로 접수해 주세요.'; end if;
  if v_request.kind='return' and v_order.status not in ('shipped','delivered') then raise exception '배송 전에는 취소로 접수해 주세요.'; end if;
  select * into v_payment from public.payments where order_id=v_order.id for update;
  if not found then raise exception '결제 기록을 찾을 수 없습니다.'; end if;
  select coalesce(sum(quantity-refunded_quantity),0) into v_remaining from public.order_items where order_id=v_order.id;
  if v_remaining<1 then raise exception '환불 가능한 상품이 없습니다.'; end if;
  if v_request.order_item_id is null then
    v_qty:=v_remaining; v_cash:=v_payment.amount-v_payment.refunded_amount;
    select v_order.points_used-coalesce(sum(delta),0) into v_points from public.point_ledger where order_id=v_order.id and reason='refund_restore';
  else
    select * into v_item from public.order_items where id=v_request.order_item_id and order_id=v_order.id for update;
    if not found then raise exception '주문 상품을 찾을 수 없습니다.'; end if;
    v_qty:=coalesce(v_request.quantity,v_item.quantity-v_item.refunded_quantity);
    if v_qty<1 or v_qty>v_item.quantity-v_item.refunded_quantity then raise exception '환불 수량이 올바르지 않습니다.'; end if;
    if v_qty=v_remaining then
      v_cash:=v_payment.amount-v_payment.refunded_amount;
      select v_order.points_used-coalesce(sum(delta),0) into v_points from public.point_ledger where order_id=v_order.id and reason='refund_restore';
    else
      v_cash:=floor((v_item.line_total-v_item.coupon_share-v_item.points_share)*v_qty::numeric/v_item.quantity)::integer;
      v_points:=floor(v_item.points_share*v_qty::numeric/v_item.quantity)::integer;
    end if;
  end if;
  if v_cash<0 or v_points<0 then raise exception '환불 금액이 올바르지 않습니다.'; end if;
  update public.service_requests set status='processing',refund_amount=v_cash where id=p_request_id;
  return jsonb_build_object('paymentKey',v_payment.payment_key,'method',v_payment.method,'cashAmount',v_cash,'pointsAmount',v_points,'orderId',v_order.id,'orderCode',v_order.order_code,'requestId',p_request_id,'reason',v_request.reason);
end $$;

create or replace function public.reset_refund(p_request_id uuid,p_note text) returns void language plpgsql security definer set search_path=public as $$
begin update public.service_requests set status='requested',admin_note=p_note,refund_amount=null where id=p_request_id and status='processing'; end $$;

create or replace function public.complete_refund(p_request_id uuid,p_toss_response jsonb) returns text language plpgsql security definer set search_path=public as $$
declare v_request public.service_requests%rowtype; v_order public.orders%rowtype; v_payment public.payments%rowtype;
  v_item public.order_items%rowtype; v_qty integer; v_remaining integer; v_cash integer; v_points integer:=0;
  v_reward integer:=0; v_already_reversed integer:=0; v_reverse integer:=0; v_full boolean; v_restock boolean;
  v_eligible_total numeric:=0; v_eligible_refund numeric:=0;
begin
  select * into v_request from public.service_requests where id=p_request_id for update;
  if not found or v_request.status<>'processing' then raise exception '처리 중인 요청이 아닙니다.'; end if;
  select * into v_order from public.orders where id=v_request.order_id for update;
  select * into v_payment from public.payments where order_id=v_order.id for update;
  v_cash:=coalesce(v_request.refund_amount,0);
  if v_payment.method<>'points' and v_cash>0 and (p_toss_response is null or p_toss_response->>'paymentKey'<>v_payment.payment_key) then raise exception 'PG 취소 결과가 일치하지 않습니다.'; end if;
  select coalesce(sum(quantity-refunded_quantity),0) into v_remaining from public.order_items where order_id=v_order.id;
  if v_request.order_item_id is null then
    v_qty:=v_remaining;
  else
    select * into v_item from public.order_items where id=v_request.order_item_id and order_id=v_order.id for update;
    v_qty:=coalesce(v_request.quantity,v_item.quantity-v_item.refunded_quantity);
  end if;
  v_full:=v_qty=v_remaining;
  if v_full then select v_order.points_used-coalesce(sum(delta),0) into v_points from public.point_ledger where order_id=v_order.id and reason='refund_restore';
  else v_points:=floor(v_item.points_share*v_qty::numeric/v_item.quantity)::integer; end if;
  v_restock:=v_order.status in ('paid','preorder_waiting','preparing') or v_request.kind='return';
  for v_item in select * from public.order_items where order_id=v_order.id and (v_request.order_item_id is null or id=v_request.order_item_id) for update loop
    if v_request.order_item_id is null then v_qty:=v_item.quantity-v_item.refunded_quantity;
    else v_qty:=coalesce(v_request.quantity,v_item.quantity-v_item.refunded_quantity); end if;
    update public.order_items set refunded_quantity=refunded_quantity+v_qty where id=v_item.id;
    if v_restock then
      if (select is_preorder from public.products where id=v_item.product_id) then
        update public.products set preorder_reserved=greatest(0,preorder_reserved-v_qty-case when v_item.free_quantity>0 then v_qty else 0 end) where id=v_item.product_id;
      else update public.product_variants set stock=stock+v_qty+case when v_item.free_quantity>0 then v_qty else 0 end where id=v_item.variant_id; end if;
    end if;
  end loop;
  if v_points>0 then
    update public.profiles set points_balance=points_balance+v_points where id=v_order.user_id;
    insert into public.point_ledger(user_id,order_id,delta,reason) values(v_order.user_id,v_order.id,v_points,'refund_restore');
  end if;
  select coalesce(sum(delta),0) into v_reward from public.point_ledger where order_id=v_order.id and reason='delivery_reward';
  select coalesce(-sum(delta),0) into v_already_reversed from public.point_ledger where order_id=v_order.id and reason='refund_reward_reversal';
  select coalesce(sum(i.line_total-i.coupon_share-i.points_share),0) into v_eligible_total
    from public.order_items i join public.products p on p.id=i.product_id
    where i.order_id=v_order.id and p.points_eligible;
  if not v_full then
    select case when p.points_eligible then
      (i.line_total-i.coupon_share-i.points_share)*v_qty::numeric/i.quantity
      else 0 end into v_eligible_refund
      from public.order_items i join public.products p on p.id=i.product_id where i.id=v_request.order_item_id;
  end if;
  if v_full then v_reverse:=greatest(0,v_reward-v_already_reversed);
  else v_reverse:=least(greatest(0,v_reward-v_already_reversed),floor(v_reward*v_eligible_refund/greatest(1,v_eligible_total))::integer); end if;
  if v_reverse>0 then
    update public.profiles set points_balance=points_balance-v_reverse where id=v_order.user_id;
    insert into public.point_ledger(user_id,order_id,delta,reason) values(v_order.user_id,v_order.id,-v_reverse,'refund_reward_reversal');
  end if;
  update public.payments set refunded_amount=refunded_amount+v_cash,status=case when refunded_amount+v_cash>=amount then 'REFUNDED' else 'PARTIAL_REFUNDED' end,raw_response=coalesce(p_toss_response,raw_response) where id=v_payment.id;
  if v_full then
    update public.orders set status=case when v_order.status in ('paid','preorder_waiting','preparing') then 'cancelled' else 'refunded' end where id=v_order.id;
    if v_order.coupon_id is not null then update public.coupons set used_count=greatest(0,used_count-1) where id=v_order.coupon_id; end if;
  end if;
  update public.service_requests set status='completed',refund_amount=v_cash,resolved_at=now() where id=p_request_id;
  return case when v_full then 'full' else 'partial' end;
end $$;

revoke all on function public.claim_refund(uuid),public.reset_refund(uuid,text),public.complete_refund(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.claim_refund(uuid),public.reset_refund(uuid,text),public.complete_refund(uuid,jsonb) to service_role;
