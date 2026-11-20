/**
 * Hollow Strike - Railway-Compatible Authoritative WebSocket & HTTP Server
 * Uses erasable TypeScript syntax so Node v22+ executes `node server.ts` natively without extra flags.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';

type TeamSide = 'ATTACKERS' | 'DEFENDERS';
type MatchMode = 'COMPETITIVE' | 'SKIRMISH' | 'PRACTICE' | 'CUSTOM';
type BotDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
type OnlinePresenceStatus = 'ONLINE' | 'IN_LOBBY' | 'IN_MATCH' | 'OFFLINE';

interface RoomMember {
  username: string;
  team: TeamSide;
  agentId: string;
  ready: boolean;
  isHost: boolean;
  online: boolean;
}

interface CustomRoom {
  code: string;
  name: string;
  hostUsername: string;
  mode: MatchMode;
  botDifficulty: BotDifficulty;
  fillBots: boolean;
  isPublic: boolean;
  inMatch: boolean;
  members: RoomMember[];
}

interface SocialRecord {
  friends: Record<string, string[]>;
  pendingIncoming: Record<string, string[]>;
}

const DEFAULT_CUSTOM_MAP_URL =
  process.env.CUSTOM_MAP_URL ||
  'https://raw.githubusercontent.com/Aosmic-S/Hollow-Strike/7cf95c8ed1f2f06632311cdf8e967e58dd01f944/public/models/Map/valorant_style_map_v2_heavy-compressed.glb';
const PREFERRED_MAP_FILENAME = 'valorant_style_map_v2_heavy-compressed.glb';

interface ClientSession {
  ws: WebSocket;
  username: string | null;
  status: OnlinePresenceStatus;
  roomCode: string | null;
  agentId: string;
  isAlive: boolean;
}

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, '.data');
const MAP_CACHE_DIR = path.join(DATA_DIR, 'maps');
const MAP_CACHE_FILE = path.join(MAP_CACHE_DIR, PREFERRED_MAP_FILENAME);
const SOCIAL_FILE = path.join(DATA_DIR, 'social.json');

let socialData: SocialRecord = { friends: {}, pendingIncoming: {} };
let pendingMapDownload: Promise<string | null> | null = null;

function listLocalCustomMaps(): string[] {
  const mapDir = path.join(ROOT_DIR, 'public', 'models', 'Map');
  try {
    if (!fs.existsSync(mapDir)) return [];
    const files = fs
      .readdirSync(mapDir)
      .filter((f) => f.toLowerCase().endsWith('.glb') || f.toLowerCase().endsWith('.gltf'));
    files.sort((a, b) => {
      if (a === PREFERRED_MAP_FILENAME) return -1;
      if (b === PREFERRED_MAP_FILENAME) return 1;
      return a.localeCompare(b);
    });
    return files;
  } catch {
    return [];
  }
}

async function ensureActiveMapFile(): Promise<string | null> {
  const localMaps = listLocalCustomMaps();
  if (localMaps.length > 0) {
    const localPath = path.join(ROOT_DIR, 'public', 'models', 'Map', localMaps[0]);
    if (fs.existsSync(localPath) && fs.statSync(localPath).size > 1024) {
      return localPath;
    }
  }

  if (fs.existsSync(MAP_CACHE_FILE) && fs.statSync(MAP_CACHE_FILE).size > 1024) {
    return MAP_CACHE_FILE;
  }

  if (pendingMapDownload) {
    return pendingMapDownload;
  }

  pendingMapDownload = (async () => {
    try {
      fs.mkdirSync(MAP_CACHE_DIR, { recursive: true });
      const res = await fetch(DEFAULT_CUSTOM_MAP_URL, { redirect: 'follow' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} downloading custom map`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 1024) {
        throw new Error('Downloaded map file unexpectedly small');
      }
      const tmpPath = `${MAP_CACHE_FILE}.tmp`;
      fs.writeFileSync(tmpPath, buffer);
      fs.renameSync(tmpPath, MAP_CACHE_FILE);
      return MAP_CACHE_FILE;
    } catch (err) {
      console.error('[Hollow Strike Server] Failed to fetch remote custom map:', err);
      return null;
    } finally {
      pendingMapDownload = null;
    }
  })();

  return pendingMapDownload;
}

function loadSocialData(): void {
  try {
    if (fs.existsSync(SOCIAL_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SOCIAL_FILE, 'utf8')) as Partial<SocialRecord>;
      socialData = {
        friends: parsed.friends ?? {},
        pendingIncoming: parsed.pendingIncoming ?? {},
      };
    }
  } catch {
    socialData = { friends: {}, pendingIncoming: {} };
  }
}

function saveSocialData(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SOCIAL_FILE, JSON.stringify(socialData, null, 2));
  } catch {
    // Non-fatal in read-only or ephemeral containers
  }
}

loadSocialData();

const sessionsByWs = new Map<WebSocket, ClientSession>();
const sessionsByUsername = new Map<string, ClientSession>(); // keyed lowercase username
const roomsByCode = new Map<string, CustomRoom>();

function normUser(name: string): string {
  return name.trim().toLowerCase();
}

function sanitizeUsername(raw: string): string {
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 16);
}

function sendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function getPublicRoomsSummary() {
  return Array.from(roomsByCode.values())
    .filter((r) => r.isPublic && !r.inMatch && r.members.length < 10)
    .map((r) => ({
      code: r.code,
      name: r.name,
      hostUsername: r.hostUsername,
      mode: r.mode,
      memberCount: r.members.length,
      fillBots: r.fillBots,
    }));
}

function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 25; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    if (!roomsByCode.has(code)) return code;
  }
  return `HS${Math.floor(1000 + Math.random() * 8999)}`;
}

function getFriendsSnapshot(username: string) {
  const key = normUser(username);
  const friendNames = socialData.friends[key] ?? [];
  const pendingNames = socialData.pendingIncoming[key] ?? [];

  const friends = friendNames.map((fName) => {
    const sess = sessionsByUsername.get(normUser(fName));
    return {
      username: sess?.username ?? fName,
      status: sess ? sess.status : ('OFFLINE' as OnlinePresenceStatus),
      roomCode: sess?.roomCode ?? null,
      agentId: sess?.agentId,
    };
  });

  return {
    friends,
    pendingRequests: pendingNames,
  };
}

function pushFriendsToUser(username: string): void {
  const sess = sessionsByUsername.get(normUser(username));
  if (!sess) return;
  const snap = getFriendsSnapshot(username);
  sendJson(sess.ws, {
    type: 'FRIENDS_UPDATE',
    friends: snap.friends,
    pendingRequests: snap.pendingRequests,
  });
}

function notifyFriendsPresence(username: string): void {
  const key = normUser(username);
  const friendNames = socialData.friends[key] ?? [];
  for (const fName of friendNames) {
    pushFriendsToUser(fName);
  }
}

function broadcastRoomState(room: CustomRoom): void {
  for (const member of room.members) {
    const sess = sessionsByUsername.get(normUser(member.username));
    if (sess) {
      sendJson(sess.ws, {
        type: 'ROOM_STATE',
        room,
      });
    }
  }
}

function broadcastPublicRooms(): void {
  const list = getPublicRoomsSummary();

  for (const sess of sessionsByWs.values()) {
    if (sess.username) {
      sendJson(sess.ws, { type: 'PUBLIC_ROOMS', rooms: list });
    }
  }
}

function leaveCurrentRoom(sess: ClientSession): void {
  if (!sess.roomCode || !sess.username) return;
  const room = roomsByCode.get(sess.roomCode);
  sess.roomCode = null;
  sess.status = 'ONLINE';

  if (!room) {
    notifyFriendsPresence(sess.username);
    return;
  }

  room.members = room.members.filter((m) => normUser(m.username) !== normUser(sess.username!));
  if (room.members.length === 0) {
    roomsByCode.delete(room.code);
  } else {
    if (normUser(room.hostUsername) === normUser(sess.username)) {
      room.hostUsername = room.members[0].username;
      room.members[0].isHost = true;
    }
    broadcastRoomState(room);
  }

  sendJson(sess.ws, { type: 'ROOM_STATE', room: null });
  notifyFriendsPresence(sess.username);
  broadcastPublicRooms();
}

function addMemberToRoom(sess: ClientSession, room: CustomRoom, desiredTeam?: TeamSide): void {
  if (!sess.username) return;
  if (sess.roomCode && sess.roomCode !== room.code) {
    leaveCurrentRoom(sess);
  }

  const existing = room.members.find((m) => normUser(m.username) === normUser(sess.username!));
  if (existing) {
    existing.online = true;
    existing.agentId = sess.agentId;
  } else {
    const attCount = room.members.filter((m) => m.team === 'ATTACKERS').length;
    const defCount = room.members.filter((m) => m.team === 'DEFENDERS').length;
    const assignedTeam: TeamSide =
      desiredTeam ?? (attCount <= defCount ? 'ATTACKERS' : 'DEFENDERS');

    room.members.push({
      username: sess.username,
      team: assignedTeam,
      agentId: sess.agentId,
      ready: true,
      isHost: normUser(room.hostUsername) === normUser(sess.username),
      online: true,
    });
  }

  sess.roomCode = room.code;
  sess.status = room.inMatch ? 'IN_MATCH' : 'IN_LOBBY';
  broadcastRoomState(room);
  notifyFriendsPresence(sess.username);
  broadcastPublicRooms();
}

function handleSocketMessage(sess: ClientSession, raw: string): void {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }

  const type = typeof msg.type === 'string' ? msg.type : '';

  if (type === 'CLAIM_USERNAME') {
    const clean = sanitizeUsername(String(msg.username ?? ''));
    const agentId = typeof msg.agentId === 'string' ? msg.agentId : 'ZEPHYR';
    sess.agentId = agentId;

    if (clean.length < 3) {
      sendJson(sess.ws, {
        type: 'USERNAME_ERROR',
        message: 'Username must be 3–16 alphanumeric characters.',
      });
      return;
    }

    const key = normUser(clean);
    const existing = sessionsByUsername.get(key);
    if (existing && existing !== sess) {
      sendJson(sess.ws, {
        type: 'USERNAME_TAKEN',
        username: clean,
        message: `Username "${clean}" is currently active online. Pick another callsign.`,
      });
      return;
    }

    if (sess.username && normUser(sess.username) !== key) {
      sessionsByUsername.delete(normUser(sess.username));
    }

    sess.username = clean;
    sess.status = sess.roomCode ? sess.status : 'ONLINE';
    sessionsByUsername.set(key, sess);

    sendJson(sess.ws, {
      type: 'USERNAME_CLAIMED',
      username: clean,
    });
    pushFriendsToUser(clean);
    notifyFriendsPresence(clean);
    broadcastPublicRooms();
    return;
  }

  if (!sess.username) {
    sendJson(sess.ws, { type: 'AUTH_REQUIRED', message: 'Claim a unique username first.' });
    return;
  }

  const myKey = normUser(sess.username);

  switch (type) {
    case 'UPDATE_AGENT': {
      const agentId = typeof msg.agentId === 'string' ? msg.agentId : 'ZEPHYR';
      sess.agentId = agentId;
      if (sess.roomCode) {
        const room = roomsByCode.get(sess.roomCode);
        if (room) {
          const member = room.members.find((m) => normUser(m.username) === myKey);
          if (member) {
            member.agentId = agentId;
            broadcastRoomState(room);
          }
        }
      }
      break;
    }

    case 'FRIEND_ADD': {
      const targetClean = sanitizeUsername(String(msg.targetUsername ?? ''));
      const targetKey = normUser(targetClean);
      if (!targetClean || targetKey === myKey) {
        sendJson(sess.ws, { type: 'SERVER_NOTICE', message: 'Enter a valid teammate username.' });
        return;
      }

      const myFriends = (socialData.friends[myKey] ??= []);
      if (myFriends.some((f) => normUser(f) === targetKey)) {
        sendJson(sess.ws, { type: 'SERVER_NOTICE', message: `${targetClean} is already on your friend list.` });
        return;
      }

      // If mutual incoming request exists, auto-accept
      const myPending = (socialData.pendingIncoming[myKey] ??= []);
      if (myPending.some((p) => normUser(p) === targetKey)) {
        socialData.pendingIncoming[myKey] = myPending.filter((p) => normUser(p) !== targetKey);
        const theirFriends = (socialData.friends[targetKey] ??= []);
        const targetSess = sessionsByUsername.get(targetKey);
        const displayTarget = targetSess?.username ?? targetClean;
        if (!myFriends.some((f) => normUser(f) === targetKey)) myFriends.push(displayTarget);
        if (!theirFriends.some((f) => normUser(f) === myKey)) theirFriends.push(sess.username);
        saveSocialData();
        pushFriendsToUser(sess.username);
        pushFriendsToUser(displayTarget);
        return;
      }

      const targetSess = sessionsByUsername.get(targetKey);
      const displayTarget = targetSess?.username ?? targetClean;
      const theirPending = (socialData.pendingIncoming[targetKey] ??= []);
      if (!theirPending.some((p) => normUser(p) === myKey)) {
        theirPending.push(sess.username);
      }
      saveSocialData();
      pushFriendsToUser(displayTarget);
      sendJson(sess.ws, { type: 'SERVER_NOTICE', message: `Friend request sent to ${displayTarget}.` });
      break;
    }

    case 'FRIEND_ACCEPT': {
      const fromClean = sanitizeUsername(String(msg.fromUsername ?? ''));
      const fromKey = normUser(fromClean);
      const myPending = (socialData.pendingIncoming[myKey] ??= []);
      if (!myPending.some((p) => normUser(p) === fromKey)) return;

      socialData.pendingIncoming[myKey] = myPending.filter((p) => normUser(p) !== fromKey);
      const myFriends = (socialData.friends[myKey] ??= []);
      const theirFriends = (socialData.friends[fromKey] ??= []);
      const fromSess = sessionsByUsername.get(fromKey);
      const displayFrom = fromSess?.username ?? fromClean;

      if (!myFriends.some((f) => normUser(f) === fromKey)) myFriends.push(displayFrom);
      if (!theirFriends.some((f) => normUser(f) === myKey)) theirFriends.push(sess.username);

      saveSocialData();
      pushFriendsToUser(sess.username);
      pushFriendsToUser(displayFrom);
      break;
    }

    case 'FRIEND_REMOVE': {
      const targetKey = normUser(String(msg.targetUsername ?? ''));
      if (socialData.friends[myKey]) {
        socialData.friends[myKey] = socialData.friends[myKey].filter((f) => normUser(f) !== targetKey);
      }
      if (socialData.friends[targetKey]) {
        socialData.friends[targetKey] = socialData.friends[targetKey].filter((f) => normUser(f) !== myKey);
      }
      if (socialData.pendingIncoming[myKey]) {
        socialData.pendingIncoming[myKey] = socialData.pendingIncoming[myKey].filter((p) => normUser(p) !== targetKey);
      }
      saveSocialData();
      pushFriendsToUser(sess.username);
      pushFriendsToUser(targetKey);
      break;
    }

    case 'CREATE_ROOM': {
      const mode = (['COMPETITIVE', 'SKIRMISH', 'PRACTICE', 'CUSTOM'].includes(String(msg.mode))
        ? String(msg.mode)
        : 'CUSTOM') as MatchMode;
      const botDifficulty = (['EASY', 'MEDIUM', 'HARD'].includes(String(msg.botDifficulty))
        ? String(msg.botDifficulty)
        : 'MEDIUM') as BotDifficulty;
      const fillBots = typeof msg.fillBots === 'boolean' ? msg.fillBots : false;
      const isPublic = typeof msg.isPublic === 'boolean' ? msg.isPublic : true;
      const roomName =
        typeof msg.name === 'string' && msg.name.trim().length > 0
          ? msg.name.trim().slice(0, 26)
          : `${sess.username}'s Squad`;

      const code = generateRoomCode();
      const room: CustomRoom = {
        code,
        name: roomName,
        hostUsername: sess.username,
        mode,
        botDifficulty,
        fillBots,
        isPublic,
        inMatch: false,
        members: [],
      };
      roomsByCode.set(code, room);
      addMemberToRoom(sess, room, 'ATTACKERS');
      break;
    }

    case 'JOIN_ROOM': {
      const code = String(msg.code ?? '').trim().toUpperCase();
      const room = roomsByCode.get(code);
      if (!room) {
        sendJson(sess.ws, { type: 'SERVER_NOTICE', message: `Room ${code} not found.` });
        return;
      }
      if (room.members.length >= 10) {
        sendJson(sess.ws, { type: 'SERVER_NOTICE', message: `Room ${code} is full.` });
        return;
      }
      addMemberToRoom(sess, room);
      break;
    }

    case 'QUICK_MATCH': {
      const targetMode = (['COMPETITIVE', 'SKIRMISH', 'CUSTOM'].includes(String(msg.mode))
        ? String(msg.mode)
        : 'CUSTOM') as MatchMode;
      const botDifficulty = (['EASY', 'MEDIUM', 'HARD'].includes(String(msg.botDifficulty))
        ? String(msg.botDifficulty)
        : 'MEDIUM') as BotDifficulty;
      const fillBots = typeof msg.fillBots === 'boolean' ? msg.fillBots : false;

      const openRoom = Array.from(roomsByCode.values()).find(
        (r) =>
          r.isPublic &&
          !r.inMatch &&
          r.members.length < 10 &&
          r.mode === targetMode &&
          r.fillBots === fillBots
      );

      if (openRoom) {
        addMemberToRoom(sess, openRoom);
      } else {
        const code = generateRoomCode();
        const room: CustomRoom = {
          code,
          name: `${targetMode === 'SKIRMISH' ? 'Skirmish' : targetMode === 'CUSTOM' ? 'Multiplayer 5v5' : 'Competitive'} Match`,
          hostUsername: sess.username,
          mode: targetMode,
          botDifficulty,
          fillBots,
          isPublic: true,
          inMatch: false,
          members: [],
        };
        roomsByCode.set(code, room);
        addMemberToRoom(sess, room, 'ATTACKERS');
      }
      break;
    }

    case 'LEAVE_ROOM': {
      leaveCurrentRoom(sess);
      break;
    }

    case 'SWITCH_TEAM': {
      if (!sess.roomCode) return;
      const room = roomsByCode.get(sess.roomCode);
      if (!room || room.inMatch) return;
      const member = room.members.find((m) => normUser(m.username) === myKey);
      if (!member) return;
      const requested: TeamSide =
        msg.team === 'ATTACKERS' || msg.team === 'DEFENDERS'
          ? msg.team
          : member.team === 'ATTACKERS'
            ? 'DEFENDERS'
            : 'ATTACKERS';
      const countInTarget = room.members.filter((m) => m.team === requested).length;
      if (countInTarget < 5) {
        member.team = requested;
        broadcastRoomState(room);
      }
      break;
    }

    case 'TOGGLE_READY': {
      if (!sess.roomCode) return;
      const room = roomsByCode.get(sess.roomCode);
      if (!room) return;
      const member = room.members.find((m) => normUser(m.username) === myKey);
      if (member) {
        member.ready = !member.ready;
        broadcastRoomState(room);
      }
      break;
    }

    case 'UPDATE_ROOM_CONFIG': {
      if (!sess.roomCode) return;
      const room = roomsByCode.get(sess.roomCode);
      if (!room || normUser(room.hostUsername) !== myKey) return;
      if (typeof msg.fillBots === 'boolean') room.fillBots = msg.fillBots;
      if (typeof msg.isPublic === 'boolean') room.isPublic = msg.isPublic;
      if (['COMPETITIVE', 'SKIRMISH', 'PRACTICE', 'CUSTOM'].includes(String(msg.mode))) {
        room.mode = String(msg.mode) as MatchMode;
      }
      if (['EASY', 'MEDIUM', 'HARD'].includes(String(msg.botDifficulty))) {
        room.botDifficulty = String(msg.botDifficulty) as BotDifficulty;
      }
      broadcastRoomState(room);
      broadcastPublicRooms();
      break;
    }

    case 'SEND_INVITE': {
      const targetKey = normUser(String(msg.targetUsername ?? ''));
      const targetSess = sessionsByUsername.get(targetKey);
      if (!targetSess) {
        sendJson(sess.ws, { type: 'SERVER_NOTICE', message: 'Friend is currently offline.' });
        return;
      }
      if (!sess.roomCode) {
        // Auto-create a private squad room if host invites from main lobby
        const code = generateRoomCode();
        const room: CustomRoom = {
          code,
          name: `${sess.username}'s Lobby`,
          hostUsername: sess.username,
          mode: 'CUSTOM',
          botDifficulty: 'MEDIUM',
          fillBots: false,
          isPublic: false,
          inMatch: false,
          members: [],
        };
        roomsByCode.set(code, room);
        addMemberToRoom(sess, room, 'ATTACKERS');
      }
      const room = sess.roomCode ? roomsByCode.get(sess.roomCode) : null;
      if (!room) return;
      sendJson(targetSess.ws, {
        type: 'ROOM_INVITE',
        invite: {
          id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          fromUsername: sess.username,
          roomCode: room.code,
          mode: room.mode,
          timestamp: Date.now(),
        },
      });
      sendJson(sess.ws, { type: 'SERVER_NOTICE', message: `Invited ${targetSess.username} to room ${room.code}.` });
      break;
    }

    case 'START_MATCH': {
      if (!sess.roomCode) return;
      const room = roomsByCode.get(sess.roomCode);
      if (!room || normUser(room.hostUsername) !== myKey) return;
      room.inMatch = true;

      for (const m of room.members) {
        const ms = sessionsByUsername.get(normUser(m.username));
        if (ms) {
          ms.status = 'IN_MATCH';
          notifyFriendsPresence(m.username);
          sendJson(ms.ws, {
            type: 'MATCH_LAUNCH',
            room,
          });
        }
      }
      broadcastRoomState(room);
      broadcastPublicRooms();
      break;
    }

    case 'END_MATCH_RETURN': {
      if (!sess.roomCode) return;
      const room = roomsByCode.get(sess.roomCode);
      sess.status = 'IN_LOBBY';
      notifyFriendsPresence(sess.username);
      if (room && normUser(room.hostUsername) === myKey) {
        room.inMatch = false;
        broadcastRoomState(room);
        broadcastPublicRooms();
      }
      break;
    }

    // Real-Time In-Match Combat Relays (broadcast to all other room participants)
    case 'PLAYER_SYNC':
    case 'PLAYER_SHOOT':
    case 'PLAYER_HIT':
    case 'SPIKE_EVENT':
    case 'ROUND_SYNC': {
      if (!sess.roomCode) return;
      const room = roomsByCode.get(sess.roomCode);
      if (!room) return;
      const outbound = JSON.stringify({
        ...msg,
        fromUsername: sess.username,
      });
      for (const member of room.members) {
        if (normUser(member.username) === myKey) continue;
        const targetSess = sessionsByUsername.get(normUser(member.username));
        if (targetSess && targetSess.ws.readyState === WebSocket.OPEN) {
          targetSess.ws.send(outbound);
        }
      }
      break;
    }
  }
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      playersOnline: sessionsByUsername.size,
      activeRooms: roomsByCode.size,
      uptimeSec: Math.round(process.uptime()),
    });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({
      ok: true,
      playersOnline: sessionsByUsername.size,
      rooms: getPublicRoomsSummary(),
    });
  });

  app.get('/api/maps', (_req, res) => {
    const customMaps = listLocalCustomMaps();
    const hasLocalCustom = customMaps.length > 0;
    const activeMap = hasLocalCustom
      ? `/models/Map/${customMaps[0]}`
      : '/api/maps/active.glb';
    res.json({
      defaultMap: '/api/maps/active.glb',
      customMaps: hasLocalCustom ? customMaps : [PREFERRED_MAP_FILENAME],
      activeMap,
      fallbackUrl: '/api/maps/active.glb',
      isCustom: true,
    });
  });

  app.get('/api/maps/active.glb', async (_req, res) => {
    const filePath = await ensureActiveMapFile();
    if (!filePath) {
      res.status(502).json({ ok: false, error: 'Unable to fetch custom arena GLB from upstream.' });
      return;
    }
    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(filePath);
  });

  if (IS_PROD) {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get(/^(?!\/api\/|\/ws).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use(async (req, res, next) => {
      if (req.originalUrl.startsWith('/api/') || req.originalUrl.startsWith('/ws')) {
        return next();
      }
      try {
        const htmlPath = path.join(ROOT_DIR, 'index.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        next(err);
      }
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const heartbeatInterval = setInterval(() => {
    for (const [ws, sess] of sessionsByWs.entries()) {
      if (!sess.isAlive) {
        ws.terminate();
        continue;
      }
      sess.isAlive = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }
  }, 25000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws) => {
    const sess: ClientSession = {
      ws,
      username: null,
      status: 'ONLINE',
      roomCode: null,
      agentId: 'ZEPHYR',
      isAlive: true,
    };
    sessionsByWs.set(ws, sess);

    ws.on('pong', () => {
      sess.isAlive = true;
    });

    ws.on('message', (data) => {
      sess.isAlive = true;
      handleSocketMessage(sess, data.toString());
    });

    ws.on('close', () => {
      sessionsByWs.delete(ws);
      if (sess.username) {
        const uname = sess.username;
        if (sess.roomCode) {
          leaveCurrentRoom(sess);
        }
        const key = normUser(uname);
        if (sessionsByUsername.get(key) === sess) {
          sessionsByUsername.delete(key);
        }
        notifyFriendsPresence(uname);
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Hollow Strike Server] Listening on http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[Hollow Strike Server] Failed to start:', err);
  process.exit(1);
});
