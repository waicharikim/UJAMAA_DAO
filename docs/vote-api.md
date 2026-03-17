# UjamaaDAO Voting Module Documentation

> **Module status:** `tested` — governance (voting) routes at `/api/v1/governance` (58 tests).
> Individual PR-weighted votes live. `castVote`, `tallyVotes`, `startVoting` all tested.

## Overview

The Voting module manages the casting, validation, and tallying of votes within UjamaaDAO’s governance system. It supports both individual votes and group block votes, enforces eligibility rules based on impact points and token balances, and ensures proper quorum and consensus in group voting.

---

## Core Concepts

- **Individual Votes:**  
  - Users cast votes directly on proposals, spending tokens as a cost.  
  - User vote eligibility is based on impact points and geographic participation.  
  - Duplicate voting by the same user on the same proposal is prevented.

- **Group Block Votes:**  
  - Groups vote collectively as a single block once their internal member votes achieve quorum and consensus.  
  - Quorum requires at least 75% of active members to participate.  
  - Consensus requires at least 68% of votes to agree on the same option.  
  - Duplicate group block voting on the same proposal is prevented.

- **Token Usage:**  
  - Tokens are spent when individuals cast votes (token balance checked and deducted).  
  - Group block votes do not directly spend tokens but represent aggregated membership votes.

---

## API Endpoints

### Cast Individual Vote

`POST /api/v1/governance/votes/individual`

- **Headers:**  
  `Authorization: Bearer <JWT>`

- **Body:**
  ```json
  {
    "proposalId": "string (UUID)",
    "vote": true | false,
    "tokensSpent": number (integer >=0)
  }

    Responses:
        201 Created — Vote recorded successfully
        403 Forbidden — Insufficient tokens or voting ineligible
        409 Conflict — User has already voted on this proposal
        400 Bad Request — Validation errors
        401 Unauthorized — Missing or invalid authentication

Cast Group Block Vote

POST /api/v1/governance/votes/group

    Headers:
    Authorization: Bearer <JWT>

    Body:

    {
      "proposalId": "string (UUID)",
      "groupId": "string (UUID)",
      "vote": true | false
    }

    Responses:
        201 Created — Group vote recorded
        403 Forbidden — Quorum or consensus not met
        409 Conflict — Group already voted
        400 Bad Request — Validation errors
        401 Unauthorized — Missing or invalid authentication

Get Vote Tally

GET /api/v1/governance/votes/{proposalId}/tally

    Headers:
    Authorization: Bearer <JWT>

    Responses:
        200 OK — JSON object with vote counts

    {
      "individualYes": number,
      "individualNo": number,
      "groupYes": number,
      "groupNo": number,
      "totalYes": number,
      "totalNo": number,
      "totalVotes": number
    }

        404 Not Found — Proposal not found
        401 Unauthorized — Missing or invalid authentication

Business Rules

    Voting Eligibility:
    Individual voters must have sufficient impact points and meet geographic criteria associated with the proposal.
    Token Spending:
    Individuals must hold enough tokens to cover the cost of their vote; tokens are deducted when voting.
    Group Voting:
    Internal group members cast votes that are tracked separately; once internal quorum (≥75%) and consensus (≥68%) are met, the group casts a block vote.
    Duplicate Votes:
    Both individual and group block duplicate votes are rejected with a 409 error.

Error Codes
Code 	Meaning
400 	Bad Request — Input validation failed
401 	Unauthorized — Missing or invalid token
403 	Forbidden — Eligibility or token balance fail
409 	Conflict — Duplicate vote
500 	Internal Server Error
Example Request — Cast Individual Vote

curl -X POST http://localhost:4000/api/v1/governance/votes/individual \
-H "Authorization: Bearer <token>" \
-H "Content-Type: application/json" \
-d '{
  "proposalId": "abcde-12345-xyz",
  "vote": true,
  "tokensSpent": 5
}'

Example Response

{
  "id": "vote-uuid",
  "proposalId": "abcde-12345-xyz",
  "voterId": "user-uuid",
  "isGroup": false,
  "vote": true,
  "tokensSpent": 5,
  "createdAt": "2025-05-18T12:00:00.000Z"
}