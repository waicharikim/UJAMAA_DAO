-- CreateTable
CREATE TABLE "GroupMemberVote" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "vote" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMemberVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupMemberVote_proposalId_groupId_userId_key" ON "GroupMemberVote"("proposalId", "groupId", "userId");

-- AddForeignKey
ALTER TABLE "GroupMemberVote" ADD CONSTRAINT "GroupMemberVote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMemberVote" ADD CONSTRAINT "GroupMemberVote_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMemberVote" ADD CONSTRAINT "GroupMemberVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
