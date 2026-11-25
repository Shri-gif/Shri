// Browser-safe Supabase configuration.
// Publishable keys are intended for client-side use; protect data with Supabase RLS policies.
// Use the project URL (not the /rest/v1 endpoint) with supabase-js createClient().
const SUPABASE_URL = 'https://ywrmolylbotgvrehedxl.supabase.co/rest/v1/';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_pjXonygmt7-QXycGeMaOGw_afgEG3h5';
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
