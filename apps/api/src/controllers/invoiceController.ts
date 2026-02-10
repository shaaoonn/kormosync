// ============================================================
// Invoice & Wallet Controller (Phase 4)
// ============================================================

import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import {
    ensurePayPeriod,
    generateInvoices,
    lockPayPeriod,
    approveInvoice,
    payInvoice,
    payAllInvoices,
} from '../services/payrollCronService';


// ============================================================
// Pay Periods
// ============================================================

/**
 * GET /api/invoices/periods?year=2026
 * List all pay periods for the company
 */
export const getPayPeriods = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        if (!user?.companyId || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
            res.status(403).json({ success: false, error: 'Admin access required' });
            return;
        }

        const { year } = req.query;
        const filterYear = year ? parseInt(year as string) : new Date().getFullYear();

        const startOfYear = new Date(filterYear, 0, 1);
        const endOfYear = new Date(filterYear, 11, 31, 23, 59, 59);

        const periods = await prisma.payPeriod.findMany({
            where: {
                companyId: user.companyId,
                startDate: { gte: startOfYear, lte: endOfYear },
            },
            include: {
                invoices: {
                    select: { id: true, status: true, netAmount: true },
                },
            },
            orderBy: { startDate: 'desc' },
        });

        const enriched = periods.map((p) => ({
            ...p,
            invoiceCount: p.invoices.length,
            paidCount: p.invoices.filter((i) => i.status === 'PAID').length,
            draftCount: p.invoices.filter((i) => i.status === 'DRAFT').length,
            approvedCount: p.invoices.filter((i) => i.status === 'APPROVED').length,
        }));

        res.json({ success: true, periods: enriched });
    } catch (error: any) {
        console.error('Get Pay Periods Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/invoices/periods/create
 * Create/ensure a pay period + generate invoices
 */
export const createPayPeriod = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        if (!user?.companyId || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
            res.status(403).json({ success: false, error: 'Admin access required' });
            return;
        }

        const { year, month } = req.body;
        if (!year || !month) {
            res.status(400).json({ success: false, error: 'year and month are required' });
            return;
        }

        const period = await ensurePayPeriod(user.companyId, year, month);
        const invoices = await generateInvoices(period.id);

        res.json({
            success: true,
            period,
            invoiceCount: invoices.length,
        });
    } catch (error: any) {
        console.error('Create Pay Period Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/invoices/periods/:periodId/lock
 */
export const lockPeriod = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        if (user?.role !== 'OWNER' && user?.role !== 'ADMIN') {
            res.status(403).json({ success: false, error: 'Admin access required' });
            return;
        }

        const period = await lockPayPeriod(req.params.periodId);
        res.json({ success: true, period });
    } catch (error: any) {
        console.error('Lock Period Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/invoices/periods/:periodId/pay-all
 * Pay all invoices in a period and credit wallets
 */
export const payAllPeriod = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        if (user?.role !== 'OWNER') {
            res.status(403).json({ success: false, error: 'Only company owner can process payments' });
            return;
        }

        const results = await payAllInvoices(req.params.periodId);
        res.json({ success: true, results });
    } catch (error: any) {
        console.error('Pay All Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// Invoices
// ============================================================

/**
 * GET /api/invoices/period/:periodId
 * Get all invoices for a pay period
 */
export const getPeriodInvoices = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        if (!user?.companyId) {
            res.status(400).json({ success: false, error: 'No company associated' });
            return;
        }

        const invoices = await prisma.invoice.findMany({
            where: {
                payPeriodId: req.params.periodId,
                companyId: user.companyId,
            },
            orderBy: { createdAt: 'desc' },
        });

        // Enrich with user names
        const userIds = [...new Set(invoices.map((i) => i.userId))];
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true, profileImage: true },
        });
        const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

        const enriched = invoices.map((inv) => ({
            ...inv,
            user: userMap[inv.userId] || { name: 'Unknown', email: null },
        }));

        res.json({ success: true, invoices: enriched });
    } catch (error: any) {
        console.error('Get Period Invoices Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/invoices/:invoiceId/approve
 */
export const approveInvoiceHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        if (user?.role !== 'OWNER' && user?.role !== 'ADMIN') {
            res.status(403).json({ success: false, error: 'Admin access required' });
            return;
        }

        const invoice = await approveInvoice(req.params.invoiceId);
        res.json({ success: true, invoice });
    } catch (error: any) {
        console.error('Approve Invoice Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/invoices/:invoiceId/pay
 * Pay a single invoice and credit employee wallet
 */
export const payInvoiceHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        if (user?.role !== 'OWNER') {
            res.status(403).json({ success: false, error: 'Only company owner can process payments' });
            return;
        }

        const result = await payInvoice(req.params.invoiceId);
        res.json(result);
    } catch (error: any) {
        console.error('Pay Invoice Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// Wallet
// ============================================================

/**
 * GET /api/invoices/wallet
 * Get current user's wallet
 */
export const getMyWallet = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        if (!user?.id) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        let wallet = await prisma.wallet.findUnique({
            where: { userId: user.id },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
            },
        });

        if (!wallet) {
            wallet = await prisma.wallet.create({
                data: {
                    userId: user.id,
                    balance: 0,
                    totalEarned: 0,
                    totalWithdrawn: 0,
                    currency: user.currency || 'BDT',
                },
                include: {
                    transactions: {
                        orderBy: { createdAt: 'desc' },
                        take: 20,
                    },
                },
            });
        }

        res.json({ success: true, wallet });
    } catch (error: any) {
        console.error('Get Wallet Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/invoices/wallet/:userId
 * Get a specific user's wallet (admin only)
 */
export const getUserWallet = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        if (user?.role !== 'OWNER' && user?.role !== 'ADMIN') {
            res.status(403).json({ success: false, error: 'Admin access required' });
            return;
        }

        const wallet = await prisma.wallet.findUnique({
            where: { userId: req.params.userId },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 50,
                },
            },
        });

        if (!wallet) {
            res.json({
                success: true,
                wallet: {
                    userId: req.params.userId,
                    balance: 0,
                    totalEarned: 0,
                    totalWithdrawn: 0,
                    currency: 'BDT',
                    transactions: [],
                },
            });
            return;
        }

        res.json({ success: true, wallet });
    } catch (error: any) {
        console.error('Get User Wallet Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/invoices/my-invoices
 * Employee sees their own invoices
 */
export const getMyInvoices = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        if (!user?.id) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        const invoices = await prisma.invoice.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        res.json({ success: true, invoices });
    } catch (error: any) {
        console.error('Get My Invoices Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
