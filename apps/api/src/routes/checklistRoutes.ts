import express from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import {
    getChecklist,
    addChecklistItem,
    toggleChecklistItem,
    updateChecklistItem,
    deleteChecklistItem,
    reorderChecklist,
} from '../controllers/checklistController';

const router = express.Router();

// GET /api/checklist/:taskId — Get checklist items
router.get('/:taskId', authenticateUser, getChecklist);

// POST /api/checklist/:taskId — Add item
router.post('/:taskId', authenticateUser, addChecklistItem);

// PUT /api/checklist/:taskId/reorder — Reorder items
router.put('/:taskId/reorder', authenticateUser, reorderChecklist);

// PUT /api/checklist/item/:itemId/toggle — Toggle complete
router.put('/item/:itemId/toggle', authenticateUser, toggleChecklistItem);

// PUT /api/checklist/item/:itemId — Update title
router.put('/item/:itemId', authenticateUser, updateChecklistItem);

// DELETE /api/checklist/item/:itemId — Delete item
router.delete('/item/:itemId', authenticateUser, deleteChecklistItem);

export default router;
