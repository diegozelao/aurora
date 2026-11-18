const { test } = require('node:test');
const assert = require('node:assert/strict');
const permissions = require('./permissions.cjs');
test('Electron screen permission accepted; physical media and foreign origins denied', () => {
  const origin = 'https://aurora.ddtech.cloud';
  assert.equal(permissions.check('media', origin), true);
  assert.equal(permissions.request('media', origin, {mediaTypes: []}), true);
  for (const mediaTypes of [['audio'], ['video'], ['audio', 'video']]) assert.equal(permissions.request('media', origin, {mediaTypes}), false);
  assert.equal(permissions.request('media', origin), false);
  assert.equal(permissions.request('media', origin, {mediaTypes: ['audio']}, true), true);
  assert.equal(permissions.request('media', origin, {mediaTypes: ['video']}, true), true);
  assert.equal(permissions.request('media', origin, {mediaTypes: ['unknown']}, true), false);
  assert.equal(permissions.request('media', 'https://example.com', {mediaTypes: ['audio']}, true), false);
  assert.equal(permissions.request('media', 'https://example.com', {mediaTypes: []}), false);
  assert.equal(permissions.check('media', 'https://example.com'), false);
});
