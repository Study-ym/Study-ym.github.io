const DAY_MS = 86_400_000;

/** A calendar date in the device's timezone, never an ISO UTC date slice. */
export function todayLocal(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('无法读取今天的日期，请检查设备时间。');
  }
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** UTC is used only for calendar arithmetic, so DST cannot shorten a day. */
export function dayNumber(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new Error('日期格式不正确，请使用 YYYY-MM-DD。');
  }
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`日期 ${iso} 无效，请选择 1900 年起真实存在的日期。`);
  }
  return date.getTime() / DAY_MS;
}

export function daysInclusive(start, end) {
  const duration = dayNumber(end) - dayNumber(start) + 1;
  if (duration < 1) throw new Error('结束日期不能早于开始日期，请重新选择。');
  return duration;
}

/** Validate before every write/import and keep only the documented fields. */
export function validateRecords(records, today = todayLocal()) {
  const currentDay = dayNumber(today);
  if (!Array.isArray(records)) throw new Error('记录格式不正确，请选择本工具导出的备份文件。');
  if (records.length > 1000) throw new Error('记录超过 1000 条，请减少记录后再导入。');
  const ids = new Set();
  const normalized = Array.from(records, (record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error(`第 ${index + 1} 条记录格式不正确，请检查备份文件。`);
    }
    const { id, start, end } = record;
    if (typeof id !== 'string' || !id.trim() || id.length > 100 || ids.has(id)) {
      throw new Error(`第 ${index + 1} 条记录的编号为空、重复或超过 100 字符，请检查备份文件。`);
    }
    ids.add(id);
    const startDay = dayNumber(start);
    const endDay = end === null ? Infinity : dayNumber(end);
    if (startDay > currentDay || (end !== null && endDay > currentDay)) {
      throw new Error('不能记录未来的经期，请选择今天或更早的日期。');
    }
    if (endDay < startDay) throw new Error('结束日期不能早于开始日期，请重新选择。');
    return { id, start, end };
  });
  normalized.sort((a, b) => b.start.localeCompare(a.start));
  if (normalized.filter(record => record.end === null).length > 1) {
    throw new Error('只能有一条进行中的记录，请先结束或修改已有记录。');
  }
  for (let index = 1; index < normalized.length; index += 1) {
    const older = normalized[index];
    const newer = normalized[index - 1];
    if (older.end === null) {
      throw new Error('进行中的记录必须是最近一次，请先补全较早记录的结束日期。');
    }
    if (older.end >= newer.start) {
      throw new Error('记录日期有重叠，请调整开始或结束日期；同一天不能属于两次经期。');
    }
  }
  return normalized;
}

export function parseBackup(text, today = todayLocal()) {
  let backup;
  try {
    if (typeof text !== 'string') throw new Error();
    backup = JSON.parse(text);
  } catch {
    throw new Error('无法读取备份，请选择本工具导出的 JSON 文件。');
  }
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
    throw new Error('备份格式不正确，请选择本工具导出的 JSON 文件。');
  }
  if (backup.version !== 1) throw new Error('备份版本不支持，请使用版本 1 的备份文件。');
  return validateRecords(backup.records, today);
}

export function makeBackup(records, today = todayLocal()) {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records: validateRecords(records, today) }, null, 2);
}
