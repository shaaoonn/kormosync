// ============================================================
// Payroll Cron Service
// Runs monthly to close pay periods, generate invoices, and credit wallets
// ============================================================

import prisma from '../utils/prisma';
import { calculateEarnings } from './earningsService';
import { generateDailyAttendance } from '../controllers/attendanceController';


/**
 * Ensure a pay period exists for the given month.
 * Creates one if missing.
 */
export async function ensurePayPeriod(companyId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const existing = await prisma.payPeriod.findUnique({
        where: {
            companyId_startDate: { companyId, startDate },
        },
    });

    if (existing) return existing;

    return prisma.payPeriod.create({
        data: {
            companyId,
            startDate,
            endDate,
            status: 'OPEN',
            currency: 'BDT',
        },
    });
}

/**
 * Generate invoices for all employees in a pay period.
 * Calculates hours from TimeLogs, deductions from penalty logs, etc.
 */
export async function generateInvoices(payPeriodId: string) {
    const payPeriod = await prisma.payPeriod.findUnique({
        where: { id: payPeriodId },
    });

    if (!payPeriod || payPeriod.status === 'PAID') {
        throw new Error('Pay period not found or already paid');
    }

    // Get all employees in the company
    const employees = await prisma.user.findMany({
        where: {
            companyId: payPeriod.companyId,
            role: { in: ['EMPLOYEE', 'ADMIN', 'FREELANCER'] },
            deletedAt: null,
        },
        select: {
            id: true,
            hourlyRate: true,
            currency: true,
        },
    });

    const invoices = [];

    for (const emp of employees) {
        try {
            // Use earningsService for full calculation (leave, overtime, penalties)
            const earnings = await calculateEarnings(emp.id, payPeriod.startDate, payPeriod.endDate);

            // Skip if no work and no leave
            if (earnings.workedHours === 0 && earnings.paidLeaveDays === 0) continue;

            const hourlyRate = emp.hourlyRate || 0;

            // Upsert invoice with full breakdown
            const invoice = await prisma.invoice.upsert({
                where: {
                    payPeriodId_userId: { payPeriodId, userId: emp.id },
                },
                update: {
                    totalHours: earnings.workedHours,
                    hourlyRate,
                    grossAmount: earnings.grossAmount,
                    deductions: earnings.penaltyAmount,
                    netAmount: Math.max(0, earnings.netAmount),
                    currency: earnings.currency,
                    status: 'DRAFT',
                    leaveHours: earnings.leaveHours,
                    leavePay: earnings.leavePay,
                    overtimeHours: earnings.overtimeHours,
                    overtimePay: earnings.overtimePay,
                    overtimeRate: earnings.overtimeRate,
                    salaryType: earnings.salaryType,
                    monthlySalary: earnings.monthlySalary,
                    workedDays: earnings.workedDays,
                    totalWorkingDays: earnings.totalWorkingDays,
                },
                create: {
                    payPeriodId,
                    userId: emp.id,
                    companyId: payPeriod.companyId,
                    totalHours: earnings.workedHours,
                    hourlyRate,
                    grossAmount: earnings.grossAmount,
                    deductions: earnings.penaltyAmount,
                    netAmount: Math.max(0, earnings.netAmount),
                    currency: earnings.currency,
                    status: 'DRAFT',
                    leaveHours: earnings.leaveHours,
                    leavePay: earnings.leavePay,
                    overtimeHours: earnings.overtimeHours,
                    overtimePay: earnings.overtimePay,
                    overtimeRate: earnings.overtimeRate,
                    salaryType: earnings.salaryType,
                    monthlySalary: earnings.monthlySalary,
                    workedDays: earnings.workedDays,
                    totalWorkingDays: earnings.totalWorkingDays,
                },
            });

            invoices.push(invoice);
        } catch (err) {
            console.error(`[PayrollCron] Error generating invoice for user ${emp.id}:`, err);
        }
    }

    // Update pay period total
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.netAmount, 0);
    await prisma.payPeriod.update({
        where: { id: payPeriodId },
        data: { totalAmount: parseFloat(totalAmount.toFixed(2)) },
    });

    return invoices;
}

/**
 * Lock a pay period (no more changes to invoices).
 */
export async function lockPayPeriod(payPeriodId: string) {
    return prisma.payPeriod.update({
        where: { id: payPeriodId },
        data: { status: 'LOCKED' },
    });
}

/**
 * Mark invoices as approved and optionally credit employee wallets.
 */
export async function approveInvoice(invoiceId: string) {
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
    });

    if (!invoice || invoice.status !== 'DRAFT') {
        throw new Error('Invoice not found or not in DRAFT status');
    }

    return prisma.invoice.update({
        where: { id: invoiceId },
        data: {
            status: 'APPROVED',
            approvedAt: new Date(),
        },
    });
}

/**
 * Mark an invoice as paid and credit the employee's wallet.
 */
export async function payInvoice(invoiceId: string) {
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
    });

    if (!invoice || (invoice.status !== 'APPROVED' && invoice.status !== 'DRAFT')) {
        throw new Error('Invoice not found or not payable');
    }

    // Ensure wallet exists
    let wallet = await prisma.wallet.findUnique({
        where: { userId: invoice.userId },
    });

    if (!wallet) {
        wallet = await prisma.wallet.create({
            data: {
                userId: invoice.userId,
                balance: 0,
                totalEarned: 0,
                totalWithdrawn: 0,
                currency: invoice.currency,
            },
        });
    }

    // Credit wallet
    await prisma.$transaction([
        prisma.wallet.update({
            where: { id: wallet.id },
            data: {
                balance: { increment: invoice.netAmount },
                totalEarned: { increment: invoice.netAmount },
            },
        }),
        prisma.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: 'CREDIT',
                amount: invoice.netAmount,
                description: `Invoice payment for period`,
                reference: invoiceId,
            },
        }),
        prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                status: 'PAID',
                paidAt: new Date(),
            },
        }),
    ]);

    return { success: true, credited: invoice.netAmount };
}

/**
 * Pay all approved/draft invoices in a pay period at once.
 */
export async function payAllInvoices(payPeriodId: string) {
    const invoices = await prisma.invoice.findMany({
        where: {
            payPeriodId,
            status: { in: ['DRAFT', 'APPROVED'] },
        },
    });

    const results = [];
    for (const inv of invoices) {
        try {
            const result = await payInvoice(inv.id);
            results.push({ invoiceId: inv.id, userId: inv.userId, ...result });
        } catch (err: any) {
            results.push({ invoiceId: inv.id, userId: inv.userId, success: false, error: err.message });
        }
    }

    // Mark pay period as PAID
    await prisma.payPeriod.update({
        where: { id: payPeriodId },
        data: { status: 'PAID', closedAt: new Date() },
    });

    return results;
}

/**
 * Monthly cron: Auto-close previous month's pay period and create new one.
 * Call this at the start of each month (e.g., via setInterval or external cron).
 */
let isPayrollRunning = false;
export async function runMonthlyPayroll() {
    if (isPayrollRunning) {
        console.warn('[PayrollCron] ⚠️ Already running, skipping...');
        return;
    }
    isPayrollRunning = true;
    try {
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // 1-12
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    console.log(`[PayrollCron] Running monthly payroll for ${prevYear}-${prevMonth}`);

    // Get all active companies
    const companies = await prisma.company.findMany({
        where: {
            subscriptionStatus: 'ACTIVE',
            deletedAt: null,
        },
        select: { id: true },
    });

    for (const company of companies) {
        try {
            // 1. Ensure previous month pay period exists
            const prevPeriod = await ensurePayPeriod(company.id, prevYear, prevMonth);

            // 2. Generate invoices for previous month (if still OPEN)
            if (prevPeriod.status === 'OPEN') {
                await generateInvoices(prevPeriod.id);
                console.log(`[PayrollCron] Generated invoices for company ${company.id}, period ${prevYear}-${prevMonth}`);
            }

            // 3. Create current month pay period
            await ensurePayPeriod(company.id, currentYear, currentMonth);
        } catch (err) {
            console.error(`[PayrollCron] Error for company ${company.id}:`, err);
        }
    }

    console.log(`[PayrollCron] Monthly payroll complete for ${companies.length} companies`);
    } finally {
        isPayrollRunning = false;
    }
}

// ============================================================
// Simple interval-based cron (runs every 24 hours, checks if 1st of month)
// ============================================================
let cronInterval: ReturnType<typeof setInterval> | null = null;

export function startPayrollCron() {
    // Check daily at midnight-ish
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    // Run immediately on startup if it's the 1st
    const now = new Date();
    if (now.getDate() <= 2) {
        // Within first 2 days of month — safe to run
        runMonthlyPayroll().catch(console.error);
    }

    cronInterval = setInterval(() => {
        const today = new Date();
        if (today.getDate() === 1) {
            runMonthlyPayroll().catch(console.error);
        }
    }, TWENTY_FOUR_HOURS);

    console.log('[PayrollCron] Payroll cron started (daily check)');
}

export function stopPayrollCron() {
    if (cronInterval) {
        clearInterval(cronInterval);
        cronInterval = null;
    }
    if (attendanceCronInterval) {
        clearInterval(attendanceCronInterval);
        attendanceCronInterval = null;
    }
}

// ============================================================
// Daily Attendance Cron — generates attendance for previous day
// ============================================================
let attendanceCronInterval: ReturnType<typeof setInterval> | null = null;

let isAttendanceRunning = false;
async function runDailyAttendance() {
    if (isAttendanceRunning) {
        console.warn('[AttendanceCron] ⚠️ Already running, skipping...');
        return;
    }
    isAttendanceRunning = true;
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        console.log(`[AttendanceCron] Generating attendance for ${yesterday.toISOString().split('T')[0]}`);

        const companies = await prisma.company.findMany({
            where: { subscriptionStatus: 'ACTIVE', deletedAt: null },
            select: { id: true },
        });

        for (const company of companies) {
            try {
                await generateDailyAttendance(company.id, yesterday);
            } catch (err) {
                console.error(`[AttendanceCron] Error for company ${company.id}:`, err);
            }
        }

        console.log(`[AttendanceCron] Done for ${companies.length} companies`);
    } finally {
        isAttendanceRunning = false;
    }
}

export function startAttendanceCron() {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    // Run on startup for yesterday (if not already generated)
    runDailyAttendance().catch(console.error);

    attendanceCronInterval = setInterval(() => {
        const now = new Date();
        // Run at approximately 00:30 AM
        if (now.getHours() === 0 && now.getMinutes() >= 25 && now.getMinutes() <= 35) {
            runDailyAttendance().catch(console.error);
        }
    }, 60 * 60 * 1000); // Check every hour

    console.log('[AttendanceCron] Daily attendance cron started');
}
