# User API Documentation

## Overview

The User API handles registration, profile management, and public user lookup by wallet address. It provides both public and authenticated endpoints for managing user data.

---

## Endpoints

### POST `/api/users`

**Description:**  
Registers a new user.

**Authentication:**  
None (public endpoint).

**Request Body:**  
| Field             | Type         | Required | Description                        |
| ----------------- | ------------ | -------- | -------------------------------- |
| `walletAddress`    | string       | Yes      | User's Ethereum wallet address    |
| `email`            | string       | Yes      | User's email address (unique)     |
| `name`             | string       | Yes      | User's full name                  |
| `phoneNumber`      | string       | No       | Optional contact phone number     |
| `constituencyOrigin` | string     | Yes      | User's origin constituency         |
| `countyOrigin`     | string       | Yes      | User's origin county              |
| `constituencyLive` | string       | Yes      | User's current constituency        |
| `countyLive`       | string       | Yes      | User's current county             |
| `industry`         | string       | No       | Industry or sector affiliation    |
| `goodsServices`    | string[]     | No       | Goods or services provided by user |

**Responses:**  
- `201 Created`: User successfully registered. Returns created user object.  
- `409 Conflict`: Email or wallet address already registered.  
- `400 Bad Request`: Validation errors.

---

### GET `/api/users/wallet/:walletAddress`

**Description:**  
Fetches user details by their wallet address.

**Authentication:**  
None (public endpoint).

**Path Parameters:**  
| Parameter        | Type   | Description                      |
| ---------------- | ------ | ------------------------------- |
| `walletAddress`  | string | Ethereum wallet address (case-insensitive) |

**Responses:**  
- `200 OK`: Return user object matching wallet address.  
- `404 Not Found`: User with given wallet address not found.

---

### GET `/api/users/me`

**Description:**  
Gets the profile of the authenticated user.

**Authentication:**  
Bearer JWT token required.

**Responses:**  
- `200 OK`: Returns authenticated user profile.  
- `401 Unauthorized`: Missing or invalid authentication token.

---

### PATCH `/api/users/me`

**Description:**  
Updates profile of the authenticated user.

**Authentication:**  
Bearer JWT token required.

**Request Body:** (any subset of below fields, all validated)  
| Field             | Type         | Description                    |
| ----------------- | ------------ | ------------------------------ |
| `email`            | string       | User's email address           |
| `name`             | string       | User's name                   |
| `phoneNumber`      | string       | Contact phone number          |
| `constituencyOrigin` | string     | Origin constituency            |
| `countyOrigin`     | string       | Origin county                |
| `constituencyLive` | string       | Current constituency           |
| `countyLive`       | string       | Current county                |
| `industry`         | string       | Industry/sector              |
| `goodsServices`    | string[]     | Goods or services offered      |

**Responses:**  
- `200 OK`: Updated user object returned.  
- `400 Bad Request`: Validation error on input.  
- `401 Unauthorized`: Missing or invalid token.

---

## Notes

- All wallet addresses are normalized to lowercase internally to avoid case-sensitivity issues. Input casing variations are accepted but normalized on storage and lookup.
- Registration automatically assigns a nonce used in wallet signature challenge for authentication.
- Authentication tokens are JWTs signed with a secure secret (`JWT_SECRET`).
- JWT tokens are sent in `Authorization` header as `Bearer <token>`.
- Input validation is rigorously performed using Zod schemas to ensure data correctness.
- Profile updates allow partial fields, validating only provided keys.

---

## Example cURL Requests

**Register a new user:**

```bash
curl -X POST http://localhost:4000/api/users \
-H "Content-Type: application/json" \
-d '{
  "walletAddress": "0xabcdef1234567890abcdef1234567890abcdef12",
  "email": "user@example.com",
  "name": "Jane Doe",
  "constituencyOrigin": "Nairobi West",
  "countyOrigin": "Nairobi",
  "constituencyLive": "Nairobi West",
  "countyLive": "Nairobi",
  "industry": "Education",
  "goodsServices": ["Teaching", "Books"]
}'
```
**Get user by wallet address:**

```bash
curl http://localhost:4000/api/users/wallet/0xabcdef1234567890abcdef1234567890abcdef12
```

**Get own profile (authenticated):**

```bash
curl http://localhost:4000/api/users/me \
-H "Authorization: Bearer <your_jwt_token>"
```


**Update profile (authenticated):**

```bash
curl -X PATCH http://localhost:4000/api/users/me \
-H "Authorization: Bearer <your_jwt_token>" \
-H "Content-Type: application/json" \
-d '{"name": "Jane Updated"}'
```