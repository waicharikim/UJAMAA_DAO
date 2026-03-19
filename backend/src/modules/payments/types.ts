/**
 * @file src/modules/payments/types.ts
 * Payment module types and DTOs
 */

export type PaymentMethod = 'MPESA' | 'CARD';
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

/** Shape returned by Flutterwave charge.mpesa() */
export interface FlwMpesaChargeResponse {
  status: string; // "success" | "error"
  message: string;
  data?: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    device_fingerprint: string;
    amount: number;
    charged_amount: number;
    app_fee: number;
    merchant_fee: number;
    processor_response: string;
    auth_model: string;
    currency: string;
    ip: string;
    narration: string;
    status: string;
    payment_type: string;
    fraud_status: string;
    charge_type: string;
    created_at: string;
    account_id: number;
    customer: {
      id: number;
      phone_number: string;
      name: string;
      email: string;
      created_at: string;
    };
    meta: Record<string, string | number | boolean | null>;
  };
}

/** Shape returned by Flutterwave payment.create() for hosted checkout */
export interface FlwPaymentLinkResponse {
  status: string; // "success" | "error"
  message: string;
  data?: {
    link: string;
  };
}

/** Shape of the Flutterwave webhook payload */
export interface FlwWebhookPayload {
  event: string; // "charge.completed"
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    charged_amount: number;
    status: string; // "successful" | "failed"
    payment_type: string;
    meta?: Record<string, string | number | boolean | null>;
    customer: {
      id: number;
      name: string;
      phone_number?: string;
      email: string;
    };
  };
}
