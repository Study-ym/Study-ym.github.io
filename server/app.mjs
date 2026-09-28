import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, timingSafeEqual, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync, writeFileSync, chmodSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { validateRecords } from '../src/lib/cycle.mjs';

const scrypt = promisify(scryptCallback);
const COOKIE = '__Host-garden_session';
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const MAX_BODY = 1024 * 1024;
const SCRYPT_OPTIONS = { N: 65536, r: 8, p: 2, maxmem: 96 * 1024 * 1024 };
const hash = value => createHash('sha256').update(value).digest('hex');
const safeEqual = (a, b) => timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
const shanghaiDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, '请求内容过大。');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new HttpError(400, '请求必须是 JSON 对象。'); }
}

/** Single-process, single-owner service. Nginx must overwrite forwarding headers. */
export function createGardenServer({ dataDir, origin = 'https://ymihh.xyz', port = 8787 } = {}) {
  if (!dataDir) throw new Error('GARDEN_DATA_DIR is required');
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.protocol !== 'https:' || parsedOrigin.origin !== origin) throw new Error('GARDEN_ORIGIN must be an exact HTTPS origin without a trailing slash');
  const directory = resolve(dataDir);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const databasePath = join(directory, 'garden.sqlite');
  const db = new DatabaseSync(databasePath);
  chmodSync(databasePath, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY CHECK(id=1), username TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS cycles (user_id INTEGER PRIMARY KEY REFERENCES users(id), version INTEGER NOT NULL DEFAULT 0, records TEXT NOT NULL DEFAULT '[]');`);
  const setupPath = join(directory, 'setup-token');
  let setupToken = null;
  if (!db.prepare('SELECT id FROM users LIMIT 1').get()) {
    try { writeFileSync(setupPath, randomBytes(32).toString('base64url'), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    chmodSync(setupPath, 0o600);
    setupToken = readFileSync(setupPath, 'utf8').trim();
    if (!/^[A-Za-z0-9_-]{43}$/.test(setupToken)) throw new Error('Invalid setup-token file');
  } else {
    try { unlinkSync(setupPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  // Shared limit is intentionally conservative for this private, single-owner site.
  let authWindow = 0;
  let authAttempts = 0;
  let activeAuth = 0;
  const limitAuth = () => {
    const now = Date.now();
    if (now - authWindow >= 15 * 60 * 1000) { authWindow = now; authAttempts = 0; }
    if (++authAttempts > 30) throw new HttpError(429, '登录尝试过多，请稍后再试。');
  };
  const derivePassword = async (password, salt) => {
    // Acquire only after the entire body has arrived; a slow body must not reserve
    // or bypass a hash slot. No await may appear between this check and increment.
    if (activeAuth >= 2) throw new HttpError(429, '登录尝试过多，请稍后再试。');
    activeAuth++;
    try { return Buffer.from(await scrypt(password, salt, 64, SCRYPT_OPTIONS)); }
    finally { activeAuth--; }
  };
  const sessionUser = req => {
    const token = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    return db.prepare('SELECT users.id, users.username FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?').get(hash(token), Date.now()) || null;
  };
  const cookie = (token, age = SESSION_SECONDS) => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
  const newSession = () => {
    const token = randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
    // Bound retained sessions even if the owner repeatedly logs in on many devices.
    db.prepare('DELETE FROM sessions WHERE token_hash IN (SELECT token_hash FROM sessions ORDER BY expires_at DESC LIMIT -1 OFFSET 19)').run();
    db.prepare('INSERT INTO sessions VALUES (?, 1, ?)').run(hash(token), Date.now() + SESSION_SECONDS * 1000);
    return cookie(token);
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
    try {
      const path = (req.url || '').split('?')[0];
      const method = req.method;
      if (!['GET', 'POST', 'PUT'].includes(method)) throw new HttpError(405, '不支持此请求方式。');
      if (method !== 'GET') {
        if (req.headers.origin !== origin) throw new HttpError(403, '请求来源不受信任。');
        if ((req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') throw new HttpError(415, '请使用 JSON 请求。');
        if (Number(req.headers['content-length']) > MAX_BODY) throw new HttpError(413, '请求内容过大。');
      }
      const user = sessionUser(req);
      if (method === 'GET' && path === '/api/health') return send(200, { ok: true });
      if (method === 'GET' && path === '/api/session') return send(200, { user, setupRequired: !db.prepare('SELECT id FROM users LIMIT 1').get() });
      if (method === 'GET' && path === '/api/auth/check') {
        if (!user) throw new HttpError(401, '请先登录。');
        return send(200, { ok: true });
      }
      if (method === 'POST' && ['/api/auth/setup', '/api/auth/login'].includes(path)) {
        limitAuth();
        const body = await readJson(req);
        if (typeof body.username !== 'string' || !/^[A-Za-z0-9_-]{3,40}$/.test(body.username) || typeof body.password !== 'string' || body.password.length < (path.endsWith('/setup') ? 12 : 1) || body.password.length > 128) throw new HttpError(400, '用户名需为 3–40 位字母、数字或 _-，设置密码需为 12–128 位。');
        if (path.endsWith('/setup')) {
          if (!setupToken || db.prepare('SELECT id FROM users').get()) throw new HttpError(409, '账号已建立，不能重复初始化。');
          if (typeof body.token !== 'string' || !safeEqual(body.token, setupToken)) throw new HttpError(403, '初始化凭证无效。');
          const salt = randomBytes(16).toString('hex');
          const passwordHash = (await derivePassword(body.password, salt)).toString('hex');
          db.exec('BEGIN IMMEDIATE');
          try {
            if (db.prepare('SELECT id FROM users').get()) throw new HttpError(409, '账号已建立，不能重复初始化。');
            db.prepare('INSERT INTO users VALUES (1, ?, ?, ?)').run(body.username, salt, passwordHash);
            db.prepare('INSERT INTO cycles(user_id) VALUES (1)').run();
            db.exec('COMMIT');
          } catch (error) { db.exec('ROLLBACK'); throw error; }
          setupToken = null;
          // Database ownership is authoritative even if a file cleanup fails.
          try { unlinkSync(setupPath); } catch { /* never expose token or account details in logs */ }
        } else {
          const account = db.prepare('SELECT * FROM users WHERE username=?').get(body.username);
          const attempted = await derivePassword(body.password, account?.salt || '00000000000000000000000000000000');
          if (!account || !timingSafeEqual(attempted, Buffer.from(account.password_hash, 'hex'))) throw new HttpError(401, '用户名或密码不正确。');
        }
        res.setHeader('Set-Cookie', newSession());
        return send(200, { user: { id: 1, username: body.username } });
      }
      if (method === 'POST' && path === '/api/auth/logout') {
        await readJson(req);
        const token = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
        if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));
        res.setHeader('Set-Cookie', cookie('', 0));
        return send(200, { ok: true });
      }
      if (path === '/api/cycle' && ['GET', 'PUT'].includes(method)) {
        if (!user) throw new HttpError(401, '请先登录。');
        if (method === 'GET') {
          const row = db.prepare('SELECT version, records FROM cycles WHERE user_id=?').get(user.id);
          return send(200, { version: row.version, records: JSON.parse(row.records) });
        }
        const body = await readJson(req);
        if (!Number.isSafeInteger(body.version) || body.version < 0) throw new HttpError(400, '记录版本无效。');
        let records;
        try { records = validateRecords(body.records, shanghaiDate()); }
        catch (error) { throw new HttpError(400, error.message); }
        const result = db.prepare('UPDATE cycles SET records=?, version=version+1 WHERE user_id=? AND version=?').run(JSON.stringify(records), user.id, body.version);
        if (!result.changes) throw new HttpError(409, '记录已在其他设备更新，请先读取最新记录。');
        return send(200, { version: body.version + 1, records });
      }
      throw new HttpError(404, '接口不存在。');
    } catch (error) {
      if (!res.headersSent && !res.destroyed) send(error instanceof HttpError ? error.status : 500, { error: error instanceof HttpError ? error.message : '服务器暂时无法完成请求。' });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  let closed = false;
  return {
    server,
    async start() {
      await new Promise((resolveStart, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolveStart(); }); });
      return server.address();
    },
    async stop() {
      if (closed) return;
      closed = true;
      if (server.listening) await new Promise(resolveStop => { server.close(resolveStop); server.closeIdleConnections(); });
      db.close();
    },
  };
}
