import type { APIRoute } from 'astro';
import { adminGuard, redirectWithFlash } from '../../../server/api-helpers';
import { readSite, writeSite } from '../../../server/data-store';
import { isValidUrl, stripUnknownSiteFields } from '../../../server/validation';

export const prerender = false;

export const POST = adminGuard(async ({ request }) => {
  const fd = await request.formData();
  const s = readSite();
  const updated = stripUnknownSiteFields(
    {
      ...s,
      nom: fd.get('nom')?.toString() ?? s.nom,
      marque: fd.get('marque')?.toString() ?? s.marque,
      sousTitre: fd.get('sousTitre')?.toString() ?? s.sousTitre,
      baseline: fd.get('baseline')?.toString() ?? s.baseline,
      titre: fd.get('titre')?.toString() ?? s.titre,
      zone: fd.get('zone')?.toString() ?? s.zone,
      telephone: fd.get('telephone')?.toString() ?? s.telephone,
      email: fd.get('email')?.toString() ?? s.email,
      horaires: fd.get('horaires')?.toString() ?? s.horaires,
      facebookUrl: fd.get('facebookUrl')?.toString() ?? s.facebookUrl,
      googleAvisUrl: fd.get('googleAvisUrl')?.toString() ?? s.googleAvisUrl,
      pagesJaunesUrl: fd.get('pagesJaunesUrl')?.toString() ?? s.pagesJaunesUrl,
      motsCles: fd
        .get('motsCles')
        ?.toString()
        .split('\n')
        .map((k) => k.trim())
        .filter(Boolean) ?? s.motsCles,
      adresse: {
        ...s.adresse,
        rue: fd.get('adresse_rue')?.toString() ?? s.adresse.rue,
        codePostal: fd.get('adresse_cp')?.toString() ?? s.adresse.codePostal,
        ville: fd.get('adresse_ville')?.toString() ?? s.adresse.ville,
      },
    },
    s,
  );

  for (const [k, v] of [
    ['facebookUrl', updated.facebookUrl],
    ['googleAvisUrl', updated.googleAvisUrl],
    ['pagesJaunesUrl', updated.pagesJaunesUrl],
  ] as const) {
    if (v && !isValidUrl(v)) throw new Error(`URL invalide : ${k}`);
  }

  writeSite(updated);
  return redirectWithFlash('/admin/site', 'Informations enregistrées avec succès.');
});
