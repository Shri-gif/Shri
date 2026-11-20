# Shri Spices Supabase Upgrade

## Included
- Original storefront layout retained with dynamic catalog.
- Supabase catalog and variants, browser cart, WhatsApp checkout/UPI intent.
- B2B inquiry form.
- Admin login, product editing and first variant, orders list/status, leads list.
- SQL schema and policies in `database/migrations/001_initial_schema.sql`.

## Setup (before replacing the live site)
1. Back up the current website files and database.
2. Supabase Dashboard → SQL Editor: run `database/migrations/001_initial_schema.sql`. Existing objects are guarded by `if not exists`/policy drops, but review your existing policies first; don't blindly run on a production database.
3. Confirm the admin auth account exists, then add its UUID to `public.admin_users` (the provided build expects UUID `add644f1-02c3-46a6-a913-f0ae08a2203e`). Confirm role and access.
4. Ensure that account can sign in to Supabase Auth and that `admin_users` has the matching user UUID.
5. Upload folder contents to your web host, preserving relative paths. `index.html` and `admin.html` should be served at the site root.
6. Admin page: `/admin.html`.

## Checkout caveat
UPI deep link is not payment confirmation. WhatsApp checkout creates a pending/unverified order record when the insert policy is available; it does not confirm payment or validate prices server-side. Treat customer order data/payment status as untrusted until you implement server-side verification.

## Limitations to review
This is a front-end/admin starter, not a secure full commerce backend. Public order insert policies can be abused, prices are client supplied, cart line items are not currently saved as a normalized order_items transaction, image upload UI and multi-variant management are not yet present in this panel, and banners/promotions/site settings are not editable in the UI. For production, move checkout/order validation to an Edge Function or backend, rate-limit submissions, and review policies.

## Folder structure
- `assets/css/style.css`, `assets/js/` supplemental assets
- `js/` application modules
- `database/migrations/` SQL migration
