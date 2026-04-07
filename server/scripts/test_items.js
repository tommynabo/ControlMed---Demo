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
    const client = axios.create({
        baseURL: 'https://getquipu.com',
        headers: {
            Authorization: 'Bearer ' + tkRes.data.access_token,
            Accept: 'application/vnd.quipu.v1+json',
            'Content-Type': 'application/vnd.quipu.v1+json'
        }
    });
    const today = new Date().toISOString().split('T')[0];
    const existingContactId = '10970015';

    // Test A: items inside relationships.items.data (with filing_number)
    console.log('--- Test A: items in relationships.items.data ---');
    const payloadA = {
        data: {
            type: 'invoices',
            attributes: {
                kind: 'income', issue_date: today, due_dates: [today], paid_at: today,
                payment_method: 'cash', filing_number: 'TEST-RELITEMS-1'
            },
            relationships: {
                contact: { data: { id: existingContactId, type: 'contacts' } },
                items: {
                    data: [{
                        type: 'book_entry_items',
                        attributes: { concept: 'Test A', unitary_amount: '50.00', quantity: 1, vat_percent: '0.0', retention_percent: '0.0' }
                    }]
                }
            }
        }
    };
    try {
        const rA = await client.post('/invoices', payloadA);
        const inv = rA.data?.data;
        console.log('✅ A OK id:', inv?.id, 'total:', inv?.attributes?.total_amount, 'items_count:', inv?.relationships?.items?.data?.length);
        await client.delete('/invoices/' + inv.id).catch(() => {});
    } catch (e) {
        console.error('❌ A FAILED HTTP', e.response?.status, JSON.stringify(e.response?.data, null, 2));
    }

    // Test B: items via separate POST /invoices/:id/items after creation
    console.log('\n--- Test B: POST items after invoice creation ---');
    let invoiceId;
    try {
        const base = await client.post('/invoices', {
            data: {
                type: 'invoices',
                attributes: { kind: 'income', issue_date: today, due_dates: [today], paid_at: today, payment_method: 'cash', filing_number: 'TEST-POSTITEMS-1' },
                relationships: { contact: { data: { id: existingContactId, type: 'contacts' } } }
            }
        });
        invoiceId = base.data?.data?.id;
        console.log('  Invoice created id:', invoiceId, 'total_before:', base.data?.data?.attributes?.total_amount);

        const itemRes = await client.post(`/invoices/${invoiceId}/items`, {
            data: { type: 'book_entry_items', attributes: { concept: 'Test B', unitary_amount: '75.00', quantity: 1, vat_percent: '0.0', retention_percent: '0.0' } }
        });
        console.log('✅ B item added:', JSON.stringify(itemRes.data?.data?.attributes));
        // re-fetch invoice
        const updated = await client.get(`/invoices/${invoiceId}`);
        console.log('  Updated total:', updated.data?.data?.attributes?.total_amount);
        await client.delete('/invoices/' + invoiceId).catch(() => {});
    } catch (e) {
        console.error('❌ B FAILED HTTP', e.response?.status, JSON.stringify(e.response?.data, null, 2));
        if (invoiceId) await client.delete('/invoices/' + invoiceId).catch(() => {});
    }
}

run().catch(e => console.error('FATAL', e.message));
