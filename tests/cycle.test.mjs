import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { todayLocal, dayNumber, daysInclusive, validateRecords, parseBackup, makeBackup } from '../src/lib/cycle.mjs';

const TODAY = '2026-09-28';
const record = (id = 'a', start = '2026-09-01', end = '2026-09-05') => ({ id, start, end });

test('calendar dates reject malformed and impossible dates, including century leap rules', () => {
  for (const value of ['2026-02-29', '1900-02-29', '2026-04-31', '2026-00-12', '2026-13-01', '2026-01-00', '2026-1-01', '1899-12-31', '2026-01-01T00:00:00Z', null]) {
    assert.throws(() => dayNumber(value));
  }
  assert.equal(dayNumber('2000-02-29') + 1, dayNumber('2000-03-01'));
  assert.equal(daysInclusive('2024-02-28', '2024-03-01'), 3);
  assert.equal(daysInclusive('2026-09-01', '2026-09-01'), 1);
  assert.throws(() => daysInclusive('2026-09-05', '2026-09-01'), /早于/);
});

test('device local date and day counts work across timezone midnight and DST', () => {
  const moduleUrl = new URL('../src/lib/cycle.mjs', import.meta.url).href;
  const script = `import {todayLocal, daysInclusive} from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify([todayLocal(new Date('2026-03-09T02:00:00Z')), daysInclusive('2026-03-07','2026-03-09'),daysInclusive('2026-10-31','2026-11-02')]));`;
  for (const [timezone, expectedDate] of [['America/Los_Angeles', '2026-03-08'], ['Asia/Shanghai', '2026-03-09']]) {
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ: timezone }, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(output), [expectedDate, 3, 3]);
  }
  assert.throws(() => todayLocal(new Date('invalid')));
});

test('validation clones and sanitizes records, sorts latest first, and preserves IDs exactly', () => {
  const source = [Object.freeze({ ...record(' older '), secret: 'discard' }), Object.freeze(record('newer', '2026-09-28', null))];
  Object.freeze(source);
  const actual = validateRecords(source, TODAY);
  assert.deepEqual(actual, [record('newer', '2026-09-28', null), record(' older ')]);
  assert.notEqual(actual[1], source[0]);
  assert.deepEqual(validateRecords([], TODAY), []);
});

test('inclusive overlap and ongoing-record rules protect history', () => {
  assert.throws(() => validateRecords([record(), record('b', '2026-09-05', '2026-09-07')], TODAY), /重叠/);
  assert.throws(() => validateRecords([record(), record('b', '2026-09-02', '2026-09-03')], TODAY), /重叠/);
  assert.throws(() => validateRecords([record('a', '2026-09-01', null), record('b', '2026-09-10', null)], TODAY), /只能有一条/);
  assert.throws(() => validateRecords([record('a', '2026-09-01', null), record('b', '2026-09-10', '2026-09-12')], TODAY), /最近一次/);
  assert.equal(validateRecords([record(), record('b', '2026-09-06', null)], TODAY).length, 2);
});

test('future dates, reversed ranges, invalid IDs, malformed records, and excess records fail', () => {
  assert.throws(() => validateRecords([record('a', '2026-09-29', null)], TODAY), /未来/);
  assert.throws(() => validateRecords([record('a', '2026-09-01', '2026-09-29')], TODAY), /未来/);
  assert.throws(() => validateRecords([record('a', '2026-09-05', '2026-09-01')], TODAY), /早于/);
  for (const invalid of [null, {}, Array(1), [null], [[]], [{ start: '2026-09-01', end: null }], [{ id: 'a', start: '2026-09-01' }], [record('')], [record(' ')], [record('x'.repeat(101))], [record(), record()]]) {
    assert.throws(() => validateRecords(invalid, TODAY));
  }
  assert.throws(() => validateRecords(Array.from({ length: 1001 }, (_, i) => record(String(i))), TODAY), /1000/);
});

test('backup roundtrip keeps exact IDs and rejects invalid imports without manufacturing records', () => {
  const source = [record('exact-id'), record('ongoing', '2026-09-28', null)];
  const exported = makeBackup(source, TODAY);
  assert.equal(JSON.parse(exported).version, 1);
  assert.ok(!Number.isNaN(Date.parse(JSON.parse(exported).exportedAt)));
  assert.deepEqual(parseBackup(exported, TODAY), [...source].reverse());
  for (const invalid of ['{', 'null', '[]', '{}', '{"version":2,"records":[]}', '{"version":"1","records":[]}', '{"version":1,"records":null}', JSON.stringify({version:1,records:[{start:'2026-09-01',end:null}]}), JSON.stringify({version:1,records:[record('future','2026-10-01',null)]})]) {
    assert.throws(() => parseBackup(invalid, TODAY));
  }
  assert.throws(() => makeBackup([record('future', '2026-10-01', null)], TODAY));
});
