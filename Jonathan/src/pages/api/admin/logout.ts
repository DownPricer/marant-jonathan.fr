import type { APIRoute } from 'astro';
import { destroySession } from '../../../server/auth';
import { redirectWithFlash } from '../../../server/api-helpers';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  destroySession(cookies);
  return redirectWithFlash('/admin/login', 'Déconnexion effectuée.');
};
