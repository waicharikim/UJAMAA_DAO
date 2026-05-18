/**
 * @file src/modules/payments/types.ts
 * Payment module types and DTOs
 */

export type PaymentMethod = 'MPESA';
export type PaymentPurpose = 'DUES' | 'VERIFICATION' | 'TREASURY_DEPOSIT';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface InitiatePaymentDto {
  method: PaymentMethod;
  purpose: PaymentPurpose;
  /** Optional metadata — depends on purpose:
   * DUES: { tier, period }
   * TREASURY_DEPOSIT: { groupId }
   * VERIFICATION: {} (empty, userId inferred from auth)
   */
  purposeMeta?: Record<string, unknown>;
}

export interface DuesPurposeMeta {
  tier: string;
  period: string;
}

export interface TreasuryPurposeMeta {
  groupId: string;
}

export interface PaymentRecordDto {
  id: string;
  txRef: string;
  flwRef: string | null;
  amount: string;
  currency: string;
  method: PaymentMethod;
  purpose: PaymentPurpose;
  purposeMeta: Record<string, unknown> | null;
  status: PaymentStatus;
  createdAt: Date;
  completedAt: Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUNI (KCB) TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface BuniStkPushResponse {
  header: {
    statusCode: string | number;
    statusDescription: string;
  };
  response?: {
    MerchantRequestID: string;
    CheckoutRequestID: string;
    CustomerMessage: string;
    ResponseCode: number;
    ResponseDescription: string;
  };
}

export interface BuniCallbackMetadataItem {
  Name: string;
  Value: string | number;
}

/** Safaricom STK push callback delivered by Buni to your callbackUrl */
export interface BuniCallbackPayload {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: BuniCallbackMetadataItem[];
      };
    };
  };
}

export interface BuniTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUNI B2C (outbound M-Pesa payouts)
// ─────────────────────────────────────────────────────────────────────────────

export interface BuniB2cRequestBody {
  InitiatorName: string;
  SecurityCredential: string;
  CommandID: 'BusinessPayment' | 'SalaryPayment' | 'PromotionPayment';
  Amount: string;
  PartyA: string; // shortcode
  PartyB: string; // recipient phone (no +)
  Remarks: string;
  QueueTimeOutURL: string;
  ResultURL: string;
  Occasion: string; // withdrawalId for correlation
}

export interface BuniB2cResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string; // "0" = accepted
  ResponseDescription: string;
}

/** Safaricom B2C result callback delivered to ResultURL */
export interface BuniB2cCallbackPayload {
  Result: {
    ResultType: number;
    ResultCode: number; // 0 = success
    ResultDesc: string;
    OriginatorConversationID: string;
    ConversationID: string;
    TransactionID: string;
    ResultParameters?: {
      ResultParameter: Array<{ Key: string; Value: string | number }>;
    };
    /** withdrawalId stored in Occasion at request time */
    ReferenceData?: {
      ReferenceItem: { Key: string; Value: string };
    };
  };
}
