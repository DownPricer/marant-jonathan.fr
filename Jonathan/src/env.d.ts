/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

import type { ProjetData, SiteData } from './types/content';

declare namespace App {
  interface Locals {
    site: SiteData;
    projets: ProjetData[];
    csrfToken?: string;
    adminFlash?: { ok?: string; err?: string };
  }
}
