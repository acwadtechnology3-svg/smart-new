import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import crypto from 'crypto';
import { config } from '../config/env';
import { sendNotificationToUser } from '../services/notificationService';

// =============================================
// Kashier Configuration (from environment)
// =============================================
const KASHIER = {
    MERCHANT_ID: config.KASHIER_MERCHANT_ID,
    API_KEY: config.KASHIER_API_KEY,
    SECRET_KEY: config.KASHIER_SECRET_KEY,
    WEBHOOK_SECRET: config.KASHIER_WEBHOOK_SECRET,
    CURRENCY: config.KASHIER_CURRENCY,
    MODE: config.KASHIER_MODE
};

// Base URLs - switch between test and production
const KASHIER_API_BASE = KASHIER.MODE === 'live'
    ? 'https://api.kashier.io'
    : 'https://test-api.kashier.io';

const KASHIER_REFUND_BASE = KASHIER.MODE === 'live'
    ? 'https://fep.kashier.io'
    : 'https://test-fep.kashier.io';

// =============================================
// HELPER: Validate Kashier Signature
// =============================================
const validateKashierSignature = (params: any, receivedSignature: string): boolean => {
    const data: any = { ...params };
    delete data.signature;
    delete data.mode;

    const sortedKeys = Object.keys(data).sort();
    const queryParts = sortedKeys.map(key => `${key}=${data[key]}`);
    const queryString = queryParts.join('&');

    // Secret Key logic: If secret contains '$', use the part AFTER '$'
    const secret = KASHIER.WEBHOOK_SECRET.includes('$')
        ? KASHIER.WEBHOOK_SECRET.split('$')[1]
        : KASHIER.WEBHOOK_SECRET;

    const generatedSignature = crypto.createHmac('sha256', secret).update(queryString).digest('hex');

    // console.log("Validation Debug:", { queryString, generatedSignature, receivedSignature });

    return generatedSignature === receivedSignature;
};

// =============================================
// 1. INITIALIZE DEPOSIT (Payment Session)
// =============================================
export const initializeDeposit = async (req: Request, res: Response) => {
    try {
        const { userId, amount } = req.body;

        if (!userId || !amount) {
            return res.status(400).json({ error: 'Missing userId or amount' });
        }

        const orderId = crypto.randomUUID();
        const amountFormatted = parseFloat(amount).toFixed(2);

        // Save Pending Transaction in DB
        const { error: insertError } = await supabase.from('wallet_transactions').insert({
            id: orderId,
            user_id: userId,
            amount: parseFloat(amount),
            type: 'deposit',
            status: 'pending',
            description: 'Kashier Deposit - Awaiting Payment'
        });

        if (insertError) throw insertError;

        // Fetch user info for Kashier customer field (required)
        const { data: userData } = await supabase
            .from('users')
            .select('email, name, phone')
            .eq('id', userId)
            .single();

        // Build the callback/webhook URLs
        // In production, set SERVER_BASE_URL in .env (e.g. https://api.smartline.app)
        // For local dev, we use a placeholder redirect (user returns to app manually)
        const baseUrl = process.env.SERVER_BASE_URL || '';
        const merchantRedirect = baseUrl
            ? `${baseUrl}/api/payment/callback`
            : 'https://smartline.app/payment/success'; // Placeholder for local dev
        const serverWebhook = baseUrl
            ? `${baseUrl}/api/payment/webhook`
            : undefined; // No webhook in local dev (not reachable)

        // Expiry: 30 minutes from now
        const expireAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        // Create Payment Session via Kashier V3 API
        const sessionPayload = {
            expireAt,
            maxFailureAttempts: 3,
            paymentType: 'credit',
            amount: amountFormatted,
            currency: KASHIER.CURRENCY,
            order: orderId,
            merchantRedirect,
            display: 'en',
            type: 'one-time',
            allowedMethods: 'card,wallet',
            iframeBackgroundColor: '#FFFFFF',
            merchantId: KASHIER.MERCHANT_ID,
            failureRedirect: false,
            brandColor: '#4F46E5',
            defaultMethod: 'card',
            description: `SmartLine Wallet Top-Up (${amountFormatted} ${KASHIER.CURRENCY})`,
            manualCapture: false,
            enable3DS: true,
            serverWebhook,
            interactionSource: 'ECOMMERCE',
            customer: {
                email: userData?.email || `user-${userId}@smartline.app`,
                reference: userId
            },
            metaData: {
                userId,
                orderId,
                source: 'smartline-app'
            }
        };

        /*console.log('📤 Creating Kashier Payment Session:', {
            url: `${KASHIER_API_BASE}/v3/payment/sessions`,
            orderId,
            amount: amountFormatted,
            mode: KASHIER.MODE
        });*/

        const response = await fetch(`${KASHIER_API_BASE}/v3/payment/sessions`, {
            method: 'POST',
            headers: {
                'Authorization': KASHIER.SECRET_KEY,
                'api-key': KASHIER.API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionPayload)
        });

        const responseData = await response.json();

        if (!response.ok) {
            // console.error('❌ Kashier Session Creation Failed:', responseData);
            // Mark transaction as failed
            await supabase.from('wallet_transactions').update({
                status: 'failed',
                description: `Kashier session creation failed: ${JSON.stringify(responseData)}`
            }).eq('id', orderId);

            return res.status(response.status).json({
                error: 'Failed to create payment session',
                details: responseData
            });
        }

        /*console.log('✅ Kashier Session Created:', {
            sessionId: responseData._id,
            sessionUrl: responseData.sessionUrl,
            status: responseData.status
        });*/

        // Update transaction with kashier session ID
        await supabase.from('wallet_transactions').update({
            description: `Kashier Session: ${responseData._id}`
        }).eq('id', orderId);

        // Return session URL to mobile app
        res.json({
            paymentUrl: responseData.sessionUrl,
            orderId,
            sessionId: responseData._id,
            paymentId: orderId
        });

    } catch (err: any) {
        // console.error("❌ Deposit Init Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// =============================================
// 2. PAYMENT CALLBACK (Browser Redirect)
// =============================================
export const paymentCallback = async (req: Request, res: Response) => {
    try {
        // console.log("🔔 Kashier Callback Received:");
        // console.log("  Query:", req.query);
        // console.log("  Body:", req.body);

        // Kashier sends params in query string for redirect
        const params = { ...req.query, ...req.body } as any;
        const {
            paymentStatus,
            orderId,
            merchantOrderId,
            transactionId,
            kashierOrderId,
            signature,
            cardDataToken
        } = params;

        const orderRef = orderId || merchantOrderId;

        if (!orderRef) {
            return res.status(400).send(`
                <html>
                <body style="text-align:center; padding: 50px; font-family: sans-serif;">
                    <h1 style="color:red">Missing Order ID</h1>
                    <p>No order reference found in the payment callback.</p>
                </body>
                </html>
            `);
        }

        // Validate Signature (if provided)
        if (signature) {
            const isValid = validateKashierSignature(params, signature as string);
            if (!isValid) {
                console.warn("⚠️ Invalid signature for order:", orderRef);
                // Continue processing in test mode, block in production
                if (KASHIER.MODE === 'live') {
                    return res.status(403).send(`
                        <html>
                        <body style="text-align:center; padding: 50px; font-family: sans-serif;">
                            <h1 style="color:red">Invalid Signature</h1>
                            <p>Payment verification failed.</p>
                        </body>
                        </html>
                    `);
                }
            }
        }

        // Check Status
        const isSuccess = ['SUCCESS', 'CAPTURED', 'success', 'captured'].includes(
            (paymentStatus || '').toString()
        );

        if (isSuccess) {
            await processSuccessfulPayment(orderRef, transactionId || kashierOrderId);

            res.send(`
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body { text-align:center; padding: 50px; font-family: -apple-system, sans-serif; background: #f0fdf4; }
                        .card { max-width: 400px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                        .icon { font-size: 64px; margin-bottom: 16px; }
                        h1 { color: #10B981; margin-bottom: 8px; }
                        p { color: #6B7280; margin-bottom: 4px; }
                        .close-hint { margin-top: 24px; color: #9CA3AF; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="icon">✅</div>
                        <h1>Payment Successful!</h1>
                        <p>Your SmartLine wallet has been topped up.</p>
                        <p style="font-weight:bold; color:#111827;">Order: ${orderRef}</p>
                        <p class="close-hint">You can close this window and return to the app.</p>
                    </div>
                </body>
                </html>
            `);
        } else {
            // Mark as failed
            await supabase.from('wallet_transactions').update({
                status: 'failed',
                description: `Payment failed - Status: ${paymentStatus}`
            }).eq('id', orderRef);

            res.send(`
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body { text-align:center; padding: 50px; font-family: -apple-system, sans-serif; background: #fef2f2; }
                        .card { max-width: 400px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                        .icon { font-size: 64px; margin-bottom: 16px; }
                        h1 { color: #EF4444; margin-bottom: 8px; }
                        p { color: #6B7280; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="icon">❌</div>
                        <h1>Payment Failed</h1>
                        <p>Status: ${paymentStatus || 'Unknown'}</p>
                        <p>Please try again from the app.</p>
                    </div>
                </body>
                </html>
            `);
        }

    } catch (err) {
        // console.error("❌ Callback Error:", err);
        res.status(500).send("Error processing payment callback");
    }
};

// =============================================
// 3. WEBHOOK (Server-to-Server from Kashier)
// =============================================
export const paymentWebhook = async (req: Request, res: Response) => {
    try {
        // console.log("🔔 Kashier Webhook Received:");
        // console.log("  Headers:", JSON.stringify(req.headers, null, 2));
        // console.log("  Body:", JSON.stringify(req.body, null, 2));

        const data = req.body;

        // Kashier webhook can send different formats
        // Try to extract order info from various possible structures
        const paymentStatus = data.paymentStatus || data.status || data?.response?.status;
        const orderId = data.merchantOrderId || data.orderId || data.order;
        const transactionId = data.transactionId || data?.response?.transactionId;
        const kashierOrderId = data.kashierOrderId || data?.response?.cardOrderId;

        if (!orderId) {
            console.warn("⚠️ Webhook received without orderId:", data);
            return res.status(200).json({ received: true, message: 'No orderId found' });
        }

        const isSuccess = ['SUCCESS', 'CAPTURED', 'success', 'captured'].includes(
            (paymentStatus || '').toString()
        );

        if (isSuccess) {
            await processSuccessfulPayment(orderId, transactionId || kashierOrderId);
        } else {
            await supabase.from('wallet_transactions').update({
                status: 'failed',
                description: `Webhook: Payment status ${paymentStatus}`
            }).eq('id', orderId);
        }

        // Always return 200 to Kashier webhook
        res.status(200).json({ received: true, status: paymentStatus });

    } catch (err) {
        // console.error("❌ Webhook Error:", err);
        // Still return 200 to prevent Kashier from retrying
        res.status(200).json({ received: true, error: 'Internal processing error' });
    }
};

// =============================================
// HELPER: Process a successful payment
// =============================================
async function processSuccessfulPayment(orderId: string, transactionId?: string) {
    // Find Transaction
    const { data: tx, error: fetchError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('id', orderId)
        .single();

    if (fetchError || !tx) {
        // console.error("❌ Transaction not found:", orderId, fetchError);
        return;
    }

    if (tx.status === 'completed') {
        // console.log("ℹ️ Transaction already completed (idempotent):", orderId);
        return;
    }

    // Update User Balance
    const { data: user } = await supabase
        .from('users')
        .select('balance')
        .eq('id', tx.user_id)
        .single();

    const newBalance = (user?.balance || 0) + tx.amount;

    const { error: updateError } = await supabase.from('users').update({ balance: newBalance }).eq('id', tx.user_id);

    if (updateError) {
        throw new Error(`Failed to update user balance: ${updateError.message}`);
    }

    // Mark Transaction Complete - store Kashier ref for refund lookups
    await supabase.from('wallet_transactions').update({
        status: 'completed',
        description: `Deposit via Kashier (Tx: ${transactionId || 'N/A'}) [KashierRef:${transactionId || orderId}]`
    }).eq('id', orderId);

    // console.log(`✅ Payment Success: ${orderId} - User ${tx.user_id} credited ${tx.amount} ${KASHIER.CURRENCY}`);
}

// =============================================
// 4. REQUEST WITHDRAWAL (Pending admin approval)
//    Creates a withdrawal request for admin review
// =============================================
export const requestWithdrawal = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { amount, method, accountNumber } = req.body;

        // Check Balance
        const { data: user } = await supabase
            .from('users')
            .select('balance')
            .eq('id', userId)
            .single();

        if (!user || (user.balance || 0) < amount) {
            return res.status(400).json({
                error: 'Insufficient funds',
                message_ar: 'رصيدك غير كافي',
                message_en: 'Insufficient funds'
            });
        }

        // Check for existing PENDING request
        const { data: existingPending } = await supabase
            .from('withdrawal_requests')
            .select('id')
            .eq('driver_id', userId)
            .eq('status', 'pending')
            .single();

        if (existingPending) {
            return res.status(400).json({
                error: 'You already have a pending withdrawal request.',
                message_ar: 'لديك بالفعل طلب سحب قيد المراجعة',
                message_en: 'You already have a pending withdrawal request.'
            });
        }

        // Insert Withdrawal Request (pending admin review)
        const { data, error } = await supabase
            .from('withdrawal_requests')
            .insert({
                driver_id: userId,
                amount,
                method,
                account_number: accountNumber,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        // console.log(`📋 Withdrawal request created: User ${userId}, Amount: ${amount}, Method: ${method}`);

        res.json({
            success: true,
            request: data,
            message_ar: `تم إرسال طلب السحب بنجاح بمبلغ ${amount} جنيه. سيتم تحويل المبلغ بعد مراجعة الطلب من قبل الإدارة.`,
            message_en: `Withdrawal request of ${amount} EGP submitted successfully. The amount will be transferred after admin review.`
        });

    } catch (err: any) {
        // console.error('❌ Withdrawal Request Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// =============================================
// 5. MANAGE WITHDRAWAL (Admin approves/rejects)
//    Uses Kashier Refund API when approving
// =============================================
export const manageWithdrawal = async (req: Request, res: Response) => {
    try {
        const { requestId, action, adminNote } = req.body;

        // Get Withdrawal Request
        const { data: request } = await supabase
            .from('withdrawal_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (!request || request.status !== 'pending') {
            return res.status(400).json({ error: 'Invalid request' });
        }

        if (action === 'approve') {

            // Check Balance
            const { data: user } = await supabase
                .from('users')
                .select('balance')
                .eq('id', request.driver_id)
                .single();

            if (!user || (user.balance || 0) < request.amount) {
                return res.status(400).json({ error: 'Driver has insufficient funds' });
            }

            // Try to find a completed deposit to refund against
            // Look for the most recent completed deposit with a Kashier transaction ID
            const { data: lastDeposit } = await supabase
                .from('wallet_transactions')
                .select('*')
                .eq('user_id', request.driver_id)
                .eq('type', 'deposit')
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            let refundResult = null;
            let refundSuccess = false;

            if (lastDeposit && lastDeposit.description) {
                // Extract Kashier Order ID from the description
                const txMatch = lastDeposit.description.match(/Tx:\s*([^\)]+)/);
                const kashierOrderId = txMatch ? txMatch[1].trim() : null;

                if (kashierOrderId && kashierOrderId !== 'N/A') {
                    // Attempt Kashier Refund
                    try {
                        // console.log(`💸 Attempting Kashier Refund: orderId=${kashierOrderId}, amount=${request.amount}`);

                        const refundResponse = await fetch(
                            `${KASHIER_REFUND_BASE}/orders/${kashierOrderId}/`,
                            {
                                method: 'PUT',
                                headers: {
                                    'Authorization': KASHIER.SECRET_KEY,
                                    'accept': 'application/json',
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    apiOperation: 'REFUND',
                                    reason: adminNote || `Withdrawal request #${requestId}`,
                                    transaction: {
                                        amount: request.amount
                                    }
                                })
                            }
                        );

                        refundResult = await refundResponse.json();
                        // console.log('Kashier Refund Response:', JSON.stringify(refundResult, null, 2));

                        refundSuccess = refundResult?.status === 'SUCCESS' ||
                            refundResult?.response?.status === 'SUCCESS' ||
                            refundResult?.response?.gatewayCode === 'APPROVED';

                    } catch (refundErr) {
                        // console.error('❌ Kashier Refund API Error:', refundErr);
                    }
                }
            }

            // Deduct from wallet balance regardless (admin manually approved)
            const newBalance = (user.balance || 0) - request.amount;
            const { error: updateError } = await supabase.from('users').update({ balance: newBalance }).eq('id', request.driver_id);

            if (updateError) {
                // If we refunded via kashier succesffully but failed to update balance, log critical error
                if (refundSuccess) {
                    console.error('CRITICAL: Kashier refund succeeded but user balance update failed!', {
                        userId: request.driver_id,
                        amount: request.amount,
                        error: updateError
                    });
                }
                throw new Error(`Failed to update driver balance: ${updateError.message}`);
            }

            // Transaction Record
            await supabase.from('wallet_transactions').insert({
                user_id: request.driver_id,
                amount: -request.amount,
                type: 'withdrawal',
                status: 'completed',
                trip_id: null,
                description: refundSuccess
                    ? `Withdrawal to ${request.method} via Kashier Refund`
                    : `Withdrawal to ${request.method} (manual transfer required)`
            });

            // Update Withdrawal Request Status
            await supabase.from('withdrawal_requests').update({
                status: 'approved',
                admin_note: adminNote || (refundSuccess
                    ? 'Approved - Kashier refund processed'
                    : 'Approved - Manual transfer required')
            }).eq('id', requestId);

            // console.log(`✅ Withdrawal approved: ${requestId}, refund via Kashier: ${refundSuccess}`);

            // Send Notification
            sendNotificationToUser(
                request.driver_id,
                'Withdrawal Approved',
                `Your withdrawal of ${request.amount} ${KASHIER.CURRENCY} has been approved.`
            );

            res.json({
                success: true,
                refundProcessed: refundSuccess,
                refundResult: refundSuccess ? refundResult : undefined,
                message: refundSuccess
                    ? 'Withdrawal approved and refund processed via Kashier'
                    : 'Withdrawal approved. Manual bank transfer may be required.'
            });

        } else if (action === 'reject') {
            await supabase.from('withdrawal_requests').update({
                status: 'rejected',
                admin_note: adminNote
            }).eq('id', requestId);

            // Send Notification
            sendNotificationToUser(
                request.driver_id,
                'Withdrawal Rejected',
                `Your withdrawal request was rejected.${adminNote ? ' Reason: ' + adminNote : ''}`
            );

            res.json({ success: true, message: 'Withdrawal request rejected' });
        } else {
            res.status(400).json({ error: 'Invalid action. Use "approve" or "reject".' });
        }

    } catch (err: any) {
        // console.error('❌ Manage Withdrawal Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// =============================================
// 6. VERIFY & PROCESS PAYMENT (App polls this)
//    Checks Kashier session status and auto-credits wallet
// =============================================
export const verifyPayment = async (req: Request, res: Response) => {
    try {
        const orderId = req.params.orderId as string;

        if (!orderId) {
            return res.status(400).json({ error: 'Missing orderId' });
        }

        // Find the pending transaction
        const { data: tx } = await supabase
            .from('wallet_transactions')
            .select('*')
            .eq('id', orderId)
            .single();

        if (!tx) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Already completed - return success
        if (tx.status === 'completed') {
            return res.json({
                verified: true,
                status: 'completed',
                message: 'Payment already processed'
            });
        }

        // Already failed
        if (tx.status === 'failed') {
            return res.json({
                verified: false,
                status: 'failed',
                message: 'Payment was marked as failed'
            });
        }

        // Extract session ID from description if stored
        const sessionMatch = tx.description?.match(/Kashier Session:\s*(.+)/);
        const sessionId = sessionMatch ? sessionMatch[1].trim() : null;

        if (!sessionId) {
            return res.json({
                verified: false,
                status: tx.status,
                message: 'No Kashier session found for this transaction'
            });
        }

        // Query Kashier for the session payment status
        // console.log(`🔍 Verifying payment with Kashier - Session: ${sessionId}, Order: ${orderId}`);

        const response = await fetch(
            `${KASHIER_API_BASE}/v3/payment/sessions/${sessionId}/payment`,
            {
                method: 'GET',
                headers: {
                    'Authorization': KASHIER.SECRET_KEY
                }
            }
        );

        const kashierData = await response.json();
        // console.log('📋 Kashier session status:', JSON.stringify(kashierData, null, 2));

        if (!response.ok) {
            return res.json({
                verified: false,
                status: tx.status,
                message: 'Could not verify with Kashier',
                kashierError: kashierData
            });
        }

        // Check if payment was successful
        const paymentData = kashierData?.data || kashierData;
        const kashierStatus = paymentData?.status || '';
        const isSuccess = ['SUCCESS', 'CAPTURED', 'PAID'].includes(kashierStatus.toUpperCase());

        if (isSuccess) {
            // Process the payment - credit the wallet
            const transactionId = String(paymentData?.orderId || paymentData?.transactionId || sessionId);
            await processSuccessfulPayment(orderId, transactionId);

            return res.json({
                verified: true,
                status: 'completed',
                message: 'Payment verified and wallet credited!'
            });
        }

        // Payment not yet successful
        return res.json({
            verified: false,
            status: kashierStatus || tx.status,
            message: `Payment status: ${kashierStatus || 'pending'}`
        });

    } catch (err: any) {
        console.error("❌ Verify Payment Error:", err);
        res.status(500).json({ error: err.message });
    }
};

