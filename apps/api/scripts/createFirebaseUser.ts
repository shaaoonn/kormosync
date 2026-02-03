import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config();

// Ensure GOOGLE_APPLICATION_CREDENTIALS is set absolute if it's relative
if (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_APPLICATION_CREDENTIALS.startsWith('.')) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

// Initialize Firebase Admin
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
        console.log('🔥 Firebase Admin initialized');
    } catch (error) {
        console.error('⚠️ Firebase Admin initialization failed:', error);
        process.exit(1);
    }
}

async function main() {
    const email = 'mdahsanullahshaon@gmail.com';
    const password = 'Sadia1055+';

    console.log(`Checking Firebase Auth for: ${email}...`);

    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        console.log(`User exists (UID: ${userRecord.uid}). Updating password...`);

        await admin.auth().updateUser(userRecord.uid, {
            password: password,
            emailVerified: true
        });
        console.log('✅ Password updated successfully.');

    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            console.log('User not found. Creating new user...');
            const userRecord = await admin.auth().createUser({
                email: email,
                password: password,
                emailVerified: true,
                displayName: "Ahsanullah Shaon"
            });
            console.log(`✅ User created successfully (UID: ${userRecord.uid})`);
        } else {
            console.error('❌ Error managing user:', error);
            process.exit(1);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
