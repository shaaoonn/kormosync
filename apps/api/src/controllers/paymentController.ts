import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { grantToken, createPayment as bkashCreate, executePayment as bkashExecute } from '../utils/bkashClient';
import { v4 as uuidv4 } from 'uuid';


export const createPayment = async (req: Request, res: Response) => {
    console.log('[Payment] createPayment called with body:', JSON.stringify(req.body));
    try {
        // 1. Get User/Company
        const { amount, callbackUrl, planName, maxEmployees, storageLimit, billingCycle, paymentMethod } = req.body;
        const { uid } = req.user!; // From authMiddleware

        // Validation
        if (!amount || !planName) {
            res.status(400).json({ error: 'Missing plan details' });
            return;
        }

        // 1. Get User/Company
        const user = await prisma.user.findUnique({
            where: { firebaseUid: uid },
            include: { company: true },
        });

        if (!user || !user.companyId) {
            res.status(400).json({ error: 'User must belong to a company to pay' });
            return;
        }

        // --- DEMO PAYMENT LOGIC ---
        if (paymentMethod === 'DEMO') {
            console.log(`Processing DEMO payment for ${user.email} - Plan: ${planName}`);

            const daysToAdd = billingCycle === 'YEARLY' ? 365 : 30;
            const nextDate = new Date();
            nextDate.setDate(nextDate.getDate() + daysToAdd);

            // Directly update company
            await prisma.company.update({
                where: { id: user.companyId },
                data: {
                    subscriptionStatus: 'ACTIVE',
                    subscriptionEndDate: nextDate,
                    maxEmployees: maxEmployees || 10,
                    storageLimit: storageLimit ? parseFloat(storageLimit) : 2048.0,
                }
            });

            // Log payment record as SUCCESS immediately
            await prisma.payment.create({
                data: {
                    companyId: user.companyId,
                    trxID: `DEMO-${Date.now()}`,
                    amount: parseFloat(amount),
                    status: 'SUCCESS',
                    paymentExecuteTime: new Date(),
                    metadata: { planName, maxEmployees, storageLimit, billingCycle, type: 'DEMO' }
                }
            });

            res.json({ success: true, demo: true });
            return;
        }
        // --------------------------

        // 2. Grant Token
        const token = await grantToken();
        console.log('[Controller] Token obtained for user:', uid);

        // 3. Create bKash Payment
        // We use a temporary invoice number (our internal tracking)
        const invoiceNumber = `INV-${Date.now()}`;

        // We expect the frontend to provide a specific callback URL or we construct it
        // Using a default for now if not provided, assuming localhost or the deployed domain
        const finalCallbackUrl = callbackUrl || `http://localhost:8000/api/payment/callback`;

        const paymentRes = await bkashCreate(token, amount || '100', invoiceNumber, finalCallbackUrl);

        if (paymentRes && paymentRes.paymentID) {
            console.log('[Controller] bKash Payment Initiated. URL:', paymentRes.bkashURL);
            // 4. Save to DB
            // We store the paymentID as the temporary trxID
            await prisma.payment.create({
                data: {
                    companyId: user.companyId,
                    trxID: paymentRes.paymentID, // Temporary, will be updated to real TrxID on success
                    amount: parseFloat(amount || '100'),
                    status: 'PENDING',
                    metadata: {
                        planName,
                        maxEmployees,
                        storageLimit,
                        billingCycle
                    }
                },
            });

            res.json({ success: true, bkashURL: paymentRes.bkashURL });
        } else {
            console.error('[Controller] Failed to initiate payment. Response:', paymentRes);
            res.status(500).json({ error: 'Failed to initiate bKash payment', details: paymentRes });
        }

    } catch (error) {
        console.error('Create Payment Error:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

export const handleCallback = async (req: Request, res: Response) => {
    try {
        const { paymentID, status } = req.query;

        if (status === 'cancel' || status === 'failure') {
            // Update DB if we can find it
            // Note: We might want to find by trxID=paymentID
            await prisma.payment.update({
                where: { trxID: paymentID as string },
                data: { status: 'FAILED' }
            });
            // Redirect to frontend failure page
            return res.redirect(`http://localhost:3000/payment/fail?message=${status}`);
        }

        if (status === 'success') {
            // 1. Grant Token (Tokens expire, good to refresh or cache, fetching fresh for safety)
            const token = await grantToken();

            // 2. Execute Payment
            const executeRes = await bkashExecute(token, paymentID as string);

            if (executeRes && executeRes.trxID) {
                // 3. Update Payment in DB
                // Find by the temporary trxID (which was paymentID)
                const payment = await prisma.payment.findUnique({
                    where: { trxID: paymentID as string }
                });

                if (payment) {
                    await prisma.payment.update({
                        where: { id: payment.id },
                        data: {
                            status: 'SUCCESS',
                            trxID: executeRes.trxID, // Update to real TrxID
                            paymentExecuteTime: new Date(executeRes.paymentExecuteTime), // e.g. "2018-10-08T10:12:35 GMT+0600"
                        }
                    });

                    // 4. Update Company Subscription
                    const metadata = payment.metadata as any || {}; // Cast to any to access JSON fields
                    const { maxEmployees, storageLimit, billingCycle } = metadata;

                    const daysToAdd = billingCycle === 'YEARLY' ? 365 : 30;
                    const nextDate = new Date();
                    nextDate.setDate(nextDate.getDate() + daysToAdd);

                    await prisma.company.update({
                        where: { id: payment.companyId },
                        data: {
                            subscriptionStatus: 'ACTIVE',
                            subscriptionEndDate: nextDate,
                            maxEmployees: maxEmployees || 10, // Default fallback
                            storageLimit: storageLimit ? parseFloat(storageLimit) : 2048.0,
                        }
                    });

                    return res.redirect(`http://localhost:3000/dashboard/billing/success?trxID=${executeRes.trxID}&amount=${payment.amount}&planName=${metadata.planName}&date=${new Date().toISOString()}`);
                }
            } else {
                console.error("Execute failed", executeRes);
                return res.redirect(`http://localhost:3000/payment/fail?message=${executeRes.statusMessage}`);
            }
        }
    } catch (error) {
        console.error('Payment Callback Error:', error);
        res.status(500).send('Payment Execution Failed');
    }
};
