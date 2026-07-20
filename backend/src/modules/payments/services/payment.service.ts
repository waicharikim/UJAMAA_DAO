/**
 * @file src/modules/payments/services/payment.service.ts
 * @description
 * Payment Service
 *
 * M-Pesa STK Push  →  Buni by KCB  (POST /mm/api/request/1.0.0/stkpush)
 *
 * Stubbed when NODE_ENV=test.
 */

import crypto from 'crypto';
import { prisma } from '../../../core/database/client.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import { logger } from '../../../core/logger/logger.js';
import { duesService } from '../../economy/services/dues.service.js';
import { treasuryService } from '../../treasury/services/treasury.service.js';
import { getUtContract } from '../../../core/blockchain/client.js';
import {
  InitiatePaymentDto,
  PaymentPurpose,
  BuniCallbackPayload,
  BuniStkPushResponse,
  BuniTokenResponse,
  BuniB2cResponse,
  DuesPurposeMeta,
  TreasuryPurposeMeta,
} from '../types.js';
import { DuesTier, DUES_CONFIG } from '../../economy/types.js';

// ─── Provider env vars ────────────────────────────────────────────────────────

const BUNI_CLIENT_ID = process.env.BUNI_CLIENT_ID || '';
const BUNI_CLIENT_SECRET = process.env.BUNI_CLIENT_SECRET || '';
const BUNI_BASE_URL =
  process.env.BUNI_BASE_URL || 'https://uat.buni.kcbgroup.com';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';

// B2C-specific — only needed for outbound payouts
const BUNI_B2C_SHORTCODE = process.env.BUNI_B2C_SHORTCODE || '';
const BUNI_B2C_INITIATOR_NAME = process.env.BUNI_B2C_INITIATOR_NAME || '';
const BUNI_B2C_SECURITY_CREDENTIAL =
  process.env.BUNI_B2C_SECURITY_CREDENTIAL || '';

// ─── Buni OAuth2 token cache (in-memory, single instance) ────────────────────

let _buniTokenCache: { token: string; expiresAt: number } | null = null;

async function getBuniToken(): Promise<string> {
  if (_buniTokenCache && Date.now() < _buniTokenCache.expiresAt - 30_000) {
    return _buniTokenCache.token;
  }

  const credentials = Buffer.from(
    `${BUNI_CLIENT_ID}:${BUNI_CLIENT_SECRET}`
  ).toString('base64');
  const res = await fetch(`${BUNI_BASE_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error(
      `[BUNI] Token request failed: ${res.status} ${res.statusText}`
    );
  }

  const data = (await res.json()) as BuniTokenResponse;
  _buniTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1_000,
  };
  return _buniTokenCache.token;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateTxRef(): string {
  return `UJ-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/** Amount (KES) for each purpose */
const FIXED_AMOUNTS: Partial<Record<PaymentPurpose, number>> = {
  VERIFICATION: 100,
};

function resolveAmount(
  purpose: PaymentPurpose,
  meta: Record<string, unknown>
): number {
  if (purpose === 'DUES') {
    const { tier } = meta as unknown as DuesPurposeMeta;
    const config = DUES_CONFIG.TIERS[tier as DuesTier];
    if (!config) throw ApiError.badRequest(`Unknown dues tier: ${tier}`);
    return config.amountKes;
  }
  const fixed = FIXED_AMOUNTS[purpose];
  if (fixed !== undefined) return fixed;
  if (typeof meta.amount === 'number') return meta.amount;
  throw ApiError.badRequest('Cannot determine payment amount');
}

// ─────────────────────────────────────────────────────────────────────────────

class PaymentService {
  /**
   * Initiate an M-Pesa payment via Buni STK push.
   * Result arrives at POST /payments/webhook/buni
   */
  async initiatePayment(
    userId: string,
    dto: InitiatePaymentDto
  ): Promise<{ txRef: string }> {
    const { method, purpose, purposeMeta = {} } = dto;

    const amount = resolveAmount(purpose, purposeMeta);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phoneNumber: true, name: true },
    });
    if (!user) throw ApiError.notFound('User', userId);

    const txRef = generateTxRef();

    await prisma.paymentRecord.create({
      data: {
        userId,
        txRef,
        amount,
        currency: 'KES',
        method,
        purpose,
        purposeMeta: purposeMeta as object,
        status: 'PENDING',
      },
    });

    if (process.env.NODE_ENV === 'test') {
      logger.debug(
        { txRef, method, purpose },
        '[PAYMENTS] Test mode — stubbed'
      );
      return { txRef };
    }

    return this._initiateMpesaBuni(txRef, amount, user, purposeMeta);
  }

  // ─── Buni M-Pesa STK Push ──────────────────────────────────────────────────

  private async _initiateMpesaBuni(
    txRef: string,
    amount: number,
    user: {
      email: string | null;
      phoneNumber: string | null;
      name: string | null;
    },
    _meta: Record<string, unknown>
  ): Promise<{ txRef: string }> {
    const rawPhone = user.phoneNumber;
    if (!rawPhone) {
      await prisma.paymentRecord.update({
        where: { txRef },
        data: { status: 'FAILED' },
      });
      throw ApiError.badRequest('Phone number required for M-Pesa payment');
    }

    // Buni expects E.164 without the + prefix: 254712345678
    const phone = rawPhone.replace(/^\+/, '');

    // invoiceNumber max 24 chars — our txRef fits (UJ-1742220000-ABCD = ~19 chars)
    const invoiceNumber = txRef.slice(-24);

    const token = await getBuniToken();

    const body = {
      phoneNumber: phone,
      amount: String(Math.round(amount)),
      invoiceNumber,
      sharedShortCode: true,
      orgShortCode: '',
      orgPassKey: '',
      callbackUrl: `${BASE_URL}/api/v1/payments/webhook/buni`,
      transactionDescription: 'DAO Payment',
    };

    const res = await fetch(`${BUNI_BASE_URL}/mm/api/request/1.0.0/stkpush`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        routeCode: '207',
        operation: 'STKPush',
        messageId: txRef,
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as BuniStkPushResponse;
    const statusCode = String(data?.header?.statusCode);

    if (statusCode !== '0') {
      await prisma.paymentRecord.update({
        where: { txRef },
        data: { status: 'FAILED' },
      });
      logger.error(
        { txRef, statusCode, desc: data?.header?.statusDescription },
        '[BUNI] STK push rejected'
      );
      throw ApiError.transactionFailed('M-Pesa STK push failed');
    }

    // Store CheckoutRequestID in flwRef for webhook correlation
    const checkoutRequestId = data.response?.CheckoutRequestID;
    if (checkoutRequestId) {
      await prisma.paymentRecord.update({
        where: { txRef },
        data: { flwRef: checkoutRequestId },
      });
    }

    logger.info({ txRef, checkoutRequestId }, '[BUNI] STK push sent');
    return { txRef };
  }

  // ─── Buni webhook (Safaricom STK callback) ─────────────────────────────────

  /**
   * Handle the Safaricom STK push callback delivered by Buni.
   * Must return { statusCode: '0', statusMessage: '...' } to acknowledge.
   */
  async handleBuniWebhook(
    payload: BuniCallbackPayload
  ): Promise<{ statusCode: string; statusMessage: string }> {
    const { stkCallback } = payload.Body;
    const { CheckoutRequestID, ResultCode, CallbackMetadata } = stkCallback;

    // Look up record by CheckoutRequestID stored in flwRef at initiation
    const record = await prisma.paymentRecord.findFirst({
      where: { flwRef: CheckoutRequestID },
    });

    if (!record) {
      logger.warn(
        { CheckoutRequestID },
        '[BUNI] Webhook for unknown CheckoutRequestID — ignoring'
      );
      return { statusCode: '0', statusMessage: 'Acknowledged' };
    }

    if (record.status !== 'PENDING') {
      logger.info(
        { txRef: record.txRef },
        '[BUNI] Already processed — idempotent skip'
      );
      return { statusCode: '0', statusMessage: 'Already processed' };
    }

    if (ResultCode !== 0) {
      await prisma.paymentRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED' },
      });
      logger.warn(
        { txRef: record.txRef, ResultCode },
        '[BUNI] STK callback failed — record FAILED'
      );
      return { statusCode: '0', statusMessage: 'Acknowledged' };
    }

    // Extract amount + receipt from CallbackMetadata
    const items = CallbackMetadata?.Item ?? [];
    const amountVal = items.find((i) => i.Name === 'Amount')?.Value;
    const receiptVal = items.find(
      (i) => i.Name === 'MpesaReceiptNumber'
    )?.Value;
    const amount =
      typeof amountVal === 'number' ? amountVal : Number(record.amount);
    const mpesaReceipt = receiptVal ? String(receiptVal) : undefined;

    await prisma.paymentRecord.update({
      where: { id: record.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    logger.info(
      { txRef: record.txRef, amount, mpesaReceipt },
      '[BUNI] Payment COMPLETED'
    );

    await this._routeCompletedPayment(
      record.userId,
      record.purpose as PaymentPurpose,
      record.purposeMeta as Record<string, unknown> | null,
      record.txRef,
      amount,
      mpesaReceipt
    );

    return {
      statusCode: '0',
      statusMessage: 'Notification received successfully',
    };
  }

  // ─── Downstream routing ────────────────────────────────────────────────────

  private async _routeCompletedPayment(
    userId: string,
    purpose: PaymentPurpose,
    meta: Record<string, unknown> | null,
    txRef: string,
    amount: number,
    mpesaReceipt?: string
  ): Promise<void> {
    switch (purpose) {
      case 'DUES': {
        const { tier, period } = (meta || {}) as unknown as DuesPurposeMeta;
        await duesService.recordPayment(
          userId,
          tier as DuesTier,
          amount,
          period,
          mpesaReceipt ?? txRef
        );
        break;
      }
      case 'VERIFICATION': {
        const { userService } = await import(
          '../../user/services/user.service.js'
        );
        await userService.finalizeVerificationPayment(userId, txRef);
        break;
      }
      case 'TREASURY_DEPOSIT': {
        const { groupId } = (meta || {}) as unknown as TreasuryPurposeMeta;
        await treasuryService.deposit(
          groupId,
          { amount, description: `Payment ${txRef}` },
          userId
        );
        // On-chain UT mint — payer receives fiatBackedUt for their M-Pesa deposit
        if (process.env.NODE_ENV !== 'test') {
          const payer = await prisma.user.findUnique({
            where: { id: userId },
            select: { walletAddress: true },
          });
          if (payer?.walletAddress) {
            const utContract = getUtContract();
            if (utContract) {
              try {
                const amountWei = BigInt(Math.round(amount)) * BigInt(10 ** 18);
                await utContract.mint(payer.walletAddress, amountWei);
                logger.info(
                  { userId, amount },
                  '[UT] On-chain mint succeeded (treasury deposit)'
                );
              } catch (err) {
                logger.warn(
                  { userId, err },
                  '[UT] On-chain mint failed — off-chain record intact'
                );
              }
            }
          }
        }
        break;
      }
      default:
        logger.warn(
          { purpose, txRef },
          '[PAYMENTS] Unknown purpose — downstream not called'
        );
    }
  }

  // ─── Status query ──────────────────────────────────────────────────────────

  async getPaymentStatus(txRef: string, userId: string) {
    const record = await prisma.paymentRecord.findUnique({ where: { txRef } });
    if (!record) throw ApiError.notFound('PaymentRecord', txRef);
    if (record.userId !== userId) throw ApiError.forbidden('Access denied');
    return record;
  }

  // ─── B2C payout (outbound M-Pesa) ─────────────────────────────────────────

  /**
   * Initiate an outbound M-Pesa B2C payout via Buni.
   * Called by the process-mpesa-payout BullMQ job.
   * Throws if B2C credentials are not configured or Buni rejects.
   * Status is confirmed asynchronously via POST /payments/webhook/buni-b2c.
   */
  async initiateB2CPayout(opts: {
    withdrawalId: string;
    amountKes: number;
    mpesaPhone: string;
  }): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      logger.debug(
        { withdrawalId: opts.withdrawalId },
        '[BUNI B2C] Test mode — stubbed'
      );
      return;
    }

    if (
      !BUNI_B2C_SHORTCODE ||
      !BUNI_B2C_INITIATOR_NAME ||
      !BUNI_B2C_SECURITY_CREDENTIAL
    ) {
      throw new Error(
        '[BUNI B2C] B2C credentials not configured (BUNI_B2C_SHORTCODE / BUNI_B2C_INITIATOR_NAME / BUNI_B2C_SECURITY_CREDENTIAL)'
      );
    }

    const phone = opts.mpesaPhone.replace(/^\+/, '');
    const resultUrl = `${BASE_URL}/api/v1/payments/webhook/buni-b2c`;

    const token = await getBuniToken();

    const body = {
      InitiatorName: BUNI_B2C_INITIATOR_NAME,
      SecurityCredential: BUNI_B2C_SECURITY_CREDENTIAL,
      CommandID: 'BusinessPayment',
      Amount: String(opts.amountKes),
      PartyA: BUNI_B2C_SHORTCODE,
      PartyB: phone,
      Remarks: `UT Cashout`,
      QueueTimeOutURL: resultUrl,
      ResultURL: resultUrl,
      Occasion: opts.withdrawalId,
    };

    const res = await fetch(`${BUNI_BASE_URL}/mm/api/b2c/v1/paymentrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as BuniB2cResponse;

    if (!res.ok || data.ResponseCode !== '0') {
      logger.error(
        {
          withdrawalId: opts.withdrawalId,
          responseCode: data.ResponseCode,
          desc: data.ResponseDescription,
        },
        '[BUNI B2C] Payout request rejected'
      );
      throw new Error(
        `[BUNI B2C] Request failed (${data.ResponseCode}): ${data.ResponseDescription}`
      );
    }

    logger.info(
      {
        withdrawalId: opts.withdrawalId,
        conversationId: data.ConversationID,
        amountKes: opts.amountKes,
      },
      '[BUNI B2C] Payout request accepted'
    );
  }

  /**
   * Handle the Safaricom B2C result callback delivered by Buni.
   * Confirms success or failure of an outbound payout.
   * Returns the withdrawalId so the caller can update UtWithdrawal status.
   */
  async handleBuniB2cWebhook(payload: {
    Result: {
      ResultCode: number;
      ResultDesc: string;
      ConversationID: string;
      TransactionID?: string;
      ReferenceData?: { ReferenceItem: { Key: string; Value: string } };
    };
  }): Promise<{ withdrawalId: string | null; success: boolean; desc: string }> {
    const { ResultCode, ResultDesc, ReferenceData } = payload.Result;

    // withdrawalId was stored in Occasion (surfaced in ReferenceData by Safaricom)
    const withdrawalId =
      ReferenceData?.ReferenceItem?.Key === 'Occasion'
        ? ReferenceData.ReferenceItem.Value
        : null;

    const success = ResultCode === 0;

    logger.info(
      {
        withdrawalId,
        resultCode: ResultCode,
        resultDesc: ResultDesc,
        transactionId: payload.Result.TransactionID,
      },
      success ? '[BUNI B2C] Payout confirmed' : '[BUNI B2C] Payout failed'
    );

    return { withdrawalId, success, desc: ResultDesc };
  }
}

export const paymentService = new PaymentService();
