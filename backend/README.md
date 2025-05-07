# UjamaaDAO Backend Service

Welcome to the backend API service for **UjamaaDAO** — a decentralized governance and project management platform.

This backend handles user and group management, proposals, voting, project participation, token and impact point logic, and blockchain interactions.

---

## Table of Contents

- [Project Setup](#project-setup)  
- [Running the Server](#running-the-server)  
- [API Documentation](#api-documentation)  
  - [User Management](#user-management)  
    - [Register New User](#register-new-user)  
- [Code Style and Conventions](#code-style-and-conventions)  
- [Testing](#testing)  
- [Contributing](#contributing)  
- [License](#license)  

---

## Project Setup

### Prerequisites

- Node.js 20.x (LTS recommended)  
- npm (comes with Node.js)  
- PostgreSQL (if applicable for database)  
- Docker (optional, for containerized dev)

### Installation

Clone the repository and install dependencies:

git clone


Setup environment variables by copying `.env.example` to `.env` and editing as needed.

---

## Running the Server

- **Development mode with hot reload:**

npm run dev


- **Build and run production version:**

npm run build
npm start


The server listens on the port specified by the `PORT` environment variable (default is 4000).

Health check endpoint available at:

GET /health


---

## API Documentation

### User Management

#### Register New User

- **Endpoint:**  
  `POST /api/users/register`

- **Description:**  
  Registers a new individual user into the platform.

- **Request Body:**

| Field          | Type       | Required | Description                              |
|----------------|------------|----------|------------------------------------------|
| walletAddress  | `string`   | Yes      | Blockchain wallet address of user       |
| email          | `string`   | Yes      | Email address for contact and login     |
| name           | `string`   | Yes      | Full name of the user                    |
| constituency   | `string`   | Yes      | Constituency of residence                |
| county         | `string`   | Yes      | County of residence                      |
| industry       | `string`   | No       | Industry user identifies with           |
| goodsServices  | `string[]` | No       | Goods or services user offers            |

- **Responses:**

  - `201 Created`  

    ```
    {
      "success": true,
      "userId": "uuid-generated-id"
    }
    ```
  - `400 Bad Request`  

    ```
    {
      "success": false,
      "error": "Missing required fields: walletAddress, email, name, constituency, county"
    }
    ```
  - `500 Internal Server Error`  

    ```
    {
      "success": false,
      "error": "Internal server error"
    }
    ```

- **Notes:**

  - Wallet address format validation and duplicate user detection are planned features.
  - Inputs should be validated on both client and server sides.

---

## Code Style and Conventions

- **TypeScript** is used throughout the backend codebase.
- ESLint with `@typescript-eslint` plugin and Prettier is configured to enforce consistent style.
- Strict typing is enforced via `tsconfig.json`.
- JSDoc-style comments are required for all public functions and major modules.
  
---

## Testing

- Jest is used for unit and integration testing.
- Run tests with:

npm test


- Tests must be written alongside new features and aim for good coverage.

---

## Contributing

- Adhere to clear, descriptive commit messages (e.g., `feat`, `fix`, `docs`, `chore` prefixes).
- All code changes require code review and passing tests.
- Update documentation when adding or modifying APIs.

---

## License

MIT License — see the LICENSE file for details.

---

**End of backend README**