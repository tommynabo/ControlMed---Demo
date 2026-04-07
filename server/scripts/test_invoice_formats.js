const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const axios = require('axios');
const qs = require('qs');

const APP_ID = process.env.QUIPU_APP_ID;
const APP_SECRET = process.env.QUIPU_APP_SECRET;
const creds = Buffer.from(APP_ID + ':' + APP_SECRET).toString('base64');

async function run() {
    const tkRes = await axios.post(
        'https://getquipu.com/oauth/token',
        qs.stringify({ grant_type: 'client_credentials', scope: 'ecommerce' }),
        { headers: { Authorization: 'Basic ' + creds, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const token = tkRes.data.access_token;
    const client = axios.create({
        baseURL: 'https://getquipu.com',
        headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/vnd.quipu.v1+json',
            'Content-Type': 'application/vnd.quipu.v1+json'
        }
    });

    // Probe various numeration endpoint names
    const endpoints = ['/numerations', '/invoice_numberings', '/invoice_series', '/series', '/invoices/series', '/invoice_numerings'];
    for (const ep of endpoints) {
        try {
            const r = await client.get(ep);
            console.log('✅', ep, '->', JSON.stringify(r.data).slice(0, 200));
        } catch (e) {
            console.log('❌', ep, '->', e.response?.status);
        }
    }

    // Test invoice without issue_date (let Quipu auto-number)
    console.log('\n--- Invoice WITHOUT issue_date ---');
    const today = new Date().toISOString().split('T')[0];
    const p1 = {
        data: {
            type: 'invoices',
            attributes: { kind: 'income', payment_method: 'cash' },
            relationships: { contact: { data: { id: '10970015', type: 'contacts' } } }
        },
        included: [{ type: 'book_entry_items', attributes: { concept: 'Test', unitary_amount: '10.00', quantity: 1, vat_percent: '0.0', retention_percent: '0.0' } }]
    };
    try {
        const r = await client.post('/invoices', p1);
        console.log('✅ No-date invoice created id:', r.data?.data?.id, 'number:', r.data?.data?.attributes?.number, 'issue_date:', r.data?.data?.attributes?.issue_date);
        // Clean up
        await client.delete('/invoices/' + r.data.data.id).catch(() => {});
    } catch (e) {
        console.error('❌ HTTP', e.response?.status, JSON.stringify(e.response?.data, null, 2));
    }

    // Test invoice WITH issue_date AND filing_number
    console.log('\n--- Invoice WITH issue_date + filing_number ---');
    const p2 = {
        data: {
            type: 'invoices',
            attributes: { kind: 'income', issue_date: today, due_dates: [today], payment_method: 'cash', filing_number: 'TEST-0001' },
            relationships: { contact: { data: { id: '10970015', type: 'contacts' } } }
        },
        included: [{ type: 'book_entry_items', attributes: { concept: 'Test', unitary_amount: '10.00', quantity: 1, vat_percent: '0.0', retention_percent: '0.0' } }]
    };
    try {
        const r = await client.post('/invoices', p2);
        console.log('✅ invoice+filing_number created id:', r.data?.data?.id, 'number:', r.data?.data?.attributes?.number);
        await client.delete('/invoices/' + r.data.data.id).catch(() => {});
    } catch (e) {
        console.error('❌ HTTP', e.response?.status, JSON.stringify(e.response?.data, null, 2));
    }
}

run().catch(e => console.error('FATAL:', e.message));
