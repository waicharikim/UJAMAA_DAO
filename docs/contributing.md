# Contributing to UjamaaDAO

Thank you for your interest in contributing to UjamaaDAO! We welcome contributions from the community that help improve the platform’s security, functionality, documentation, and user experience.

This document outlines our guidelines and best practices to help you contribute effectively while keeping the codebase consistent and maintainable.

---

## Table of Contents

- [How to Contribute](#how-to-contribute)  
- [Code of Conduct](#code-of-conduct)  
- [Getting Started](#getting-started)  
- [Branching and Workflow](#branching-and-workflow)  
- [Coding Guidelines](#coding-guidelines)  
- [Commit Messages](#commit-messages)  
- [Testing](#testing)  
- [Documentation](#documentation)  
- [Reporting Issues](#reporting-issues)  
- [Communication](#communication)  

---

## How to Contribute

Contributions can take many forms:

- Bug reports and feature requests
- Code contributions (features, bug fixes, refactors)
- Improving or adding documentation
- Writing tests or improving test coverage
- Help with triaging issues or answering questions

To contribute, please fork the repository and create a feature branch for your work.

---

## Code of Conduct

Please adhere to high standards of respect, inclusion, and professionalism. We expect all contributors to follow the [Code of Conduct](CODE_OF_CONDUCT.md) (if separate).

Be respectful when giving and receiving feedback.

---

## Getting Started

1. **Fork and Clone**  
   Fork the repo on GitHub, then clone locally:

```bash
   git clone https://github.com/your-username/ujamaadao.git
   cd ujamaadao
```
2. **Set up local environment**
    Follow the instructions in README.md to install dependencies, configure .env, and run the backend/docker environment.

3. **Run tests**
    Make sure everything is working before starting:
```bash
    npm install
    npx prisma migrate dev
    npm run dev
    npx vitest run --threads=false
```
## Branching and Workflow

- Use the main branch for stable, production-ready code only.
- Create feature branches from main named with a clear prefix, e.g., feature/, fix/, or chore/.
- Example: feature/group-membership-management
- Open a pull request (PR) against main once your work is ready for review.
- PRs should be small, focused, and contain clear descriptions.
- Ensure your branch is up to date with the latest main before merging.

## Coding Guidelines

- Use TypeScript and follow existing project patterns.

- Formatting & linting:

    - Use Prettier and ESLint as configured. Run:
```bash
        npm run lint
        npm run lint:fix
```
- Comments and Documentation:
    - Write clear JSDoc/TSDoc comments for all public functions and complex logic.
    - Add or update documentation in /docs/ for any new APIs or features.

- Error Handling:
    - Use the ApiError class for any throw-able HTTP errors with meaningful messages and status codes.

- Logging:
    - Use the centralized logger utility instead of console.log.
    - Log at appropriate levels (info, warn, error).

## Commit Messages

- Use Conventional Commits style for commit messages.

    - Examples:
        ```bash
        feat(auth): add wallet-signature login endpoint
        fix(user): handle case-insensitive wallet address matching
        docs(group): add API docs for group membership
        test(voting): add unit tests for quorum calculation
        chore(deps): update pino logger to v8
        ```

    - Use present tense and be clear and concise.

    - Separate subject and body with blank line if needed.

## Testing

- Write tests for any new features or bug fixes.

- Existing code is tested with Vitest and Supertest.

- Run tests locally before submitting:
```bash
    npx vitest run
```
- Ensure no warnings or errors.

- Tests should be deterministic and isolated; use database cleanup hooks.

## Documentation

- Update or add API documentation in /docs/.
- Keep architecture and environment documents current.
- Document any new environment variables, build or deployment steps.
- Consider generating OpenAPI specs for new endpoints.

## Reporting Issues

- Use GitHub Issues to report bugs, suggest features, or ask questions.
- Provide clear, concise descriptions and reproduction steps if possible.
- Attach logs or screenshots if helpful.

## Communication

- Use your organization’s preferred communication channels (Slack, Discord, email).
- Engage respectfully and constructively.
- Ask for help or clarification if unsure about any process or code.

Thank you for helping make UjamaaDAO secure, robust, and community-driven!

This file is maintained by the core development team.


---