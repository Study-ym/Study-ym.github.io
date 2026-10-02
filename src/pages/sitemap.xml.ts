import type { APIRoute } from 'astro';
import { publicNotes, publicIdeas } from '../lib/content';
export const GET: APIRoute = async ({site}) => {
  const [notes,ideas] = await Promise.all([publicNotes(),publicIdeas()]);
  const urls = ['/', '/notes/', '/ideas/', '/tools/', '/games/', '/games/2048/', '/other/', '/about/', '/services/renewal-reminders/', ...notes.map(n=>`/notes/${n.id}/`), ...ideas.map(n=>`/ideas/${n.id}/`)];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<url><loc>${new URL(url,site).href}</loc></url>`).join('')}</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8'}});
};
