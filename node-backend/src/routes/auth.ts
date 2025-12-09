import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { issueTokens } from '../middleware/auth.js'; 
import { env } from '../config/env';
import { prisma } from '../prisma';
import { UserType } from '@prisma/client';

const router = Router();

router.post('/token/', (req, res) => {
  const { username, password } = req.body;
  prisma.user
    .findUnique({ where: { username } })
    .then((user: any) => {
      if (!user) return res.status(401).json({ detail: 'Invalid credentials' });
      const ok = bcrypt.compareSync(password, user.password);
      if (!ok) return res.status(401).json({ detail: 'Invalid credentials' });
      const tokens = issueTokens({ id: user.id, user_type: user.userType as UserType });
      return res.json(tokens);
    })
    .catch((err: any) => {
      console.error(err);
      return res.status(500).json({ detail: 'Internal server error' });
    });
});

router.post('/token/refresh/', (req, res) => {
  const { refresh } = req.body;
  if (!refresh) return res.status(400).json({ detail: 'Refresh token required' });
  try {
    const decoded = jwt.verify(refresh, env.jwtSecret) as { id: string; user_type: UserType; type?: string };
    if (decoded.type !== 'refresh') throw new Error('bad token');
    const tokens = issueTokens({ id: decoded.id, user_type: decoded.user_type });
    return res.json(tokens);
  } catch (err) {
    return res.status(401).json({ detail: 'Invalid refresh token' });
  }
});

export default router;

