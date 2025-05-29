import { describe, it, expect } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../src/middlewares/auth.middleware.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'your_jwt_secret';

describe('authMiddleware', () => {
  it('rejects if Authorization header is missing', () => {
    const req = {
        headers: {},
    } as AuthRequest;
    const res = {
      status: (code: number) => {
        expect(code).toBe(401);
        return {
          json: (obj: any) => {
            expect(obj).toHaveProperty('error', 'Authorization header missing');
            return null;
          },
        };
      },
    } as unknown as Response;
    let calledNext = false;
    const next = () => { calledNext = true; };

    authMiddleware(req, res, next);

    expect(calledNext).toBe(false);
  });

  it('rejects if token is missing in Authorization header', () => {
    const req = { headers: { authorization: 'Bearer' } } as unknown as AuthRequest;
    const res = {
      status: (code: number) => {
        expect(code).toBe(401);
        return {
          json: (obj: any) => {
            expect(obj).toHaveProperty('error', 'Token missing');
            return null;
          },
        };
      },
    } as unknown as Response;
    let calledNext = false;
    const next = () => { calledNext = true; };

    authMiddleware(req, res, next);

    expect(calledNext).toBe(false);
  });

  it('rejects if token is invalid', () => {
    const req = { headers: { authorization: 'Bearer invalid.token' } } as unknown as AuthRequest;
    const res = {
      status: (code: number) => {
        expect(code).toBe(401);
        return {
          json: (obj: any) => {
            expect(obj).toHaveProperty('error', 'Invalid or expired token');
            return null;
          },
        };
      },
    } as unknown as Response;
    let calledNext = false;
    const next = () => { calledNext = true; };

    authMiddleware(req, res, next);

    expect(calledNext).toBe(false);
  });

  it('allows and attaches valid token payload', () => {
    const payload = { userId: 'test-id', walletAddress: '0xabc' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as AuthRequest;
    const res = {} as Response;
    let calledNext = false;
    const next = () => { calledNext = true; };

    authMiddleware(req, res, next);

    expect(calledNext).toBe(true);
    expect(req.user).toEqual(payload);
  });
});