/**
 * Hollow Strike - Real-Time WebSocket Multiplayer & Social Client
 * Connects cleanly to same-origin `/ws` or external Render backend via `VITE_WS_URL` / `VITE_BACKEND_URL`.
 * Caches unique username locally, maintains live Friend List presence, Custom Rooms, and In-Match relays.
 */

import {
  BotDifficulty,
  ChatChannel,
  ChatMessage,
  CustomRoomState,
  FriendEntry,
  MatchMode,
  RemotePlayerSync,
  RoomInviteEntry,
  VoicePeerState,
  VoiceSignalPayload,
} from './types';

const USERNAME_KEY = 'hollow_strike_username_v1';

export interface PublicRoomSummary {
  code: string;
  name: string;
  hostUsername: string;
  mode: MatchMode;
  mapId?: string;
  memberCount: number;
  fillBots: boolean;
}

export type SocialEventListener = () => void;
export type MatchLaunchListener = (room: CustomRoomState) => void;
export type InMatchMessageListener = (msg: Record<string, unknown>) => void;
export type VoiceSignalListener = (signal: VoiceSignalPayload) => void;

export function resolveBackendHttpUrl(): string {
  const configured = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  return '';
}

export function resolveBackendWsUrl(): string {
  const explicitWs = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
  if (explicitWs) {
    return explicitWs.replace(/\/+$/, '');
  }
  const backendHttp = resolveBackendHttpUrl();
  if (backendHttp) {
    const wsBase = backendHttp.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
    return wsBase.endsWith('/ws') ? wsBase : `${wsBase}/ws`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

class MultiplayerClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private pendingMessages: unknown[] = [];
  private listeners = new Set<SocialEventListener>();
  private launchListeners = new Set<MatchLaunchListener>();
  private matchListeners = new Set<InMatchMessageListener>();
  private voiceSignalListeners = new Set<VoiceSignalListener>();

  public connected: boolean = false;
  public username: string = '';
  public usernameClaimed: boolean = false;
  public usernameError: string | null = null;
  public notice: string | null = null;
  public friends: FriendEntry[] = [];
  public pendingRequests: string[] = [];
  public invites: RoomInviteEntry[] = [];
  public currentRoom: CustomRoomState | null = null;
  public publicRooms: PublicRoomSummary[] = [];
  public activeAgentId: string = 'KAEL';
  public chatMessages: ChatMessage[] = [];
  public voicePeers: Record<string, VoicePeerState> = {};

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const cached = window.localStorage.getItem(USERNAME_KEY) ?? '';
        this.username = cached.trim();
      } catch {
        this.username = '';
      }
    }
  }

  public getCachedUsername(): string {
    return this.username;
  }

  public connect(): void {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = resolveBackendWsUrl();

    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws) return;
        this.connected = true;
        this.usernameError = null;
        if (this.username.length >= 3) {
          this.send({ type: 'CLAIM_USERNAME', username: this.username, agentId: this.activeAgentId });
        }
        while (this.pendingMessages.length > 0) {
          const next = this.pendingMessages.shift();
          this.send(next);
        }
        this.startHeartbeat();
        this.emit();
      };

      ws.onmessage = (event) => {
        if (this.ws !== ws) return;
        try {
          const msg = JSON.parse(event.data as string) as Record<string, unknown>;
          this.handleMessage(msg);
        } catch {
          // Ignore malformed packet
        }
      };

      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.stopHeartbeat();
        this.connected = false;
        this.usernameClaimed = false;
        this.ws = null;
        this.emit();
        this.scheduleReconnect();
      };

      ws.onerror = () => {
        // Error is followed cleanly by onclose
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    if (typeof window === 'undefined') return;
    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (typeof window === 'undefined') return;
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2500);
  }

  private send(payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      if (this.pendingMessages.length < 16) {
        this.pendingMessages.push(payload);
      }
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const type = String(msg.type ?? '');
    switch (type) {
      case 'PONG':
        break;

      case 'USERNAME_CLAIMED':
        this.username = String(msg.username ?? this.username);
        this.usernameClaimed = true;
        this.usernameError = null;
        try {
          window.localStorage.setItem(USERNAME_KEY, this.username);
        } catch {
          // Ignore storage quota
        }
        this.emit();
        break;

      case 'USERNAME_TAKEN':
      case 'USERNAME_ERROR':
        this.usernameClaimed = false;
        this.usernameError = String(msg.message ?? 'Username unavailable.');
        this.emit();
        break;

      case 'SERVER_NOTICE':
        this.notice = String(msg.message ?? '');
        this.emit();
        break;

      case 'FRIENDS_UPDATE':
        this.friends = (msg.friends as FriendEntry[]) ?? [];
        this.pendingRequests = (msg.pendingRequests as string[]) ?? [];
        this.emit();
        break;

      case 'ROOM_INVITE':
        if (msg.invite) {
          const inv = msg.invite as RoomInviteEntry;
          this.invites = [inv, ...this.invites.filter((x) => x.roomCode !== inv.roomCode)].slice(0, 6);
          this.emit();
        }
        break;

      case 'ROOM_STATE':
        this.currentRoom = (msg.room as CustomRoomState | null) ?? null;
        this.emit();
        break;

      case 'PUBLIC_ROOMS':
        this.publicRooms = (msg.rooms as PublicRoomSummary[]) ?? [];
        this.emit();
        break;

      case 'MATCH_LAUNCH':
        if (msg.room) {
          const room = msg.room as CustomRoomState;
          this.currentRoom = room;
          this.emit();
          this.launchListeners.forEach((cb) => cb(room));
        }
        break;

      case 'PLAYER_SYNC':
      case 'PLAYER_SHOOT':
      case 'PLAYER_HIT':
      case 'SPIKE_EVENT':
      case 'ROUND_SYNC':
        this.matchListeners.forEach((cb) => cb(msg));
        break;

      case 'CHAT_HISTORY': {
        const list = (msg.messages as ChatMessage[]) ?? [];
        this.chatMessages = list.slice(-60);
        this.emit();
        break;
      }

      case 'CHAT_MESSAGE':
        if (msg.message) {
          this.chatMessages = [...this.chatMessages, msg.message as ChatMessage].slice(-60);
          this.emit();
        }
        break;

      case 'VOICE_PEERS':
        this.voicePeers = (msg.peers as Record<string, VoicePeerState>) ?? {};
        this.emit();
        break;

      case 'VOICE_SIGNAL':
        if (msg.signal) {
          const sig = msg.signal as VoiceSignalPayload;
          this.voiceSignalListeners.forEach((cb) => cb(sig));
        }
        break;
    }
  }

  public claimUsername(username: string, agentId?: string): void {
    const clean = username.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16);
    this.username = clean;
    if (agentId) this.activeAgentId = agentId;
    this.usernameError = null;
    try {
      window.localStorage.setItem(USERNAME_KEY, clean);
    } catch {
      // Ignore
    }
    this.connect();
    this.send({ type: 'CLAIM_USERNAME', username: clean, agentId: this.activeAgentId });
    this.emit();
  }

  public setAgent(agentId: string): void {
    this.activeAgentId = agentId;
    this.send({ type: 'UPDATE_AGENT', agentId });
  }

  public addFriend(targetUsername: string): void {
    this.notice = null;
    this.send({ type: 'FRIEND_ADD', targetUsername: targetUsername.trim() });
  }

  public acceptFriend(fromUsername: string): void {
    this.send({ type: 'FRIEND_ACCEPT', fromUsername });
  }

  public removeFriend(targetUsername: string): void {
    this.send({ type: 'FRIEND_REMOVE', targetUsername });
  }

  public dismissInvite(id: string): void {
    this.invites = this.invites.filter((i) => i.id !== id);
    this.emit();
  }

  public clearNotice(): void {
    this.notice = null;
    this.emit();
  }

  public createRoom(opts: {
    name?: string;
    mode: MatchMode;
    mapId?: string;
    botDifficulty: BotDifficulty;
    fillBots: boolean;
    isPublic: boolean;
  }): void {
    this.notice = null;
    this.send({ type: 'CREATE_ROOM', ...opts });
  }

  public joinRoom(code: string): void {
    this.notice = null;
    this.send({ type: 'JOIN_ROOM', code: code.trim().toUpperCase() });
  }

  public quickMatch(mode: MatchMode, botDifficulty: BotDifficulty, mapId?: string): void {
    this.notice = null;
    this.send({ type: 'QUICK_MATCH', mode, botDifficulty, mapId });
  }

  public leaveRoom(): void {
    this.send({ type: 'LEAVE_ROOM' });
    this.currentRoom = null;
    this.emit();
  }

  public switchTeam(team?: 'ATTACKERS' | 'DEFENDERS'): void {
    this.send({ type: 'SWITCH_TEAM', team });
  }

  public toggleReady(): void {
    this.send({ type: 'TOGGLE_READY' });
  }

  public updateRoomConfig(
    patch: Partial<Pick<CustomRoomState, 'mode' | 'mapId' | 'botDifficulty' | 'fillBots' | 'isPublic'>>
  ): void {
    this.send({ type: 'UPDATE_ROOM_CONFIG', ...patch });
  }

  public inviteFriend(targetUsername: string): void {
    this.send({ type: 'SEND_INVITE', targetUsername });
  }

  public startMatch(): void {
    this.send({ type: 'START_MATCH' });
  }

  public notifyMatchEnded(): void {
    this.send({ type: 'END_MATCH_RETURN' });
  }

  // Real-time match synchronization packets
  public sendPlayerSync(state: RemotePlayerSync): void {
    this.send({ type: 'PLAYER_SYNC', payload: state });
  }

  public sendPlayerShoot(origin: [number, number, number], dir: [number, number, number], weaponId: string): void {
    this.send({ type: 'PLAYER_SHOOT', origin, dir, weaponId });
  }

  public sendPlayerHit(targetUsername: string, damage: number, isHeadshot: boolean, weaponName: string): void {
    this.send({ type: 'PLAYER_HIT', targetUsername, damage, isHeadshot, weaponName });
  }

  public sendSpikeEvent(event: 'PLANTED' | 'DEFUSED', site: 'A' | 'B' | null, pos: [number, number, number]): void {
    this.send({ type: 'SPIKE_EVENT', event, site, pos });
  }

  public sendRoundSync(roundPhase: string, attackerRounds: number, defenderRounds: number, roundNumber: number): void {
    this.send({ type: 'ROUND_SYNC', roundPhase, attackerRounds, defenderRounds, roundNumber });
  }

  public sendChat(text: string, channel: ChatChannel = 'ROOM'): void {
    const clean = text.trim();
    if (!clean) return;
    this.send({ type: 'CHAT_SEND', text: clean, channel });
  }

  public sendVoiceState(active: boolean, muted: boolean, speaking: boolean): void {
    this.send({ type: 'VOICE_STATE', active, muted, speaking });
  }

  public sendVoiceSignal(payload: Omit<VoiceSignalPayload, 'fromUsername'>): void {
    this.send({ type: 'VOICE_SIGNAL', ...payload });
  }

  public subscribe(listener: SocialEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeMatchLaunch(listener: MatchLaunchListener): () => void {
    this.launchListeners.add(listener);
    return () => {
      this.launchListeners.delete(listener);
    };
  }

  public subscribeInMatch(listener: InMatchMessageListener): () => void {
    this.matchListeners.add(listener);
    return () => {
      this.matchListeners.delete(listener);
    };
  }

  public subscribeVoiceSignal(listener: VoiceSignalListener): () => void {
    this.voiceSignalListeners.add(listener);
    return () => {
      this.voiceSignalListeners.delete(listener);
    };
  }

  private emit(): void {
    this.listeners.forEach((cb) => cb());
  }
}

export const multiplayerClient = new MultiplayerClient();

