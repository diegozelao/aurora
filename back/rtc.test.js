import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomPeers } from '../front/src/rtc.js';
class Peer {
  signalingState = 'stable'; senders = []; remoteDescription = null; candidates = []; connectionState = 'new';
  addTrack(track) { this.senders.push({ track }); }
  removeTrack(sender) { this.senders.splice(this.senders.indexOf(sender), 1); }
  getSenders() { return this.senders; }
  async setLocalDescription() { this.localDescription = { type: this.signalingState === 'have-remote-offer' ? 'answer' : 'offer' }; this.signalingState = this.localDescription.type === 'answer' ? 'stable' : 'have-local-offer'; }
  async setRemoteDescription(description) { this.remoteDescription = description; this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable'; }
  async addIceCandidate(candidate) { this.candidates.push(candidate); }
  close() { this.signalingState = 'closed'; }
}
test('late peers receive local sources; candidates wait for descriptions; stopping removes senders', async () => {
  const sent = [], errors = [];
  const rtc = new RoomPeers({ self: 'z', send: m => sent.push(m), onStream() {}, onRemove() {}, onError: e => errors.push(e), Peer });
  const track = { id: 'mic' }, stream = { id: 'audio', getTracks: () => [track] };
  rtc.setSource('mic', stream); rtc.reconcile(['a']);
  const pc = rtc.peers.get('a').pc; assert.equal(pc.senders[0].track, track);
  await rtc.receive({ from: 'a', candidate: { candidate: 'ice' } }); assert.equal(pc.candidates.length, 0);
  await rtc.receive({ from: 'a', offer: { type: 'offer' } }); assert.equal(pc.candidates.length, 1); assert.equal(sent[0].type, 'answer');
  rtc.setSource('mic', null); assert.equal(pc.senders.length, 0);
  rtc.reconcile([]); assert.equal(pc.signalingState, 'closed'); assert.deepEqual(errors, []);
});
test('colliding offers are ignored only by the designated peer', async () => {
  const rtc = new RoomPeers({ self: 'a', send() {}, onStream() {}, onRemove() {}, onError: e => { throw e; }, Peer });
  rtc.reconcile(['z']); const state = rtc.peers.get('z'); state.makingOffer = true;
  await rtc.receive({ from: 'z', offer: { type: 'offer' } }); assert.equal(state.ignoreOffer, true); assert.equal(state.pc.remoteDescription, null);
  rtc.close();
});
