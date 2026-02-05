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
            // console.log(`🔑 [FIREBASE] Key Length: ${process.env.FIREBASE_PRIVATE_KEY.length}`); 

            // Robust Private Key Handling for Docker/Coolify
            // 1. Replace literal "\n" (double escaped) with real newlines
            // 2. Remove accidental surrounding quotes
            let privateKey = process.env.FIREBASE_PRIVATE_KEY
                .replace(/\\n/g, '\n')
                .replace(/^"|"$/g, '');

            // 3. Auto-Fix: If key is a single line but header/footer exists, split it
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
