import WebSocket from 'ws';
const endpoint = process.argv[2];
if (!endpoint) throw new Error('Informe o endpoint WSS.');
const clients = [];
async function connect(name, room) {
  const ws = new WebSocket(endpoint), queue = [];
  clients.push(ws); ws.on('message', raw => queue.push(JSON.parse(raw)));
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  const send = data => ws.send(JSON.stringify(data));
  const wait = async condition => { for (let i = 0; i < 100; i++) { const index = queue.findIndex(condition); if (index >= 0) return queue.splice(index, 1)[0]; await new Promise(r => setTimeout(r, 50)); } throw new Error('Timeout da resposta'); };
  send({ type: 'join', name, room }); const joined = await wait(m => m.type === 'participants');
  return { ws, send, wait, id: joined.self };
}
const timeout = setTimeout(() => { clients.forEach(ws => ws.terminate()); process.exitCode = 1; }, 20000);
try {
  const a = await connect('Verificação Aurora 015 A', 'Sala de reuniões');
  const b = await connect('Verificação Aurora 015 B', 'Sala de apresentação');
  a.send({ type: 'join', name: 'Verificação Aurora 015 A', room: 'Sala de apresentação' });
  await a.wait(m => m.room === 'Sala de apresentação' && m.participants.some(p => p.id === b.id));
  b.send({ type: 'sync' }); await b.wait(m => m.participants?.some(p => p.id === a.id));
  a.ws.close(); await b.wait(m => m.participants && !m.participants.some(p => p.id === a.id));
  console.log('PASS WSS público: entrada, troca, sincronização e saída.');
} finally { clearTimeout(timeout); clients.forEach(ws => ws.close()); }
