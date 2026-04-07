const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const axios = require('axios');
const qs = require('qs');

const APP_ID = process.env.QUIPU_APP_ID;
const APP_SECRET = process.env.QUIPU_APP_SECRET;

console.log('APP_ID set:', !!APP_ID, '| starts with:', APP_ID ? APP_ID.slice(0, 8) : 'N/A');
console.log('APP_SECRET set:', !!APP_SECRET);

if (!APP_ID || !APP_SECRET) {
    console.error('❌ Missing credentials - check .env');
    process.exit(1);
}

const credentials = Buffer.from(APP_ID + ':' + APP_SECRET).toString('base64');

async function run() {
    // Step 1: Get token
    let token;
    try {
        const tokenRes = await axios.post(
            'https://getquipu.com/oauth/token',
            qs.stringify({ grant_type: 'client_credentials', scope: 'ecommerce' }),
            {
                headers: {
                    'Authorization': 'Basic ' + credentials,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        token = tokenRes.data.access_token;
        console.log('\n✅ TOKEN OK - expires_in:', tokenRes.data.expires_in);
    } catch (e) {
        console.error('\n❌ TOKEN FAILED - HTTP', e.response?.status);
        console.error('Body:', JSON.stringify(e.response?.data, null, 2));
        return;
    }

    const client = axios.create({
        baseURL: 'https://getquipu.com',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Accept': 'application/vnd.quipu.v1+json',
            'Content-Type': 'application/vnd.quipu.v1+json'
        }
    });

    // Step 2: List contacts
    console.log('\n--- Listing contacts ---');
    try {
        const c = await client.get('/contacts?page[number]=1&page[size]=1');
        console.log('✅ Contacts OK - total:', c.data?.meta?.total_count, '| first id:', c.data?.data?.[0]?.id);
    } catch (e) {
        console.error('❌ Contacts FAILED - HTTP', e.response?.status);
        console.error(JSON.stringify(e.response?.data, null, 2));
    }

    // Step 3: Try creating a minimal contact
    console.log('\n--- Creating test contact ---');
    const contactPayload = {
        data: {
            type: 'contacts',
            attributes: {
                name: 'Test Paciente CRM',
                tax_id: '00000000T',
                email: 'test@crm.com',
                address: 'Calle Test 1',
                town: 'Madrid',
                zip_code: '28001',
                country_code: 'ES',
                is_client: true
            }
        }
    };
    let contactId;
    try {
        const cr = await client.post('/contacts', contactPayload);
        contactId = cr.data?.data?.id;
        console.log('✅ Contact created id:', contactId);
    } catch (e) {
        console.error('❌ Contact creation FAILED - HTTP', e.response?.status);
        console.error(JSON.stringify(e.response?.data, null, 2));
        return;
    }

    // Step 4: Try creating an invoice
    console.log('\n--- Creating test invoice ---');
    const today = new Date().toISOString().split('T')[0];
    const invoicePayload = {
        data: {
            type: 'invoices',
            attributes: {
                kind: 'income',
                issue_date: today,
                due_dates: [today],
                paid_at: today,
                payment_method: 'cash'
            },
            relationships: {
                contact: { data: { id: String(contactId), type: 'contacts' } }
            }
        },
        included: [
            {
                type: 'book_entry_items',
                attributes: {
                    concept: 'Limpieza dental',
                    unitary_amount: '60.00',
                    quantity: 1,
                    vat_percent: '0.0',
                    retention_percent: '0.0'
                }
            }
        ]
    };
    console.log('Payload:', JSON.stringify(invoicePayload, null, 2));
    try {
        const inv = await client.post('/invoices', invoicePayload);
        console.log('✅ Invoice created id:', inv.data?.data?.id, '| number:', inv.data?.data?.attributes?.number);
    } catch (e) {
        console.error('❌ Invoice creation FAILED - HTTP', e.response?.status);
        console.error(JSON.stringify(e.response?.data, null, 2));
    }
}

run();
