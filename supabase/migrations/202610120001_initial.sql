-- FULGERE commerce schema. Apply in the Supabase SQL editor or with Supabase CLI.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  phone text not null default '',
  phone_verified boolean not null default false,
  customer_key uuid not null default gen_random_uuid(),
  role text not null default 'customer' check (role in ('customer','owner','merchandiser','fulfillment','support')),
  status text not null default 'active' check (status in ('active','suspended')),
  points_balance integer not null default 0 check (points_balance >= 0),
  created_at timestamptz not null default now()
);
create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name,phone)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.raw_user_meta_data->>'phone',''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();

create table public.categories (id text primary key, name text not null, sort_order integer not null default 0);
insert into public.categories values ('dresses','드레스',1),('tops','상의',2),('trousers','바지',3),('knitwear','니트웨어',4),('tailoring','테일러링',5),('skirts','스커트',6),('jumpsuits','점프수트',7);

create table public.products (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  description text not null default '', category_id text not null references public.categories(id),
  price integer not null check(price >= 0), compare_at_price integer,
  image_urls text[] not null default '{}', badge text,
  status text not null default 'draft' check(status in ('draft','active','archived')),
  is_preorder boolean not null default false, preorder_date date,
  preorder_limit integer not null default 0, preorder_reserved integer not null default 0,
  one_plus_one boolean not null default false,
  points_eligible boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_variants (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique, size text not null, color text not null,
  stock integer not null default 0 check(stock >= 0), unique(product_id,size,color)
);
create table public.addresses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default '기본 배송지', recipient text not null, phone text not null,
  postal_code text not null, address text not null, detail text not null default '', is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.cart_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity integer not null check(quantity between 1 and 99), updated_at timestamptz not null default now(),
  primary key(user_id,variant_id)
);
create table public.coupons (
  id uuid primary key default gen_random_uuid(), code text not null unique, title text not null,
  discount_type text not null check(discount_type in ('fixed','percent')),
  discount_value integer not null check(discount_value > 0 and (discount_type <> 'percent' or discount_value <= 100)), min_spend integer not null default 0,
  max_discount integer, usage_limit integer, used_count integer not null default 0,
  starts_at timestamptz, ends_at timestamptz, active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.orders (
  id uuid primary key default gen_random_uuid(), order_code text not null unique,
  user_id uuid not null references public.profiles(id),
  status text not null default 'payment_pending' check(status in ('payment_pending','paid','preorder_waiting','preparing','shipped','delivered','cancelled','refunded')),
  subtotal integer not null, coupon_discount integer not null default 0, points_used integer not null default 0,
  shipping_fee integer not null default 0, total_amount integer not null,
  coupon_id uuid references public.coupons(id), shipping_address jsonb not null,
  expires_at timestamptz, created_at timestamptz not null default now(), paid_at timestamptz
);
create index orders_user_created_idx on public.orders(user_id,created_at desc);
create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id), variant_id uuid not null references public.product_variants(id),
  product_name text not null, variant_label text not null, image_url text not null default '',
  unit_price integer not null, quantity integer not null, free_quantity integer not null default 0,
  line_total integer not null, coupon_share integer not null default 0, points_share integer not null default 0
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders(id),
  payment_key text unique, method text not null default 'toss', status text not null,
  amount integer not null, receipt_url text, raw_response jsonb,
  created_at timestamptz not null default now()
);
create table public.point_ledger (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  order_id uuid references public.orders(id), delta integer not null, reason text not null,
  expires_at timestamptz, created_at timestamptz not null default now()
);
create table public.shipments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
  carrier text not null, tracking_number text not null, status text not null default 'shipped',
  shipped_at timestamptz not null default now(), delivered_at timestamptz
);
create table public.service_requests (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
  user_id uuid not null references public.profiles(id), order_item_id uuid references public.order_items(id),
  kind text not null check(kind in ('cancel','return','refund')),
  status text not null default 'requested' check(status in ('requested','approved','rejected','collecting','completed')),
  reason text not null, admin_note text, quantity integer, refund_amount integer,
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create table public.faq (id uuid primary key default gen_random_uuid(), question text not null, answer text not null, sort_order integer not null default 0, active boolean not null default true);
create table public.tickets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  subject text not null, body text not null, answer text,
  status text not null default 'open' check(status in ('open','answered','closed')),
  created_at timestamptz not null default now(), answered_at timestamptz
);
create table public.posts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  product_id uuid references public.products(id), order_id uuid references public.orders(id),
  kind text not null check(kind in ('question','free','reservation')),
  title text not null, body text not null, status text not null default 'visible' check(status in ('visible','hidden')),
  created_at timestamptz not null default now()
);
create table public.post_replies (id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade, user_id uuid not null references public.profiles(id), body text not null, created_at timestamptz not null default now());
create table public.post_reports (id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id), reporter_id uuid not null references public.profiles(id), reason text not null, created_at timestamptz not null default now(), unique(post_id,reporter_id));
create table public.reviews (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), product_id uuid not null references public.products(id), order_item_id uuid not null unique references public.order_items(id), rating integer not null check(rating between 1 and 5), body text not null, status text not null default 'visible' check(status in ('visible','hidden')), created_at timestamptz not null default now());
create table public.promotions (id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('popup','one_plus_one')), title text not null, image_url text, link_url text, starts_at timestamptz not null, ends_at timestamptz not null, active boolean not null default false, product_id uuid references public.products(id), created_at timestamptz not null default now());
create table public.suppliers (id uuid primary key default gen_random_uuid(), name text not null, contact text, created_at timestamptz not null default now());
create table public.purchase_orders (id uuid primary key default gen_random_uuid(), supplier_id uuid not null references public.suppliers(id), status text not null default 'draft', expected_at date, note text, created_at timestamptz not null default now());
create table public.purchase_order_items (id uuid primary key default gen_random_uuid(), purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade, variant_id uuid references public.product_variants(id), material_id uuid, quantity integer not null check(quantity > 0), unit_cost integer not null default 0);
create table public.materials (id uuid primary key default gen_random_uuid(), name text not null, unit text not null default '개', stock integer not null default 0 check(stock >= 0));
alter table public.purchase_order_items add constraint purchase_order_items_material_fk foreign key(material_id) references public.materials(id);
create table public.inventory_movements (id uuid primary key default gen_random_uuid(), variant_id uuid references public.product_variants(id), material_id uuid references public.materials(id), delta integer not null, reason text not null, actor_id uuid references public.profiles(id), created_at timestamptz not null default now());
create table public.admin_audit (id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id), action text not null, target_table text not null, target_id text not null, details jsonb, created_at timestamptz not null default now());

create or replace function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and status='active' and role <> 'customer') $$;
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

-- Every exposed table has RLS. Server-only tables have no client write policies.
do $$ declare t text; begin foreach t in array array['profiles','categories','products','product_variants','addresses','cart_items','coupons','orders','order_items','payments','point_ledger','shipments','service_requests','faq','tickets','posts','post_replies','post_reports','reviews','promotions','suppliers','purchase_orders','purchase_order_items','materials','inventory_movements','admin_audit'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
create policy profiles_own_read on public.profiles for select to authenticated using (id=auth.uid());
create policy addresses_own on public.addresses for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy cart_own on public.cart_items for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy categories_public on public.categories for select to anon,authenticated using (true);
create policy products_public on public.products for select to anon,authenticated using (status='active');
create policy variants_public on public.product_variants for select to anon,authenticated using (exists(select 1 from public.products p where p.id=product_id and p.status='active'));
create policy coupons_own_read on public.coupons for select to authenticated using (active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()));
create policy orders_own_read on public.orders for select to authenticated using (user_id=auth.uid());
create policy order_items_own_read on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
create policy payments_own_read on public.payments for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
create policy points_own_read on public.point_ledger for select to authenticated using (user_id=auth.uid());
create policy shipments_own_read on public.shipments for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
create policy requests_own_read on public.service_requests for select to authenticated using (user_id=auth.uid());
create policy requests_own_insert on public.service_requests for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
create policy faq_public on public.faq for select to anon,authenticated using (active);
create policy tickets_own_read on public.tickets for select to authenticated using (user_id=auth.uid());
create policy tickets_own_insert on public.tickets for insert to authenticated with check (user_id=auth.uid());
create policy posts_read on public.posts for select to anon,authenticated using ((kind <> 'reservation' and status='visible') or (user_id=auth.uid()));
create policy posts_insert on public.posts for insert to authenticated with check (user_id=auth.uid() and (kind <> 'reservation' or exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid())));
create policy replies_read on public.post_replies for select to anon,authenticated using (exists(select 1 from public.posts p where p.id=post_id and ((p.kind<>'reservation' and p.status='visible') or p.user_id=auth.uid())));
create policy reports_insert on public.post_reports for insert to authenticated with check (reporter_id=auth.uid());
create policy reviews_read on public.reviews for select to anon,authenticated using (status='visible');
create policy reviews_insert on public.reviews for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id where i.id=order_item_id and i.product_id=product_id and o.user_id=auth.uid() and o.status='delivered'));
create policy promotions_public on public.promotions for select to anon,authenticated using (active and starts_at<=now() and ends_at>=now());

insert into public.faq(question,answer,sort_order) values
('배송은 얼마나 걸리나요?','결제 완료 후 상품 준비와 배송 상태를 마이페이지에서 확인하실 수 있습니다. 예약 상품은 표시된 입고 예정일 이후 순차 발송됩니다.',1),
('주문을 취소하고 싶어요.','마이페이지의 주문 내역에서 취소를 신청해 주세요. 배송 상태에 따라 반품 접수가 필요할 수 있습니다.',2),
('포인트와 쿠폰을 함께 사용할 수 있나요?','쿠폰 1개 적용 후 남은 상품 금액에 보유 포인트를 사용할 수 있습니다.',3);
