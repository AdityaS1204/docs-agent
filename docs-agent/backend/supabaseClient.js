const { createClient } = require('@supabase/supabase-js');

// These will be loaded from the backend/.env file
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized.');
} else {
    console.warn('Missing SUPABASE_URL or SUPABASE_KEY in .env. Persistent memory disabled.');
}

module.exports = { supabase };
