import { Request, Response } from 'express';
import prisma from '../utils/prisma';

const getUser = (req: Request) => req.user as any;

// Get checklist for a task
export const getChecklist = async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;

        const items = await prisma.taskChecklist.findMany({
            where: { taskId },
            orderBy: { orderIndex: 'asc' }
        });

        return res.json({ success: true, checklist: items });
    } catch (error) {
        console.error('Get Checklist Error:', error);
        return res.status(500).json({ error: 'Failed to fetch checklist' });
    }
};

// Add checklist item
export const addChecklistItem = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { taskId } = req.params;
        const { title } = req.body;

        if (!title?.trim()) {
            return res.status(400).json({ error: 'Title is required' });
        }

        // Get the next order index
        const lastItem = await prisma.taskChecklist.findFirst({
            where: { taskId },
            orderBy: { orderIndex: 'desc' }
        });

        const item = await prisma.taskChecklist.create({
            data: {
                taskId,
                title: title.trim(),
                orderIndex: (lastItem?.orderIndex ?? -1) + 1,
            }
        });

        return res.json({ success: true, item });
    } catch (error) {
        console.error('Add Checklist Item Error:', error);
        return res.status(500).json({ error: 'Failed to add checklist item' });
    }
};

// Toggle checklist item
export const toggleChecklistItem = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { itemId } = req.params;

        const item = await prisma.taskChecklist.findUnique({ where: { id: itemId } });
        if (!item) return res.status(404).json({ error: 'Checklist item not found' });

        const updated = await prisma.taskChecklist.update({
            where: { id: itemId },
            data: { isCompleted: !item.isCompleted }
        });

        return res.json({ success: true, item: updated });
    } catch (error) {
        console.error('Toggle Checklist Error:', error);
        return res.status(500).json({ error: 'Failed to toggle checklist item' });
    }
};

// Update checklist item title
export const updateChecklistItem = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { itemId } = req.params;
        const { title } = req.body;

        const updated = await prisma.taskChecklist.update({
            where: { id: itemId },
            data: { title: title?.trim() || 'Untitled' }
        });

        return res.json({ success: true, item: updated });
    } catch (error) {
        console.error('Update Checklist Error:', error);
        return res.status(500).json({ error: 'Failed to update checklist item' });
    }
};

// Delete checklist item
export const deleteChecklistItem = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { itemId } = req.params;

        await prisma.taskChecklist.delete({ where: { id: itemId } });
        return res.json({ success: true });
    } catch (error) {
        console.error('Delete Checklist Error:', error);
        return res.status(500).json({ error: 'Failed to delete checklist item' });
    }
};

// Reorder checklist items
export const reorderChecklist = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { taskId } = req.params;
        const { items } = req.body; // [{ id, orderIndex }]

        if (!Array.isArray(items)) {
            return res.status(400).json({ error: 'items array is required' });
        }

        await Promise.all(
            items.map((item: { id: string; orderIndex: number }) =>
                prisma.taskChecklist.update({
                    where: { id: item.id },
                    data: { orderIndex: item.orderIndex }
                })
            )
        );

        return res.json({ success: true });
    } catch (error) {
        console.error('Reorder Checklist Error:', error);
        return res.status(500).json({ error: 'Failed to reorder checklist' });
    }
};
