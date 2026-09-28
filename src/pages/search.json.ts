import type { APIRoute } from 'astro';
import { publicNotes, publicIdeas } from '../lib/content';
export const GET: APIRoute = async () => {
  const [notes, ideas] = await Promise.all([publicNotes(), publicIdeas()]);
  const entries = [
    {title:'月笺 · 经期小日历',description:'记录开始与结束，可选小猫陪伴。',kind:'工具',url:'/tools/cycle/',text:'月笺 经期 月经 日历 小猫 开始 结束 记录'},
    ...notes.map(n => ({title:n.data.title, description:n.data.description, kind:'记录', url:`/notes/${n.id}/`, text:[n.data.title,n.data.description,n.data.tags.join(' '),n.body].join(' ')})),
    ...ideas.map(n => ({title:n.data.title, description:n.data.description, kind:'Idea', url:`/ideas/${n.id}/`, text:[n.data.title,n.data.description,n.data.tags.join(' '),n.body].join(' ')})),
    {title:'JSON 整理',description:'格式化、校验与压缩 JSON',kind:'工具',url:'/tools/#json',text:'JSON 整理 格式化 校验 压缩'},
    {title:'时间戳转换',description:'秒、毫秒、UTC 与本地日期转换',kind:'工具',url:'/tools/#time',text:'时间戳 日期 秒 毫秒 UTC 时间转换 timestamp'},
    {title:'URL 编解码',description:'URL 参数值编码与解码',kind:'工具',url:'/tools/#url',text:'URL 编码 解码 链接 encode decode'},
  ];
  return new Response(JSON.stringify(entries), {headers:{'Content-Type':'application/json; charset=utf-8'}});
};
