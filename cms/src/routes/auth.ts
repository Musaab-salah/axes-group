import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import {
  clearSessionCookie,
  createSession,
  destroySession,
  loadUserFromRequest,
  requireAuth,
  setSessionCookie,
  verifyPassword,
  COOKIE,
} from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { logActivity } from '../lib/activity.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

authRouter.get('/me', async (req, res) => {
  const user = await loadUserFromRequest(req);
  if (!user) {
    res.status(401).json({ user: null });
    return;
  }
  res.json({ user });
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const parsed = z
    .object({
      email: z.string().email(),
      password: z.string().min(8),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid credentials payload' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || !user.active) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    await logActivity({ action: 'login_failed', resource: 'user', resourceId: user.id });
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  const session = await createSession(user.id);
  setSessionCookie(res, session.token, session.expiresAt);
  await logActivity({
    userId: user.id,
    action: 'login',
    resource: 'user',
    resourceId: user.id,
  });
  res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

authRouter.post('/logout', requireAuth, async (req, res) => {
  const token = req.cookies?.[COOKIE] as string | undefined;
  await destroySession(token);
  clearSessionCookie(res);
  await logActivity({
    userId: req.user?.id,
    action: 'logout',
    resource: 'user',
    resourceId: req.user?.id,
  });
  res.json({ ok: true });
});
