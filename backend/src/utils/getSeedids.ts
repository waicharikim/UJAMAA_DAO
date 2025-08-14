import { seedAll } from '../../prisma/seedAll.js';

let cached = null;

export async function getSeedIds() {
  if (!cached) {
    const result = await seedAll();
    cached = result.ids;
  }
  return cached;
}