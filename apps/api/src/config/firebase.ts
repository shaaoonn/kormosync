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
            // Standard Private Key Handling
            // Coolify/Docker Env vars often treat \n as literal characters (double escaped)
            // We only fix that specific issue as it's the standard behavior for Node.js in Docker.
            const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
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
