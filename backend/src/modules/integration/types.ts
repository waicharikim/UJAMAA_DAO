/**
 * @file src/modules/integration/types.ts
 * @description
 * Integration module types — Baraza messaging platform DTOs, job payloads, and Telegram types.
 */

export enum BotJobName {
  BARAZA_ATTENDANCE_REWARD = 'BARAZA_ATTENDANCE_REWARD',
  BARAZA_SEND_INVITE = 'BARAZA_SEND_INVITE',
  BARAZA_SESSION_REMINDER = 'BARAZA_SESSION_REMINDER',
  BARAZA_DEMAND_SCAN = 'BARAZA_DEMAND_SCAN',
}

// ─────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────

export interface RegisterBarazaGroupDto {
  groupId: string;
  platform: 'TELEGRAM' | 'WHATSAPP' | 'DISCORD';
  externalId: string;
  name: string;
  inviteLink?: string;
  metadata?: Record<string, unknown>;
}

export interface MarkAttendanceDto {
  platform: 'TELEGRAM' | 'WHATSAPP' | 'DISCORD';
  externalGroupId: string; // platform's chat ID → look up BarazaGroup
  sessionDate: string; // "YYYY-MM-DD"
  attendeeExternalIds: string[]; // platform user IDs
  facilitatorExternalId?: string;
  reportedBy?: string;
}

export interface BarazaGroupDto {
  id: string;
  groupId: string;
  platform: string;
  name: string;
  inviteLink?: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface AttendanceRecordDto {
  id: string;
  userId: string;
  barazaGroupId: string;
  sessionDate: string;
  prAwarded: boolean;
  prAmount: number;
}

// ─────────────────────────────────────────────
// Job payloads
// ─────────────────────────────────────────────

export interface BarazaAttendanceRewardJobData {
  attendanceId: string; // BarazaAttendance UUID — idempotency key
  userId: string;
  prAmount: number;
  reason: string; // ParticipationRightsReason value
  barazaGroupId: string;
  sessionDate: string;
}

export interface BarazaSendInviteJobData {
  userId: string;
  barazaGroupId: string;
  platform: 'TELEGRAM' | 'WHATSAPP' | 'DISCORD';
}

export interface BarazaSessionReminderJobData {
  barazaSessionId: string;
  barazaGroupId: string;
  chatId: string; // Telegram externalId (string representation)
}

export interface BarazaSessionDto {
  id: string;
  barazaGroupId: string;
  scheduledAt: Date;
  openedAt: Date | null;
  closedAt: Date | null;
  createdBy: string;
  createdAt: Date;
}

// ─────────────────────────────────────────────
// Telegram (minimal subset needed for attendance tracking)
// ─────────────────────────────────────────────

export interface TelegramUpdate {
  update_id: number;
  message?: {
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number; type: string };
    text?: string;
    reply_to_message?: {
      from?: { id: number; is_bot?: boolean; username?: string };
    };
    entities?: { type: string; offset: number; length: number }[];
  };
}

/** Bot identity (from getMe), cached to gate AI replies on @mention / reply-to-bot. */
export type TelegramMessage = NonNullable<TelegramUpdate['message']>;
