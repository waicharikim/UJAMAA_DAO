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
