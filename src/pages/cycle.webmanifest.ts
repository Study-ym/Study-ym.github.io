import type { APIRoute } from 'astro';
export const GET: APIRoute = () => {
  const cloud = import.meta.env.PUBLIC_GARDEN_CLOUD === 'true';
  return new Response(JSON.stringify({name:'月笺 · 经期小日历',short_name:'月笺',lang:'zh-CN',id:'/tools/cycle/',start_url:cloud?'/private/cycle/':'/tools/cycle/',scope:cloud?'/':'/tools/cycle/',display:'standalone',background_color:'#fbfafb',theme_color:'#fbfafb',icons:[{src:'/cycle-icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]}),{headers:{'Content-Type':'application/manifest+json'}});
};
