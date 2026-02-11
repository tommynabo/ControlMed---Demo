
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load env vars
const envPath = path.resolve(__dirname, '../../.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const cleanEnv = (val) => val ? val.replace(/^"|"$/g, '') : val;
const supabaseUrl = cleanEnv(envConfig.SUPABASE_URL || process.env.SUPABASE_URL);
const supabaseKey = cleanEnv(envConfig.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log("🔍 Checking recent PatientTreatments...");
    const { data: treatments, error: tError } = await supabase
        .from('PatientTreatment')
        .select('*')
        .order('createdAt', { ascending: false })
        .limit(5);

    if (tError) console.error("Error fetching treatments:", tError);
    else {
        console.table(treatments.map(t => ({
            id: t.id.substring(0, 8),
            serviceName: t.serviceName,
            serviceId: t.serviceId,
            status: t.status,
            createdAt: t.createdAt
        })));
    }

    console.log("\n🔍 Checking recent Liquidations/Payrolls...");
    const { data: liquidations, error: lError } = await supabase
        .from('Liquidation')
        .select('*')
        .order('date', { ascending: false })
        .limit(5);

    if (lError) console.error("Error fetching liquidations:", lError);
    else {
        console.table(liquidations.map(l => ({
            id: l.id.substring(0, 8),
            treatmentName: l.treatmentName,
            amount: l.amount,
            concept: l.concept
        })));
    }
}

checkData();
