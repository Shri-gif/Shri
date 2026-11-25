# Shri Spices — Supabase-connected website

## What is included
- Customer storefront with Supabase product catalogue and pack variants.
- Browser cart and WhatsApp checkout handoff.
- B2B enquiry submission.
- Tejas Taxi-inspired admin dashboard: products, pack sizes/prices/stock, orders and B2B leads.
- Supabase schema and Row Level Security policies in `database/migrations/001_initial_schema.sql`.

## Important: connect the new Supabase project
The browser configuration is in `js/supabase.js`. It uses the supplied project URL `https://yqjvtdzhpjirjiefdfqd.supabase.co` and the supplied `sb_publishable_...` key. A publishable key is intended for browser use. Never put a Supabase secret/service-role key in this repository.

## Required Supabase setup (one-time)
1. Open the Supabase project matching `yqjvtdzhpjirjiefdfqd`.
2. In SQL Editor, review and run `database/migrations/001_initial_schema.sql`. This creates the tables and RLS policies expected by this code. If the project already has production tables/data, back them up and review the SQL before running it; `CREATE TABLE IF NOT EXISTS` does not retrofit mismatched columns in existing tables.
3. In Authentication → Users, create or confirm the admin login account.
4. Copy that user's UUID. In SQL Editor run the following, replacing the UUID with the actual Auth user UUID:

   ```sql
   insert into public.admin_users (user_id, role)
   values ('PASTE-AUTH-USER-UUID-HERE', 'admin')
   on conflict (user_id) do update set role = excluded.role;
   ```

5. Confirm Email/Password sign-in is enabled in Supabase Authentication.
6. Deploy the complete repository contents to the GitHub Pages repository root (do not put the files inside an extra `Shri-main/` directory).

## Website paths
- Customer website: `/`
- Admin panel: `/admin.html`

## GitHub Pages deployment
The workflow is `.github/workflows/deploy.yml`. In GitHub → Settings → Pages, set Build and deployment Source to **GitHub Actions**. Push to `main` or manually run the workflow from Actions. The workflow uploads the repository root using `actions/upload-pages-artifact@v3` and deploys with `actions/deploy-pages@v4`.

## Data model alignment
The JavaScript uses the column names defined in the supplied SQL migration: `products.is_active`, `product_variants.variant_name`, `product_variants.stock_quantity`, `product_variants.is_active`, `orders.order_status`, and `b2b_leads.requirement`.

## Checkout note
WhatsApp remains the customer checkout handoff. The browser attempts to create a pending order record, but the supplied migration intentionally does not grant anonymous public order insertion. Therefore the WhatsApp message still opens if the database insert is denied; order tracking from WhatsApp requires a trusted server/Edge Function or an explicitly reviewed public-order policy. Do not expose service-role credentials in frontend code.
