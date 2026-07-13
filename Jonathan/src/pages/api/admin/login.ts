import type { APIRoute } from 'astro';
import {
  checkRateLimit,
  clearLoginAttempts,
  createSession,
  getClientIp,
  recordFailedLogin,
  verifyPassword,
} from '../../../server/auth';
import { errorResponse, redirectWithFlash } from '../../../server/api-helpers';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const ip = getClientIp(request, clientAddress);
  const rate = checkRateLimit(ip);
  if (!rate.ok) {
    return redirectWithFlash('/admin/login', undefined, rate.message);
  }

  const fd = await request.formData();
  const password = fd.get('password')?.toString() || '';
  if (!verifyPassword(password)) {
    recordFailedLogin(ip);
    return redirectWithFlash('/admin/login', undefined, 'Mot de passe incorrect.');
  }

  clearLoginAttempts(ip);
  createSession(cookies);
  return redirectWithFlash('/admin/site', 'Connexion réussie.');
};

export const GET: APIRoute = () => errorResponse('Méthode non autorisée.', 405);
