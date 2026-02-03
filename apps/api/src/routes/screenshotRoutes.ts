import express from 'express';
import multer from 'multer';
import { authenticateUser } from '../middlewares/authMiddleware';
import { uploadScreenshot, getScreenshots, getScreenshotById } from '../controllers/screenshotController';

const router = express.Router();

// Multer config for file uploads (memory storage for direct MinIO upload)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// Upload screenshot from desktop app
router.post('/upload', authenticateUser, upload.single('screenshot'), uploadScreenshot);

// Get screenshots for activity log
router.get('/list', authenticateUser, getScreenshots);

// Get single screenshot by ID
router.get('/:screenshotId', authenticateUser, getScreenshotById);

export default router;
