import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import { Copy, LogOut, MonitorUp, Users, Wifi, X } from 'lucide-react';
import './style.css';

const ROOM = 'Sala principal';
const Avatar = ({ name }) => <span className="avatar">{(name || '?').trim().split(/\s+/).map((v) => v[0]).join('').slice(0, 2).toUpperCase()}</span>;

function App() {
  const [name, setName] = useState(''); const [joined, setJoined] = useState(false); const [people, setPeople] = useState([]); const [sharing, setSharing] = useState(false); const [error, setError] = useState(''); const [copied, setCopied] = useState(false);
  const socket = useRef(null); const peers = useRef(new Map()); const screen = useRef(null); const video = useRef(null); const self = useRef(null);
  const send = (message) => socket.current?.readyState === WebSocket.OPEN && socket.current.send(JSON.stringify(message));
  const peer = (id, initiator) => {
    if (peers.current.has(id)) return peers.current.get(id);
    const connection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }); peers.current.set(id, connection);
    screen.current?.getTracks().forEach((track) => connection.addTrack(track, screen.current));
    connection.onicecandidate = ({ candidate }) => candidate && send({ type: 'candidate', to: id, candidate });
    if (initiator) connection.onnegotiationneeded = async () => { try { const offer = await connection.createOffer(); await connection.setLocalDescription(offer); send({ type: 'offer', to: id, offer }); } catch { setError('Não foi possível conectar outro participante.'); } };
    return connection;
  };
  useEffect(() => () => { socket.current?.close(); peers.current.forEach((item) => item.close()); screen.current?.getTracks().forEach((track) => track.stop()); }, []);
  const join = (event) => {
    event.preventDefault(); const clean = name.trim().slice(0, 32); if (!clean) return setError('Informe seu nome para entrar.'); setError('');
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws'; const ws = new WebSocket(`${protocol}://${location.host}/ws`); socket.current = ws;
    ws.onopen = () => { setJoined(true); send({ type: 'join', name: clean, room: ROOM }); };
    ws.onerror = () => setError('A sala não pôde ser conectada. Tente novamente.'); ws.onclose = () => setJoined(false);
    ws.onmessage = async ({ data }) => { const message = JSON.parse(data);
      if (message.type === 'participants') { self.current = message.self; setPeople(message.participants.map((item) => ({ ...item, self: item.id === message.self }))); message.participants.filter((item) => item.id !== message.self && message.self < item.id).forEach((item) => peer(item.id, true)); }
      if (message.type === 'user-joined') { setPeople((current) => [...current.filter((item) => item.id !== message.user.id), message.user]); if (self.current < message.user.id) peer(message.user.id, true); }
      if (message.type === 'user-left') { peers.current.get(message.id)?.close(); peers.current.delete(message.id); setPeople((current) => current.filter((item) => item.id !== message.id)); }
      if (message.type === 'offer') { const connection = peer(message.from, false); await connection.setRemoteDescription(message.offer); const answer = await connection.createAnswer(); await connection.setLocalDescription(answer); send({ type: 'answer', to: message.from, answer }); }
      if (message.type === 'answer') await peers.current.get(message.from)?.setRemoteDescription(message.answer);
      if (message.type === 'candidate') await peers.current.get(message.from)?.addIceCandidate(message.candidate);
    };
  };
  const stop = () => { screen.current?.getTracks().forEach((track) => track.stop()); screen.current = null; peers.current.forEach((connection) => connection.getSenders().forEach((sender) => sender.track && connection.removeTrack(sender))); setSharing(false); send({ type: 'sharing', active: false }); };
  const share = async () => { if (sharing) return stop(); try { const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); screen.current = stream; if (video.current) video.current.srcObject = stream; stream.getVideoTracks()[0].onended = stop; peers.current.forEach((connection) => stream.getTracks().forEach((track) => connection.addTrack(track, stream))); setSharing(true); send({ type: 'sharing', active: true }); } catch { setError('O compartilhamento foi cancelado ou não está disponível neste navegador.'); } };
  const invite = async () => { try { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setError('Não foi possível copiar o link.'); } };
  const leave = () => { stop(); socket.current?.close(); location.reload(); }; const me = people.find((item) => item.self) || { name: name || 'Você' };
  if (!joined) return <main className="join"><section><span className="mark"><MonitorUp size={20} /></span><p className="eyebrow">{ROOM}</p><h1>Entre na sala.</h1><p>Use seu nome para participar. Ele será visível somente enquanto esta sessão estiver ativa.</p><form onSubmit={join}><label htmlFor="name">Seu nome</label><input id="name" autoFocus autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Como podemos chamar você?" maxLength="32" /><button>Entrar na sala</button></form>{error && <b className="error">{error}</b>}</section></main>;
  return <main className="room"><header><div className="brand"><span className="mark"><MonitorUp size={18} /></span><div><strong>{ROOM}</strong><small><i /> Conectado</small></div></div><div className="actions"><button onClick={invite}><Copy size={16} /> {copied ? 'Link copiado' : 'Convidar'}</button><button aria-label="Sair" onClick={leave}><LogOut size={18} /></button></div></header><div className="body"><section className="stage"><div><p className="eyebrow">Sala de compartilhamento</p><h1>{sharing ? 'Você está compartilhando sua tela' : 'Pronto para colaborar?'}</h1><p className="sub">{sharing ? 'Todos os participantes conectados podem ver sua apresentação.' : 'A transmissão só começa após sua confirmação no navegador.'}</p></div><div className={`screen ${sharing ? 'live' : ''}`}>{sharing ? <><video ref={video} autoPlay muted playsInline /><span>AO VIVO</span></> : <div className="empty"><span className="mark"><MonitorUp size={32} /></span><h2>Compartilhe o que importa.</h2><p>Nenhuma câmera ou áudio será ativado automaticamente.</p><button onClick={share}><MonitorUp size={17} /> Compartilhar tela</button></div>}</div>{error && <p className="error notice">{error}<button aria-label="Fechar aviso" onClick={() => setError('')}><X size={15} /></button></p>}<footer><div><Wifi size={16} /> Conexão em tempo real</div><button className={sharing ? 'stop' : ''} onClick={share}><MonitorUp size={17} /> {sharing ? 'Parar compartilhamento' : 'Compartilhar tela'}</button></footer></section><aside><div className="side-title"><div><p className="eyebrow">Na sala</p><h2>Participantes <em>{people.length}</em></h2></div><Users size={19} /></div>{people.map((person) => <article key={person.id}><Avatar name={person.name} /><div><strong>{person.self ? `${person.name} (você)` : person.name}</strong><small>{person.self ? 'Você entrou nesta sala' : 'Conectado agora'}</small></div><i /></article>)}<div className="privacy"><strong>Sem dados pré-preenchidos</strong><p>A lista mostra somente pessoas conectadas agora.</p></div></aside></div></main>;
}
createRoot(document.getElementById('root')).render(<App />);
