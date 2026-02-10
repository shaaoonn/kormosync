import { Request, Response } from 'express';
import prisma from '../utils/prisma';

const getUser = (req: Request) => req.user as any;

// Add a dependency (Task A depends on Task B)
export const addDependency = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { taskId } = req.params;
        const { dependsOnTaskId } = req.body;

        if (!dependsOnTaskId) {
            return res.status(400).json({ error: 'dependsOnTaskId is required' });
        }

        // Prevent self-dependency
        if (taskId === dependsOnTaskId) {
            return res.status(400).json({ error: 'A task cannot depend on itself' });
        }

        // Prevent circular dependencies
        const reverseExists = await prisma.taskDependency.findUnique({
            where: { taskId_dependsOnTaskId: { taskId: dependsOnTaskId, dependsOnTaskId: taskId } }
        });
        if (reverseExists) {
            return res.status(400).json({ error: 'Circular dependency detected' });
        }

        const dependency = await prisma.taskDependency.create({
            data: {
                taskId,
                dependsOnTaskId,
                type: 'BLOCKS',
            },
            include: {
                dependsOnTask: { select: { id: true, title: true, status: true } }
            }
        });

        return res.json({ success: true, dependency });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'This dependency already exists' });
        }
        console.error('Add Dependency Error:', error);
        return res.status(500).json({ error: 'Failed to add dependency' });
    }
};

// Remove a dependency
export const removeDependency = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { dependencyId } = req.params;

        await prisma.taskDependency.delete({ where: { id: dependencyId } });
        return res.json({ success: true });
    } catch (error) {
        console.error('Remove Dependency Error:', error);
        return res.status(500).json({ error: 'Failed to remove dependency' });
    }
};

// Get dependencies for a task
export const getDependencies = async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;

        const [dependencies, dependedOnBy] = await Promise.all([
            prisma.taskDependency.findMany({
                where: { taskId },
                include: { dependsOnTask: { select: { id: true, title: true, status: true } } }
            }),
            prisma.taskDependency.findMany({
                where: { dependsOnTaskId: taskId },
                include: { task: { select: { id: true, title: true, status: true } } }
            })
        ]);

        return res.json({
            success: true,
            blockedBy: dependencies,   // This task is blocked by these
            blocking: dependedOnBy,     // This task is blocking these
        });
    } catch (error) {
        console.error('Get Dependencies Error:', error);
        return res.status(500).json({ error: 'Failed to fetch dependencies' });
    }
};
