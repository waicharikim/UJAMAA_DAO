# Payments API Documentation

> **Module status:** `partial` — all endpoints live, both flows end-to-end verified; unit tests pending.
> **Provider:** Buni by KCB — M-Pesa STK push (inbound) + M-Pesa B2C (outbound payouts).
> Base URL: `http://localhost:4000/api/v1/payments`

---

## Overview

All real-money flows use **Buni by KCB** — a Kenya-focused M-Pesa gateway. Payments go to platform-controlled M-Pesa accounts. No P2P in-app transfers (Rule 2).

### Inbound flow (STK push — user pays the platform)
1. Client calls `/initiate` → Buni triggers an STK push (popup on the user's phone)
2. User enters M-Pesa PIN on their phone (~30 seconds)
3. Buni calls `POST /webhook/buni` with the result
4. Client polls `GET /status/:txRef` to check the outcome

### Outbound flow (B2C — platform pays the user; UT cash-out)
1. Client calls `POST /economy/ut/withdraw` → debits `fiatBackedUtBalance`, creates `UtWithdrawal(PENDING)`, enqueues BullMQ job
2. Worker calls Buni B2C API → Safaricom pushes KES to user's M-Pesa
3. Safaricom calls `POST /webhook/buni-b2c` with the result
4. Handler calls `completePayout` (COMPLETED) or `refundPayout` (FAILED + balance restored)

**Rule 4:** Only `fiatBackedUtBalance` can be cashed out (1 UT = 1 KES, deposited via M-Pesa). `earnedUtBalance` has no cash-out path, ever.

---

## Endpoints

### `POST /payments/initiate`

**Auth:** Bearer token required

Initiate an M-Pesa STK push. Buni sends a payment prompt to the user's registered phone number.

**Body:**
| Field | Type | Required | Notes |
|---|---|---|---|
| `amount` | number | Yes | Amount in KES (minimum 1) |
| `phoneNumber` | string | Yes | E.164 format, e.g. `+254712345678` |
| `method` | string | Yes | Must be `"MPESA"` |
| `description` | string | No | Payment description (shown to user) |

**Response `200`:**
```json
{
  "success": true,
  "txRef": "BUNI-1746800000000-abc123"
}
```

**Notes:**
- In test mode (`NODE_ENV=test`), returns a stub `txRef` immediately without calling Buni.
- `txRef` is the reference to use for status polling.
- A `Payment` DB record is created immediately with `status: PENDING`.

---

### `POST /payments/webhook/buni`

**Auth:** None (called by Buni/Safaricom servers)

Buni's STK push callback. Updates the `Payment` record with the result.

**Body (Buni callback payload):**
```json
{
  "ResultCode": 0,
  "ResultDesc": "The service request is processed successfully.",
  "MerchantRequestID": "...",
  "CheckoutRequestID": "...",
  "Amount": 100,
  "MpesaReceiptNumber": "QJA123XYZ",
  "TransactionDate": 20260509120000,
  "PhoneNumber": "254712345678"
}
```

**ResultCode values:**
| Code | Meaning |
|---|---|
| `0` | Success — payment completed |
| `1032` | Request cancelled by user |
| `1037` | DS timeout — user unreachable (sandbox: phone didn't respond) |
| Other | Payment failed |

**Response `200`:** `{ "success": true }`

**Effect:** Updates the `Payment` record:
- `ResultCode 0` → `status: SUCCESS`, stores `mpesaReceiptNumber`
- Any other code → `status: FAILED`

---

### `POST /payments/webhook/buni-b2c`

**Auth:** None (called by Safaricom/Buni B2C servers)

Safaricom B2C result callback. Called after the worker's B2C payout request is processed.

**Body (Safaricom B2C result payload):**
```json
{
  "Result": {
    "ResultType": 0,
    "ResultCode": 0,
    "ResultDesc": "The service request is processed successfully.",
    "OriginatorConversationID": "...",
    "ConversationID": "...",
    "TransactionID": "QJA123XYZ",
    "ResultParameters": {
      "ResultParameter": [
        { "Key": "TransactionAmount", "Value": 100 },
        { "Key": "ReceiverPartyPublicName", "Value": "254712345678 - Jane Doe" }
      ]
    },
    "ReferenceData": {
      "ReferenceItem": { "Key": "Occasion", "Value": "withdrawal-uuid-here" }
    }
  }
}
```

**ResultCode values:**
| Code | Meaning |
|---|---|
| `0` | Success — M-Pesa transfer sent |
| Non-zero | Transfer failed (insufficient funds, invalid phone, etc.) |

**Response `200`:** `{ "ResultCode": 0, "ResultDesc": "Accepted" }` (always — Safaricom ignores any other response)

**Effect:**
- `ResultCode 0` → `UtWithdrawal.status = COMPLETED`, `completedAt` set, audit `UT_WITHDRAWAL_COMPLETED`
- Any other code → `fiatBackedUtBalance` restored, `UtWithdrawal.status = FAILED`, audit `UT_WITHDRAWAL_FAILED`

**Correlation:** The `withdrawalId` is stored in the `Occasion` field of the original B2C request. Safaricom surfaces it back in `ReferenceData.ReferenceItem.Key="Occasion"`.

---

### `GET /payments/status/:txRef`

**Auth:** Bearer token required

Poll the payment status by `txRef`.

**Response `200`:**
```json
{
  "success": true,
  "payment": {
    "txRef": "BUNI-1746800000000-abc123",
    "status": "SUCCESS",
    "amount": 100,
    "currency": "KES",
    "phoneNumber": "+254712345678",
    "mpesaReceiptNumber": "QJA123XYZ",
    "createdAt": "2026-05-09T12:00:00.000Z",
    "updatedAt": "2026-05-09T12:00:30.000Z"
  }
}
```

**Status values:** `PENDING` · `SUCCESS` · `FAILED`

---

## UT Withdrawal (cash-out)

The UT withdrawal flow is in `POST /economy/ut/withdraw` (not `/payments`). The payment module handles only the Buni API calls and webhook.

**Limits:**
- Minimum: 10 KES per request
- Maximum: 10,000 KES per request
- Daily: 50,000 KES per user (pending + completed withdrawals since midnight)

**Retry logic:** BullMQ job retries 3× with exponential backoff (30s base). If all retries fail, `failedJobHandler` in `workers.ts` calls `refundPayout` automatically to restore the user's balance.

---

## Environment Variables

### Web service (STK push)
| Variable | Description |
|---|---|
| `BUNI_CLIENT_ID` | Buni sandbox/production client ID |
| `BUNI_CLIENT_SECRET` | Buni sandbox/production client secret |
| `BUNI_BASE_URL` | Buni API base URL (default: `https://uat.buni.kcbgroup.com`) |
| `BASE_URL` | Public HTTPS URL for Buni to send STK callbacks (must be reachable) |

### Worker service (B2C payouts — do NOT put on web service)
| Variable | Description |
|---|---|
| `BUNI_CLIENT_ID` | Shared OAuth credentials (same as web) |
| `BUNI_CLIENT_SECRET` | Shared OAuth credentials (same as web) |
| `BUNI_BASE_URL` | Buni API base URL |
| `BUNI_B2C_SHORTCODE` | M-Pesa shortcode for B2C payouts |
| `BUNI_B2C_INITIATOR_NAME` | Buni B2C initiator name |
| `BUNI_B2C_SECURITY_CREDENTIAL` | Encrypted password for B2C initiator |

> **Callback URL requirement:** Buni sandbox requires a publicly reachable HTTPS URL. In dev, use a tunnel: `ssh -o StrictHostKeyChecking=no -R 80:localhost:4000 localhost.run`. Set `BASE_URL` to the generated `https://<hash>.lhr.life` URL and restart the web container with `docker compose up -d --no-deps web`.

---

## Security Notes

- The webhook endpoint has no auth — validate the Buni signature if/when they provide one.
- `docker restart` does NOT pick up `.env` changes — use `docker compose up -d --no-deps web`.
- Buni sandbox `statusCode "0"` = accepted (push sent), not completed. The actual result comes in the callback.
- ResultCode 1037 in sandbox means the sandbox phone didn't respond — the integration itself is working.
