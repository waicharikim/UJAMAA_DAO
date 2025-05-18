# UjamaaDAO Proposal Module - High-Level Documentation

## Overview
The Proposal module handles creation, updating, retrieval, and validation of governance proposals. Supports both individual user and group proposals with business rules to ensure eligibility and correctness.

## Features
- Create and manage proposals for users and groups
- Enforce impact point and backing eligibility
- Support multiple geographic scopes and privacy options
- Link proposals to projects and votes

## Data Model
- `Proposal` entity with fields like:
  - `title`, `description`, `proposalType`
  - `funded` (boolean), `budget`, `timeline`
  - `locationScope` (LOCAL, CONSTITUENCY, COUNTY, NATIONAL), `constituency`, `county`
  - `isPrivate`, `creatorUserId`, `creatorGroupId`, `status`
- Group impact points computed from members’ points

## Business Rules
- Users require minimum impact points per scope (1000 for constituency, etc.)
- Funded company proposals require backing community group in same constituency
- County groups have limited scopes for proposal creation
- Proposal privacy and location fields validated consistently

## Example Usage
```ts
const proposal = await ProposalService.createProposal({
  title: 'Community Education Project',
  description: 'Improving education outcomes.',
  proposalType: 'NON_PROFIT',
  funded: true,
  budget: 50000,
  locationScope: 'CONSTITUENCY',
  constituency: 'Nairobi West',
  isPrivate: false,
  creatorGroupId: 'group-uuid',
});