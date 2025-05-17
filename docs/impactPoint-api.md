# Impact Points & Token Management API

Base URL: `/api`

---

## Impact Points API

### Add or Update Impact Points

**POST** `/impact-points`

**Description:** Add or modify impact points for a user or group.

**Authorization:** Required (JWT Bearer Token)

**Request Body:**

| Field           | Type                                     | Description                               | Required |
|-----------------|------------------------------------------|-------------------------------------------|----------|
| `holderType`    | `"USER"` or `"GROUP"`                     | Specifies the type of holder               | Yes      |
| `holderId`      | `UUID string`                            | The ID of the user or group                | Yes      |
| `points`        | `Integer`                               | Number of impact points to add or subtract | Yes      |
| `locationScope` | `"LOCAL" \| "CONSTITUENCY" \| "COUNTY" \| "NATIONAL"` | Optional geographic context for impact points | No       |
| `constituency`  | `String`                                | Optional constituency name                 | No       |
| `county`        | `String`                                | Optional county name                       | No       |

**Success Response:**

- Status: `200 OK`
  
```json
{
  "id": "uuid",
  "holderType": "USER",
  "userId": "uuid",
  "groupId": null,
  "points": 15,
  "locationScope": "CONSTITUENCY",
  "constituency": "TestConstituency",
  "county": "TestCounty",
  "updatedAt": "2025-05-17T20:00:00.000Z"
}

Error Responses:

    400 Bad Request - Invalid input or validation failure
    401 Unauthorized - Missing or invalid authentication token
    500 Internal Server Error - Server error processing the request

Get Impact Points

GET /impact-points

Description: Get impact points for a specified user or group.

Authorization: Required (JWT Bearer Token)

Query Parameters:
Parameter 	Type 	Description 	Required
holderType 	"USER" or "GROUP" 	Holder type to query 	Yes
holderId 	UUID string 	User or group ID 	Yes
locationScope 	Optional geographic scope 	Location context filter 	No

Success Response:

    Status: 200 OK

{
  "points": 15
}

Token Balance API
Update Token Balance

POST /token-balance

Description: Add or subtract tokens from a user or group balance.

Authorization: Required (JWT Bearer Token)

Request Body:
Field 	Type 	Description 	Required
holderType 	"USER" or "GROUP" 	The type of token holder 	Yes
holderId 	UUID string 	ID of the user or group 	Yes
amount 	Integer 	Tokens to add (positive) or deduct (negative) 	Yes

Success Response:

    Status: 200 OK

{
  "id": "uuid",
  "holderType": "USER",
  "userId": "uuid",
  "groupId": null,
  "balance": 50,
  "updatedAt": "2025-05-17T20:00:00.000Z"
}

Error Responses:

    400 Bad Request - Validation errors or negative balance attempt.
    401 Unauthorized - Missing or invalid token.
    500 Internal Server Error - Server issues.

Get Token Balance

GET /token-balance

Description: Retrieve the current token balance of a user or group.

Authorization: Required (JWT Bearer Token)

Query Parameters:
Parameter 	Type 	Description 	Required
holderType 	"USER" or "GROUP" 	Holder type 	Yes
holderId 	UUID string 	User or group ID 	Yes

Success Response:

    Status: 200 OK

{
  "balance": 50
}

Authentication

All endpoints require the HTTP header:

Authorization: Bearer <JWT_token>

Use your authentication API to obtain a valid JWT token before making requests to these endpoints.
Notes

    All UUIDs must be in valid RFC4122 format.
    The points and amount values must be integers; negative increments are permitted only if resulting values do not become negative.
    locationScope, constituency, and county are optional but should align with your community's hierarchy and data validation rules.
