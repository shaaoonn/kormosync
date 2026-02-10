// ============================================================
// Leave Management Controller
// Handles leave requests, approvals, balances, and calendar
// ============================================================

import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { invalidateEarningsCache } from '../services/earningsService';

// ============================================================
// Employee: Submit leave request
// POST /api/leave/request
// ============================================================
export const createLeaveRequest = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.id || !user?.companyId) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        const { type, startDate, endDate, reason } = req.body;
        if (!type || !startDate || !endDate) {
            res.status(400).json({ success: false, error: 'type, startDate, endDate are required' });
            return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (end < start) {
            res.status(400).json({ success: false, error: 'endDate must be after startDate' });
            return;
        }

        // Fix 2G: HALF_DAY must be single day only
        if (type === 'HALF_DAY') {
            if (start.toDateString() !== end.toDateString()) {
                res.status(400).json({ success: false, error: 'অর্ধদিবস ছুটি শুধুমাত্র একদিনের জন্য প্রযোজ্য' });
                return;
            }
        }

        // Calculate total days
        let totalDays = 0;
        if (type === 'HALF_DAY') {
            totalDays = 0.5;
        } else {
            // Count business days between start and end
            const current = new Date(start);
            current.setHours(0, 0, 0, 0);
            const endDate = new Date(end);
            endDate.setHours(0, 0, 0, 0);
            while (current <= endDate) {
                const day = current.getDay();
                if (day !== 0 && day !== 6) totalDays++;
                current.setDate(current.getDate() + 1);
            }
        }

        if (totalDays === 0) {
            res.status(400).json({ success: false, error: 'No working days in the selected range' });
            return;
        }

        // Validate against leave balance for PAID and SICK
        if (type === 'PAID' || type === 'SICK' || type === 'HALF_DAY') {
            const year = start.getFullYear();
            let balance = await prisma.leaveBalance.findUnique({
                where: { userId_year: { userId: user.id, year } },
            });

            if (!balance) {
                // Auto-create balance for the year
                balance = await prisma.leaveBalance.create({
                    data: {
                        userId: user.id,
                        companyId: user.companyId,
                        year,
                    },
                });
            }

            if (type === 'PAID' || type === 'HALF_DAY') {
                const remaining = balance.paidLeave - balance.paidUsed;
                if (totalDays > remaining) {
                    res.status(400).json({
                        success: false,
                        error: `বেতনসহ ছুটি অবশিষ্ট: ${remaining} দিন। আপনি ${totalDays} দিন চেয়েছেন।`,
                    });
                    return;
                }
            } else if (type === 'SICK') {
                const remaining = balance.sickLeave - balance.sickUsed;
                if (totalDays > remaining) {
                    res.status(400).json({
                        success: false,
                        error: `অসুস্থতার ছুটি অবশিষ্ট: ${remaining} দিন। আপনি ${totalDays} দিন চেয়েছেন।`,
                    });
                    return;
                }
            }
        }

        // Check for overlapping requests
        const overlapping = await prisma.leaveRequest.findFirst({
            where: {
                userId: user.id,
                status: { in: ['PENDING', 'APPROVED'] },
                OR: [
                    { startDate: { lte: end }, endDate: { gte: start } },
                ],
            },
        });

        if (overlapping) {
            res.status(400).json({
                success: false,
                error: 'এই তারিখে ইতিমধ্যে একটি ছুটির আবেদন আছে।',
            });
            return;
        }

        const leaveRequest = await prisma.leaveRequest.create({
            data: {
                userId: user.id,
                companyId: user.companyId,
                type,
                startDate: start,
                endDate: end,
                totalDays,
                reason,
            },
            include: {
                user: { select: { name: true, email: true } },
            },
        });

        // Notify admins
        const admins = await prisma.user.findMany({
            where: {
                companyId: user.companyId,
                role: { in: ['OWNER', 'ADMIN'] },
            },
            select: { id: true },
        });

        const typeLabels: Record<string, string> = {
            PAID: 'বেতনসহ', UNPAID: 'বিনা বেতনে', SICK: 'অসুস্থতা', HALF_DAY: 'অর্ধদিবস',
        };

        for (const admin of admins) {
            await prisma.notification.create({
                data: {
                    userId: admin.id,
                    title: 'নতুন ছুটির আবেদন',
                    message: `${leaveRequest.user.name || 'একজন কর্মী'} ${typeLabels[type] || type} ছুটি চেয়েছে (${totalDays} দিন)`,
                    type: 'INFO',
                },
            });
        }

        // Socket event
        try {
            const io = req.app.get('io');
            io.to(`company:${user.companyId}`).emit('leave:requested', {
                leaveRequest,
                requestedBy: user.id,
            });
        } catch (e) { /* socket not initialized */ }

        res.json({ success: true, leaveRequest });
    } catch (error: any) {
        console.error('Create Leave Request Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// Employee: Get my leave requests
// GET /api/leave/my-requests
// ============================================================
export const getMyLeaveRequests = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.id) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        const leaveRequests = await prisma.leaveRequest.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                approver: { select: { name: true } },
            },
        });

        res.json({ success: true, leaveRequests });
    } catch (error: any) {
        console.error('Get My Leave Requests Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// Employee: Get my leave balance
// GET /api/leave/my-balance
// ============================================================
export const getMyLeaveBalance = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.id || !user?.companyId) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        const year = new Date().getFullYear();
        let balance = await prisma.leaveBalance.findUnique({
            where: { userId_year: { userId: user.id, year } },
        });

        if (!balance) {
            balance = await prisma.leaveBalance.create({
                data: {
                    userId: user.id,
                    companyId: user.companyId,
                    year,
                },
            });
        }

        res.json({
            success: true,
            balance: {
                ...balance,
                paidRemaining: balance.paidLeave - balance.paidUsed,
                sickRemaining: balance.sickLeave - balance.sickUsed,
            },
        });
    } catch (error: any) {
        console.error('Get Leave Balance Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// Admin: Get pending leave requests
// GET /api/leave/pending
// ============================================================
export const getPendingLeaveRequests = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.companyId || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
            res.status(403).json({ success: false, error: 'Admin access required' });
            return;
        }

        const leaveRequests = await prisma.leaveRequest.findMany({
            where: {
                companyId: user.companyId,
                status: 'PENDING',
            },
            orderBy: { createdAt: 'asc' },
            include: {
                user: { select: { id: true, name: true, email: true, profileImage: true, designation: true } },
            },
        });

        res.json({ success: true, leaveRequests });
    } catch (error: any) {
        console.error('Get Pending Leaves Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// Admin: Get all leave requests
// GET /api/leave/all?status=APPROVED&month=2026-02
// ============================================================
export const getAllLeaveRequests = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.companyId || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
            res.status(403).json({ success: false, error: 'Admin access required' });
            return;
        }

        const { status, month } = req.query;
        const where: any = { companyId: user.companyId };

        if (status && typeof status === 'string') {
            where.status = status;
        }

        if (month && typeof month === 'string') {
            const [year, mon] = month.split('-').map(Number);
            const startOfMonth = new Date(year, mon - 1, 1);
            const endOfMonth = new Date(year, mon, 0, 23, 59, 59);
            where.OR = [
                { startDate: { gte: startOfMonth, lte: endOfMonth } },
                { endDate: { gte: startOfMonth, lte: endOfMonth } },
                { startDate: { lte: startOfMonth }, endDate: { gte: endOfMonth } },
            ];
        }

        const leaveRequests = await prisma.leaveRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, name: true, email: true, profileImage: true } },
                approver: { select: { name: true } },
            },
        });

        res.json({ success: true, leaveRequests });
    } catch (error: any) {
        console.error('Get All Leaves Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// Admin: Approve leave request
// PUT /api/leave/:id/approve
// ============================================================
export const approveLeaveRequest = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.companyId || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
            res.status(403).json({ success: false, error: 'Admin access required' });
            return;
        }

        const { id } = req.params;
        const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });

        if (!leaveRequest || leaveRequest.companyId !== user.companyId) {
            res.status(404).json({ success: false, error: 'Leave request not found' });
            return;
        }

        if (leaveRequest.status !== 'PENDING') {
            res.status(400).json({ success: false, error: 'Only PENDING requests can be approved' });
            return;
        }

        // Fix 2H: Wrap approval + balance update in transaction to prevent race condition
        const updated = await prisma.$transaction(async (tx) => {
            // Verify balance is sufficient before approving
            const year = leaveRequest.startDate.getFullYear();
            if (leaveRequest.type === 'PAID' || leaveRequest.type === 'HALF_DAY') {
                const balance = await tx.leaveBalance.findUnique({
                    where: { userId_year: { userId: leaveRequest.userId, year } },
                });
                const remaining = (balance?.paidLeave || 10) - (balance?.paidUsed || 0);
                if (remaining < leaveRequest.totalDays) {
                    throw new Error(`অপর্যাপ্ত বেতনসহ ছুটি। অবশিষ্ট: ${remaining} দিন`);
                }
            } else if (leaveRequest.type === 'SICK') {
                const balance = await tx.leaveBalance.findUnique({
                    where: { userId_year: { userId: leaveRequest.userId, year } },
                });
                const remaining = (balance?.sickLeave || 7) - (balance?.sickUsed || 0);
                if (remaining < leaveRequest.totalDays) {
                    throw new Error(`অপর্যাপ্ত অসুস্থতার ছুটি। অবশিষ্ট: ${remaining} দিন`);
                }
            }

            // Update leave request
            const result = await tx.leaveRequest.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    approvedBy: user.id,
                    approvedAt: new Date(),
                },
            });

            // Decrement leave balance
            if (leaveRequest.type === 'PAID' || leaveRequest.type === 'HALF_DAY') {
                await tx.leaveBalance.upsert({
                    where: { userId_year: { userId: leaveRequest.userId, year } },
                    update: { paidUsed: { increment: leaveRequest.totalDays } },
                    create: {
                        userId: leaveRequest.userId,
                        companyId: leaveRequest.companyId,
                        year,
                        paidUsed: leaveRequest.totalDays,
                    },
                });
            } else if (leaveRequest.type === 'SICK') {
                await tx.leaveBalance.upsert({
                    where: { userId_year: { userId: leaveRequest.userId, year } },
                    update: { sickUsed: { increment: leaveRequest.totalDays } },
                    create: {
                        userId: leaveRequest.userId,
                        companyId: leaveRequest.companyId,
                        year,
                        sickUsed: leaveRequest.totalDays,
                    },
                });
            } else if (leaveRequest.type === 'UNPAID') {
                await tx.leaveBalance.upsert({
                    where: { userId_year: { userId: leaveRequest.userId, year } },
                    update: { unpaidUsed: { increment: leaveRequest.totalDays } },
                    create: {
                        userId: leaveRequest.userId,
                        companyId: leaveRequest.companyId,
                        year,
                        unpaidUsed: leaveRequest.totalDays,
                    },
                });
            }

            // Fix 5C: Sync attendance records for leave dates
            const currentDate = new Date(leaveRequest.startDate);
            const endDateObj = new Date(leaveRequest.endDate);
            while (currentDate <= endDateObj) {
                const day = currentDate.getDay();
                if (day !== 0 && day !== 6) { // Skip weekends
                    const dateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
                    await tx.dailyAttendance.upsert({
                        where: { userId_date: { userId: leaveRequest.userId, date: dateOnly } },
                        update: { status: 'ON_LEAVE' as any },
                        create: {
                            userId: leaveRequest.userId,
                            companyId: leaveRequest.companyId,
                            date: dateOnly,
                            status: 'ON_LEAVE' as any,
                            expectedSeconds: 28800,
                        },
                    });
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }

            return result;
        });

        // Fix 3C: Invalidate earnings cache after leave approval
        invalidateEarningsCache(leaveRequest.userId);

        // Notify employee
        await prisma.notification.create({
            data: {
                userId: leaveRequest.userId,
                title: 'ছুটি অনুমোদিত ✅',
                message: `আপনার ${leaveRequest.totalDays} দিনের ছুটির আবেদন অনুমোদিত হয়েছে।`,
                type: 'INFO',
            },
        });

        // Socket event
        try {
            const io = req.app.get('io');
            io.to(`user:${leaveRequest.userId}`).emit('leave:approved', { leaveRequest: updated });
        } catch (e) { /* socket not initialized */ }

        res.json({ success: true, leaveRequest: updated });
    } catch (error: any) {
        console.error('Approve Leave Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// Admin: Reject leave request
// PUT /api/leave/:id/reject
// ============================================================
export const rejectLeaveRequest = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.companyId || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
            res.status(403).json({ success: false, error: 'Admin access required' });
            return;
        }

        const { id } = req.params;
        const { reason } = req.body;

        const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });

        if (!leaveRequest || leaveRequest.companyId !== user.companyId) {
            res.status(404).json({ success: false, error: 'Leave request not found' });
            return;
        }

        // Fix 2B: Allow rejecting both PENDING and APPROVED requests
        if (leaveRequest.status !== 'PENDING' && leaveRequest.status !== 'APPROVED') {
            res.status(400).json({ success: false, error: 'শুধুমাত্র অপেক্ষমান বা অনুমোদিত আবেদন প্রত্যাখ্যান করা যায়' });
            return;
        }

        const previousStatus = leaveRequest.status;

        const updated = await prisma.leaveRequest.update({
            where: { id },
            data: {
                status: 'REJECTED',
                rejectedReason: reason || null,
            },
        });

        // Fix 2B: Refund leave balance if previously APPROVED
        if (previousStatus === 'APPROVED') {
            const year = leaveRequest.startDate.getFullYear();
            if (leaveRequest.type === 'PAID' || leaveRequest.type === 'HALF_DAY') {
                await prisma.leaveBalance.update({
                    where: { userId_year: { userId: leaveRequest.userId, year } },
                    data: { paidUsed: { decrement: leaveRequest.totalDays } },
                });
            } else if (leaveRequest.type === 'SICK') {
                await prisma.leaveBalance.update({
                    where: { userId_year: { userId: leaveRequest.userId, year } },
                    data: { sickUsed: { decrement: leaveRequest.totalDays } },
                });
            } else if (leaveRequest.type === 'UNPAID') {
                await prisma.leaveBalance.update({
                    where: { userId_year: { userId: leaveRequest.userId, year } },
                    data: { unpaidUsed: { decrement: leaveRequest.totalDays } },
                });
            }

            // Revert attendance records to ABSENT
            const currentDate = new Date(leaveRequest.startDate);
            const endDateObj = new Date(leaveRequest.endDate);
            while (currentDate <= endDateObj) {
                const day = currentDate.getDay();
                if (day !== 0 && day !== 6) {
                    const dateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
                    await prisma.dailyAttendance.updateMany({
                        where: { userId: leaveRequest.userId, date: dateOnly, status: 'ON_LEAVE' as any },
                        data: { status: 'ABSENT' as any },
                    });
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }

            // Invalidate earnings cache
            invalidateEarningsCache(leaveRequest.userId);
        }

        // Notify employee
        await prisma.notification.create({
            data: {
                userId: leaveRequest.userId,
                title: 'ছুটি প্রত্যাখ্যাত ❌',
                message: `আপনার ছুটির আবেদন প্রত্যাখ্যাত হয়েছে।${reason ? ` কারণ: ${reason}` : ''}${previousStatus === 'APPROVED' ? ' (পূর্বে অনুমোদিত ছুটি বাতিল করা হয়েছে, ব্যালেন্স ফেরত দেওয়া হয়েছে)' : ''}`,
                type: 'WARNING',
            },
        });

        // Socket event
        try {
            const io = req.app.get('io');
            io.to(`user:${leaveRequest.userId}`).emit('leave:rejected', { leaveRequest: updated });
        } catch (e) { /* socket not initialized */ }

        res.json({ success: true, leaveRequest: updated });
    } catch (error: any) {
        console.error('Reject Leave Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// Employee: Cancel own PENDING request
// DELETE /api/leave/:id/cancel
// ============================================================
export const cancelLeaveRequest = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.id) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        const { id } = req.params;
        const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });

        if (!leaveRequest || leaveRequest.userId !== user.id) {
            res.status(404).json({ success: false, error: 'Leave request not found' });
            return;
        }

        // Allow cancelling PENDING or APPROVED requests
        if (leaveRequest.status !== 'PENDING' && leaveRequest.status !== 'APPROVED') {
            res.status(400).json({ success: false, error: 'শুধুমাত্র অপেক্ষমান বা অনুমোদিত আবেদন বাতিল করা যায়' });
            return;
        }

        const previousStatus = leaveRequest.status;

        const updated = await prisma.leaveRequest.update({
            where: { id },
            data: { status: 'CANCELLED' },
        });

        // Refund balance if was APPROVED
        if (previousStatus === 'APPROVED') {
            const year = leaveRequest.startDate.getFullYear();
            if (leaveRequest.type === 'PAID' || leaveRequest.type === 'HALF_DAY') {
                await prisma.leaveBalance.update({
                    where: { userId_year: { userId: leaveRequest.userId, year } },
                    data: { paidUsed: { decrement: leaveRequest.totalDays } },
                });
            } else if (leaveRequest.type === 'SICK') {
                await prisma.leaveBalance.update({
                    where: { userId_year: { userId: leaveRequest.userId, year } },
                    data: { sickUsed: { decrement: leaveRequest.totalDays } },
                });
            } else if (leaveRequest.type === 'UNPAID') {
                await prisma.leaveBalance.update({
                    where: { userId_year: { userId: leaveRequest.userId, year } },
                    data: { unpaidUsed: { decrement: leaveRequest.totalDays } },
                });
            }

            // Revert attendance records
            const currentDate = new Date(leaveRequest.startDate);
            const endDateObj = new Date(leaveRequest.endDate);
            while (currentDate <= endDateObj) {
                const day = currentDate.getDay();
                if (day !== 0 && day !== 6) {
                    const dateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
                    await prisma.dailyAttendance.updateMany({
                        where: { userId: leaveRequest.userId, date: dateOnly, status: 'ON_LEAVE' as any },
                        data: { status: 'ABSENT' as any },
                    });
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }

            invalidateEarningsCache(leaveRequest.userId);
        }

        res.json({ success: true, leaveRequest: updated });
    } catch (error: any) {
        console.error('Cancel Leave Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// Admin: Leave calendar
// GET /api/leave/calendar?month=2026-02
// ============================================================
export const getLeaveCalendar = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.companyId) {
            res.status(400).json({ success: false, error: 'No company associated' });
            return;
        }

        const { month, year: yearParam } = req.query;
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        if (yearParam && month) {
            // Support year=YYYY&month=M format
            const yr = Number(yearParam);
            const mn = Number(month);
            startDate = new Date(yr, mn - 1, 1);
            endDate = new Date(yr, mn, 0, 23, 59, 59);
        } else if (month && typeof month === 'string' && month.includes('-')) {
            // Support month=YYYY-MM format
            const [yr, mn] = month.split('-').map(Number);
            startDate = new Date(yr, mn - 1, 1);
            endDate = new Date(yr, mn, 0, 23, 59, 59);
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        }

        const approvedLeaves = await prisma.leaveRequest.findMany({
            where: {
                companyId: user.companyId,
                status: 'APPROVED',
                OR: [
                    { startDate: { gte: startDate, lte: endDate } },
                    { endDate: { gte: startDate, lte: endDate } },
                    { startDate: { lte: startDate }, endDate: { gte: endDate } },
                ],
            },
            include: {
                user: { select: { id: true, name: true, profileImage: true } },
            },
        });

        res.json({ success: true, calendar: approvedLeaves, period: { startDate, endDate } });
    } catch (error: any) {
        console.error('Get Leave Calendar Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
