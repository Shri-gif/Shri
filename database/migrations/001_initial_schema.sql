-- Shri Spices initial migration. Execute in Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.categories(id uuid primary key default gen_random_uuid(),name text not null unique,created_at timestamptz default now());
create table if not exists public.products(id uuid primary key default gen_random_uuid(),name text not null,description text,image_url text,category_id uuid references public.categories(id),active boolean not null default true,created_at timestamptz default now(),updated_at timestamptz default now());
create table if not exists public.product_variants(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products(id) on delete cascade,name text not null,price numeric(10,2) not null check(price>=0),stock integer not null default 0 check(stock>=0),active boolean not null default true,created_at timestamptz default now());
create table if not exists public.orders(id uuid primary key default gen_random_uuid(),order_number text unique,customer_name text,customer_phone text,customer_email text,status text not null default 'pending',payment_status text not null default 'unverified',total_amount numeric(12,2) not null default 0,notes text,created_at timestamptz default now());
create table if not exists public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,product_id uuid references public.products(id) on delete set null,variant_id uuid references public.product_variants(id) on delete set null,product_name text not null,variant_name text,quantity integer not null check(quantity>0),unit_price numeric(10,2) not null check(unit_price>=0),created_at timestamptz default now());
create table if not exists public.b2b_leads(id uuid primary key default gen_random_uuid(),name text not null,business_name text,phone text not null,email text,requirements text,status text not null default 'new',created_at timestamptz default now());
create table if not exists public.banners(id uuid primary key default gen_random_uuid(),title text,image_url text,link_url text,active boolean default true,created_at timestamptz default now());
create table if not exists public.promotions(id uuid primary key default gen_random_uuid(),title text,description text,code text,active boolean default true,created_at timestamptz default now());
create table if not exists public.site_settings(id uuid primary key default gen_random_uuid(),key text unique not null,value jsonb not null default '{}'::jsonb);
create table if not exists public.admin_users(user_id uuid primary key references auth.users(id) on delete cascade,role text not null default 'admin',created_at timestamptz default now());
create or replace function public.is_admin() returns boolean language sql security definer set search_path=public as $$select exists(select 1 from public.admin_users where user_id=auth.uid())$$;
-- Enable RLS
do $$declare t text;begin foreach t in array array['categories','products','product_variants','orders','order_items','b2b_leads','banners','promotions','site_settings','admin_users'] loop execute format('alter table public.%I enable row level security',t);end loop;end$$;
-- Public catalog visibility
drop policy if exists catalog_products_read on public.products;create policy catalog_products_read on public.products for select to anon,authenticated using(active or public.is_admin());
drop policy if exists catalog_variants_read on public.product_variants;create policy catalog_variants_read on public.product_variants for select to anon,authenticated using(active or public.is_admin());
drop policy if exists admin_products_all on public.products;create policy admin_products_all on public.products for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists admin_variants_all on public.product_variants;create policy admin_variants_all on public.product_variants for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists admin_users_self_read on public.admin_users;create policy admin_users_self_read on public.admin_users for select to authenticated using(user_id=auth.uid());
drop policy if exists admin_categories_all on public.categories;create policy admin_categories_all on public.categories for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists admin_orders_all on public.orders;create policy admin_orders_all on public.orders for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists admin_order_items_all on public.order_items;create policy admin_order_items_all on public.order_items for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists public_orders_insert on public.orders;create policy public_orders_insert on public.orders for insert to anon,authenticated with check(status='pending' and payment_status='unverified');
drop policy if exists public_order_items_insert on public.order_items;create policy public_order_items_insert on public.order_items for insert to anon,authenticated with check(exists(select 1 from public.orders where id=order_id and status='pending' and payment_status='unverified'));
drop policy if exists admin_b2b_all on public.b2b_leads;create policy admin_b2b_all on public.b2b_leads for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists public_b2b_insert on public.b2b_leads;create policy public_b2b_insert on public.b2b_leads for insert to anon,authenticated with check(status='new');
drop policy if exists admin_banners_all on public.banners;create policy admin_banners_all on public.banners for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists public_banners_read on public.banners;create policy public_banners_read on public.banners for select to anon,authenticated using(active or public.is_admin());
drop policy if exists admin_promotions_all on public.promotions;create policy admin_promotions_all on public.promotions for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists public_promotions_read on public.promotions;create policy public_promotions_read on public.promotions for select to anon,authenticated using(active or public.is_admin());
drop policy if exists admin_settings_all on public.site_settings;create policy admin_settings_all on public.site_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists admin_categories_read on public.categories;create policy admin_categories_read on public.categories for select to anon,authenticated using(true);
-- Storage bucket (public images); bucket creation via SQL is supported
insert into storage.buckets(id,name,public) values('product-images','product-images',true) on conflict(id) do update set public=true;
drop policy if exists public_product_images_read on storage.objects;create policy public_product_images_read on storage.objects for select to anon,authenticated using(bucket_id='product-images');
drop policy if exists admin_product_images_upload on storage.objects;create policy admin_product_images_upload on storage.objects for insert to authenticated with check(bucket_id='product-images' and public.is_admin());
drop policy if exists admin_product_images_update on storage.objects;create policy admin_product_images_update on storage.objects for update to authenticated using(bucket_id='product-images' and public.is_admin()) with check(bucket_id='product-images' and public.is_admin());
drop policy if exists admin_product_images_delete on storage.objects;create policy admin_product_images_delete on storage.objects for delete to authenticated using(bucket_id='product-images' and public.is_admin());
