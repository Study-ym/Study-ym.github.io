import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync, statSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { createGardenServer } from '../server/app.mjs';

const origin = 'https://ymihh.xyz';
const password = 'correct-horse-battery-9';
async function fixture(t) {
  const dataDir = mkdtempSync(join(tmpdir(), 'garden-api-'));
  let app;
  let base;
  const start = async () => { app = createGardenServer({ dataDir, origin, port: 0 }); const address = await app.start(); base = `http://127.0.0.1:${address.port}`; };
  await start();
  t.after(async () => { await app.stop(); rmSync(dataDir, { recursive: true, force: true }); });
  const request = async (path, { method = 'GET', body, cookie, headers = {} } = {}) => {
    const response = await fetch(`${base}${path}`, { method, headers: { ...(method !== 'GET' ? { origin, 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  const setup = async () => {
    const token = readFileSync(join(dataDir, 'setup-token'), 'utf8');
    const result = await request('/api/auth/setup', { method: 'POST', body: { token, username: 'owner', password } });
    assert.equal(result.status, 200);
    return result.headers.get('set-cookie').split(';')[0];
  };
  return { dataDir, request, setup, get base() { return base; }, restart: async () => { await app.stop(); await start(); } };
}

test('anonymous isolation, origin/content type protections, and private response caching', async t => {
  const { request } = await fixture(t);
  assert.deepEqual((await request('/api/session')).body, { user: null, setupRequired: true });
  assert.equal((await request('/api/cycle')).status, 401);
  assert.equal((await request('/api/cycle', { method: 'PUT', body: { version: 0, records: [] } })).status, 401);
  assert.equal((await request('/api/auth/setup', { method: 'POST', body: {}, headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await request('/api/auth/setup', { method: 'POST', body: {}, headers: { origin: '' } })).status, 403);
  assert.equal((await request('/api/auth/setup', { method: 'POST', body: {}, headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await request('/api/session')).headers.get('cache-control'), 'no-store');
  assert.equal((await request('/api/session')).headers.get('access-control-allow-origin'), null);
});

test('one-time owner setup, secure opaque cookie, password verification and logout', async t => {
  const { request, setup, dataDir, restart } = await fixture(t);
  assert.equal(statSync(join(dataDir, 'setup-token')).mode & 0o777, 0o600);
  assert.equal((await request('/api/auth/setup', { method: 'POST', body: { token: 'bad-token', username: 'owner', password } })).status, 403);
  const cookie = await setup();
  assert.match(cookie, /^__Host-garden_session=[A-Za-z0-9_-]{43}$/);
  assert.equal(existsSync(join(dataDir, 'setup-token')), false);
  assert.deepEqual((await request('/api/session', { cookie })).body, { user: { id: 1, username: 'owner' }, setupRequired: false });
  assert.equal((await request('/api/auth/setup', { method: 'POST', body: { token: 'anything', username: 'second', password } })).status, 409);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { username: 'owner', password: 'wrong' } })).status, 401);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { username: 'unknown', password } })).status, 401);
  const login = await request('/api/auth/login', { method: 'POST', body: { username: 'owner', password } });
  assert.equal(login.status, 200);
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.ok(login.headers.get('set-cookie').includes(attribute));
  assert.ok(!login.headers.get('set-cookie').includes('Domain='));
  await restart();
  assert.equal((await request('/api/session', { cookie })).body.user.username, 'owner');
  assert.equal((await request('/api/auth/logout', { method: 'POST', body: {}, cookie })).status, 200);
  assert.equal((await request('/api/cycle', { cookie })).status, 401);
  assert.equal((await request('/api/cycle', { cookie: `${cookie.slice(0, -1)}!` })).status, 401);
  const db = new DatabaseSync(join(dataDir, 'garden.sqlite'), { readOnly: true });
  const account = db.prepare('SELECT * FROM users').get();
  assert.notEqual(account.password_hash, password);
  assert.equal(account.password_hash.length, 128);
  assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n, 1);
  assert.ok(!JSON.stringify(db.prepare('SELECT * FROM sessions').all()).includes(login.headers.get('set-cookie').split(';')[0].split('=')[1]));
  db.close();
});

test('atomic version updates, validation, restart persistence and consistent backup', async t => {
  const { request, setup, dataDir, restart } = await fixture(t);
  const cookie = await setup();
  assert.deepEqual((await request('/api/cycle', { cookie })).body, { version: 0, records: [] });
  const records = [{ id: 'test-only', start: '2025-03-01', end: '2025-03-05' }];
  const update = { method: 'PUT', cookie, body: { version: 0, records } };
  const writes = await Promise.all([request('/api/cycle', update), request('/api/cycle', update)]);
  assert.deepEqual(writes.map(value => value.status).sort(), [200, 409]);
  const invalid = await request('/api/cycle', { method: 'PUT', cookie, body: { version: 1, records: [{ id: 'bad', start: '2099-01-01', end: null }] } });
  assert.equal(invalid.status, 400);
  assert.equal((await request('/api/cycle', { method: 'PUT', cookie, body: { version: 1, records }, headers: { origin: 'https://evil.example' } })).status, 403);
  assert.deepEqual((await request('/api/cycle', { cookie })).body, { version: 1, records });
  const backup = join(dataDir, 'backups', 'test.sqlite');
  execFileSync(process.execPath, ['server/backup.mjs', backup], { cwd: resolve(import.meta.dirname, '..'), env: { ...process.env, GARDEN_DATA_DIR: dataDir }, stdio: 'pipe' });
  const backupDb = new DatabaseSync(backup, { readOnly: true });
  assert.equal(backupDb.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.deepEqual(JSON.parse(backupDb.prepare('SELECT records FROM cycles').get().records), records);
  backupDb.close();
  assert.equal(statSync(backup).mode & 0o777, 0o600);
  await restart();
  assert.deepEqual((await request('/api/cycle', { cookie })).body, { version: 1, records });
});

test('auth attempt limit bounds password hashing work and oversized bodies are rejected', async t => {
  const { request } = await fixture(t);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { text: 'x'.repeat(1024 * 1024) } })).status, 413);
  for (let index = 0; index < 30; index++) await request('/api/auth/login', { method: 'POST', body: {} });
  assert.equal((await request('/api/auth/login', { method: 'POST', body: {} })).status, 429);
});


test('simultaneous slow request bodies cannot bypass the two-hash concurrency limit', async t => {
  const fixtureData = await fixture(t);
  const pending = [];
  const results = Array.from({ length: 3 }, () => new Promise((resolveResponse, reject) => {
    const req = http.request(`${fixtureData.base}/api/auth/login`, { method: 'POST', headers: { origin, 'content-type': 'application/json' } }, response => {
      response.resume();
      response.on('end', () => resolveResponse(response.statusCode));
    });
    req.on('error', reject);
    // All requests pass the initial rate check before any body is complete.
    req.write('{"username":"unknown","password":');
    pending.push(req);
  }));
  await new Promise(resolveWait => setTimeout(resolveWait, 50));
  for (const req of pending) req.end(`${JSON.stringify(password)}}`);
  assert.deepEqual((await Promise.all(results)).sort(), [401, 401, 429]);
});

test('daily backup verifies new copy before pruning only old owned backup names', async t => {
  const { dataDir, setup } = await fixture(t);
  await setup();
  const runDaily = () => execFileSync(process.execPath, ['server/backup-daily.mjs'], { cwd: resolve(import.meta.dirname, '..'), env: { ...process.env, GARDEN_DATA_DIR: dataDir }, stdio: 'pipe' });
  runDaily();
  const backupDir = join(dataDir, 'backups');
  const old = join(backupDir, 'garden-20000101T000000000Z.sqlite');
  const unrelated = join(backupDir, 'my-20000101-backup.sqlite');
  const invalid = join(backupDir, 'garden-20000231T000000000Z.sqlite');
  for (const file of [old, unrelated, invalid]) writeFileSync(file, 'untouched test fixture');
  runDaily();
  assert.equal(existsSync(old), false);
  assert.equal(existsSync(unrelated), true);
  assert.equal(existsSync(invalid), true);
  const snapshots = readdirSync(backupDir).filter(name => /^garden-\d{8}T\d{9}Z\.sqlite$/.test(name) && name !== 'garden-20000231T000000000Z.sqlite');
  assert.ok(snapshots.length >= 1);
  const backup = new DatabaseSync(join(backupDir, snapshots.at(-1)), { readOnly: true });
  assert.equal(backup.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  backup.close();
});
