import { z } from 'zod';

export const initiatePaymentSchema = z.object({
  method: z.enum(['MPESA']),
  purpose: z.enum(['DUES', 'VERIFICATION', 'TREASURY_DEPOSIT']),
  purposeMeta: z.record(z.unknown()).optional(),
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
