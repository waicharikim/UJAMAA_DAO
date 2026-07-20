/**
 * @file src/modules/treasury/types.ts
 * Treasury module DTOs and types
 */

export interface TreasuryDto {
  id: string;
  groupId: string;
  groupName: string;
  balance: number;
  tokenBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransactionDto {
  id: string;
  treasuryId: string;
  amount: number;
  currency: string;
  transactionType: 'CREDIT' | 'DEBIT';
  description: string | null;
  referenceType: string | null;
  proposalId: string | null;
  projectId: string | null;
  initiatedById: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
}

export interface TransactionListDto {
  transactions: WalletTransactionDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DepositDto {
  amount: number;
  description?: string;
  referenceType?: string;
  proposalId?: string;
  projectId?: string;
}

export interface WithdrawDto {
  amount: number;
  description?: string;
  referenceType?: string;
  proposalId?: string;
  projectId?: string;
}

export interface TransactionQueryDto {
  page?: number;
  limit?: number;
  transactionType?: 'CREDIT' | 'DEBIT';
  referenceType?: string;
  fromDate?: string;
  toDate?: string;
}

export interface AllocationSplit {
  WARD: number;
  CONSTITUENCY: number;
  COUNTY: number;
  NATIONAL: number;
}
