import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRoomServer, ROOMS } from './server.js';

test('three rooms: snapshots, switching, late media, sync and signaling isolation', async t => {
  const { server, wss } = createRoomServer();
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const clients = [];
  t.after(async () => { clients.forEach(client => client.ws.terminate()); wss.close(); await new Promise(resolve => server.close(resolve)); });
  async function client(name, room) {
    const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`), messages = [];
    ws.on('message', data => messages.push(JSON.parse(data)));
    await once(ws, 'open');
    const c = { ws, messages, send: data => ws.send(JSON.stringify(data)) }; clients.push(c);
    c.send({ type: 'join', name, room });
    c.wait = async predicate => { for (let i = 0; i < 100; i++) { const index = messages.findIndex(predicate); if (index >= 0) return messages.splice(index, 1)[0]; await new Promise(r => setTimeout(r, 10)); } throw new Error('Message timeout'); };
    c.id = (await c.wait(m => m.type === 'participants')).self; return c;
  }
  const a = await client('A', ROOMS[0]);
  a.send({ type: 'media', media: { screen: 'screen-stream', mic: 'mic-stream' } });
  await a.wait(m => m.participants?.[0]?.media?.screen === 'screen-stream');
  const b = await client('B', ROOMS[0]);
  b.send({ type: 'sync' });
  const joined = await b.wait(m => m.participants?.length === 2);
  assert.equal(joined.participants.find(p => p.id === a.id).media.mic, 'mic-stream');
  assert.deepEqual(joined.sharing, [a.id]);
  const c = await client('C', ROOMS[1]); const d = await client('D', ROOMS[2]);
  a.send({ type: 'offer', to: b.id, offer: { type: 'offer', sdp: 'in-room' } });
  assert.equal((await b.wait(m => m.type === 'offer')).offer.sdp, 'in-room');
  a.send({ type: 'offer', to: c.id, offer: { type: 'offer', sdp: 'cross-room' } });
  c.send({ type: 'sync' }); await c.wait(m => m.type === 'participants');
  await new Promise(r => setTimeout(r, 60));
  assert.equal(c.messages.some(m => m.type === 'offer'), false);
  a.send({ type: 'join', name: 'A', room: ROOMS[1] });
  const switched = await a.wait(m => m.room === ROOMS[1]);
  assert.equal(switched.participants.length, 2); assert.deepEqual(switched.sharing, []);
  assert.deepEqual(switched.participants.find(p => p.id === a.id).media, {});
  const old = await b.wait(m => m.participants?.length === 1); assert.equal(old.participants[0].id, b.id);
  a.ws.send('{broken'); await a.wait(m => m.type === 'error');
  a.send({ type: 'sync' }); assert.equal((await a.wait(m => m.room === ROOMS[1])).participants.length, 2);
  d.send({ type: 'sync' }); assert.equal((await d.wait(m => m.type === 'participants')).participants.length, 1);
  a.ws.close(); await c.wait(m => m.participants?.length === 1);
});
