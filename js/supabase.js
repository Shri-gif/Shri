// Shri Spices - Supabase Configuration

const SUPABASE_URL = 'https://ywrmolylbotgvrehedxl.supabase.co';

const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_pjXonygmt7-QXycGeMaOGw_afgEG3h5';

window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);
