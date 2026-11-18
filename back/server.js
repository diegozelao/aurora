import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';

export const ROOMS = ['Sala principal', 'Sala de reuniões', 'Sala de apresentação'];
const defaultDist = fileURLToPath(new URL('../front/dist', import.meta.url));

export function createRoomServer({ dist = defaultDist } = {}) {
  const clients = new Map();
  const send = (client, data) => { if (client.ws.readyState === 1) client.ws.send(JSON.stringify(data)); };
  const members = room => [...clients.values()].filter(c => c.room === room);
  const snapshot = client => send(client, {
    type: 'participants', room: client.room, self: client.id,
    participants: members(client.room).map(c => ({ id: c.id, name: c.name, media: c.media })),
    sharing: members(client.room).filter(c => c.media.screen).map(c => c.id)
  });
  const update = room => { if (room) members(room).forEach(snapshot); };
  const server = createServer((req, res) => {
    if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true,"version":"0.1.5"}'); }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end(); }
    let file = resolve(dist, '.' + pathname);
    if (!file.startsWith(dist + sep)) file = resolve(dist, 'index.html');
    if (!existsSync(file) || !statSync(file).isFile()) {
      if (extname(pathname)) { res.writeHead(404); return res.end(); }
      file = resolve(dist, 'index.html');
    }
    if (!existsSync(file)) { res.writeHead(503); return res.end('Build unavailable'); }
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    createReadStream(file).pipe(res);
  });
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 128 * 1024 });
  wss.on('connection', ws => {
    const client = { id: randomUUID(), ws, room: null, name: '', media: {}, alive: true };
    clients.set(client.id, client);
    ws.on('pong', () => { client.alive = true; });
    ws.on('error', () => {});
    ws.on('message', raw => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch { return send(client, { type: 'error', message: 'Mensagem inválida.' }); }
      if (!message || typeof message !== 'object') return;
      if (message.type === 'join') {
        if (!ROOMS.includes(message.room) || typeof message.name !== 'string' || !message.name.trim()) return send(client, { type: 'error', message: 'Nome ou sala inválidos.' });
        const previous = client.room;
        if (previous !== message.room) client.media = {};
        client.room = message.room; client.name = message.name.trim().slice(0, 32);
        if (previous !== client.room) update(previous);
        update(client.room); return;
      }
      if (!client.room || (message.room && message.room !== client.room)) return;
      if (message.type === 'sync') return snapshot(client);
      if (message.type === 'media') {
        client.media = Object.fromEntries(['mic', 'camera', 'screen'].flatMap(key => typeof message.media?.[key] === 'string' && message.media[key].length <= 128 ? [[key, message.media[key]]] : []));
        update(client.room); return;
      }
      if (message.type === 'sharing') {
        if (message.active) client.media.screen = 'legacy'; else delete client.media.screen;
        update(client.room); return;
      }
      if (['offer', 'answer', 'candidate', 'request-offer'].includes(message.type)) {
        const target = clients.get(message.to);
        if (!target || target === client || target.room !== client.room) return;
        send(target, { type: message.type, room: client.room, from: client.id, offer: message.offer, answer: message.answer, candidate: message.candidate });
      }
    });
    ws.on('close', () => { clients.delete(client.id); update(client.room); });
  });
  const heartbeat = setInterval(() => {
    for (const client of clients.values()) { if (!client.alive) client.ws.terminate(); else { client.alive = false; client.ws.ping(); } }
  }, 15000);
  heartbeat.unref();
  server.on('close', () => clearInterval(heartbeat));
  return { server, wss };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  createRoomServer().server.listen(Number(process.env.PORT || 3001), '0.0.0.0', () => console.log('Aurora Rooms 0.1.5 listening'));
}
