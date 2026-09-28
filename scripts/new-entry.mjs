import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [kind, slug, title] = process.argv.slice(2);
if (!['note','idea'].includes(kind) || !slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !title) {
  console.error('用法：npm run new -- note|idea english-slug "标题"'); process.exit(1);
}
const directory = resolve('src/content',kind === 'note' ? 'notes' : 'ideas');
mkdirSync(directory,{recursive:true});
const date = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
const content = `---\ntitle: ${JSON.stringify(title)}\ndescription: "在这里写一句简介"\ndate: ${date}\ntags: []\n${kind==='note' ? 'stage: seed' : 'status: idea'}\ndraft: true\n---\n\n从这里开始记录。\n`;
try { writeFileSync(resolve(directory,slug+'.md'),content,{flag:'wx'}); console.log(`已创建草稿：${directory}/${slug}.md\n写好后将 draft 改为 false，网站才会展示。公开仓库中的草稿源码仍然公开。`); }
catch(error) { console.error(error.code === 'EEXIST' ? '同名内容已存在，请换一个 slug。' : error.message); process.exit(1); }
