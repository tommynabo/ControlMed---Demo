const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('User')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000000')
        .single();
    
    if (error) {
        console.log("❌ User not found or error:", error.message);
    } else {
        console.log("✅ User found:", JSON.stringify(data));
    }
}

check();
