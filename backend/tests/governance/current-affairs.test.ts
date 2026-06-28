/**
 * @file tests/governance/current-affairs.test.ts
 * Phase 3: current-affairs store + EPRA parser. Parser is pure; service tests
 * use the test DB.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { currentAffairsService } from '../../src/modules/governance/current-affairs/current-affairs.service.js';
import { parseEpraText } from '../../src/modules/governance/current-affairs/collectors/epra.js';
import { parseXFeed } from '../../src/modules/governance/current-affairs/collectors/x-moneyacademy.js';

describe('EPRA parser', () => {
  it('extracts petrol/diesel/kerosene from page text', () => {
    const text =
      'EPRA monthly review. Super Petrol in Nairobi is 217.43 per litre. Diesel retails at 205.47. Kerosene 198.20.';
    const out = parseEpraText(text, new Date('2026-06-14'), 'http://epra');
    const byKey = Object.fromEntries(out.map((o) => [o.indicator, o.value]));
    expect(byKey.fuel_petrol).toBe('217.43');
    expect(byKey.fuel_diesel).toBe('205.47');
    expect(byKey.fuel_kerosene).toBe('198.20');
    expect(out[0].source).toBe('EPRA');
    expect(out[0].unit).toBe('KES/L');
  });

  it('returns [] when nothing matches', () => {
    expect(parseEpraText('no fuel prices in this text', new Date())).toEqual([]);
  });
});

describe('X (@moneyacademyKE) feed parser', () => {
  it('extracts latest post titles (capped) and strips CDATA', () => {
    const xml = `<rss><channel>
      <item><title>Fuel prices up 5% this month</title></item>
      <item><title><![CDATA[Shilling weakens to 130 per USD]]></title></item>
      <item><title>Third item</title></item>
      <item><title>Fourth item (should be dropped)</title></item>
    </channel></rss>`;
    const posts = parseXFeed(xml);
    expect(posts).toHaveLength(3); // capped at MAX_POSTS
    expect(posts[0]).toBe('Fuel prices up 5% this month');
    expect(posts[1]).toBe('Shilling weakens to 130 per USD');
  });

  it('falls back to description and decodes entity-encoded HTML', () => {
    const xml = `<feed><entry><description>&lt;p&gt;Tax &amp; levy update&lt;/p&gt;</description></entry></feed>`;
    expect(parseXFeed(xml)[0]).toBe('Tax & levy update');
  });

  it('returns [] for non-feed text', () => {
    expect(parseXFeed('not a feed at all')).toEqual([]);
  });
});

describe('current affairs service', () => {
  beforeEach(async () => {
    await prisma.currentAffairs.deleteMany({});
  });

  it('formatForDeliberation is empty when nothing is on record', async () => {
    expect(await currentAffairsService.formatForDeliberation()).toBe('');
  });

  it('stores a valid indicator and formats it with source + as-of', async () => {
    await currentAffairsService.upsertFromCollector({
      indicator: 'fuel_petrol',
      label: 'Petrol pump price',
      value: '217.43',
      unit: 'KES/L',
      source: 'EPRA',
      asOf: new Date(),
    });
    const out = await currentAffairsService.formatForDeliberation();
    expect(out).toContain('Petrol pump price');
    expect(out).toContain('217.43');
    expect(out).toContain('EPRA');
  });

  it('rejects an out-of-range fuel value (sanity guard)', async () => {
    await currentAffairsService.upsertFromCollector({
      indicator: 'fuel_petrol',
      label: 'Petrol',
      value: '9999', // absurd for KES/L
      unit: 'KES/L',
      source: 'EPRA',
      asOf: new Date(),
    });
    expect(await prisma.currentAffairs.count()).toBe(0);
  });

  it('does not let a collector overwrite an admin-set value', async () => {
    await currentAffairsService.setAdminValue({
      indicator: 'fuel_petrol',
      label: 'Petrol',
      value: '200.00',
      unit: 'KES/L',
    });
    await currentAffairsService.upsertFromCollector({
      indicator: 'fuel_petrol',
      label: 'Petrol',
      value: '250.00',
      unit: 'KES/L',
      source: 'EPRA',
      asOf: new Date(),
    });
    const row = await prisma.currentAffairs.findUnique({
      where: { indicator: 'fuel_petrol' },
    });
    expect(row?.value).toBe('200.00');
    expect(row?.source).toBe('admin');
  });

  it('flags stale figures', async () => {
    const old = new Date(Date.now() - 60 * 86_400_000); // 60 days ago
    await currentAffairsService.upsertFromCollector({
      indicator: 'fuel_diesel',
      label: 'Diesel pump price',
      value: '205.47',
      unit: 'KES/L',
      source: 'EPRA',
      asOf: old,
    });
    expect(await currentAffairsService.formatForDeliberation()).toContain(
      '[STALE]'
    );
  });
});
