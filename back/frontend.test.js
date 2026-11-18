import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRoomServer } from './server.js';

test('serves the production frontend, health check and SPA fallback', async t => {
  const { server, wss } = createRoomServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    for (const ws of wss.clients) ws.terminate();
    wss.close();
    await new Promise(resolve => server.close(resolve));
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, version: '2.0.0' });

  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  const homeHtml = await home.text();
  assert.match(homeHtml, /id="root"/);
  const scriptPath = homeHtml.match(/src="([^"]+\.js)"/)?.[1];
  assert.ok(scriptPath, 'production HTML should reference a JavaScript asset');

  const asset = await fetch(`${base}${scriptPath}`);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /javascript/);

  const route = await fetch(`${base}/room/inexistente`);
  assert.equal(route.status, 200);
  assert.match(await route.text(), /id="root"/);

  const missingAsset = await fetch(`${base}/assets/inexistente.js`);
  assert.equal(missingAsset.status, 404);
});
