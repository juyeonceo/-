-- Product management through an authenticated staff JWT, without exposing the service role key.
create or replace function public.can_manage_products()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and status = 'active' and role in ('owner', 'merchandiser')
  )
$$;
revoke all on function public.can_manage_products() from public, anon, authenticated;
grant execute on function public.can_manage_products() to authenticated;

create or replace function public.can_manage_variants()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and status = 'active' and role in ('owner', 'merchandiser', 'fulfillment')
  )
$$;
revoke all on function public.can_manage_variants() from public, anon, authenticated;
grant execute on function public.can_manage_variants() to authenticated;

grant select, insert, update, delete on public.products, public.product_variants, public.categories to authenticated;
grant insert on public.admin_audit to authenticated;

create policy categories_manager_insert on public.categories for insert to authenticated
  with check (public.can_manage_products());
create policy categories_manager_update on public.categories for update to authenticated
  using (public.can_manage_products()) with check (public.can_manage_products());

create policy products_manager_read on public.products for select to authenticated
  using (public.can_manage_products());
create policy products_manager_insert on public.products for insert to authenticated
  with check (public.can_manage_products());
create policy products_manager_update on public.products for update to authenticated
  using (public.can_manage_products()) with check (public.can_manage_products());
create policy products_manager_delete on public.products for delete to authenticated
  using (public.can_manage_products());

create policy variants_staff_read on public.product_variants for select to authenticated
  using (public.can_manage_variants());
create policy variants_staff_insert on public.product_variants for insert to authenticated
  with check (public.can_manage_variants());
create policy variants_staff_update on public.product_variants for update to authenticated
  using (public.can_manage_variants()) with check (public.can_manage_variants());

create policy product_audit_staff_insert on public.admin_audit for insert to authenticated
  with check (actor_id = (select auth.uid()) and public.is_staff());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5000000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy product_images_manager_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.can_manage_products());
