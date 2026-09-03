/**
 * WebRTCManager wraps a single RTCPeerConnection plus local media for one
 * call. It knows nothing about the WebSocket - the caller wires up
 * onIceCandidate / sendOffer / sendAnswer to whatever transport is in use.
 */
export class WebRTCManager {
  constructor({ iceServers, onRemoteStream, onIceCandidate, onConnectionStateChange }) {
    this.pc = new RTCPeerConnection({ iceServers: iceServers?.length ? iceServers : [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.localStream = null;
    this.remoteStream = new MediaStream();
    this.onRemoteStream = onRemoteStream;
    this.onIceCandidate = onIceCandidate;
    this.onConnectionStateChange = onConnectionStateChange;

    this.pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => this.remoteStream.addTrack(track));
      this.onRemoteStream?.(this.remoteStream);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) this.onIceCandidate?.(event.candidate);
    };

    this.pc.onconnectionstatechange = () => {
      this.onConnectionStateChange?.(this.pc.connectionState);
    };
  }

  async getLocalMedia(callType) {
    const constraints = callType === 'video' ? { audio: true, video: true } : { audio: true, video: false };
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.localStream.getTracks().forEach((track) => this.pc.addTrack(track, this.localStream));
    return this.localStream;
  }

  async createOffer() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(remoteOffer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(remoteOffer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async acceptAnswer(remoteAnswer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
  }

  async addIceCandidate(candidate) {
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      // Benign if it arrives before remote description is set in rare races.
      console.warn('Failed to add ICE candidate', err);
    }
  }

  toggleAudio(enabled) {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }

  toggleVideo(enabled) {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = enabled));
  }

  close() {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.pc.getSenders().forEach((s) => s.track?.stop());
    this.pc.close();
  }
}
