import type { APIRoute } from 'astro';
import { validateCsrf, requireAuth } from './auth';

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ ok: false, error: message }, status);
}

export function okResponse(message: string, extra: Record<string, unknown> = {}): Response {
  return jsonResponse({ ok: true, message, ...extra });
}

export const prerender = false;

export function adminGuard(
  handler: (context: Parameters<APIRoute>[0]) => Promise<Response> | Response,
): APIRoute {
  return async (context) => {
    const { isAuthenticated } = await import('./auth');
    if (!isAuthenticated(context.cookies)) {
      return errorResponse('Non authentifié.', 401);
    }
    if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
      let token = context.request.headers.get('x-csrf-token');
      if (!token) {
        try {
          const fd = await context.request.clone().formData();
          token = fd.get('csrf')?.toString() || null;
        } catch {
          token = null;
        }
      }
      if (!validateCsrf(context.cookies, token)) {
        return errorResponse('Jeton CSRF invalide.', 403);
      }
    }
    try {
      requireAuth(context.cookies);
      return await handler(context);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur.';
      if (msg === 'UNAUTHORIZED') return errorResponse('Non authentifié.', 401);
      return errorResponse(msg, 500);
    }
  };
}

export function redirectWithFlash(path: string, ok?: string, err?: string): Response {
  const url = new URL(path, 'http://local');
  if (ok) url.searchParams.set('ok', ok);
  if (err) url.searchParams.set('err', err);
  const location = url.pathname + url.search;
  return new Response(null, {
    status: 303,
    headers: { Location: location },
  });
}
