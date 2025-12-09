import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../prisma.js';
import { UserType } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: { id: string; user_type: UserType };
}

export function issueTokens(payload: { id: string; user_type: UserType }) {
  const access = jwt.sign(payload, env.jwtSecret, { expiresIn: '1d' });
  const refresh = jwt.sign({ ...payload, type: 'refresh' }, env.jwtSecret, { expiresIn: '7d' });
  return { access, refresh };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ detail: 'Authentication credentials were not provided.' });
  const [, token] = header.split(' ');
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { id: string; user_type: UserType };
    req.user = { id: decoded.id, user_type: decoded.user_type };
    next();
  } catch (err) {
    return res.status(401).json({ detail: 'Invalid or expired token.' });
  }
}

export function requireRole(...roles: UserType[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ detail: 'Unauthorized' });
    if (!roles.includes(req.user.user_type)) return res.status(403).json({ detail: 'Forbidden' });
    next();
  };
}

export function currentUser(req: AuthRequest) {
  if (!req.user) return undefined;
  return prisma.user.findUnique({ where: { id: req.user.id } });
}