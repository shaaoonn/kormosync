const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const API_URL = 'http://localhost:8000/api';
const TEST_IMAGE_PATH = path.join(__dirname, 'test-screenshot.png');

// Create a dummy image if it doesn't exist
if (!fs.existsSync(TEST_IMAGE_PATH)) {
    const canvas = Buffer.alloc(100 * 100 * 4); // 100x100 RGBA
    for (let i = 0; i < canvas.length; i++) canvas[i] = 255; // White
    // Simple PNG header + IHDR + IDAT + IEND (minimal valid PNG for testing)
    // Actually, let's just use a 1x1 pixel base64 decoded to file for simplicity
    const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    fs.writeFileSync(TEST_IMAGE_PATH, Buffer.from(base64Png, 'base64'));
}

async function verifyUpload() {
    try {
        console.log('🚀 Starting Screenshot Upload Verification...');

        // 1. Login to get token (You might need a valid user in DB)
        // For this script, we'll assume we can get a token or need to mock it.
        // Since we can't easily login without Firebase client SDK in this node script,
        // we might need to rely on a hardcoded token or skip auth middleware temporarily for testing,
        // OR better, we use a known test user credentials if available.

        // However, as an agent, I can't easily get a valid firebase ID token without the client SDK and user interaction.
        // I will try to hit the endpoint. If 401, I'll report that auth is working but I need a token.
        // For now, let's assume the user has a way to provide a token or we test the endpoint structure.

        // Actually, looking at the project, it uses `authenticateUser` middleware.
        // I will skip the actual upload test if I can't get a token, but I'll set up the script to accept a token.

        const token = process.env.TEST_AUTH_TOKEN;
        if (!token) {
            console.warn('⚠️  No TEST_AUTH_TOKEN provided. Skipping actual upload request.');
            console.log('ℹ️  To run full test: set TEST_AUTH_TOKEN env var and run again.');
            return;
        }

        const formData = new FormData();
        formData.append('screenshot', fs.createReadStream(TEST_IMAGE_PATH));
        formData.append('taskId', 'test-task-id');
        formData.append('keystrokes', '100');
        formData.append('mouseClicks', '50');
        formData.append('activeSeconds', '300');
        formData.append('capturedAt', new Date().toISOString());

        console.log('📸 Uploading screenshot...');
        const response = await axios.post(`${API_URL}/screenshots/upload`, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.data.success) {
            console.log('✅ Screenshot upload SUCCESS!');
            console.log('📝 Image URL:', response.data.screenshot.imageUrl);
            console.log('📝 ID:', response.data.screenshot.id);
        } else {
            console.error('❌ Screenshot upload FAILED:', response.data);
        }

    } catch (error) {
        if (error.response) {
            console.error(`❌ HTTP Error: ${error.response.status} - ${error.response.statusText}`);
            console.error('   Data:', error.response.data);
        } else {
            console.error('❌ Network/Script Error:', error.message);
        }
    } finally {
        // Cleanup
        if (fs.existsSync(TEST_IMAGE_PATH)) fs.unlinkSync(TEST_IMAGE_PATH);
    }
}

verifyUpload();
