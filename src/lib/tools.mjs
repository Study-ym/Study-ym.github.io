export function formatJson(text, compact = false) {
  if (!text.trim()) throw new Error('先输入需要整理的 JSON。');
  // Validate syntax, then format the original tokens. Re-serializing parsed
  // numbers would silently round large IDs or replace overflow values with null.
  JSON.parse(text);
  let quoted = false;
  let escaped = false;
  let minified = '';
  for (const char of text) {
    if (quoted) {
      minified += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') { quoted = true; minified += char; }
    else if (!/\s/.test(char)) minified += char;
  }
  if (compact) return minified;
  let output = '';
  let depth = 0;
  quoted = false;
  escaped = false;
  for (let index = 0; index < minified.length; index++) {
    const char = minified[index];
    if (quoted) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; output += char; }
    else if (char === '{' || char === '[') {
      output += char; depth++;
      if (minified[index + 1] !== '}' && minified[index + 1] !== ']') output += '\n' + '  '.repeat(depth);
    } else if (char === '}' || char === ']') {
      depth--;
      if (minified[index - 1] !== '{' && minified[index - 1] !== '[') output += '\n' + '  '.repeat(depth);
      output += char;
    } else if (char === ',') output += ',\n' + '  '.repeat(depth);
    else if (char === ':') output += ': ';
    else output += char;
  }
  return output;
}

export function timestampToDate(value, unit = 'seconds') {
  if (!/^-?\d+$/.test(value.trim())) throw new Error('请输入整数时间戳。');
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('时间戳超出安全整数范围。');
  const milliseconds = unit === 'seconds' ? number * 1000 : number;
  const date = new Date(milliseconds);
  if (!Number.isFinite(date.getTime())) throw new Error('时间戳超出有效日期范围。');
  return date;
}

export function localDateToTimestamp(value) {
  if (!value) throw new Error('先选择日期和时间。');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('日期和时间无效。');
  return { seconds: Math.floor(date.getTime() / 1000), milliseconds: date.getTime() };
}

export function transformUrl(value, mode) {
  if (!value) throw new Error('先输入需要处理的文字。');
  if (mode === 'encode') return encodeURIComponent(value);
  if (mode === 'decode') return decodeURIComponent(value);
  throw new Error('未知操作。');
}
