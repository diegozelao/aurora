import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';
import WebSocket from 'ws';
import { createRoomServer, ROOMS } from './server.js';

const wait = async condition => { for (let i = 0; i < 150; i++) { if (condition()) return; await new Promise(r => setTimeout(r, 10)); } throw new Error('UI timeout'); };
test('render, enter, switch without form, sync, media cleanup and sound controls', async t => {
  const { server, wss } = createRoomServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/`;
  const compiled = await build({ entryPoints: [fileURLToPath(new URL('../front/src/main.jsx', import.meta.url))], bundle: true, write: false, format: 'iife', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.env.VITE_WS_URL': 'undefined', 'process.env.NODE_ENV': '"production"' } });
  const errors = [], calls = [], windows = [], sockets = [];
  t.after(async () => { windows.forEach(w => w.close()); sockets.forEach(ws => ws.terminate()); for (const ws of wss.clients) ws.terminate(); wss.close(); await new Promise(r => server.close(r)); });
  function browser() {
    const console = new VirtualConsole(); console.on('jsdomError', error => errors.push(error));
    const dom = new JSDOM('<div id="root"></div>', { url, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: console });
    const w = dom.window; windows.push(w);
    w.WebSocket = class extends WebSocket { constructor(url) { super(url); sockets.push(this); } };
    w.peerInstances = [];
    w.RTCPeerConnection = class {
      constructor() { w.peerInstances.push(this); }
      senders = []; signalingState = 'stable'; connectionState = 'new';
      addTrack(track) { this.senders.push({ track }); }
      removeTrack(sender) { this.senders.splice(this.senders.indexOf(sender), 1); }
      getSenders() { return this.senders; }
      close() { this.signalingState = 'closed'; }
    };
    w.HTMLMediaElement.prototype.play = () => Promise.resolve(); w.HTMLMediaElement.prototype.pause = () => {};
    function stream(kind) {
      const track = { kind, stopped: false, stop() { this.stopped = true; }, onended: null };
      const stream = { id: `${kind}-${calls.length}`, getTracks: () => [track], track }; calls.push(stream); return Promise.resolve(stream);
    }
    Object.defineProperty(w.navigator, 'mediaDevices', { value: { getUserMedia: opts => stream(opts.audio ? 'audio' : 'video'), getDisplayMedia: () => stream('screen') } });
    Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async value => { w.invite = value; } } });
    w.eval(compiled.outputFiles[0].text);
    return w;
  }
  const button = (w, text) => [...w.document.querySelectorAll('button')].find(b => b.textContent.includes(text));
  const enter = async (w, name) => {
    await wait(() => w.document.querySelector('#name'));
    const input = w.document.querySelector('#name');
    Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(input, name);
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
    await wait(() => !button(w, 'Entrar na sala').disabled); button(w, 'Entrar na sala').click();
    await wait(() => w.document.querySelectorAll('.participant').length > 0);
  };
  const a = browser(), b = browser(); await enter(a, 'Teste A'); await enter(b, 'Teste B');
  await wait(() => a.document.querySelectorAll('.participant').length === 2);
  assert.equal(calls.length, 0, 'No automatic captures');
  button(a, 'Ativar mic').click(); await wait(() => Boolean(button(a, 'Desligar mic')));
  const mic = calls[0];
  b.peerInstances[0].ontrack({ streams: [mic], track: mic.track });
  await wait(() => b.document.querySelector('audio'));
  assert.equal(b.document.querySelector('audio').muted, false);
  b.document.querySelector('[aria-label="Silenciar som da sala"]').click();
  await wait(() => b.document.querySelector('audio').muted);
  button(a, 'Compartilhar tela').click(); await wait(() => a.document.querySelector('.presentation'));
  button(a, ROOMS[1]).click();
  await wait(() => a.document.querySelector('h1')?.textContent === ROOMS[1] && a.document.querySelectorAll('.participant').length === 1);
  assert.equal(a.document.querySelector('#name'), null, 'Room switching does not return to the entry form');
  assert.equal(a.document.querySelector('.participant strong').textContent, 'Teste A (você)');
  assert.equal(calls.every(stream => stream.track.stopped), true, 'Switching stops mic and screen tracks');
  assert.equal(a.document.querySelector('.presentation'), null);
  await wait(() => b.document.querySelectorAll('.participant').length === 1);
  button(a, 'Atualizar sala').click(); await wait(() => !button(a, 'Atualizar sala')?.disabled);
  button(a, ROOMS[2]).click(); await wait(() => a.document.querySelector('h1')?.textContent === ROOMS[2] && a.document.querySelector('.participant'));
  button(a, 'Convidar').click(); await wait(() => a.invite); assert.equal(new URL(a.invite).searchParams.get('room'), ROOMS[2]);
  a.document.querySelector('[aria-label="Silenciar som da sala"]').click();
  await wait(() => a.document.querySelector('[aria-label="Ativar som da sala"]'));
  assert.deepEqual(errors, []);
});
