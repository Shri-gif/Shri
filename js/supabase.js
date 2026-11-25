// Browser-safe Supabase publishable key. Never place a service-role key here.
const SUPABASE_URL = 'https://ywrmolylbotgvrehedxl.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_pjXonygmt7-QXycGeMaG_wafgEG3h5';
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
