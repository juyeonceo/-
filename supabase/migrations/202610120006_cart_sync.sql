create or replace function public.sync_cart(p_lines jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare v_item jsonb;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)>50 then raise exception '장바구니 형식이 올바르지 않습니다.'; end if;
  delete from public.cart_items where user_id=auth.uid();
  for v_item in select * from jsonb_array_elements(p_lines) loop
    if (v_item->>'quantity')::integer not between 1 and 99 then raise exception '수량이 올바르지 않습니다.'; end if;
    insert into public.cart_items(user_id,variant_id,quantity)
      values(auth.uid(),(v_item->>'variantId')::uuid,(v_item->>'quantity')::integer);
  end loop;
end $$;
revoke all on function public.sync_cart(jsonb) from public,anon;
grant execute on function public.sync_cart(jsonb) to authenticated;
