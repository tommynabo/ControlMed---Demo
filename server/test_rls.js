const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const URL = process.env.SUPABASE_URL || "https://gnnacijqglcqonholpwt.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }

const supabase = createClient(URL, KEY);

async function test() {
    console.log("Testing doctor_schedules insert with service_role...");
    const { data, error } = await supabase.from('doctor_schedules').insert([{
        doctor_id: 'db2a7af3-0e86-455b-b9d5-7fd9059b02a2', // Just a UUID
        doctor_name: 'Test Doctor',
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
        morning_start: '09:00',
        morning_end: '13:00',
        afternoon_start: '16:00',
        afternoon_end: '20:00'
    }]).select();

    if (error) {
        console.error("Supabase Error:", error);
    } else {
        console.log("Success:", data);
        // Clean up
        await supabase.from('doctor_schedules').delete().eq('id', data[0].id);
    }
}

test();
