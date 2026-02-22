/**
 * @file src/modules/marketplace/types.ts
 * @description
 * Marketplace Types — Discovery Platform
 * Version: 2.0 — December 2025
 */

export enum ListingType {
  OFFER = 'OFFER', // I can provide this
  REQUEST = 'REQUEST', // I need this
}

export interface CreateListingDto {
  goodsServiceId: string;
  title: string;
  description: string;
  priceGuideKes?: number; // Optional guide only
  quantity?: number;
  type: ListingType;
}

export interface SearchListingsDto {
  goodsServiceId?: string;
  type?: ListingType;
  wardId?: string;
  page?: number;
  limit?: number;
}
