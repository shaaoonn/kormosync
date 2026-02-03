import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const {
    BKASH_USERNAME,
    BKASH_PASSWORD,
    BKASH_APP_KEY,
    BKASH_APP_SECRET,
    BKASH_BASE_URL,
} = process.env;

// Helper to clean env vars (remove quotes if present)
const clean = (val: string | undefined) => val ? val.replace(/^["']|["']$/g, '') : '';

export const grantToken = async () => {
    try {
        console.log('[bKash] Requesting Token...');
        const username = clean(process.env.BKASH_USERNAME);
        const password = clean(process.env.BKASH_PASSWORD);
        const appKey = clean(process.env.BKASH_APP_KEY);
        const appSecret = clean(process.env.BKASH_APP_SECRET);
        const baseUrl = clean(process.env.BKASH_BASE_URL);

        console.log(`[bKash] Config: User=${username}, BaseURL=${baseUrl}`);

        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            username: username,
            password: password,
        };

        const response = await axios.post(
            `${baseUrl}/tokenized/checkout/token/grant`,
            {
                app_key: appKey,
                app_secret: appSecret,
                username: username,
                password: password,
            },
            { headers }
        );
        console.log('[bKash] Token Granted');
        return response.data.id_token;
    } catch (error: any) {
        console.error('bKash Grant Token Error:', error.response?.data || error.message);
        throw new Error('Failed to grant bKash token');
    }
};

export const createPayment = async (token: string, amount: string, invoice: string, callbackUrl: string) => {
    try {
        console.log('[bKash] Creating Payment...', { amount, invoice });
        const username = clean(process.env.BKASH_USERNAME);
        const password = clean(process.env.BKASH_PASSWORD);
        const appKey = clean(process.env.BKASH_APP_KEY);
        const baseUrl = clean(process.env.BKASH_BASE_URL);

        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: token,
            'x-app-key': appKey,
        };

        const response = await axios.post(
            `${baseUrl}/tokenized/checkout/create`,
            {
                mode: '0011',
                payerReference: invoice,
                callbackURL: callbackUrl,
                amount: amount,
                currency: 'BDT',
                intent: 'sale',
                merchantInvoiceNumber: invoice,
            },
            { headers }
        );
        console.log('[bKash] Payment Created:', response.data);
        return response.data;
    } catch (error: any) {
        console.error('bKash Create Payment Error:', error.response?.data || error.message);
        throw new Error('Failed to create bKash payment');
    }
};

export const executePayment = async (token: string, paymentID: string) => {
    try {
        console.log('[bKash] Executing Payment...', { paymentID });
        const username = clean(process.env.BKASH_USERNAME);
        const password = clean(process.env.BKASH_PASSWORD);
        const appKey = clean(process.env.BKASH_APP_KEY);
        const baseUrl = clean(process.env.BKASH_BASE_URL);

        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: token,
            'x-app-key': appKey,
        };

        const response = await axios.post(
            `${baseUrl}/tokenized/checkout/execute`,
            {
                paymentID,
            },
            { headers }
        );
        console.log('[bKash] Payment Executed:', response.data);
        return response.data;
    } catch (error: any) {
        console.error('bKash Execute Payment Error:', error.response?.data || error.message);
        throw new Error('Failed to execute bKash payment');
    }
};
