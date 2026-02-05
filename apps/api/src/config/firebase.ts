import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Deep debug function to understand the exact format of the private key
 */
const debugPrivateKey = (rawKey: string): void => {
    console.log('========== PRIVATE KEY DEBUG ==========');
    console.log('1. Raw length:', rawKey.length);
    console.log('2. First 100 chars:', JSON.stringify(rawKey.substring(0, 100)));
    console.log('3. Last 50 chars:', JSON.stringify(rawKey.substring(rawKey.length - 50)));
    console.log('4. Contains literal backslash-n (\\\\n):', rawKey.includes('\\n'));
    console.log('5. Contains actual newline (char code 10):', rawKey.includes('\n'));
    console.log('6. Starts with quote:', rawKey.startsWith('"') || rawKey.startsWith("'"));
    console.log('7. Ends with quote:', rawKey.endsWith('"') || rawKey.endsWith("'"));
    console.log('8. Has BEGIN marker:', rawKey.includes('-----BEGIN'));
    console.log('9. Has END marker:', rawKey.includes('-----END'));

    // Check for various escape patterns
    const patterns = [
        { name: 'Single escaped \\n', regex: /(?<!\\)\\n/g },
        { name: 'Double escaped \\\\n', regex: /\\\\n/g },
        { name: 'Triple escaped \\\\\\n', regex: /\\\\\\n/g },
        { name: 'Actual newline', regex: /\n/g },
    ];

    patterns.forEach(p => {
        const matches = rawKey.match(p.regex);
        console.log(`10. ${p.name} count:`, matches ? matches.length : 0);
    });
    console.log('========================================');
};

/**
 * Robust private key parser that handles multiple encoding scenarios
 */
const parsePrivateKey = (rawKey: string): string => {
    let key = rawKey;

    // Debug before processing
    debugPrivateKey(key);

    // Step 1: Remove surrounding quotes (single or double)
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
        key = key.slice(1, -1);
        console.log('[KEY-PARSE] Removed surrounding quotes');
    }

    // Step 2: Handle different newline escape scenarios
    // Scenario A: Double-escaped (\\\\n in source = \\n in runtime)
    if (key.includes('\\\\n')) {
        key = key.replace(/\\\\n/g, '\n');
        console.log('[KEY-PARSE] Fixed double-escaped newlines');
    }
    // Scenario B: Single-escaped (\\n in source = \n as literal chars)
    else if (key.includes('\\n') && !key.includes('\n')) {
        key = key.replace(/\\n/g, '\n');
        console.log('[KEY-PARSE] Fixed single-escaped newlines');
    }

    // Step 3: Verify final format
    const hasRealNewlines = key.includes('\n');
    const lineCount = key.split('\n').length;
    console.log('[KEY-PARSE] Final has real newlines:', hasRealNewlines);
    console.log('[KEY-PARSE] Final line count:', lineCount);
    console.log('[KEY-PARSE] Final first 80 chars:', key.substring(0, 80));

    return key;
};

export const initializeFirebase = (): void => {
    if (admin.apps.length > 0) {
        console.log('[FIREBASE] Already initialized');
        return;
    }
    try {
        let credential;

        // Priority 1: Base64 encoded service account (most reliable)
        if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
            console.log('[FIREBASE] Using Base64 service account...');
            try {
                const jsonString = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
                const serviceAccount = JSON.parse(jsonString);
                credential = admin.credential.cert({
                    projectId: serviceAccount.project_id,
                    clientEmail: serviceAccount.client_email,
                    privateKey: serviceAccount.private_key,
                });
                console.log('[FIREBASE] Base64 decode successful');
            } catch (b64Error: any) {
                console.error('[FIREBASE] Base64 decode failed:', b64Error.message);
            }
        }

        // Priority 2: Individual environment variables
        if (!credential && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
            console.log('[FIREBASE] Using individual env vars...');
            const privateKey = parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
            credential = admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey,
            });
        }

        // Priority 3: Application Default Credentials
        if (!credential) {
            console.log('[FIREBASE] Using Application Default Credentials...');
            credential = admin.credential.applicationDefault();
        }

        admin.initializeApp({ credential });
        console.log('[FIREBASE] Admin SDK initialized successfully!');
    } catch (error: any) {
        console.error('[FIREBASE] Initialization FAILED!');
        console.error('[FIREBASE] Error:', error.message);
    }
};

export default admin;
