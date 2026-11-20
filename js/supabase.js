
/* =========================================
   SHRI SPICES - SUPABASE CONFIGURATION
   File: js/supabase.js
   ========================================= */

(function () {
    "use strict";

    const SUPABASE_URL =
        "https://ywrmolylbotgvrehedxl.supabase.co";

    const SUPABASE_ANON_KEY =
        "sb_publishable_pjXonygmt7-QXycGeMaOGw_afgEG3h5";

    // Check Supabase library
    if (!window.supabase || !window.supabase.createClient) {
        console.error(
            "Shri Spices: Supabase library failed to load."
        );
        window.shriSupabaseReady = false;
        return;
    }

    try {

        // Create Supabase client
        const client = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        );

        // Shared application configuration
        window.SHRI_CONFIG = Object.freeze({
            projectUrl: SUPABASE_URL,
            currency: "INR",
            currencySymbol: "₹",
            freeDeliveryMinimum: 499,
            whatsappNumber: "917379969545",
            upiId: "vishuclasse@okicici"
        });

        // Shared Supabase client
        window.shriSupabase = client;

        // Ready flag
        window.shriSupabaseReady = true;

        console.info(
            "Shri Spices: Supabase initialized successfully."
        );

    } catch (error) {

        console.error(
            "Shri Spices: Supabase initialization failed:",
            error
        );

        window.shriSupabaseReady = false;

    }

})();
