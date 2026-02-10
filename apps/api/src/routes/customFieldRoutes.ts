import express from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import {
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getTaskCustomFieldValues,
    setTaskCustomFieldValues,
} from '../controllers/customFieldController';

const router = express.Router();

// Company-level custom field definitions
router.get('/', authenticateUser, getCustomFields);
router.post('/', authenticateUser, createCustomField);
router.put('/:fieldId', authenticateUser, updateCustomField);
router.delete('/:fieldId', authenticateUser, deleteCustomField);

// Task-level custom field values
router.get('/task/:taskId', authenticateUser, getTaskCustomFieldValues);
router.put('/task/:taskId', authenticateUser, setTaskCustomFieldValues);

export default router;
