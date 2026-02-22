# UjamaaDAO Project Module Documentation

> **Module status:** `partial` — project routes not yet mounted in `app.ts`, no tests written.
> Expected base URL: `/api/v1/projects`

## Overview

The Project module manages the lifecycle of projects created from approved proposals within UjamaaDAO. It allows creating, reading, updating, listing, and deleting projects. Projects encapsulate higher-level metadata and link to milestones for phased progress and funding.

### Core Features

- Create projects from approved proposals
- Retrieve project details by ID
- List projects with optional filtering and pagination
- Update project metadata and status
- Delete projects securely

### Business Rules

- Projects can only be created from proposals in `APPROVED` status
- Updates and deletions require existing projects and appropriate authorization
- Projects maintain location and budgeting information aligned with originating proposals

---

## API Reference

### Base URL

`/api/v1/projects`

---

### POST `/`

Create a new project from an approved proposal.

- **Auth required:** Yes (JWT)
- **Request Body:**

```json
{
  "proposalId": "UUID",
  "title": "string (min 3 char)",
  "description": "string (min 5 char)",
  "budget": "integer (≥ 0, optional)",
  "timeline": "string (optional)"
}

    Responses:
        201 Created – Returns created project object.
        400 Bad Request – Validation errors or proposal not approved.
        401 Unauthorized – Missing or invalid authentication.
        404 Not Found – Proposal does not exist.

GET /:id

Get a project by its ID.

    Auth required: Yes
    Path Parameters:
        id: Project UUID
    Responses:
        200 OK – Project object including linked proposal, participants, and milestones.
        401 Unauthorized – Missing or invalid authentication.
        404 Not Found – Project id not found.

GET /

List projects with optional filters.

    Auth required: Yes
    Query Parameters:
        status (optional): Filter by project status (ACTIVE, COMPLETED, etc.)
        constituency (optional): Filter projects by constituency
        county (optional): Filter projects by county
        limit (optional, default 20): Number of records per page (max 100)
        offset (optional, default 0): Number of records to skip
    Responses:
        200 OK – Array of project objects.
        401 Unauthorized – Missing or invalid authentication.

PATCH /:id

Update a project partially.

    Auth required: Yes
    Path Parameters:
        id: Project UUID
    Request Body: Partial project properties to update

{
  "title": "string (optional)",
  "description": "string (optional)",
  "budget": "integer (optional)",
  "timeline": "string (optional)",
  "status": "string enum (optional)"
}

    Responses:
        200 OK – Updated project object.
        400 Bad Request – Validation errors.
        401 Unauthorized
        404 Not Found

DELETE /:id

Delete a project.

    Auth required: Yes
    Path Parameters:
        id: Project UUID
    Responses:
        204 No Content – Successfully deleted.
        401 Unauthorized
        404 Not Found

Errors
Code 	Error 	Description
400 	ValidationError 	Input fields did not meet schema requirements
401 	Unauthorized 	Authentication failure or missing token
403 	Forbidden 	Insufficient permissions (not typical here)
404 	Not Found 	Requested resource does not exist
500 	Internal Server Error 	Unexpected server error