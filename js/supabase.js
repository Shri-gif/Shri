// Browser-safe Supabase configuration.
// Publishable keys are intended for client-side use; protect data with Supabase RLS policies.
// Use the project URL (not the /rest/v1 endpoint) with supabase-js createClient().
const SUPABASE_URL = 'https://yqjvtdzhpjirjiefdfqd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_jHTyROZzm-nRazUuXolIpw_0Q3yjp9p';
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
