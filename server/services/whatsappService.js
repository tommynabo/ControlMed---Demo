const axios = require('axios');

const API_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = "chc-clinica";

let status = 'DISCONNECTED';
let qrCodeData = null;

const safeInstanceName = encodeURIComponent(INSTANCE_NAME);

/**
 * Helper to get headers for request
 */
const getHeaders = () => {
    return {
        'Content-Type': 'application/json',
        'apikey': API_KEY
    };
};

const initialize = async () => {
    console.log('🔄 Checking Evolution API Connection...');

    if (!API_URL || !API_KEY) {
        console.error('❌ Missing Evolution API Configuration. Service disabled.');
        status = 'DISABLED';
        return;
    }

    try {
        // Check connection state
        const response = await axios.get(
            `${API_URL}/instance/connectionState/${safeInstanceName}`,
            { headers: getHeaders() }
        );

        const connectionState = response.data?.instance?.state || response.data?.state;
        console.log(`📡 Evolution API State for ${INSTANCE_NAME}:`, connectionState);

        if (connectionState === 'open') {
            status = 'READY';
            qrCodeData = null;
        } else {
            status = 'DISCONNECTED';
            // We don't automatically fetch QR on init to avoid resource waste
        }

    } catch (error) {
        if (error.response?.status === 404) {
            console.log(`⚠️ Instance ${INSTANCE_NAME} does not exist. Creating...`);
            await createInstance();
        } else {
            console.warn('⚠️ Could not connect to Evolution API instance:', error.message);
            status = 'ERROR';
        }
    }
};

const createInstance = async () => {
    try {
        await axios.post(`${API_URL}/instance/create`, {
            instanceName: INSTANCE_NAME,
            token: API_KEY, // Optional: Evolution API allows custom token
            qrcode: true
        }, { headers: getHeaders() });
        console.log(`✅ Instance ${INSTANCE_NAME} created.`);
        status = 'DISCONNECTED';
    } catch (e) {
        console.error('❌ Failed to create instance:', e.message);
    }
};

const getStatus = async () => {
    try {
        const response = await axios.get(
            `${API_URL}/instance/connectionState/${safeInstanceName}`,
            { headers: getHeaders() }
        );
        const connectionState = response.data?.instance?.state || response.data?.state;
        
        if (connectionState === 'open') {
            return { status: 'READY', qrCode: null, provider: 'Evolution API' };
        }
        
        return { status: 'DISCONNECTED', qrCode: qrCodeData, provider: 'Evolution API' };
    } catch (e) {
        return { status: 'DISCONNECTED', qrCode: qrCodeData, provider: 'Evolution API' };
    }
};

const getQrCode = async () => {
    try {
        const response = await axios.get(
            `${API_URL}/instance/connect/${safeInstanceName}`,
            { headers: getHeaders() }
        );
        
        if (response.data && response.data.base64) {
            qrCodeData = response.data.base64;
            // Ensure data URI prefix
            if (!qrCodeData.startsWith('data:image')) {
                qrCodeData = `data:image/png;base64,${qrCodeData}`;
            }
            return qrCodeData;
        }
        return null;
    } catch (e) {
        console.error('❌ Error fetching QR:', e.message);
        return null;
    }
};

const sendMessage = async (to, message) => {
    if (!API_URL || !API_KEY) throw new Error('WA_DISABLED');

    try {
        let number = to.replace(/[^0-9]/g, '');
        if (number.length === 9) number = '34' + number;

        const url = `${API_URL}/message/sendText/${safeInstanceName}`;
        const payload = {
            number: number,
            text: message,
            options: { delay: 1200, presence: "composing" }
        };

        const response = await axios.post(url, payload, { headers: getHeaders() });
        return { success: true, data: response.data };
    } catch (error) {
        console.error('❌ Error sending message:', error.response?.data || error.message);
        throw error;
    }
};

const logout = async () => {
    try {
        await axios.delete(`${API_URL}/instance/logout/${safeInstanceName}`, { headers: getHeaders() });
        status = 'DISCONNECTED';
        qrCodeData = null;
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
};

module.exports = {
    initialize,
    getStatus,
    getQrCode,
    sendMessage,
    logout
};
