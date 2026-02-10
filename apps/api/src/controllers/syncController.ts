import { Request, Response } from 'express';
import prisma from '../utils/prisma';


/**
 * POST /api/sync/bulk
 * Accepts mixed offline queue items (timelogs, activitylogs, screenshots metadata).
 * Items are processed in order. Server timestamp wins for conflict resolution.
 */
export const bulkSync = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        if (!user || !user.id) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'items must be a non-empty array' });
            return;
        }

        const results: { index: number; type: string; success: boolean; error?: string }[] = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            try {
                switch (item.type) {
                    case 'timelog': {
                        // Check for conflict: if a timelog already exists for this period, skip
                        const existing = await prisma.timeLog.findFirst({
                            where: {
                                userId: user.id,
                                taskId: item.taskId,
                                startTime: new Date(item.startTime),
                            },
                        });

                        if (existing) {
                            // Server wins - skip duplicate
                            results.push({ index: i, type: 'timelog', success: true, error: 'duplicate_skipped' });
                        } else {
                            await prisma.timeLog.create({
                                data: {
                                    userId: user.id,
                                    taskId: item.taskId,
                                    startTime: new Date(item.startTime),
                                    endTime: item.endTime ? new Date(item.endTime) : null,
                                    durationSeconds: item.durationSeconds || null,
                                },
                            });
                            results.push({ index: i, type: 'timelog', success: true });
                        }
                        break;
                    }

                    case 'activity': {
                        await prisma.activityLog.create({
                            data: {
                                userId: user.id,
                                taskId: item.taskId,
                                intervalStart: new Date(item.intervalStart),
                                intervalEnd: new Date(item.intervalEnd),
                                keystrokes: item.keystrokes || 0,
                                mouseClicks: item.mouseClicks || 0,
                                mouseMovement: item.mouseMovement || 0,
                                activeSeconds: item.activeSeconds || 0,
                            },
                        });
                        results.push({ index: i, type: 'activity', success: true });
                        break;
                    }

                    default:
                        results.push({ index: i, type: item.type || 'unknown', success: false, error: 'unsupported_type' });
                }
            } catch (itemError: any) {
                console.error(`Sync item ${i} failed:`, itemError.message);
                results.push({ index: i, type: item.type, success: false, error: itemError.message });
            }
        }

        const successCount = results.filter((r) => r.success).length;

        res.json({
            success: true,
            processed: items.length,
            succeeded: successCount,
            failed: items.length - successCount,
            results,
        });
    } catch (error) {
        console.error('Bulk Sync Error:', error);
        res.status(500).json({ error: 'Failed to process sync' });
    }
};
