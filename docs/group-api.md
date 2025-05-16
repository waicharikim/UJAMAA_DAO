# Group API Documentation

## Overview

The Group API manages group creation, membership, invitations, role management, and group data retrieval. All group-related endpoints require authentication.

---

## Endpoints

### POST `/api/groups`

**Description:**  
Create a new group. The authenticated user is automatically assigned as the group admin.

**Authentication:**  
Bearer JWT token required.

**Request Body:**  
| Field             | Type       | Required | Description                    |
| ----------------- | ---------- | -------- | ------------------------------ |
| `name`            | string     | Yes      | Unique group name              |
| `description`     | string     | No       | Optional group description      |
| `walletAddress`   | string     | Yes      | Group's Ethereum wallet address |
| `constituency`    | string     | Yes      | Group's registered constituency |
| `county`          | string     | Yes      | Group's registered county      |
| `industryFocus`   | string     | No       | Group's industry focus         |
| `productsServices`| string[]   | No       | List of products or services    |

**Responses:**  
- `201 Created`: Returns created group object.  
- `409 Conflict`: Group name already exists.  
- `400 Bad Request`: Validation errors.  
- `401 Unauthorized`: Missing or invalid authentication.

---

### GET `/api/groups/:id`

**Description:**  
Retrieve group details by ID, including active members and their user info.

**Authentication:**  
Bearer JWT token required.

**Path Parameters:**  
| Parameter | Type   | Description           |
| --------- | ------ | --------------------- |
| `id`      | string | Unique ID of the group |

**Responses:**  
- `200 OK`: Returns group object with members.  
- `404 Not Found`: Group not found.  
- `401 Unauthorized`: Missing or invalid authentication.

---

### PATCH `/api/groups/:id`

**Description:**  
Update group details partially.

**Authentication:**  
Bearer JWT token required.

**Request Body:** (any combination of fields below)

| Field             | Type       | Description                |
| ----------------- | ---------- | -------------------------- |
| `name`            | string     | Group name (unique)         |
| `description`     | string     | Group description           |
| `walletAddress`   | string     | Group wallet address        |
| `constituency`    | string     | Group constituency          |
| `county`          | string     | Group county                |
| `industryFocus`   | string     | Industry focus              |
| `productsServices`| string[]   | Products or services list   |

**Responses:**  
- `200 OK`: Returns updated group object.  
- `400 Bad Request`: Validation errors.  
- `404 Not Found`: Group not found.  
- `401 Unauthorized`: Missing or invalid authentication.

---

### POST `/api/groups/:id/invite`

**Description:**  
Invite a user to join the group. Requires admin privileges (enforced in backend).

**Authentication:**  
Bearer JWT token required.

**Path Parameters:**  
| Parameter | Type   | Description           |
| --------- | ------ | --------------------- |
| `id`      | string | ID of the group       |

**Request Body:**  
| Field  | Type   | Description          |
| ------ | ------ | -------------------- |
| `userId`| string | ID of user to invite |

**Responses:**  
- `201 Created`: Invitation created (pending membership).  
- `400 Bad Request`: User already a member or invited.  
- `404 Not Found`: Group not found.  
- `401 Unauthorized`: Missing or invalid authentication.

---

### POST `/api/groups/:id/accept`

**Description:**  
Authenticated user accepts a pending invitation to join the group.

**Authentication:**  
Bearer JWT token required.

**Path Parameters:**  
| Parameter | Type   | Description           |
| --------- | ------ | --------------------- |
| `id`      | string | ID of the group       |

**Responses:**  
- `200 OK`: Invitation accepted, membership activated.  
- `404 Not Found`: No pending invitation found.  
- `401 Unauthorized`: Missing or invalid authentication.

---

### POST `/api/groups/:id/role`

**Description:**  
Change the role of a group member (e.g., promote/demote admin/member). Requires admin privileges.

**Authentication:**  
Bearer JWT token required.

**Path Parameters:**  
| Parameter | Type   | Description           |
| --------- | ------ | --------------------- |
| `id`      | string | ID of the group       |

**Request Body:**  
| Field  | Type          | Description       |
| ------ | ------------- | ----------------- |
| `userId`| string       | ID of member      |
| `role` | 'ADMIN' \| 'MEMBER' | New role        |

**Responses:**  
- `200 OK`: Member role updated.  
- `404 Not Found`: Member not found or group not found.  
- `401 Unauthorized`: Missing or invalid authentication.

---

## Notes

- All routes under `/api/groups` require valid JWT tokens.
- Group names must be unique across the platform.
- User invitations create `GroupMember` entries with `active=false` until accepted.
- Role changes are restricted to admins (logic enforced server-side).
- Group data includes active members only.
- Constituency and county must be valid predefined locations.

---

## Example cURL Requests

**Create a group:**

```bash
curl -X POST http://localhost:4000/api/groups \
-H "Authorization: Bearer <your_jwt_token>" \
-H "Content-Type: application/json" \
-d '{
  "name": "Test Group",
  "walletAddress": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
  "constituency": "Nairobi West",
  "county": "Nairobi",
  "industryFocus": "Tech",
  "productsServices": ["Consulting", "Development"]
}'
```

**Invite a user to group:**
```bash
curl -X POST http://localhost:4000/api/groups/<group_id>/invite \
-H "Authorization: Bearer <your_jwt_token>" \
-H "Content-Type: application/json" \
-d '{"userId": "<user_id>"}'
```


**Accept an invitation:**
```bash
curl -X POST http://localhost:4000/api/groups/<group_id>/accept \
-H "Authorization: Bearer <your_jwt_token>"
```


**Change member role:**
```bash
curl -X POST http://localhost:4000/api/groups/<group_id>/role \
-H "Authorization: Bearer <your_jwt_token>" \
-H "Content-Type: application/json" \
-d '{"userId": "<user_id>", "role": "ADMIN"}'
```