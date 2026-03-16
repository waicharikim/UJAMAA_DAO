/**
 * @file src/modules/emergency/types.ts
 * @description
 * Emergency Response Types
 * Version: 2.0 — December 2025
 */

export enum EmergencyType {
  FIRE = 'FIRE',
  FLOOD = 'FLOOD',
  MEDICAL = 'MEDICAL',
  SECURITY = 'SECURITY',
  ACCIDENT = 'ACCIDENT',
  OTHER = 'OTHER',
}

export enum EmergencyStatus {
  REPORTED = 'REPORTED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  FALSE_ALARM = 'FALSE_ALARM',
}

export interface ReportEmergencyDto {
  type: EmergencyType;
  description: string;
  locationWardId: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
}

export interface RespondToEmergencyDto {
  message: string;
}

export interface ListAlertsDto {
  wardId?: string;
  status?: string;
  type?: EmergencyType;
  limit?: number;
  page?: number;
}
