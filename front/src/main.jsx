import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Check, Copy, Download, LogOut, Maximize2, Mic, MicOff, MonitorUp, RefreshCw, Send, Users, Volume2, VolumeX, X } from 'lucide-react';
import { RoomPeers } from './rtc.js';
import { invoke } from '@tauri-apps/api/core';
import './room.css';
import './media-stage.css';
import './header-layout.css';
import './brand.css';

export const ROOMS = ['Sala principal', 'Sala de reuniões', 'Sala de apresentação'];
export const APP_VERSION = '2.0.0';
const iceServers = (() => {
  const value = import.meta.env.VITE_ICE_SERVERS;
  if (!value) return [{ urls: 'stun:stun.l.google.com:19302' }];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) && parsed.length ? parsed : [{ urls: 'stun:stun.l.google.com:19302' }]; }
  catch { return [{ urls: 'stun:stun.l.google.com:19302' }]; }
})();
const initialRoom = () => { const value = new URLSearchParams(location.search).get('room'); return ROOMS.includes(value) ? value : ROOMS[0]; };
const stopTracks = stream => stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
const runningInTauri = () => Boolean(window.__TAURI_INTERNALS__);
const savedName = () => { try { return localStorage.getItem('aurora.profile.name') || ''; } catch { return ''; } };
function Avatar({ name }) { return <span className="avatar" aria-hidden="true">{name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()}</span>; }
function Media({ stream, audio = false, muted = true, volume = 1 }) {
  const ref = useRef(); const [blocked, setBlocked] = useState(false);
  const play = () => ref.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  useEffect(() => { const el = ref.current; if (!el) return; el.srcObject = stream; play(); return () => { el.pause(); el.srcObject = null; }; }, [stream]);
  useEffect(() => { if (ref.current) { ref.current.volume = volume; ref.current.muted = muted; if (!muted) play(); } }, [volume, muted]);
  return <>{audio ? <audio ref={ref} autoPlay muted={muted} /> : <video ref={ref} autoPlay playsInline muted={muted} />}{blocked && !muted && <button className="play-audio" onClick={play}>Ativar reprodução</button>}</>;
}

export function App() {
  const [name, setName] = useState(savedName);
  const [sessionReady, setSessionReady] = useState(false);
  const [room, setRoom] = useState(initialRoom);
  const [entered, setEntered] = useState(false);
  const [status, setStatus] = useState('idle');
  const [people, setPeople] = useState([]);
  const [self, setSelf] = useState(null);
  const [local, setLocal] = useState({});
  const [remote, setRemote] = useState({});
  const [focused, setFocused] = useState(null);
  const [focusedPerson, setFocusedPerson] = useState(null);
  const [pending, setPending] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [sound, setSound] = useState(true);
  const [volume, setVolume] = useState(1);
  const [notice, setNotice] = useState('');
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const chatMessagesRef = useRef(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const socket = useRef(null), rtc = useRef(null), activeRoom = useRef(room), sources = useRef({}), generation = useRef(0), syncTimer = useRef(), connectTimer = useRef(), copyTimer = useRef(), busy = useRef(new Set()), restoredSession = useRef(false);

  function transmit(data) {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    socket.current.send(JSON.stringify({ ...data, room: activeRoom.current })); return true;
  }
  function publishMedia() { transmit({ type: 'media', media: Object.fromEntries(Object.entries(sources.current).map(([kind, stream]) => [kind, stream.id])) }); }
  function resetMedia() {
    rtc.current?.close(); rtc.current = null;
    Object.values(sources.current).forEach(stopTracks); sources.current = {};
    setLocal({}); setRemote({}); setPeople([]); setFocused(null); setSelf(null);
    busy.current.clear(); setPending({});
  }
  function disconnect() {
    generation.current++; clearTimeout(syncTimer.current); clearTimeout(connectTimer.current);
    const ws = socket.current; socket.current = null;
    if (ws) { ws.onclose = null; ws.onmessage = null; ws.onerror = null; ws.close(); }
    resetMedia(); setMessages([]); setSyncing(false);
  }
  function connect(target = room) {
    const profile = name.trim().slice(0, 32); try { if (profile) localStorage.setItem('aurora.profile.name', profile); } catch {}
    disconnect(); activeRoom.current = target; setRoom(target); setEntered(true); setStatus('connecting'); setError('');
    const url = new URL(location.href); url.searchParams.set('room', target); history.replaceState(null, '', url);
    const endpoint = import.meta.env.VITE_WS_URL || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    const ws = new WebSocket(endpoint); socket.current = ws;
    connectTimer.current = setTimeout(() => { if (socket.current === ws) { ws.close(); setError('A conexão demorou. Clique em reconectar.'); } }, 10000);
    ws.onopen = () => { if (socket.current === ws) transmit({ type: 'join', name: name.trim() }); };
    ws.onmessage = ({ data }) => {
      if (socket.current !== ws) return;
      let message; try { message = JSON.parse(data); } catch { return; }
      if (message.type === 'error') { setError(message.message); return; }
      if (message.room !== activeRoom.current) return;
      if (message.type === 'chat') { setMessages(current => [...current.slice(-199), message]); return; }
      if (message.type === 'participants') {
        clearTimeout(connectTimer.current); clearTimeout(syncTimer.current);
        setStatus('connected'); setSyncing(false); setSelf(message.self);
        if (!rtc.current) rtc.current = new RoomPeers({
          self: message.self, send: transmit, iceServers,
          onStream: (id, stream) => setRemote(current => ({ ...current, [id]: { ...current[id], [stream.id]: stream } })),
          onRemove: (id, streamId) => setRemote(current => { const next = { ...current }; if (streamId) { next[id] = { ...next[id] }; delete next[id][streamId]; } else delete next[id]; return next; }),
          onError: e => setError(`Falha na conexão de mídia: ${e.message}`)
        });
        rtc.current.reconcile(message.participants.filter(person => person.id !== message.self).map(person => person.id));
        setPeople(message.participants);
        setFocused(current => message.participants.some(p => p.id === current && p.media?.screen) ? current : null);
      } else rtc.current?.receive(message);
    };
    ws.onerror = () => { if (socket.current === ws) setError('Não foi possível conectar. Verifique sua rede e tente novamente.'); };
    ws.onclose = () => {
      if (socket.current !== ws) return;
      socket.current = null; generation.current++; clearTimeout(syncTimer.current); clearTimeout(connectTimer.current);
      resetMedia(); setSyncing(false); setStatus('disconnected'); setNotice('Você foi desconectado. Suas capturas foram encerradas.');
    };
  }
  useEffect(() => {
    if (restoredSession.current || entered) return;
    restoredSession.current = true;
    const remembered = savedName();
    if (remembered) { setName(remembered); connect(ROOMS[0]); }
    setSessionReady(true);
  }, []);
  function synchronize(manual = true) {
    if (socket.current?.readyState !== WebSocket.OPEN) { if (manual) connect(activeRoom.current); return; }
    if (manual) { setError(''); setSyncing(true); rtc.current?.retry(); clearTimeout(syncTimer.current); syncTimer.current = setTimeout(() => { setSyncing(false); setError('A sala não respondeu. Tente reconectar.'); }, 6000); }
    transmit({ type: 'sync' });
  }
  useEffect(() => {
    const timer = setInterval(() => synchronize(false), 15000);
    const visible = () => { if (!document.hidden) synchronize(false); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visible); clearTimeout(syncTimer.current); clearTimeout(connectTimer.current); clearTimeout(copyTimer.current); socket.current?.close(); rtc.current?.close(); Object.values(sources.current).forEach(stopTracks); };
  }, []);
  useEffect(() => { const container = chatMessagesRef.current; if (container) container.scrollTop = container.scrollHeight; }, [messages]);
  useEffect(() => {
    if (!focusedPerson) return;
    const person = people.find(item => item.id === focusedPerson);
    const cameraStream = person?.id === self ? local.camera : person?.media?.camera && remote[person.id]?.[person.media.camera];
    if (!cameraStream) setFocusedPerson(null);
  }, [focusedPerson, people, local.camera, remote, self]);
  function switchRoom(target) {
    if (target === room) return;
    setNotice(`Entrando em ${target.toLowerCase()}. Microfone, câmera e tela foram desligados.`);
    connect(target);
  }
  function sendChat(event) { event.preventDefault(); const text = messageText.trim(); if (!text || !transmit({ type: 'chat', text })) return; setMessageText(''); }
  function saveName(event) { event.preventDefault(); const next = name.trim().slice(0, 32); if (!next) return; setName(next); try { localStorage.setItem('aurora.profile.name', next); } catch {} setEditingName(false); }
  function stopSource(kind) {
    const stream = sources.current[kind]; if (!stream) return;
    rtc.current?.setSource(kind, null); stopTracks(stream); delete sources.current[kind];
    setLocal({ ...sources.current }); if (kind === 'screen') setFocused(null); publishMedia();
  }
  async function toggleSource(kind) {
    if (sources.current[kind]) return stopSource(kind);
    if (busy.current.has(kind) || status !== 'connected') return;
    const token = generation.current; busy.current.add(kind); setPending(current => ({ ...current, [kind]: true })); setError('');
    let stream;
    try {
      const media = navigator.mediaDevices;
      if (kind === 'screen') {
        if (runningInTauri()) {
          const nativeSources = await invoke('list_capture_sources');
          if (!nativeSources?.length) throw new Error('Nenhuma janela ou tela disponível para captura nativa. Verifique a permissão de Gravação de Tela.');
          setNotice(`${nativeSources.length} fonte(s) nativa(s) encontrada(s). Selecione a janela ou tela no próximo seletor.`);
        }
        try {
          stream = await media.getDisplayMedia({
            video: { displaySurface: 'monitor' },
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
            systemAudio: 'include',
            surfaceSwitching: 'include',
            selfBrowserSurface: 'exclude',
            monitorTypeSurfaces: 'include'
          });
          if (!stream.getAudioTracks?.().length) {
            setNotice('A imagem foi compartilhada, mas o áudio não veio da fonte. Na próxima tentativa, escolha uma aba/janela com áudio e marque “Compartilhar áudio”.');
          }
        } catch (audioError) {
          const audioUnavailable = /audio source|audio capture|could not start/i.test(`${audioError.name} ${audioError.message}`);
          if (!audioUnavailable) throw audioError;
          setNotice('O compartilhamento foi iniciado sem áudio. Para transmitir o som, selecione uma aba/janela compatível e ative “Compartilhar áudio” no seletor do navegador.');
          stream = await media.getDisplayMedia({ video: true, audio: false });
        }
      } else {
        stream = await media.getUserMedia(kind === 'mic' ? { audio: { echoCancellation: true, noiseSuppression: true }, video: false } : { video: true, audio: false });
      }
      if (generation.current !== token || socket.current?.readyState !== WebSocket.OPEN) { stopTracks(stream); return; }
      rtc.current.setSource(kind, stream); sources.current[kind] = stream;
      stream.getTracks().forEach(track => { track.onended = () => { if (sources.current[kind] === stream) stopSource(kind); }; });
      setLocal({ ...sources.current }); publishMedia();
    } catch (e) { stopTracks(stream); if (token === generation.current) { const label = kind === 'screen' ? 'o compartilhamento' : kind === 'mic' ? 'o microfone' : 'a câmera'; const errorName = e?.name || ''; const errorMessage = typeof e === 'string' ? e : e?.message || ''; const reason = errorName === 'NotAllowedError' ? 'A permissão foi negada.' : errorName === 'NotFoundError' ? 'Nenhum dispositivo compatível foi encontrado.' : errorMessage || 'Verifique as permissões e tente novamente.'; setError(`Não foi possível ativar ${label}: ${reason}`); } }
    finally { if (token === generation.current) { busy.current.delete(kind); setPending(current => ({ ...current, [kind]: false })); } }
  }
  async function copyInvite() {
    const url = new URL(location.href); url.searchParams.set('room', room);
    try { await navigator.clipboard.writeText(url.href); setCopied(true); clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(false), 2000); }
    catch { setError(`Copie o convite pela barra de endereço: ${url.href}`); }
  }
  async function fullscreen(event) {
    const card = event.currentTarget.closest('.presentation');
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (card.requestFullscreen) await card.requestFullscreen(); else throw new Error('Tela cheia indisponível neste dispositivo.'); }
    catch (e) { setError(e.message); }
  }
  const connected = status === 'connected';
  const presenters = people.filter(person => person.media?.screen);
  const getStream = (person, kind) => person.id === self ? local[kind] : remote[person.id]?.[person.media?.[kind]];
  const statusText = connected ? 'Conectado' : status === 'connecting' ? 'Conectando…' : 'Desconectado';

  if (!sessionReady) return <main className="loading-screen"><div className="loading-card"><img className="loading-logo" src="/aurora-logo.png" alt="Aurora" /><span className="loading-orbit" aria-hidden="true" /><strong>Aurora</strong><small>Restaurando sua sala…</small></div></main>;
  if (!entered) return <main className="entry"><form className="entry-card" onSubmit={event => { event.preventDefault(); if (name.trim()) connect(); }}>
    <img className="brand-logo" src="/aurora-logo.png" alt="Aurora" /><p className="eyebrow">AURORA ROOMS</p><h1>Um espaço para<br />compartilhar ideias.</h1><p className="muted">Entre com seu nome e escolha onde conversar.</p>
    <label htmlFor="name">Seu nome</label><input id="name" value={name} onChange={event => setName(event.target.value)} autoFocus maxLength={32} placeholder="Como podemos chamar você?" required />
    <label htmlFor="entry-room">Sala</label><select id="entry-room" value={room} onChange={event => setRoom(event.target.value)}>{ROOMS.map(item => <option key={item}>{item}</option>)}</select>
    <button className="primary" type="submit" disabled={!name.trim()}>Entrar na sala</button><small className="muted">Microfone e câmera começam desligados.</small>
  </form></main>;
  return <main className="app-shell">
    <header className="app-header"><div className="header-brand-group"><div className="brand"><img className="brand-logo" src="/aurora-logo.png" alt="Aurora" /><div><strong>Aurora<span className="version">{APP_VERSION}</span></strong><small className={`connection ${connected ? 'online' : ''}`}><i />{statusText}</small></div></div>
      <div className="header-downloads"><button className="button icon-only" aria-label="Baixar aplicativo" aria-expanded={downloadsOpen} title="Baixar aplicativo" onClick={() => setDownloadsOpen(value => !value)}><Download size={17} /></button>{downloadsOpen && <div className="download-menu" role="menu"><a className="download-menu-link" href="/downloads/Aurora-macOS.dmg" download role="menuitem"><Download size={15} />macOS</a><a className="download-menu-link" href="/downloads/Aurora-Windows.exe" download role="menuitem"><Download size={15} />Windows</a></div>}</div>
      </div><div className="header-room-tools"><nav className="room-switch" aria-label="Salas">{ROOMS.map((item, index) => <button key={item} className={`room-tab ${room === item ? 'selected' : ''}`} aria-pressed={room === item} onClick={() => switchRoom(item)}><span className="room-number">0{index + 1}</span>{item}</button>)}</nav><select className="room-select" aria-label="Selecionar sala" value={room} onChange={event => switchRoom(event.target.value)}>{ROOMS.map(item => <option key={item} value={item}>{item}</option>)}</select><span className="header-room-spacer" aria-hidden="true" /><button className="button sync icon-only" aria-label={status === 'disconnected' ? 'Reconectar' : 'Atualizar sala'} title={status === 'disconnected' ? 'Reconectar' : 'Atualizar sala'} onClick={() => synchronize()} disabled={syncing || status === 'connecting'}><RefreshCw size={17} className={syncing ? 'spin' : ''} /></button><span className="header-online-count"><Users size={15} />{people.length} online</span></div>
      <div className="header-actions"><button className="button" onClick={copyInvite} disabled={!connected}>{copied ? <Check size={16} /> : <Copy size={16} />}<span>{copied ? 'Link copiado' : 'Convidar'}</span></button><button className="button leave" onClick={() => { disconnect(); setEntered(false); setStatus('idle'); setNotice(''); }}><LogOut size={16} /><span>Sair</span></button><div className="profile-menu"><button className="profile-button" aria-label="Editar nome" title="Editar nome" onClick={() => setEditingName(value => !value)}><Avatar name={name || 'Aurora'} /></button>{editingName && <form className="profile-editor" onSubmit={saveName}><label htmlFor="profile-name">Seu nome</label><input id="profile-name" value={name} onChange={event => setName(event.target.value)} maxLength={32} autoFocus /><button className="primary" type="submit" disabled={!name.trim()}>Salvar nome</button></form>}</div></div>
    </header>
    <div className="workspace"><section className="stage">
      {notice && <div className="notice" role="status">{notice}<button className="icon-button" aria-label="Fechar aviso" onClick={() => setNotice('')}><X size={16} /></button></div>}
      {error && <div className="error" role="alert">{error}<button className="icon-button" aria-label="Fechar erro" onClick={() => setError('')}><X size={16} /></button></div>}
      <div className={`media-layout ${focusedPerson ? 'video-expanded' : ''}`}>
      <div className={`presentations ${focused ? 'focused-grid' : ''}`}>
        {presenters.map(person => <section key={person.id} className={`presentation ${focused === person.id ? 'focused' : ''} ${focused && focused !== person.id ? 'thumbnail' : ''}`} aria-label={`Tela de ${person.name}`}>
          {getStream(person, 'screen') ? <Media stream={getStream(person, 'screen')} muted={person.id === self || !sound} volume={volume} /> : <div className="stream-wait"><MonitorUp size={30} /><p>Conectando à tela de {person.name}…</p></div>}
          <div className="presentation-label"><span>{person.name}{person.id === self ? ' (você)' : ''}</span><span className="live"><MonitorUp size={13} />Compartilhando</span></div>
          <div className="viewer-controls"><button className="icon-button" title="Tela cheia" aria-label={`Tela cheia de ${person.name}`} onClick={fullscreen}><Maximize2 size={17} /></button></div>
        </section>)}
      </div>
      <div className={`people-grid ${presenters.length ? 'compact' : ''} ${focusedPerson ? 'focused-person-grid' : ''}`}>{people.map(person => <article className={`person-card ${focusedPerson === person.id ? 'focused-person' : ''} ${focusedPerson && focusedPerson !== person.id ? 'person-thumbnail' : ''}`} key={person.id} onClick={() => getStream(person, 'camera') && setFocusedPerson(current => current === person.id ? null : person.id)}>
        {person.media?.camera && getStream(person, 'camera') ? <Media stream={getStream(person, 'camera')} /> : <Avatar name={person.name} />}
        <div className="person-label"><span>{person.name}{person.id === self ? ' (você)' : ''}</span>{person.media?.mic ? <Mic size={14} /> : <MicOff size={14} />}{person.media?.screen && <MonitorUp size={14} />}</div>
      </article>)}</div>
      </div>
      {!people.length && <div className="empty-stage"><Users size={32} /><p>{status === 'connecting' ? 'Conectando à sala…' : 'Reconecte para ver os participantes.'}</p></div>}
      <div className="audio-streams">{people.filter(person => person.id !== self && person.media?.mic && getStream(person, 'mic')).map(person => <Media key={`${person.id}-${person.media.mic}`} audio stream={getStream(person, 'mic')} muted={!sound} volume={volume} />)}</div>
    </section>
    <aside className="participants"><section className="chat-panel"><div ref={chatMessagesRef} className="chat-messages">{messages.map((message, index) => <div className={`chat-message ${message.from === self ? 'mine' : ''}`} key={`${message.at}-${index}`}><strong>{message.name}</strong><p>{message.text}</p></div>)}</div><form className="chat-form" onSubmit={sendChat}><div className="chat-composer"><input value={messageText} onChange={event => setMessageText(event.target.value)} maxLength={1000} placeholder="Digite uma mensagem…" aria-label="Mensagem" disabled={!connected} /><button className="send-message" type="submit" aria-label="Enviar mensagem" title="Enviar mensagem" disabled={!connected || !messageText.trim()}><Send size={16} /></button></div></form></section>
    </aside></div>
    <footer className="control-bar"><div className="output-controls"><button className={`control ${!sound ? 'off' : ''}`} aria-label={sound ? 'Silenciar som da sala' : 'Ativar som da sala'} aria-pressed={!sound} onClick={() => setSound(value => !value)}>{sound ? <Volume2 size={19} /> : <VolumeX size={19} />}</button><label htmlFor="volume">Volume <span>{Math.round(volume * 100)}%</span><input id="volume" type="range" min="0" max="100" value={Math.round(volume * 100)} onChange={event => setVolume(Number(event.target.value) / 100)} /></label></div>
      <div className="media-controls"><button className={`control ${local.mic ? 'active' : 'off'}`} disabled={!connected || pending.mic} aria-pressed={Boolean(local.mic)} onClick={() => toggleSource('mic')}>{local.mic ? <Mic size={19} /> : <MicOff size={19} />}<span>{pending.mic ? 'Aguardando…' : local.mic ? 'Desligar mic' : 'Ativar mic'}</span></button>
        <button className={`control ${local.camera ? 'active' : 'off'}`} disabled={!connected || pending.camera} aria-pressed={Boolean(local.camera)} onClick={() => toggleSource('camera')}>{local.camera ? <Camera size={19} /> : <CameraOff size={19} />}<span>{pending.camera ? 'Aguardando…' : local.camera ? 'Desligar câmera' : 'Ativar câmera'}</span></button>
        <button className={`control share-control ${local.screen ? 'stop' : ''}`} disabled={!connected || pending.screen} onClick={() => toggleSource('screen')}><MonitorUp size={19} /><span>{pending.screen ? 'Escolhendo…' : local.screen ? 'Parar tela' : 'Compartilhar tela'}</span></button>
      </div><span className="footer-room">{room}</span>
    </footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
