import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

export const initializeFirebase = (): void => {
    if (admin.apps.length > 0) {
        console.log('ℹ️ [FIREBASE] Already initialized');
        return;
    }

    try {
        let credential;

        // Priority 1: Environment Variables (Production / Docker / Coolify)
        if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
            console.log('🔑 [FIREBASE] Initializing with Environment Variables...');

            // Robust Private Key Handling for Docker/Coolify
            let privateKey = process.env.FIREBASE_PRIVATE_KEY;

            // 1. Try JSON.parse in case it's a stringified JSON string (common in some CI/CD)
            try {
                if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
                    privateKey = JSON.parse(privateKey);
                }
            } catch (e) {
                // Not a JSON string, continue
            }

            // 2. Replace literal "\n" (double escaped) with real newlines
            privateKey = privateKey.replace(/\\n/g, '\n');

            // 3. Remove any remaining wrapping quotes if they weren't handled by JSON.parse
            if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
                privateKey = privateKey.slice(1, -1);
            }

            // 4. Auto-Fix: If key is a still single line but header/footer exists, force split
            if (!privateKey.includes('\n') && privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
                console.log('⚠️ [FIREBASE] Private Key is single-line. Attempting auto-fix formatting...');
                privateKey = privateKey
                    .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
                    .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
            }

            credential = admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey,
            });
        }
        // Priority 2: Default Google Credentials (Local Dev with service-account.json or GCP Identity)
        else {
            console.log('📂 [FIREBASE] Initializing with Application Default Credentials (ADC)...');
            credential = admin.credential.applicationDefault();
        }

        admin.initializeApp({
            credential
        });
        console.log('🔥 [FIREBASE] Admin SDK initialized successfully');
    } catch (error: any) {
        console.error('❌ [FIREBASE] Initialization Failed!');
        console.error('Error Details:', error.message);
        // We do NOT exit header, but we log loudly. Middleware checks admin.apps.length.
    }
};

export default admin;
