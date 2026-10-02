import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { buildQueue, SAMPLE_CLIENTS, SAMPLE_TODAY } from '../src/lib/renewal-demo.mjs';

const client = (id, dueDate, name = id) => ({ id, name, service: '演示服务', dueDate });

test('sample queue covers overdue, today, inclusive lead boundary and later dates', () => {
  assert.deepEqual(buildQueue(SAMPLE_CLIENTS, SAMPLE_TODAY, 30).map(({ daysUntil, status }) => [daysUntil, status]), [
    [-4, 'overdue'], [0, 'due'], [14, 'due'], [30, 'due'], [60, 'later'],
  ]);
  assert.deepEqual(buildQueue(SAMPLE_CLIENTS, SAMPLE_TODAY, 0).map(({ status }) => status), [
    'overdue', 'due', 'later', 'later', 'later',
  ]);
  assert.equal(buildQueue([client('year', '2027-10-02')], SAMPLE_TODAY, 365)[0].status, 'due');
});

test('handled clients are suppressed from action states and ordered after later clients', () => {
  const result = buildQueue(SAMPLE_CLIENTS, SAMPLE_TODAY, 30, ['sample-overdue', 'sample-boundary', 'unknown']);
  assert.deepEqual(result.map(({ id, status }) => [id, status]), [
    ['sample-today', 'due'], ['sample-soon', 'due'], ['sample-later', 'later'],
    ['sample-overdue', 'handled'], ['sample-boundary', 'handled'],
  ]);
  assert.equal(result[3].daysUntil, -4);
});

test('sorting is deterministic by calendar date, then name and ID without mutating inputs', () => {
  const clients = Object.freeze([
    Object.freeze(client('z', '2026-10-03', 'A')),
    Object.freeze(client('b', '2026-10-03', 'B')),
    Object.freeze(client('a', '2026-10-03', 'A')),
    Object.freeze(client('old', '2026-09-30')),
  ]);
  const handled = Object.freeze([]);
  const snapshot = JSON.stringify(clients);
  const result = buildQueue(clients, SAMPLE_TODAY, 30, handled);
  assert.deepEqual(result.map(({ id }) => id), ['old', 'a', 'z', 'b']);
  assert.deepEqual(result, buildQueue([...clients].reverse(), SAMPLE_TODAY, 30, handled));
  result[0].name = 'changed';
  assert.equal(JSON.stringify(clients), snapshot);
  assert.deepEqual(buildQueue([], SAMPLE_TODAY, 30), []);
});

test('strict date validation rejects impossible dates and non-date strings', () => {
  for (const value of ['2026-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00',
    '2026-1-02', '2026-10-02T00:00:00Z', ' 2026-10-02', '', null, 20261002]) {
    assert.throws(() => buildQueue([], value, 30), /today.*valid ISO calendar date/);
    assert.throws(() => buildQueue([client('bad', value)], SAMPLE_TODAY, 30), /dueDate.*valid ISO calendar date/);
  }
});

test('calendar arithmetic handles leap days, centuries, year boundaries and early ISO years', () => {
  for (const [today, dueDate, days] of [
    ['2024-02-28', '2024-03-01', 2], ['2023-02-28', '2023-03-01', 1],
    ['2000-02-28', '2000-03-01', 2], ['1900-02-28', '1900-03-01', 1],
    ['2026-12-31', '2027-01-01', 1], ['0099-12-31', '0100-01-01', 1],
  ]) {
    assert.equal(buildQueue([client('date', dueDate)], today, 30)[0].daysUntil, days);
  }
  assert.throws(() => buildQueue([], '1900-02-29', 30), /valid ISO calendar date/);
});

test('validates lead days and client identity before building a queue', () => {
  for (const leadDays of [-1, 366, 1.5, NaN, Infinity, '30', null]) {
    assert.throws(() => buildQueue([], SAMPLE_TODAY, leadDays), /leadDays.*integer from 0 to 365/);
  }
  assert.throws(() => buildQueue(null, SAMPLE_TODAY, 30), /clients must be an array/);
  assert.throws(() => buildQueue([null], SAMPLE_TODAY, 30), /nonempty id, name and service/);
  assert.throws(() => buildQueue([client('', SAMPLE_TODAY)], SAMPLE_TODAY, 30), /nonempty id/);
  assert.throws(() => buildQueue([client('same', SAMPLE_TODAY), client('same', SAMPLE_TODAY)], SAMPLE_TODAY, 30), /Duplicate client ID/);
  assert.throws(() => buildQueue([], SAMPLE_TODAY, 30, [123]), /handledIds.*string IDs/);
});

test('day differences remain identical across DST transitions and time zones', () => {
  const moduleUrl = new URL('../src/lib/renewal-demo.mjs', import.meta.url).href;
  const script = `import { buildQueue } from ${JSON.stringify(moduleUrl)};
    const cases = [['2026-03-07', '2026-03-09'], ['2026-10-31', '2026-11-02']];
    console.log(JSON.stringify(cases.map(([today, dueDate]) =>
      buildQueue([{ id: 'a', name: 'A', service: 'demo', dueDate }], today, 2)[0])));`;
  const outputs = ['UTC', 'America/New_York', 'Asia/Shanghai', 'Pacific/Auckland'].map((TZ) =>
    execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', env: { ...process.env, TZ } }));
  for (const output of outputs) {
    assert.equal(output, outputs[0]);
    assert.deepEqual(JSON.parse(output).map(({ daysUntil, status }) => [daysUntil, status]), [[2, 'due'], [2, 'due']]);
  }
});
