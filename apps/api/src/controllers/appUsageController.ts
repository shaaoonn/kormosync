import { Request, Response } from 'express';
import prisma from '../utils/prisma';


// ============================================================
// Bulk upload app usage data (from Desktop app)
// ============================================================
export const logAppUsage = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        if (!user?.id) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        const { entries } = req.body;
        // entries: [{ taskId, appName, windowTitle, durationSec, recordedAt }]

        if (!entries || !Array.isArray(entries) || entries.length === 0) {
            res.status(400).json({ success: false, error: 'No entries provided' });
            return;
        }

        const data = entries.map((e: any) => ({
            userId: user.id,
            taskId: e.taskId,
            appName: e.appName || 'Unknown',
            windowTitle: e.windowTitle || null,
            durationSec: e.durationSec || 0,
            recordedAt: e.recordedAt ? new Date(e.recordedAt) : new Date(),
        }));

        await prisma.appUsageLog.createMany({ data });

        res.status(201).json({ success: true, count: data.length });
    } catch (error: any) {
        console.error('Log App Usage Error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to log app usage' });
    }
};

// ============================================================
// Get app usage for a user (admin view)
// ============================================================
export const getUserAppUsage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const { date, taskId } = req.query;

        const where: any = { userId };
        if (taskId) where.taskId = taskId as string;
        if (date) {
            const d = new Date(date as string);
            const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
            where.recordedAt = { gte: start, lte: end };
        }

        const logs = await prisma.appUsageLog.findMany({
            where,
            orderBy: { recordedAt: 'desc' },
            take: 200,
        });

        // Aggregate by app name
        const appSummary: Record<string, { appName: string; totalSeconds: number; count: number }> = {};
        for (const log of logs) {
            if (!appSummary[log.appName]) {
                appSummary[log.appName] = { appName: log.appName, totalSeconds: 0, count: 0 };
            }
            appSummary[log.appName].totalSeconds += log.durationSec;
            appSummary[log.appName].count++;
        }

        // Get categories for enrichment
        const user = (req as any).user;
        const categories = await prisma.appCategory.findMany({
            where: {
                OR: [
                    { companyId: null },               // Global defaults
                    { companyId: user?.companyId },     // Company-specific
                ],
            },
        });

        // Enrich summary with categories
        const enrichedSummary = Object.values(appSummary)
            .map((app) => {
                const match = categories.find((c) =>
                    app.appName.toLowerCase().includes(c.appPattern.toLowerCase())
                );
                return {
                    ...app,
                    category: match?.category || 'NEUTRAL',
                    categoryLabel: match?.label || 'Uncategorized',
                };
            })
            .sort((a, b) => b.totalSeconds - a.totalSeconds);

        // Productivity breakdown
        let productiveSeconds = 0;
        let unproductiveSeconds = 0;
        let neutralSeconds = 0;

        for (const app of enrichedSummary) {
            switch (app.category) {
                case 'PRODUCTIVE': productiveSeconds += app.totalSeconds; break;
                case 'UNPRODUCTIVE': unproductiveSeconds += app.totalSeconds; break;
                default: neutralSeconds += app.totalSeconds; break;
            }
        }

        res.json({
            success: true,
            logs,
            summary: enrichedSummary,
            productivity: {
                productiveHours: parseFloat((productiveSeconds / 3600).toFixed(2)),
                unproductiveHours: parseFloat((unproductiveSeconds / 3600).toFixed(2)),
                neutralHours: parseFloat((neutralSeconds / 3600).toFixed(2)),
            },
        });
    } catch (error: any) {
        console.error('Get App Usage Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// Get/Manage App Categories (Admin)
// ============================================================
export const getAppCategories = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;

        const categories = await prisma.appCategory.findMany({
            where: {
                OR: [
                    { companyId: null },
                    { companyId: user?.companyId },
                ],
            },
            orderBy: { label: 'asc' },
        });

        res.json({ success: true, categories });
    } catch (error: any) {
        console.error('Get App Categories Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const upsertAppCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const { id, appPattern, category, label } = req.body;

        if (!appPattern || !category || !label) {
            res.status(400).json({ success: false, error: 'appPattern, category, and label are required' });
            return;
        }

        if (id) {
            // Update existing
            const updated = await prisma.appCategory.update({
                where: { id },
                data: { appPattern, category, label },
            });
            res.json({ success: true, category: updated });
        } else {
            // Create new (company-specific)
            const created = await prisma.appCategory.create({
                data: {
                    companyId: user?.companyId || null,
                    appPattern,
                    category,
                    label,
                },
            });
            res.json({ success: true, category: created });
        }
    } catch (error: any) {
        console.error('Upsert App Category Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteAppCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        await prisma.appCategory.delete({ where: { id } });
        res.json({ success: true });
    } catch (error: any) {
        console.error('Delete App Category Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
