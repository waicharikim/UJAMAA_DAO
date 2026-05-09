# Payments API Documentation

> **Module status:** `partial` — endpoints live, end-to-end verified; unit tests pending.
> **Provider:** Buni by KCB — M-Pesa STK push (Kenya).
> Base URL: `http://localhost:4000/api/v1/payments`

---

## Overview

All real-money flows use **Buni by KCB** — a Kenya-focused M-Pesa STK push integration. Payments go to platform-controlled M-Pesa accounts. No P2P in-app transfers (Rule 2).

The flow is async:
1. Client calls `/initiate` → Buni triggers an STK push (popup on the user's phone)
2. User enters M-Pesa PIN on their phone (~30 seconds)
3. Buni calls `POST /webhook/buni` with the result
4. Client polls `GET /status/:txRef` to check the outcome

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

## Environment Variables

| Variable | Description |
|---|---|
| `BUNI_CLIENT_ID` | Buni sandbox/production client ID |
| `BUNI_CLIENT_SECRET` | Buni sandbox/production client secret |
| `BASE_URL` | Public HTTPS URL for Buni to send callbacks (must be reachable) |

> **Callback URL requirement:** Buni sandbox requires a publicly reachable HTTPS URL. In dev, use a tunnel: `ssh -o StrictHostKeyChecking=no -R 80:localhost:4000 localhost.run`. Set `BASE_URL` to the generated `https://<hash>.lhr.life` URL and restart the web container with `docker compose up -d --no-deps web`.

---

## Security Notes

- The webhook endpoint has no auth — validate the Buni signature if/when they provide one.
- `docker restart` does NOT pick up `.env` changes — use `docker compose up -d --no-deps web`.
- Buni sandbox `statusCode "0"` = accepted (push sent), not completed. The actual result comes in the callback.
- ResultCode 1037 in sandbox means the sandbox phone didn't respond — the integration itself is working.
