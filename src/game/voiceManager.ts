/**
 * Hollow Strike - WebRTC Peer-to-Peer Squad Voice Chat Manager
 * Uses live WebSocket signaling via multiplayerClient (`VOICE_STATE`, `VOICE_SIGNAL`)
 * with real microphone capture, VAD speaking detection, mute toggle, and graceful fallback.
 */

import { multiplayerClient } from './multiplayerClient';
import { VoicePeerState, VoiceSignalPayload } from './types';

type VoiceListener = () => void;

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
};

class VoiceManager {
  private localStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vadTimer: number | null = null;
  private peerConns = new Map<string, RTCPeerConnection>();
  private audioElements = new Map<string, HTMLAudioElement>();
  private listeners = new Set<VoiceListener>();
  private unsubSignal: (() => void) | null = null;
  private unsubSocial: (() => void) | null = null;

  public active: boolean = false;
  public muted: boolean = false;
  public speaking: boolean = false;
  public deafened: boolean = false;
  public error: string | null = null;

  private ensureSubscriptions(): void {
    if (!this.unsubSignal) {
      this.unsubSignal = multiplayerClient.subscribeVoiceSignal((sig) => {
        void this.handleSignal(sig);
      });
    }
    if (!this.unsubSocial) {
      this.unsubSocial = multiplayerClient.subscribe(() => {
        if (this.active) {
          this.syncPeers(multiplayerClient.voicePeers);
        }
        this.emit();
      });
    }
  }

  public async joinVoice(): Promise<boolean> {
    if (this.active) return true;
    this.error = null;
    this.ensureSubscriptions();

    if (!multiplayerClient.currentRoom || !multiplayerClient.usernameClaimed) {
      this.error = 'Join or create a Multiplayer Room with a claimed handle to start Voice Chat.';
      this.emit();
      return false;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.error = 'Microphone API unavailable in this browser context.';
      this.emit();
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.localStream = stream;
      this.active = true;
      this.muted = false;
      this.speaking = false;
      this.startVadMonitor(stream);

      multiplayerClient.sendVoiceState(true, this.muted, false);
      this.syncPeers(multiplayerClient.voicePeers);
      this.emit();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone permission denied.';
      this.error = `Mic blocked or unavailable: ${msg}`;
      this.emit();
      return false;
    }
  }

  public leaveVoice(): void {
    this.stopVadMonitor();
    for (const [peer, pc] of this.peerConns.entries()) {
      try {
        pc.close();
      } catch {
        // Ignore
      }
      this.removeAudioElement(peer);
    }
    this.peerConns.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    const wasActive = this.active;
    this.active = false;
    this.speaking = false;
    if (wasActive) {
      multiplayerClient.sendVoiceState(false, this.muted, false);
    }
    this.emit();
  }

  public toggleMute(): void {
    if (!this.active || !this.localStream) return;
    this.muted = !this.muted;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.muted;
    });
    if (this.muted) this.speaking = false;
    multiplayerClient.sendVoiceState(true, this.muted, this.speaking);
    this.emit();
  }

  public toggleDeafen(): void {
    this.deafened = !this.deafened;
    for (const audio of this.audioElements.values()) {
      audio.muted = this.deafened;
    }
    this.emit();
  }

  public clearError(): void {
    this.error = null;
    this.emit();
  }

  private startVadMonitor(stream: MediaStream): void {
    this.stopVadMonitor();
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      this.audioCtx = ctx;
      this.analyser = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      this.vadTimer = window.setInterval(() => {
        if (!this.active || !this.analyser) return;
        if (this.muted) {
          if (this.speaking) {
            this.speaking = false;
            multiplayerClient.sendVoiceState(true, this.muted, false);
            this.emit();
          }
          return;
        }
        this.analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        const nowSpeaking = avg > 18;
        if (nowSpeaking !== this.speaking) {
          this.speaking = nowSpeaking;
          multiplayerClient.sendVoiceState(true, this.muted, nowSpeaking);
          this.emit();
        }
      }, 140);
    } catch {
      // VAD optional fallback
    }
  }

  private stopVadMonitor(): void {
    if (this.vadTimer !== null) {
      window.clearInterval(this.vadTimer);
      this.vadTimer = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
  }

  private syncPeers(peers: Record<string, VoicePeerState>): void {
    const me = multiplayerClient.username;
    if (!me) return;

    const activeUsernames = new Set(
      Object.values(peers)
        .filter((p) => p.active && p.username.toLowerCase() !== me.toLowerCase())
        .map((p) => p.username)
    );

    // Close connections for departed peers
    for (const [peerUser, pc] of this.peerConns.entries()) {
      if (!activeUsernames.has(peerUser)) {
        try {
          pc.close();
        } catch {
          // Ignore
        }
        this.peerConns.delete(peerUser);
        this.removeAudioElement(peerUser);
      }
    }

    // Deterministic initiator tie-breaker: lexicographically lower username initiates offer
    for (const peerUser of activeUsernames) {
      if (!this.peerConns.has(peerUser) && me.toLowerCase() < peerUser.toLowerCase()) {
        void this.createAndSendOffer(peerUser);
      }
    }
  }

  private createPeerConnection(peerUser: string): RTCPeerConnection {
    const existing = this.peerConns.get(peerUser);
    if (existing) return existing;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        multiplayerClient.sendVoiceSignal({
          kind: 'ice',
          targetUsername: peerUser,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;
      let audio = this.audioElements.get(peerUser);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.muted = this.deafened;
        this.audioElements.set(peerUser, audio);
      }
      audio.srcObject = stream;
      audio.play().catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.peerConns.delete(peerUser);
        this.removeAudioElement(peerUser);
      }
    };

    this.peerConns.set(peerUser, pc);
    return pc;
  }

  private removeAudioElement(peerUser: string): void {
    const audio = this.audioElements.get(peerUser);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      this.audioElements.delete(peerUser);
    }
  }

  private async createAndSendOffer(peerUser: string): Promise<void> {
    if (!this.active) return;
    try {
      const pc = this.createPeerConnection(peerUser);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      multiplayerClient.sendVoiceSignal({
        kind: 'offer',
        targetUsername: peerUser,
        sdp: { type: offer.type, sdp: offer.sdp },
      });
    } catch {
      // Ignore signaling race
    }
  }

  private async handleSignal(signal: VoiceSignalPayload): Promise<void> {
    if (!this.active) return;
    const fromUser = signal.fromUsername;
    if (!fromUser) return;

    try {
      const pc = this.createPeerConnection(fromUser);
      if (signal.kind === 'offer' && signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        multiplayerClient.sendVoiceSignal({
          kind: 'answer',
          targetUsername: fromUser,
          sdp: { type: answer.type, sdp: answer.sdp },
        });
      } else if (signal.kind === 'answer' && signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp as RTCSessionDescriptionInit));
      } else if (signal.kind === 'ice' && signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch {
      // Ignore stale ICE / SDP mismatch
    }
  }

  public subscribe(listener: VoiceListener): () => void {
    this.ensureSubscriptions();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    this.listeners.forEach((cb) => cb());
  }
}

export const voiceManager = new VoiceManager();
