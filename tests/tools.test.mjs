import test from 'node:test';
import assert from 'node:assert/strict';
import { formatJson, timestampToDate, localDateToTimestamp, transformUrl } from '../src/lib/tools.mjs';

test('JSON preserves values and supports compact output', () => {
  const source = '{"中文":[true,null,3],"nested":{"a":"b"}}';
  assert.deepEqual(JSON.parse(formatJson(source)), JSON.parse(source));
  assert.equal(formatJson(source, true), source);
  assert.throws(() => formatJson('{broken}'));
  assert.throws(() => formatJson('  '));
});
test('timestamp accepts zero, negative dates and both units', () => {
  assert.equal(timestampToDate('0').toISOString(), '1970-01-01T00:00:00.000Z');
  assert.equal(timestampToDate('-1').toISOString(), '1969-12-31T23:59:59.000Z');
  assert.equal(timestampToDate('1000','milliseconds').getTime(),1000);
  assert.equal(timestampToDate('1','seconds').getTime(),1000);
  for (const value of ['', '1.2', '12abc', '9007199254740992', '8640000000001']) assert.throws(() => timestampToDate(value));
});
test('JSON formatting never rounds large IDs or changes numeric literal values', () => {
  const source = '{"id":9223372036854775807,"amount":1e400,"empty":{},"items":[],"text":"a \\\" b\\\\ c"}';
  const formatted = formatJson(source);
  assert.ok(formatted.includes('9223372036854775807'));
  assert.ok(formatted.includes('1e400'));
  assert.equal(formatJson(formatted,true),source);
  assert.equal(formatJson('" a b "'), '" a b "');
});
test('date conversion returns seconds and milliseconds and rejects empty values', () => {
  assert.deepEqual(localDateToTimestamp('1970-01-01T00:00:00Z'), {seconds:0,milliseconds:0});
  assert.throws(() => localDateToTimestamp(''));
});
test('URL components round-trip Unicode and reserved delimiters', () => {
  const source = '你好 🌱 &x=1+2 /?';
  assert.equal(transformUrl(transformUrl(source,'encode'),'decode'),source);
  assert.equal(transformUrl('a+b','decode'),'a+b');
  assert.throws(() => transformUrl('%E0%A4','decode'));
  assert.throws(() => transformUrl('','encode'));
});
