import test from 'node:test';
import assert from 'node:assert/strict';
import { privateReturnPath, loginUrl } from '../src/lib/private-routes.mjs';
test('login returns only to known private pages and rejects external or disguised redirects', () => {
  for (const path of ['/private/', '/private/cycle/']) {
    assert.equal(privateReturnPath(path), path);
    assert.equal(new URL(loginUrl(path), 'https://ymihh.xyz').searchParams.get('next'), path);
  }
  for (const path of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/private/../account/', '/private/cycle/?next=https://evil.example', '%2f%2fevil.example', '/api/cycle', '/tools/']) {
    assert.equal(privateReturnPath(path), '/private/');
  }
});
