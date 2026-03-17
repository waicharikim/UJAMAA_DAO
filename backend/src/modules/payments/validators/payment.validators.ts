import { z } from 'zod';

export const initiatePaymentSchema = z.object({
  method: z.enum(['MPESA', 'CARD']),
  purpose: z.enum(['DUES', 'VERIFICATION', 'TREASURY_DEPOSIT']),
  purposeMeta: z.record(z.unknown()).optional(),
});

// Flutterwave card webhook
export const webhookPayloadSchema = z.object({
  event: z.string(),
  data: z.object({
    id: z.number(),
    tx_ref: z.string(),
    flw_ref: z.string(),
    amount: z.number(),
    currency: z.string(),
    charged_amount: z.number(),
    status: z.string(),
    payment_type: z.string(),
    meta: z.record(z.unknown()).optional(),
    customer: z.object({
      id: z.number(),
      name: z.string(),
      phone_number: z.string().optional(),
      email: z.string(),
    }),
  }),
});

// Buni / Safaricom STK push callback
export const buniCallbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string(),
      CheckoutRequestID: z.string(),
      ResultCode: z.number(),
      ResultDesc: z.string(),
      CallbackMetadata: z
        .object({
          Item: z.array(
            z.object({
              Name: z.string(),
              Value: z.union([z.string(), z.number()]),
            })
          ),
        })
        .optional(),
    }),
  }),
});

export const txRefParamSchema = z.object({
  txRef: z.string().min(1),
});
