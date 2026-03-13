/**
 * @file src/modules/notifications/types.ts
 * @description
 * Notifications Module Types
 * Version: 2.0 — December 2025
 */

export enum NotificationType {
  DUES_REMINDER = 'DUES_REMINDER',
  DUES_OVERDUE = 'DUES_OVERDUE',
  PROPOSAL_NEW = 'PROPOSAL_NEW',
  PROPOSAL_VOTING_STARTED = 'PROPOSAL_VOTING_STARTED',
  PROPOSAL_VOTE_CAST = 'PROPOSAL_VOTE_CAST',
  PROPOSAL_PASSED = 'PROPOSAL_PASSED',
  MARKETPLACE_NEW_MESSAGE = 'MARKETPLACE_NEW_MESSAGE',
  PROJECT_MILESTONE_SUBMITTED = 'PROJECT_MILESTONE_SUBMITTED',
  PROJECT_MILESTONE_VERIFIED = 'PROJECT_MILESTONE_VERIFIED',
  ONBOARDING_TUTORIAL_COMPLETE = 'ONBOARDING_TUTORIAL_COMPLETE',
  GENERAL_ANNOUNCEMENT = 'GENERAL_ANNOUNCEMENT',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  IN_APP = 'IN_APP',
  PUSH = 'PUSH',
}

export interface SendNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: NotificationChannel[];
}

export interface NotificationResponseDto {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
