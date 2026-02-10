import express from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import { getNotes, addNote, deleteNote } from '../controllers/noteController';

const router = express.Router();

// GET /api/notes/:taskId — Get all notes for a task
router.get('/:taskId', authenticateUser, getNotes);

// POST /api/notes/:taskId — Add a note to a task
router.post('/:taskId', authenticateUser, addNote);

// DELETE /api/notes/:noteId — Delete a note
router.delete('/:noteId', authenticateUser, deleteNote);

export default router;
