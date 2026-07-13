import { defineMiddleware } from 'astro:middleware';
import { readProjets, readSite } from './server/data-store';
import { assertRuntimeSecrets, getSession, isAuthenticated } from './server/auth';

const ADMIN_PREFIX = '/admin';

export const onRequest = defineMiddleware(async (context, next) => {
  assertRuntimeSecrets();
  context.locals.site = readSite();
  context.locals.projets = readProjets();

  const path = context.url.pathname.replace(/\/+$/, '') || '/';
  const isAdminRoute = path === ADMIN_PREFIX || path.startsWith(`${ADMIN_PREFIX}/`);
  const isLogin = path === `${ADMIN_PREFIX}/login`;
  const isAdminApi = path.startsWith('/api/admin');
  const isLoginApi = path === '/api/admin/login';

  if (isAdminApi && !isLoginApi && !isAuthenticated(context.cookies)) {
    return new Response(JSON.stringify({ ok: false, error: 'Non authentifié.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  if (isAdminRoute && !isLogin) {
    if (!isAuthenticated(context.cookies)) {
      return context.redirect(`${ADMIN_PREFIX}/login`);
    }
    const session = getSession(context.cookies);
    context.locals.csrfToken = session?.csrf;
  }

  if (isLogin && isAuthenticated(context.cookies)) {
    return context.redirect(`${ADMIN_PREFIX}/site`);
  }

  return next();
});
