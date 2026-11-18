// Each participant has one peer connection; media stream IDs distinguish sources.
export class RoomPeers {
  constructor({ self, send, onStream, onRemove, onError, iceServers, Peer = RTCPeerConnection }) {
    Object.assign(this, { self, send, onStream, onRemove, onError, iceServers, Peer });
    this.peers = new Map(); this.local = new Map(); this.closed = false;
  }
  ensure(id) {
    if (this.peers.has(id)) return this.peers.get(id);
    const pc = new this.Peer({ iceServers: this.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }] });
    const state = { pc, makingOffer: false, ignoreOffer: false, settingAnswer: false, candidates: [], queue: Promise.resolve() };
    this.peers.set(id, state);
    pc.ontrack = event => {
      if (this.closed || pc.signalingState === 'closed') return;
      const stream = event.streams[0]; if (!stream) return;
      this.onStream(id, stream);
      event.track.onended = () => { if (!stream.getTracks().some(t => t.readyState === 'live')) this.onRemove(id, stream.id); };
    };
    pc.onicecandidate = ({ candidate }) => { if (candidate && !this.closed && pc.signalingState !== 'closed') this.send({ type: 'candidate', to: id, candidate }); };
    pc.onnegotiationneeded = async () => {
      if (this.closed || pc.signalingState === 'closed') return;
      try {
        state.makingOffer = true;
        await pc.setLocalDescription();
        if (this.closed || pc.signalingState === 'closed') return;
        this.send({ type: pc.localDescription.type, to: id, [pc.localDescription.type]: pc.localDescription });
      } catch (error) { if (!this.closed && pc.signalingState !== 'closed') this.onError(error); }
      finally { state.makingOffer = false; }
    };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') { this.onError(new Error('Conexão de mídia interrompida. Atualize a sala para tentar novamente.')); } };
    for (const stream of this.local.values()) stream.getTracks().forEach(track => pc.addTrack(track, stream));
    return state;
  }
  reconcile(ids) {
    for (const [id, state] of this.peers) if (!ids.includes(id)) { state.pc.close(); this.peers.delete(id); this.onRemove(id); }
    ids.forEach(id => { if (id !== this.self) this.ensure(id); });
  }
  setSource(kind, stream) {
    const old = this.local.get(kind);
    if (old) for (const { pc } of this.peers.values()) for (const sender of pc.getSenders()) if (old.getTracks().includes(sender.track)) pc.removeTrack(sender);
    this.local.delete(kind);
    if (stream) { this.local.set(kind, stream); for (const { pc } of this.peers.values()) stream.getTracks().forEach(track => pc.addTrack(track, stream)); }
  }
  receive(message) {
    const state = this.peers.get(message.from); if (!state || this.closed) return Promise.resolve();
    state.queue = state.queue.then(async () => {
      const { pc } = state; if (pc.signalingState === 'closed') return;
      const description = message.offer || message.answer;
      if (description) {
        const ready = !state.makingOffer && (pc.signalingState === 'stable' || state.settingAnswer);
        state.ignoreOffer = description.type === 'offer' && !ready && this.self < message.from;
        if (state.ignoreOffer) { state.candidates = []; return; }
        state.settingAnswer = description.type === 'answer';
        await pc.setRemoteDescription(description); state.settingAnswer = false;
        for (const candidate of state.candidates.splice(0)) await pc.addIceCandidate(candidate);
        if (description.type === 'offer') { await pc.setLocalDescription(); this.send({ type: 'answer', to: message.from, answer: pc.localDescription }); }
      } else if (message.candidate && !state.ignoreOffer) {
        if (pc.remoteDescription) await pc.addIceCandidate(message.candidate); else state.candidates.push(message.candidate);
      }
    }).catch(error => { state.settingAnswer = false; if (!this.closed && state.pc.signalingState !== 'closed' && !state.ignoreOffer) this.onError(error); });
    return state.queue;
  }
  retry() { for (const { pc } of this.peers.values()) if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') pc.restartIce(); }
  close() { this.closed = true; for (const { pc } of this.peers.values()) pc.close(); this.peers.clear(); this.local.clear(); }
}
