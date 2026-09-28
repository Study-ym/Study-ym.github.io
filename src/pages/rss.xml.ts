import type { APIRoute } from 'astro';
import { publicNotes } from '../lib/content';
import { site as config } from '../site';
const xml = (value: string) => value.replace(/[<>&"']/g, char => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]!));
export const GET: APIRoute = async ({ site }) => {
  const notes = await publicNotes();
  const items = notes.map(note => { const url = new URL(`/notes/${note.id}/`, site).href; return `<item><title>${xml(note.data.title)}</title><link>${url}</link><guid>${url}</guid><description>${xml(note.data.description)}</description><pubDate>${note.data.date.toUTCString()}</pubDate></item>`; }).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xml(config.name)}</title><link>${site}</link><description>${xml(config.description)}</description><language>zh-CN</language>${items}</channel></rss>`,{headers:{'Content-Type':'application/rss+xml; charset=utf-8'}});
};
