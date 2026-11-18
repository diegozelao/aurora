import { useEffect, useRef, useState } from 'react';
import { Activity, Bell, ChevronDown, ChevronRight, CircleHelp, Copy, Headphones, LayoutGrid, Mic, MicOff, MonitorUp, MoreHorizontal, PanelRight, PhoneOff, Plus, Search, Settings, Sparkles, Users, Video, VideoOff, Wifi, X, Zap } from 'lucide-react';
import './style.css';

const colors = ['violet', 'rose', 'cyan', 'amber', 'green'];
const roomName = 'sala principal';

function Avatar({ name, index = 0, small = false }) {
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return <span className={`avatar ${colors[index % colors.length]} ${small ? 'small' : ''}`}>{initials}</span>;
}

function App() {
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [sharing, setSharing] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(false);
  const [rightPanel, setRightPanel] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const socket = useRef(null);
  const peers = useRef(new Map());
  const localStream = useRef(null);
  const screenStream = useRef(null);

  const send = (message) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message));
  };

  const createPeer = (id, initiator) => {
    if (peers.current.has(id)) return peers.current.get(id);
    const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peers.current.set(id, peer);
    [localStream.current, screenStream.current].forEach((stream) => stream?.getTracks().forEach((track) => peer.addTrack(track, stream)));
    peer.onicecandidate = (event) => event.candidate && send({ type: 'candidate', to: id, candidate: event.candidate });
    peer.ontrack = (event) => {
      const video = document.querySelector(`[data-peer-video="${id}"]`);
      if (video && video.srcObject !== event.streams[0]) video.srcObject = event.streams[0];
    };
    peer.onnegotiationneeded = async () => {
      if (!initiator) return;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      send({ type: 'offer', to: id, offer });
    };
    return peer;
  };

  useEffect(() => () => {
    socket.current?.close();
    peers.current.forEach((peer) => peer.close());
    localStream.current?.getTracks().forEach((track) => track.stop());
    screenStream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const join = (event) => {
    event.preventDefault();
    const cleanName = name.trim().slice(0, 32);
    if (!cleanName) return setError('Digite seu nome para entrar.');
    setError('');
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
    socket.current = ws;
    ws.onopen = () => {
      setJoined(true);
      send({ type: 'join', name: cleanName, room: roomName });
    };
    ws.onmessage = async ({ data }) => {
      const message = JSON.parse(data);
      if (message.type === 'participants') {
        setParticipants(message.participants);
        message.participants.filter((person) => person.id !== message.self).forEach((person) => createPeer(person.id, true));
      }
      if (message.type === 'user-joined') {
        setParticipants((current) => [...current.filter((person) => person.id !== message.user.id), message.user]);
        createPeer(message.user.id, true);
      }
      if (message.type === 'user-left') {
        peers.current.get(message.id)?.close();
        peers.current.delete(message.id);
        setParticipants((current) => current.filter((person) => person.id !== message.id));
      }
      if (message.type === 'offer') {
        const peer = createPeer(message.from, false);
        await peer.setRemoteDescription(message.offer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        send({ type: 'answer', to: message.from, answer });
      }
      if (message.type === 'answer') await peers.current.get(message.from)?.setRemoteDescription(message.answer);
      if (message.type === 'candidate') await peers.current.get(message.from)?.addIceCandidate(message.candidate);
    };
    ws.onerror = () => setError('Não foi possível conectar à sala. Tente novamente.');
  };

  const shareScreen = async () => {
    if (sharing) {
      screenStream.current?.getTracks().forEach((track) => track.stop());
      screenStream.current = null;
      setSharing(false);
      send({ type: 'sharing', active: false });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 60 }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: true });
      screenStream.current = stream;
      stream.getVideoTracks()[0].onended = () => shareScreen();
      peers.current.forEach((peer) => stream.getTracks().forEach((track) => peer.addTrack(track, stream)));
      setSharing(true);
      send({ type: 'sharing', active: true });
    } catch {
      setError('O compartilhamento foi cancelado ou não está disponível neste navegador.');
    }
  };

  const copyInvite = async () => {
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const me = participants.find((person) => person.self) || { name: name.trim() || 'Você', self: true };
  const others = participants.filter((person) => !person.self);

  if (!joined) return <main className="join-screen"><div className="join-card"><div className="logo"><Zap size={19} fill="currentColor" /></div><span className="eyebrow">Sala privada · {roomName}</span><h1>Entre na conversa.</h1><p>Escolha um nome para entrar. Nada de cadastro, nada de usuários fantasmas.</p><form onSubmit={join}><label htmlFor="name">Como devemos chamar você?</label><input id="name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" maxLength={32} /><button className="join-button" type="submit">Entrar na sala <ChevronRight size={17} /></button>{error && <small className="form-error">{error}</small>}</form><div className="join-note"><Wifi size={15} /> Conexão criptografada ponta a ponta</div></div></main>;

  return <main className="app-shell">
    <aside className="server-rail"><div className="logo"><Zap size={19} fill="currentColor" /></div><div className="rail-line" /><button className="rail-item active"><Sparkles size={19} /></button><button className="rail-item"><Plus size={20} /></button><div className="rail-spacer" /><button className="rail-item"><CircleHelp size={19} /></button><div className="user-mini"><Avatar name={me.name} /><span className="online-dot" /></div></aside>
    <aside className="room-sidebar"><div className="workspace-head"><div><span className="workspace-label">Workspace</span><strong>Aurora <ChevronDown size={15} /></strong></div><button className="icon-button"><MoreHorizontal size={18} /></button></div><div className="room-search"><Search size={15} /><span>Buscar uma sala</span><kbd>⌘ K</kbd></div><div className="room-section"><div className="section-title"><span>Salas de voz</span><button className="plus-button"><Plus size={15} /></button></div><button className="room-row selected"><span className="room-icon purple"><Activity size={16} /></span><span className="room-copy"><b>{roomName}</b><small>Geral</small></span><span className="room-count">{participants.length}</span><span className="room-live" /></button></div><div className="room-section lower"><div className="section-title"><span>Conectado agora</span></div>{participants.map((person, index) => <div className="dm-row" key={person.id || person.name}><Avatar name={person.name} index={index} small /><span>{person.self ? `${person.name} (você)` : person.name}</span></div>)}</div><div className="account-card"><Avatar name={me.name} /><div><b>{me.name}</b><small>Disponível</small></div><Settings size={16} /></div></aside>
    <section className="stage"><header className="topbar"><div className="crumb"><span className="hash">#</span><b>{roomName}</b><span className="crumb-divider" /><span className="muted-text">Sala de voz</span></div><div className="top-actions"><div className="secure"><Wifi size={14} /> Criptografado</div><button className="top-icon"><Bell size={18} /></button><button className={`top-icon ${rightPanel ? 'active' : ''}`} onClick={() => setRightPanel(!rightPanel)}><PanelRight size={18} /></button></div></header><div className="stage-content"><div className="stage-heading"><div><span className="eyebrow"><span className="pulse" /> Ao vivo agora</span><h1>{sharing ? `${me.name} está compartilhando a tela` : 'Pronto para compartilhar?'}</h1></div><div className="quality-pills"><span><MonitorUp size={14} /> 1080p</span><span><Activity size={14} /> 60 FPS</span></div></div><div className={`screen-card ${sharing ? 'is-sharing' : 'empty-screen'}`}>{sharing ? <><video className="local-video" autoPlay muted playsInline ref={(video) => { if (video && screenStream.current) video.srcObject = screenStream.current; }} /><div className="screen-placeholder"><MonitorUp size={30} /><b>Compartilhamento ativo</b><small>Sua tela está sendo transmitida para a sala</small></div><div className="presenter-tag"><Avatar name={me.name} small /><span>{me.name}</span><span className="presenter-live">AO VIVO</span></div></> : <div className="empty-state"><span className="empty-icon"><MonitorUp size={28} /></span><h2>Sua tela, em alta definição.</h2><p>Compartilhe ideias com toda a sala em 1080p e 60 FPS.</p><button className="share-primary" onClick={shareScreen}><MonitorUp size={17} /> Começar compartilhamento</button></div>}</div><div className="remote-videos">{others.map((person, index) => <div className="remote-tile" key={person.id}><video data-peer-video={person.id} autoPlay playsInline /><span><Avatar name={person.name} index={index} small />{person.name}</span></div>)}</div><div className="people-strip">{participants.slice(0, 5).map((person, index) => <div className="participant" key={person.id || person.name}><Avatar name={person.name} index={index} small /><span>{person.self ? 'Você' : person.name}</span><Mic size={13} /></div>)}{participants.length > 5 && <div className="more-people">+{participants.length - 5} pessoas</div>}</div></div><footer className="control-bar"><div className="connection"><span className="connection-dot" /><div><b>Excelente conexão</b><small>Sala online · WebRTC</small></div></div><div className="controls"><button className={`control ${muted ? 'off' : ''}`} onClick={() => setMuted(!muted)}>{muted ? <MicOff size={19} /> : <Mic size={19} />}<span>{muted ? 'Ativar mic' : 'Silenciar'}</span></button><button className={`control ${!camera ? 'off' : ''}`} onClick={() => setCamera(!camera)}>{camera ? <Video size={19} /> : <VideoOff size={19} />}<span>Câmera</span></button><button className={`control share-control ${sharing ? 'active' : ''}`} onClick={shareScreen}><MonitorUp size={19} /><span>{sharing ? 'Parar tela' : 'Compartilhar tela'}</span></button><button className="control icon-only"><MoreHorizontal size={19} /></button><button className="leave-button" onClick={() => window.location.reload()}><PhoneOff size={18} fill="currentColor" /><span>Sair</span></button></div><div className="invite-wrap"><button className="invite-button" onClick={copyInvite}><Copy size={15} /> {copied ? 'Link copiado!' : 'Convidar'}</button><Headphones size={17} className="headphone" /></div></footer></section>
    {rightPanel && <aside className="people-panel"><div className="people-head"><div><h2>Participantes <span>{participants.length}</span></h2><small>Na sala agora</small></div><button className="icon-button" onClick={() => setRightPanel(false)}><ChevronRight size={19} /></button></div><div className="panel-actions"><button><LayoutGrid size={14} /> Grade</button><button><Search size={14} /> Buscar</button></div><div className="people-list">{participants.length === 1 && <div className="empty-participants"><Users size={22} /><span>Você está sozinho por enquanto.</span><small>Compartilhe o link para convidar alguém.</small></div>}{participants.map((person, index) => <div className="person-row" key={person.id || person.name}><Avatar name={person.name} index={index} /><div><b>{person.self ? `${person.name} (você)` : person.name}</b><small>{person.self ? 'Host' : 'Na sala'}</small></div><span className="person-mic active"><Mic size={15} /></span></div>)}</div><div className="panel-note"><Sparkles size={16} /><span><b>Sala sem cadastro</b>Seu nome fica apenas nesta sessão.</span><X size={14} /></div></aside>}{!rightPanel && <button className="reopen-panel" onClick={() => setRightPanel(true)}><ChevronRight size={18} /><Users size={17} /></button>}</main>;
}

createRoot(document.getElementById('root')).render(<App />);
