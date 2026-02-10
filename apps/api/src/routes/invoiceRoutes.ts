import { Router } from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import {
    getPayPeriods,
    createPayPeriod,
    lockPeriod,
    payAllPeriod,
    getPeriodInvoices,
    approveInvoiceHandler,
    payInvoiceHandler,
    getMyWallet,
    getUserWallet,
    getMyInvoices,
} from '../controllers/invoiceController';

const router = Router();

// Pay Periods (Admin/Owner)
router.get('/periods', authenticateUser, getPayPeriods);
router.post('/periods/create', authenticateUser, createPayPeriod);
router.post('/periods/:periodId/lock', authenticateUser, lockPeriod);
router.post('/periods/:periodId/pay-all', authenticateUser, payAllPeriod);

// Invoices
router.get('/period/:periodId', authenticateUser, getPeriodInvoices);
router.get('/my-invoices', authenticateUser, getMyInvoices);
router.post('/:invoiceId/approve', authenticateUser, approveInvoiceHandler);
router.post('/:invoiceId/pay', authenticateUser, payInvoiceHandler);

// Wallet
router.get('/wallet', authenticateUser, getMyWallet);
router.get('/wallet/:userId', authenticateUser, getUserWallet);

export default router;
