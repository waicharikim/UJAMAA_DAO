// ============================================================================
// UJAMAADAO BASE SCHEMA - Core Shared Models
// ============================================================================

generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// SHARED ENUMS
// ============================================================================

enum LocationScope {
  WARD
  CONSTITUENCY
  COUNTY
  NATIONAL
}

enum HolderType {
  USER
  GROUP
}

enum TransactionType {
  DEPOSIT
  WITHDRAWAL
  SPEND
  REFUND
  ADJUSTMENT
}

enum TransactionStatus {
  PENDING
  COMPLETED
  FAILED
  CANCELLED
}

enum VerificationLevel {
  UNVERIFIED
  EMAIL_VERIFIED
  PHONE_VERIFIED
  COMMUNITY_VERIFIED
  LOCATION_VERIFIED
  FULL_VERIFIED
}

enum ImpactPointReason {
  SIGNUP_BONUS
  EMAIL_VERIFIED
  PHONE_VERIFIED
  PROFILE_COMPLETED
  COMMUNITY_VERIFIED
  LOCATION_VERIFIED
  WALLET_CONNECTED
  TEMPORARY_CHECKIN
  WARD_MEETING_ATTENDED
  PROJECT_CONTRIBUTION
  PROPOSAL_VOTE
  DUES_PAID
  EDUCATION_COMPLETED
  PHYSICAL_WORK_VERIFIED
  MANUAL_ADJUSTMENT
}

enum ImpactPointScope {
  GLOBAL
  WARD
  CONSTITUENCY
  COUNTY
}

enum ImpactPointType {
  LOCATION_BASED
  SYSTEM
}

enum GroupStatus {
  FORMING
  ACTIVE
  SUSPENDED
  INACTIVE
  DISSOLVED
  MERGED
}

enum GroupRole {
  MEMBER
  LEADER
  TREASURER
  AUDITOR
  FACILITATOR
  MENTOR
}


enum MembershipStatus {
  INACTIVE
  GRACE_PERIOD
  ACTIVE
  SUSPENDED
}

enum ElectionType {
  WARD_ADMIN
  CONSTITUENCY_ADMIN
  COUNTY_ADMIN
  GROUP_LEADER
  GROUP_TREASURER
  GROUP_AUDITOR
}

enum ElectionStatus {
  NOMINATION
  VOTING
  COUNTING
  COMPLETED
  CANCELLED
}

// ============================================================================
// GEOGRAPHIC MODELS
// ============================================================================

model County {
  id             String         @id @default(uuid()) @db.Uuid
  code           String         @unique
  name           String         @unique
  constituencies Constituency[]
  wards          Ward[]
  groups         Group[]        @relation("CountyGroups")
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
}

model Constituency {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  countyId  String   @db.Uuid
  county    County   @relation(fields: [countyId], references: [id], onDelete: Cascade)
  wards     Ward[]
  groups    Group[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([name, countyId])
  @@index([countyId])
}

model Ward {
  id             String       @id @default(uuid()) @db.Uuid
  name           String
  code           String?      @unique
  constituencyId String       @db.Uuid
  countyId       String       @db.Uuid
  constituency   Constituency @relation(fields: [constituencyId], references: [id], onDelete: Cascade)
  county         County       @relation(fields: [countyId], references: [id], onDelete: Cascade)

  // Relations
  groups                Group[]                     @relation("GroupWard")
  primaryUsers          User[]                      @relation("PrimaryWard")
  secondaryUsers        User[]                      @relation("SecondaryWard")
  currentLocationUsers  User[]                      @relation("CurrentLocation")
  locationImpacts       UserLocationImpact[]
  communityAssets       CommunityAsset[]
  marketplaceListings   MarketplaceListing[]
  newWardRequests       ResidenceChangeRequest[]    @relation("NewWardRequests")
  oldWardRequests       ResidenceChangeRequest[]    @relation("OldWardRequests")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([constituencyId])
  @@index([countyId])
}

// ============================================================================
// INDUSTRY MODELS
// ============================================================================

model Industry {
  id             String          @id @default(uuid()) @db.Uuid
  name           String          @unique
  userIndustries UserIndustry[]
  goodsServices  GoodsService[]
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
}

model GoodsService {
  id          String             @id @default(uuid()) @db.Uuid
  name        String
  description String?
  industryId  String             @db.Uuid
  category    String?
  active      Boolean            @default(true)
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
  industry    Industry           @relation(fields: [industryId], references: [id], onDelete: Cascade)
  userGoods   UserGoodsService[]

  @@unique([name, industryId])
  @@index([industryId, active])
}

// ============================================================================
// USER MODEL
// ============================================================================

model User {
  id            String  @id @default(uuid()) @db.Uuid
  walletAddress String? @unique
  email         String? @unique
  name          String?
  phoneNumber   String? @unique

  primaryWardId        String?   @db.Uuid
  secondaryWardId      String?   @db.Uuid
  currentLocationId    String?   @db.Uuid
  currentLocationUntil DateTime?

  primaryWard   Ward? @relation("PrimaryWard", fields: [primaryWardId], references: [id], onDelete: Restrict)
  secondaryWard Ward? @relation("SecondaryWard", fields: [secondaryWardId], references: [id], onDelete: Restrict)
  currentWard   Ward? @relation("CurrentLocation", fields: [currentLocationId], references: [id], onDelete: Restrict)

  avatarUrl String?
  nonce     String?

  verificationLevel VerificationLevel @default(UNVERIFIED)
  emailVerified     Boolean           @default(false)
  phoneVerified     Boolean           @default(false)
  communityVerified Boolean           @default(false)
  locationVerified  Boolean           @default(false)

  isActive     Boolean @default(true)
  tokenVersion Int     @default(0)

  membershipStatus  MembershipStatus @default(INACTIVE)
  lastDuesPayment   DateTime?
  nextDueDate       DateTime?
  gracePeriodEndsAt DateTime?

  globalImpactPoints  Int       @default(0)
  utilityTokens       Int       @default(0)
  participationRights Int       @default(0)
  lastPRReset         DateTime?
  prWarningsSent      Int       @default(0)
  duesOverdueMonths   Int       @default(0)

  lastLoginAt    DateTime?
  metadata       Json?
  recoveryWallet String?   @unique

  onboardingCompletedAt DateTime?

  // All relations
  userRoles                       UserRole[]
  sessions                        Session[]
  accounts                        Account[]
  recoveryRequests                RecoveryRequest[]
  loginEvents                     LoginEvent[]
  emailTokens                     EmailVerificationToken[]
  residenceChangeRequests         ResidenceChangeRequest[]    @relation("UserResidenceRequests")
  reviewedResidenceRequests       ResidenceChangeRequest[]    @relation("ResidenceRequestReviewer")
  industries                      UserIndustry[]
  goodsServices                   UserGoodsService[]
  privacySettings                 UserPrivacySettings?
  accessibility                   UserAccessibility?
  onboardingProgress              OnboardingProgress?
  tutorialCompletions             UserTutorialCompletion[]
  milestones                      OnboardingMilestone[]
  impactLogs                      ImpactPointLog[]
  locationImpacts                 UserLocationImpact[]
  prLogs                          ParticipationRightsLog[]
  duesPayments                    DuesPayment[]
  groupMemberships                GroupMember[]
  createdProposals                Proposal[]                  @relation("UserProposals")
  votes                           GroupMemberVote[]           @relation("UserVotes")
  workLogs                        PhysicalWorkLog[]
  workVerifications               WorkVerification[]          @relation("WorkVerifier")
  createdModules                  EducationalModule[]
  educationalProgress             UserEducationalProgress[]
  educationalReviews              EducationalReview[]
  reportedEmergencies             EmergencyAlert[]
  emergencyResponses              EmergencyResponse[]
  conflictsAsComplainant          ConflictCase[]              @relation("Complainant")
  conflictsAsRespondent           ConflictCase[]              @relation("Respondent")
  marketplaceListings             MarketplaceListing[]        @relation("UserListings")
  marketplacePurchases            MarketplaceTransaction[]    @relation("Buyer")
  marketplaceSales                MarketplaceTransaction[]    @relation("Seller")
  marketplaceReviews              MarketplaceReview[]         @relation("Reviewer")
  notifications                   Notification[]
  notificationPreferences         NotificationPreference[]
  audits                          UserAudit[]
  consents                        UserConsent[]
  feedback                        PlatformFeedback[]
  comments                        Comment[]
  organizedEvents                 Event[]
  eventAttendances                EventAttendee[]
  engagementMetrics               UserEngagementMetric[]
  milestoneVerifications          MilestoneVerifier[]         @relation("MilestoneVerifier_Verifier")
  milestoneAssignments            MilestoneVerifier[]         @relation("MilestoneVerifier_AssignedBy")
  projectMemberships              ProjectMember[]
  ownedProjects                   Project[]                   @relation("UserProjects") // UPDATED relation name
  assignedTasks                   Task[]
  createdEscrows                  Escrow[]
  escrowReleases                  EscrowRelease[]
  treasuryAudits                  TreasuryAudit[]
  walletTransactionsInitiated     WalletTransaction[]         @relation("WalletTransaction_InitiatedBy")
  walletTransactionsProcessed     WalletTransaction[]         @relation("WalletTransaction_ProcessedBy")
  electionCandidacies             ElectionCandidate[]         @relation("ElectionCandidate")
  electionVotes                   ElectionVote[]              @relation("ElectionVoter")
  endorsementsGiven               Endorsement[]               @relation("Endorser")
  wonElections                    Election[]                  @relation("ElectionWinner")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([walletAddress])
  @@index([email])
  @@index([primaryWardId])
  @@index([verificationLevel])
  @@index([isActive])
  @@index([membershipStatus])
  @@index([nextDueDate])
}


// ============================================================================
// RBAC MODELS
// ============================================================================

// ============================================================================
// UPDATED ROLE MODEL - Add election relation
// ============================================================================

model Role {
  id              Int              @id @default(autoincrement())
  name            String           @unique
  namespace       String?
  builtin         Boolean          @default(false)
  description     String?
  
  isElected            Boolean  @default(false)
  electableBy          String?
  termLengthMonths     Int?
  maxConsecutiveTerms  Int?
  
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  
  userRoles       UserRole[]
  rolePermissions RolePermission[]
  elections       Election[]

  @@index([isElected])
}

model UserRole {
  id         String    @id @default(uuid()) @db.Uuid
  userId     String    @db.Uuid
  roleId     Int
  scope      String?
  active     Boolean   @default(true)
  assignedBy String?   @db.Uuid
  assignedAt DateTime  @default(now())
  expiresAt  DateTime?
  
  electionId String?   @db.Uuid
  termNumber Int       @default(1)
  
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([userId, roleId, scope])
  @@index([roleId, scope])
  @@index([userId, active])
  @@index([expiresAt])
  @@index([electionId])
}

model RolePermission {
  id          String   @id @default(uuid()) @db.Uuid
  roleId      Int
  permission  String
  description String?
  createdAt   DateTime @default(now())

  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([roleId, permission])
  @@index([permission])
}

// ============================================================================
// ECONOMY MODELS
// ============================================================================

model WalletBalance {
  id         String              @id @default(uuid()) @db.Uuid
  holderType HolderType
  userId     String?             @db.Uuid
  groupId    String?             @db.Uuid
  balance    Decimal             @db.Decimal(20, 2) @default(0)
  currency   String              @default("KES")
  updatedAt  DateTime            @updatedAt
  transactions WalletTransaction[]

  @@unique([holderType, userId], name: "holderType_userId_wallet")
  @@unique([holderType, groupId], name: "holderType_groupId_wallet")
  @@index([userId])
  @@index([groupId])
}

model TokenBalance {
  id         String     @id @default(uuid()) @db.Uuid
  holderType HolderType
  userId     String?    @db.Uuid
  groupId    String?    @db.Uuid
  balance    Int        @default(0)
  tokenType  String     @default("UTILITY")

  @@unique([holderType, userId, tokenType])
  @@unique([holderType, groupId, tokenType])
  @@index([userId])
  @@index([groupId])
}

// ============================================================================
// UPDATED WALLET TRANSACTION - Add proposal relation
// ============================================================================

model WalletTransaction {
  id                String            @id @default(uuid()) @db.Uuid
  
  treasuryId        String?           @db.Uuid
  walletBalanceId   String?           @db.Uuid
  
  type              TransactionType
  action            TreasuryAction?
  amount            Decimal           @db.Decimal(20, 2)
  currency          String            @default("KES")
  status            TransactionStatus @default(PENDING)
  
  reference         String?
  mpesaReceipt      String?
  description       String?
  metadata          Json?
  
  initiatedById     String?           @db.Uuid
  processedById     String?           @db.Uuid
  
  relatedProposalId String?           @db.Uuid
  relatedProjectId  String?           @db.Uuid
  
  // RELATIONS
  treasury          GroupTreasury?    @relation("GroupTreasuryTransactions", fields: [treasuryId], references: [id])
  walletBalance     WalletBalance?    @relation(fields: [walletBalanceId], references: [id], onDelete: Cascade)
  initiatedBy       User?             @relation("WalletTransaction_InitiatedBy", fields: [initiatedById], references: [id])
  processedBy       User?             @relation("WalletTransaction_ProcessedBy", fields: [processedById], references: [id])
  relatedProposal   Proposal?         @relation("ProposalTransactions", fields: [relatedProposalId], references: [id]) // UPDATED
  relatedProject    Project?          @relation("ProjectTransactions", fields: [relatedProjectId], references: [id]) // UPDATED
  
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  
  @@index([treasuryId])
  @@index([walletBalanceId])
  @@index([initiatedById])
  @@index([processedById])
  @@index([reference])
  @@index([mpesaReceipt])
  @@index([status, createdAt])
  @@index([relatedProposalId])
  @@index([relatedProjectId])
  @@index([type, status])
}



// ============================================================================
// IMPACT POINTS MODELS
// ============================================================================

model ImpactPointLog {
  id                String            @id @default(cuid())
  userId            String            @db.Uuid
  amount            Decimal           @db.Decimal(18, 4)
  reason            ImpactPointReason
  scope             ImpactPointScope  @default(GLOBAL)
  scopedId          String?           @db.Uuid
  relatedEntityType String?
  relatedEntityId   String?
  awardedBy         String?           @db.Uuid
  metadata          Json?
  awardedAt         DateTime          @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, awardedAt])
  @@index([scope, scopedId])
  @@index([reason])
}

model UserLocationImpact {
  id           String          @id @default(uuid()) @db.Uuid
  userId       String          @db.Uuid
  wardId       String          @db.Uuid
  impactPoints Int             @default(0)
  tier         String
  type         ImpactPointType @default(LOCATION_BASED)
  lastActivity DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  ward Ward @relation(fields: [wardId], references: [id], onDelete: Cascade)

  @@unique([userId, wardId])
  @@index([wardId, impactPoints])
  @@index([userId, lastActivity])
}

// ============================================================================
// SYSTEM CONFIGURATION
// ============================================================================

model SystemConfiguration {
  id          String   @id @default(uuid()) @db.Uuid
  key         String   @unique
  value       Json
  category    String // GOVERNANCE, ECONOMY, REPUTATION, SECURITY
  description String?
  dataType    String // NUMBER, STRING, JSON, BOOLEAN
  isPublic    Boolean  @default(false)
  updatedBy   String?  @db.Uuid
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([category])
  @@index([isPublic])
}


// ============================================================================
// ELECTION MODELS (Complete)
// ============================================================================

model Election {
  id              String         @id @default(uuid()) @db.Uuid
  electionType    ElectionType
  
  scope           String
  scopeId         String         @db.Uuid
  groupId         String?        @db.Uuid
  
  roleId          Int
  roleName        String
  
  status          ElectionStatus @default(NOMINATION)
  
  nominationStartDate  DateTime
  nominationEndDate    DateTime
  votingStartDate      DateTime
  votingEndDate        DateTime
  
  quorumRequired       Decimal  @db.Decimal(3, 2)
  minimumEndorsements  Int
  
  minVerificationLevel VerificationLevel
  minImpactPoints      Int
  minMembershipMonths  Int
  requiresDues         Boolean  @default(true)
  
  winnerId        String?  @db.Uuid
  totalVotes      Int      @default(0)
  totalEligible   Int      @default(0)
  quorumMet       Boolean  @default(false)
  
  termStartDate   DateTime?
  termEndDate     DateTime?
  termLengthMonths Int     @default(12)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // RELATIONS
  group           Group?              @relation(fields: [groupId], references: [id], onDelete: Cascade)
  role            Role                @relation(fields: [roleId], references: [id], onDelete: Cascade)
  winner          User?               @relation("ElectionWinner", fields: [winnerId], references: [id], onDelete: SetNull)
  candidates      ElectionCandidate[]
  votes           ElectionVote[]
  
  @@index([status, votingEndDate])
  @@index([scopeId])
  @@index([groupId])
  @@index([electionType])
  @@index([winnerId])
  @@index([roleId])
}

model ElectionCandidate {
  id          String   @id @default(uuid()) @db.Uuid
  electionId  String   @db.Uuid
  userId      String   @db.Uuid
  
  statement   String   @db.Text
  experience  String?  @db.Text
  manifesto   String?  @db.Text
  
  endorsed           Boolean  @default(false)
  endorsementCount   Int      @default(0)
  minimumEndorsements Int
  
  votesReceived      Int      @default(0)
  votePercentage     Decimal? @db.Decimal(5, 2)
  
  approved           Boolean  @default(false)
  withdrawn          Boolean  @default(false)
  withdrawnAt        DateTime?
  withdrawalReason   String?
  
  nominatedAt DateTime @default(now())
  approvedAt  DateTime?
  
  election    Election     @relation(fields: [electionId], references: [id], onDelete: Cascade)
  user        User         @relation("ElectionCandidate", fields: [userId], references: [id], onDelete: Cascade)
  endorsements Endorsement[]
  votes       ElectionVote[]
  
  @@unique([electionId, userId])
  @@index([electionId, endorsed])
  @@index([userId])
}

model ElectionVote {
  id           String   @id @default(uuid()) @db.Uuid
  electionId   String   @db.Uuid
  voterId      String   @db.Uuid
  candidateId  String   @db.Uuid
  
  voteWeight   Int      @default(1)
  
  ipAddress    String?
  votedAt      DateTime @default(now())
  
  election  Election          @relation(fields: [electionId], references: [id], onDelete: Cascade)
  voter     User              @relation("ElectionVoter", fields: [voterId], references: [id], onDelete: Cascade)
  candidate ElectionCandidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  
  @@unique([electionId, voterId])
  @@index([electionId])
  @@index([candidateId])
  @@index([voterId])
}

model Endorsement {
  id          String   @id @default(uuid()) @db.Uuid
  candidateId String   @db.Uuid
  endorserId  String   @db.Uuid
  comment     String?  @db.Text
  createdAt   DateTime @default(now())
  
  candidate ElectionCandidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  endorser  User              @relation("Endorser", fields: [endorserId], references: [id], onDelete: Cascade)
  
  @@unique([candidateId, endorserId])
  @@index([candidateId])
  @@index([endorserId])
}



