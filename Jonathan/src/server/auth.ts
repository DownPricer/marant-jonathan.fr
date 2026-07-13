import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import type { AstroCookies } from 'astro';
import { assertRuntimeSecrets } from './secrets';

const SESSION_COOKIE = 'mj_admin_session';
const SESSION_HOURS = 8;
const MAX_LOGIN_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;

/** Rate limiting en mémoire — réinitialisé à chaque redémarrage du processus. */
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

type SessionPayload = { exp: number; sid: string; csrf: string };

let secretsReady = false;

function ensureSecrets(): { password: string; sessionSecret: string } {
  if (!secretsReady) {
    assertRuntimeSecrets();
    secretsReady = true;
  }
  return {
    password: process.env.ADMIN_PASSWORD!.trim(),
    sessionSecret: process.env.SESSION_SECRET!.trim(),
  };
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

function encodeSession(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

function decodeSession(token: string, secret: string): SessionPayload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body, secret);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now() || !payload.sid || !payload.csrf) return null;
    return payload;
  } catch {
    return null;
  }
}

function cookieOptions(maxAgeSec: number, secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSec,
  };
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function trustProxy(): boolean {
  return process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';
}

/**
 * IP pour le rate limiting login.
 * X-Forwarded-For / X-Real-IP ne sont lus que si TRUST_PROXY=true (Nginx de confiance).
 * Sans proxy de confiance, l'IP réelle n'est pas disponible via Request — on utilise une clé fixe.
 */
export function getClientIp(request: Request, clientAddress?: string): string {
  if (trustProxy()) {
    const xff = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (xff && /^[\d.a-fA-F:]+$/.test(xff)) return xff;
    const xri = request.headers.get('x-real-ip')?.trim();
    if (xri && /^[\d.a-fA-F:]+$/.test(xri)) return xri;
  }
  if (clientAddress?.trim()) return clientAddress.trim();
  return 'local';
}

export function checkRateLimit(ip: string): { ok: boolean; message?: string } {
  const entry = loginAttempts.get(ip);
  if (!entry) return { ok: true };
  if (entry.lockedUntil > Date.now()) {
    const min = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
    return { ok: false, message: `Trop de tentatives. Réessayez dans ${min} min.` };
  }
  return { ok: true };
}

export function recordFailedLogin(ip: string): void {
  const entry = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
    entry.count = 0;
  }
  loginAttempts.set(ip, entry);
}

export function clearLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

export function verifyPassword(input: string): boolean {
  const { password } = ensureSecrets();
  const a = Buffer.from(input);
  const b = Buffer.from(password);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Nouvelle session à chaque connexion (anti-fixation). Cookie signé, sans secret en clair. */
export function createSession(cookies: AstroCookies): string {
  const { sessionSecret } = ensureSecrets();
  destroySession(cookies);
  const csrf = randomBytes(24).toString('base64url');
  const payload: SessionPayload = {
    exp: Date.now() + SESSION_HOURS * 3600 * 1000,
    sid: randomBytes(16).toString('hex'),
    csrf,
  };
  const token = encodeSession(payload, sessionSecret);
  const secure = isProduction();
  cookies.set(SESSION_COOKIE, token, cookieOptions(SESSION_HOURS * 3600, secure));
  return csrf;
}

export function destroySession(cookies: AstroCookies): void {
  const secure = isProduction();
  cookies.delete(SESSION_COOKIE, { path: '/' });
  cookies.set(SESSION_COOKIE, '', { ...cookieOptions(0, secure), maxAge: 0 });
}

export function getSession(cookies: AstroCookies): SessionPayload | null {
  try {
    const { sessionSecret } = ensureSecrets();
    const token = cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return decodeSession(token, sessionSecret);
  } catch {
    return null;
  }
}

export function isAuthenticated(cookies: AstroCookies): boolean {
  return Boolean(getSession(cookies));
}

export function validateCsrf(cookies: AstroCookies, token: string | null | undefined): boolean {
  const session = getSession(cookies);
  if (!session || !token) return false;
  try {
    const a = Buffer.from(session.csrf);
    const b = Buffer.from(token);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function requireAuth(cookies: AstroCookies): SessionPayload {
  const session = getSession(cookies);
  if (!session) throw new Error('UNAUTHORIZED');
  return session;
}

export { SESSION_COOKIE, assertRuntimeSecrets };
