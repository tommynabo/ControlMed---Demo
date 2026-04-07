const axios = require('axios');
const qs = require('qs');

// ─────────────────────────────────────────────────────────────────────────────
// Quipu API (https://getquipu.com)
// Auth: OAuth2 client_credentials  →  Bearer token
// Format: JSON:API  (Content-Type: application/vnd.quipu.v1+json)
// ─────────────────────────────────────────────────────────────────────────────
const QUIPU_AUTH_URL = 'https://getquipu.com/oauth/token';
const QUIPU_API_URL  = 'https://getquipu.com';
const APP_ID     = process.env.QUIPU_APP_ID;
const APP_SECRET = process.env.QUIPU_APP_SECRET;

let cachedToken = null;
let tokenExpiry  = null;

// Axios client with Quipu JSON:API headers
const quipuClient = axios.create({
    baseURL: QUIPU_API_URL,
    headers: {
        'Accept':       'application/vnd.quipu.v1+json',
        'Content-Type': 'application/vnd.quipu.v1+json'
    },
    timeout: 15000
});

// ─────────────────────────────────────────────────────────────────────────────
// PASO 2: OAuth2 Token — exchange App ID + Secret for a Bearer token
// ─────────────────────────────────────────────────────────────────────────────
async function getAuthToken() {
    if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
        return cachedToken;
    }

    if (!APP_ID || !APP_SECRET) {
        throw new Error('Missing QUIPU_APP_ID or QUIPU_APP_SECRET environment variables');
    }

    console.log('🔐 [Quipu] Requesting new Access Token...');

    const credentials = Buffer.from(`${APP_ID}:${APP_SECRET}`).toString('base64');

    const response = await axios.post(
        QUIPU_AUTH_URL,
        qs.stringify({ grant_type: 'client_credentials', scope: 'ecommerce' }),
        {
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type':  'application/x-www-form-urlencoded;charset=UTF-8'
            }
        }
    );

    const { access_token, expires_in } = response.data;
    cachedToken = access_token;
    tokenExpiry  = new Date(Date.now() + (expires_in - 60) * 1000);
    console.log('✅ [Quipu] Token acquired.');
    return access_token;
}

// ─────────────────────────────────────────────────────────────────────────────
// PASO 1: Authenticated helper — always logs the real Quipu rejection body
// ─────────────────────────────────────────────────────────────────────────────
async function makeRequest(method, path, data = null) {
    const token = await getAuthToken();
    try {
        const config = {
            method,
            url: path,
            headers: { 'Authorization': `Bearer ${token}` }
        };
        if (data) config.data = data;
        const response = await quipuClient(config);
        return response.data;
    } catch (error) {
        // PASO 1: Log the exact Quipu error body so we can see which field failed
        console.error(
            `❌ [Quipu] ${method.toUpperCase()} ${path} →`,
            JSON.stringify(error.response?.data || error.message, null, 2)
        );
        throw error; // propagate — do NOT swallow errors here
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PASO 3: Get or Create Contact (Patient)
// Contacts are searched by tax_id; if not found they are created.
// ─────────────────────────────────────────────────────────────────────────────
async function getOrCreateContact(patient) {
    const taxId = patient.tax_id || patient.dni || '';

    // 1. Search by tax_id (Quipu filter param)
    if (taxId && taxId !== 'UNKNOWN') {
        try {
            const searchRes = await makeRequest('GET', `/contacts?filter[tax_id]=${encodeURIComponent(taxId)}`);
            const contacts  = searchRes?.data || [];
            if (contacts.length > 0) {
                console.log(`✅ [Quipu] Contact found: ${patient.name} (id ${contacts[0].id})`);
                return contacts[0];
            }
        } catch (e) {
            console.warn('⚠️ [Quipu] Contact search failed, will create instead:', e.message);
        }
    }

    // 2. Create contact
    const attributes = {
        name:         patient.name        || 'Paciente',
        tax_id:       taxId               || 'UNKNOWN',
        email:        patient.email       || '',
        address:      patient.address     || '',
        town:         patient.city        || '',
        zip_code:     patient.zip_code || patient.zipCode || '',
        country_code: 'ES',
        is_client:    true
    };

    const payload = { data: { type: 'contacts', attributes } };
    const createRes = await makeRequest('POST', '/contacts', payload);
    const contact   = createRes.data;
    console.log(`✅ [Quipu] Contact created: ${patient.name} (id ${contact.id})`);
    return contact;
}

// ─────────────────────────────────────────────────────────────────────────────
// PASO 3: Create Invoice
// Items use Quipu JSON:API field names; prices are numbers (parseFloat).
// Errors are NOT caught here — they propagate to the endpoint catch block.
// ─────────────────────────────────────────────────────────────────────────────
async function createInvoice(contactId, items, date, dueDate, paymentMethod = 'cash') {
    // Payment method mapping to Quipu accepted values
    const methodMap = {
        card:           'bank_card',
        credit_card:    'bank_card',
        cash:           'cash',
        transfer:       'bank_transfer',
        bank_transfer:  'bank_transfer',
        direct_debit:   'direct_debit',
        paypal:         'paypal',
        check:          'check'
    };
    const finalMethod = methodMap[paymentMethod] || 'cash';

    // PASO 3: Map items to Quipu book_entry_items format
    const itemsData = items.map(item => ({
        type: 'book_entry_items',
        attributes: {
            concept:           item.name    || item.concept || 'Servicio médico',
            unitary_amount:    parseFloat(item.price)    || 0,   // number, not string
            quantity:          item.quantity || 1,
            vat_percent:       item.tax !== undefined ? Number(item.tax) : 0, // 0 = exento médico
            retention_percent: 0
        }
    }));

    const payload = {
        data: {
            type: 'invoices',
            attributes: {
                kind:           'income',
                issue_date:     date,
                due_dates:      [dueDate],
                paid_at:        date,
                payment_method: finalMethod
            },
            relationships: {
                contact: { data: { id: String(contactId), type: 'contacts' } },
                items:   { data: itemsData }
            }
        }
    };

    console.log('📤 [Quipu] Creating invoice payload:', JSON.stringify(payload, null, 2));

    // No try/catch — let errors propagate so endpoint catch block logs the real Quipu body
    const res     = await makeRequest('POST', '/invoices', payload);
    const invoice = res.data;

    console.log(`✅ [Quipu] Invoice created: id ${invoice.id}`);

    // PASO 4: Get PDF URL from Quipu response attributes
    const pdfUrl     = invoice.attributes?.download_pdf_url     || null;
    const previewUrl = invoice.attributes?.ephemeral_open_download_pdf_url || pdfUrl;

    return {
        success:     true,
        id:          invoice.id,
        number:      invoice.attributes?.number || 'PENDIENTE',
        pdf_url:     pdfUrl,
        preview_url: previewUrl,
        raw:         invoice
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — PDF retrieval
// ─────────────────────────────────────────────────────────────────────────────
async function getInvoicePdf(invoiceId) {
    try {
        const res = await makeRequest('GET', `/invoices/${invoiceId}`);
        return res.data?.attributes?.download_pdf_url || null;
    } catch (error) {
        console.error(`❌ [Quipu] Failed to get PDF for invoice ${invoiceId}:`, error.message);
        return null;
    }
}

async function getInvoiceUrls(invoiceId) {
    try {
        const res = await makeRequest('GET', `/invoices/${invoiceId}`);
        return {
            download: res.data?.attributes?.download_pdf_url || null,
            preview:  res.data?.attributes?.ephemeral_open_download_pdf_url || null
        };
    } catch (error) {
        console.error(`❌ [Quipu] Failed to get URLs for invoice ${invoiceId}:`, error.message);
        return null;
    }
}

async function downloadPdf(url) {
    try {
        const token = await getAuthToken();
        const response = await axios.get(url, {
            headers:      { 'Authorization': `Bearer ${token}` },
            responseType: 'stream',
            timeout:      30000
        });
        return response.data;
    } catch (error) {
        console.error(`❌ [Quipu] Failed to download PDF: ${url}`, error.message);
        throw error;
    }
}

module.exports = {
    getOrCreateContact,
    createInvoice,
    getInvoicePdf,
    getInvoiceUrls,
    downloadPdf
};
