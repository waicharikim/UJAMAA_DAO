-- CreateTable: elections module
-- Election, ElectionCandidate, ElectionVote

CREATE TABLE "elections" (
    "id"                 UUID         NOT NULL DEFAULT gen_random_uuid(),
    "roleKey"            TEXT         NOT NULL,
    "scope"              TEXT         NOT NULL,
    "groupId"            UUID,
    "countyId"           UUID,
    "status"             TEXT         NOT NULL DEFAULT 'PENDING',
    "nominationsOpenAt"  TIMESTAMP(3) NOT NULL,
    "nominationsCloseAt" TIMESTAMP(3) NOT NULL,
    "votingOpenAt"       TIMESTAMP(3) NOT NULL,
    "votingCloseAt"      TIMESTAMP(3) NOT NULL,
    "winnerId"           UUID,
    "totalVoteWeight"    INTEGER      NOT NULL DEFAULT 0,
    "quorumReached"      BOOLEAN      NOT NULL DEFAULT false,
    "termMonths"         INTEGER      NOT NULL DEFAULT 12,
    "nextElectionAt"     TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "elections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "election_candidates" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "electionId"  UUID         NOT NULL,
    "userId"      UUID         NOT NULL,
    "statement"   TEXT,
    "totalWeight" INTEGER      NOT NULL DEFAULT 0,
    "voteCount"   INTEGER      NOT NULL DEFAULT 0,
    "nominatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    CONSTRAINT "election_candidates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "election_votes" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "electionId"  UUID         NOT NULL,
    "candidateId" UUID         NOT NULL,
    "voterId"     UUID         NOT NULL,
    "weight"      INTEGER      NOT NULL,
    "castAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "election_votes_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "elections"
    ADD CONSTRAINT "elections_groupId_fkey"  FOREIGN KEY ("groupId")  REFERENCES "Group"(id)    ON DELETE SET NULL  ON UPDATE CASCADE,
    ADD CONSTRAINT "elections_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "counties"(id) ON DELETE SET NULL  ON UPDATE CASCADE,
    ADD CONSTRAINT "elections_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "users"(id)    ON DELETE SET NULL  ON UPDATE CASCADE;

ALTER TABLE "election_candidates"
    ADD CONSTRAINT "election_candidates_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"(id)          ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "election_candidates_userId_fkey"     FOREIGN KEY ("userId")     REFERENCES "users"(id)               ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "election_votes"
    ADD CONSTRAINT "election_votes_electionId_fkey"  FOREIGN KEY ("electionId")  REFERENCES "elections"(id)          ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "election_votes_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "election_candidates"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "election_votes_voterId_fkey"     FOREIGN KEY ("voterId")     REFERENCES "users"(id)               ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique constraints
ALTER TABLE "election_candidates" ADD CONSTRAINT "election_candidates_electionId_userId_key" UNIQUE ("electionId", "userId");
ALTER TABLE "election_votes"      ADD CONSTRAINT "election_votes_electionId_voterId_key"     UNIQUE ("electionId", "voterId");

-- Indexes
CREATE INDEX "elections_groupId_status_idx"       ON "elections"("groupId", "status");
CREATE INDEX "elections_scope_status_idx"         ON "elections"("scope", "status");
CREATE INDEX "elections_countyId_status_idx"      ON "elections"("countyId", "status");
CREATE INDEX "elections_votingCloseAt_idx"        ON "elections"("votingCloseAt");
CREATE INDEX "elections_nominationsOpenAt_idx"    ON "elections"("nominationsOpenAt");
CREATE INDEX "election_candidates_electionId_idx" ON "election_candidates"("electionId");
CREATE INDEX "election_candidates_userId_idx"     ON "election_candidates"("userId");
CREATE INDEX "election_votes_electionId_idx"      ON "election_votes"("electionId");
CREATE INDEX "election_votes_candidateId_idx"     ON "election_votes"("candidateId");
CREATE INDEX "election_votes_voterId_idx"         ON "election_votes"("voterId");
