import { Request, Response } from 'express';
import prisma from '../utils/prisma';

const getUser = (req: Request) => req.user as any;

// GET /api/notes/:taskId — Get all notes for a task
export const getNotes = async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;

        const notes = await prisma.taskNote.findMany({
            where: { taskId },
            include: {
                user: { select: { id: true, name: true, email: true, profileImage: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return res.json({ success: true, notes });
    } catch (error) {
        console.error('Get Notes Error:', error);
        return res.status(500).json({ error: 'Failed to fetch notes' });
    }
};

// POST /api/notes/:taskId — Add a note
export const addNote = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { taskId } = req.params;
        const { content, subTaskId } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Note content is required' });
        }

        const note = await prisma.taskNote.create({
            data: {
                taskId,
                subTaskId: subTaskId || null,
                userId: user.id,
                content: content.trim(),
            },
            include: {
                user: { select: { id: true, name: true, email: true, profileImage: true } },
            },
        });

        return res.json({ success: true, note });
    } catch (error) {
        console.error('Add Note Error:', error);
        return res.status(500).json({ error: 'Failed to add note' });
    }
};

// DELETE /api/notes/:noteId — Delete a note
export const deleteNote = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { noteId } = req.params;

        const note = await prisma.taskNote.findUnique({ where: { id: noteId } });
        if (!note) return res.status(404).json({ error: 'Note not found' });

        // Only the note author can delete
        if (note.userId !== user.id) {
            return res.status(403).json({ error: 'You can only delete your own notes' });
        }

        await prisma.taskNote.delete({ where: { id: noteId } });

        return res.json({ success: true });
    } catch (error) {
        console.error('Delete Note Error:', error);
        return res.status(500).json({ error: 'Failed to delete note' });
    }
};
