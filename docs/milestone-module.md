Overview

The Milestone module manages discrete phases within a project. Milestones have their own lifecycle allowing submission for review, approval, rejection, and tracking funding allocation and status.
Core Features

    Create milestones tied to projects
    Submit milestones for review by authorized users
    Approve or reject milestones
    Maintain milestone statuses and due dates
    Optionally trigger funding and reputation changes (future)

API Reference
Base URL

/api/milestones
POST /

Create a new milestone.

    Auth required: Yes
    Request Body:

{
  "projectId": "UUID",
  "title": "string (min 3 characters)",
  "description": "string (min 5 characters)",
  "dueDate": "ISO 8601 date string (optional)",
  "fundingAmount": "positive integer"
}

    Responses:
        201 Created – Milestone object.
        400 Bad Request – Validation errors or invalid funding.
        401 Unauthorized
        404 Not Found – Project does not exist.

POST /submit

Submit a milestone for review.

    Auth required: Yes
    Request Body:

{
  "milestoneId": "UUID"
}

    Responses:
        200 OK – Updated milestone with status UNDER_REVIEW.
        400 Bad Request – Invalid milestone state.
        401 Unauthorized
        404 Not Found

POST /review

Approve or reject a milestone after review.

    Auth required: Yes
    Request Body:

{
  "milestoneId": "UUID",
  "approved": true|false
}

    Responses:
        200 OK – Updated milestone with status APPROVED or REJECTED.
        400 Bad Request – Milestone not in review state.
        401 Unauthorized
        404 Not Found

Errors
Code 	Error 	Description
400 	ValidationError 	Input fields invalid or invalid milestone status
401 	Unauthorized 	Missing or invalid authentication token
403 	Forbidden 	Insufficient permissions or invalid actions
404 	Not Found 	Resource (Project or Milestone) does not exist
500 	Internal Server Error 	Server error