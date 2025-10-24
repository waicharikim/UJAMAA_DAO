// src/routes/adminRoles.ts
import express from 'express';
import prisma from '../prismaClient.js';
import { loadDynamicRoles } from '../constants/roles.js';

const router = express.Router();

// Simple helper — adapt to your auth middleware shape
function requireSuperAdmin(req: any, res: any, next: any) {
  const roles = req.userRoles ?? [];
  const has = roles.some((r: any) => r.role === 'system:super_admin');
  if (!has) return res.status(403).json({ error: 'forbidden' });
  return next();
}

router.post('/reload', requireSuperAdmin, async (req, res) => {
  try {
    await loadDynamicRoles(prisma);
    return res.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as any)?.message ?? String(err) });
  }
});

export default router;