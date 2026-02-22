
> **Module status:** `partial` — governance routes not yet mounted in `app.ts`, no tests written.
> Expected base URL: `/api/v1/governance`

```markdown
# UjamaaDAO Proposal Module - API Reference

## Base URL
`/api/v1/governance/proposals`

---

### POST `/api/v1/governance/proposals`

Create a new proposal.

- **Auth required:** Yes (User or Group with JWT)
- **Request Body:**
  ```json
  {
    "title": "string, min 5 chars",
    "description": "string, min 20 chars",
    "proposalType": "BUSINESS|NON_PROFIT|BILL",
    "funded": true|false,
    "budget": "integer, positive, required if funded",
    "timeline": "string, optional",
    "locationScope": "LOCAL|CONSTITUENCY|COUNTY|NATIONAL",
    "constituency": "string, required if CONSTITUENCY scope",
    "county": "string, required if COUNTY scope",
    "isPrivate": "boolean, default false",
    "purposeDetails": "JSON object, optional",
    "creatorUserId": "UUID, optional if authenticated user is creator",
    "creatorGroupId": "UUID, optional"
  }

    Responses:
        201 Created - Proposal created successfully; returns the proposal object.
        400 Bad Request - Validation failed; returns errors.
        403 Forbidden - User or group not eligible (e.g., insufficient impact points, no backing).
        401 Unauthorized - Missing or invalid authentication.

PATCH /api/v1/governance/proposals/:id

Update an existing proposal.

    Auth required: Yes
    Request Params:
        id - ID of proposal to update
    Request Body: Partial fields same as create
    Responses:
        200 OK - Updated proposal returned.
        400 Bad Request - Validation failed.
        404 Not Found - Proposal does not exist.

GET /api/v1/governance/proposals/:id

Retrieve a proposal by ID.

    Auth required: Yes (or varies based on privacy rules)
    Request Params:
        id - ID of the proposal
    Responses:
        200 OK - Proposal data with linked user/group info, votes, project.
        404 Not Found - Proposal missing.

Common Error Responses

    Errors returned as JSON objects:

    {
      "error": "Error message describing the failure"
    }

Authorization

    All endpoints require JWT token in Authorization: Bearer <token> header.
    User identity extracted from token to set creatorUserId if needed.
    Group proposals require appropriate group admin authorization.

Example cURL Request

curl -X POST http://localhost:4000/api/v1/governance/proposals \
-H "Authorization: Bearer <token>" \
-H "Content-Type: application/json" \
-d '{
  "title": "Build community library",
  "description": "A new library project to improve literacy.",
  "proposalType": "NON_PROFIT",
  "funded": true,
  "budget": 100000,
  "locationScope": "CONSTITUENCY",
  "constituency": "Nairobi West",
  "creatorUserId": "<user_uuid>"
}'


```markdown
# UjamaaDAO Proposal Module - Error Codes & Messages

| HTTP Status | Error Message                                                     | Description                                          |
|-------------|------------------------------------------------------------------|-----------------------------------------------------|
| 400         | "Budget must be specified for funded proposals"                  | Input validation failed; funded proposals need budget |
| 400         | "Constituency scope proposals must specify a constituency"       | Location validation error                            |
| 400         | "County scope proposals must specify a county"                   | Location validation error                            |
| 400         | "Local scope proposals cannot have constituency or county set"   | Location validation error for local proposals       |
| 400         | "National proposals cannot specify constituency or county"       | Location validation error for national proposals    |
| 400         | "A proposal must have either a creatorUserId or a creatorGroupId" | Missing creator identification                       |
| 400         | "Proposal cannot have both creatorUserId and creatorGroupId"     | Invalid creator assignment                           |
| 401         | "Authentication required if no creatorGroupId provided"          | Missing auth user for user-created proposals        |
| 403         | "User must have at least [X] impact points to create proposals at this level" | User does not meet impact points threshold     |
| 403         | "Funded company proposals require backing community group in the same constituency." | Company group not properly backed             |
| 403         | "County groups cannot create proposals at local or constituency level" | County group proposal scope restriction              |
| 404         | "Proposal not found"                                              | Requested proposal does not exist                    |
| 409         | "Group name already exists"                                       | Duplicate group name when creating groups (if involved) |

---