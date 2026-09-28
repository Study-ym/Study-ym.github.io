import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const root=process.argv[2]||'dist';
const hashes=new Set();
function scan(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())scan(p);else if(e.name.endsWith('.html')){
  for(const [,attributes,body] of readFileSync(p,'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
    if(!/\bsrc\s*=/.test(attributes)&&body.trim())hashes.add(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  }
}}}
scan(root);
process.stdout.write(readFileSync(new URL('./nginx.conf',import.meta.url),'utf8').replace('__SCRIPT_HASHES__',[...hashes].sort().join(' ')));
