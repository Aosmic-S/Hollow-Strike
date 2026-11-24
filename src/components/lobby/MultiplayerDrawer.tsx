/**
 * Hollow Strike - Real-Time Multiplayer, Unique Username & Friend List Drawer
 * Connects to server WebSocket for locally cached unique usernames, live friend presence & requests,
 * custom room creation/joining by 6-char code, team switching, and real-time match launches.
 */

import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Globe,
  Lock,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Shield,
  Swords,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { multiplayerClient } from '../../game/multiplayerClient';
import { resolveMapDef } from '../../game/mapData';
import { clampTeamSizeForMap, isTdmMap } from '../../game/rules';
import { AGENT_REGISTRY, BotDifficulty, MapDef, MatchMode, OnlinePresenceStatus } from '../../game/types';
import { TacticalComms } from '../TacticalComms';

interface MultiplayerDrawerProps {
  selectedAgentId: string;
  selectedMapId: string;
  availableMaps: MapDef[];
  defaultDifficulty: BotDifficulty;
  onSelectMap: (mapId: string) => void;
  onClose: () => void;
}

type DrawerTab = 'ROOMS' | 'FRIENDS';

const STATUS_DOT: Record<OnlinePresenceStatus, string> = {
  ONLINE: 'bg-[#17E5B8]',
  IN_LOBBY: 'bg-[#fbbf24]',
  IN_MATCH: 'bg-[#FF4655]',
  OFFLINE: 'bg-[#8B978F]/50',
};

export const MultiplayerDrawer: React.FC<MultiplayerDrawerProps> = ({
  selectedAgentId,
  selectedMapId,
  availableMaps,
  defaultDifficulty,
  onSelectMap,
  onClose,
}) => {
  const [, setTick] = useState(0);
  const [tab, setTab] = useState<DrawerTab>('ROOMS');
  const [usernameInput, setUsernameInput] = useState<string>(multiplayerClient.getCachedUsername());
  const [friendInput, setFriendInput] = useState<string>('');
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [createMode, setCreateMode] = useState<MatchMode>('CUSTOM');
  const [createMapId, setCreateMapId] = useState<string>(selectedMapId);
  const [createTdmSize, setCreateTdmSize] = useState<1 | 2>(2);
  const [createFillBots, setCreateFillBots] = useState<boolean>(false);
  const [createPublic, setCreatePublic] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  useEffect(() => {
    multiplayerClient.connect();
    multiplayerClient.setAgent(selectedAgentId);
    const unsub = multiplayerClient.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, [selectedAgentId]);

  const handleClaimUsername = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim().length < 3) return;
    multiplayerClient.claimUsername(usernameInput, selectedAgentId);
  };

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendInput.trim()) return;
    multiplayerClient.addFriend(friendInput);
    setFriendInput('');
  };

  const handleJoinCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCodeInput.trim().length < 4) return;
    multiplayerClient.joinRoom(roomCodeInput);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1600);
  };

  const room = multiplayerClient.currentRoom;
  const roomMapDef = resolveMapDef(room?.mapId);
  const roomIsTdm = isTdmMap(roomMapDef);
  const roomTeamCapacity = roomIsTdm
    ? clampTeamSizeForMap(roomMapDef, room?.tdmTeamSize)
    : (roomMapDef.maxTeamSize ?? 5);
  const isHost = Boolean(room && room.hostUsername === multiplayerClient.username);
  const attackers = room?.members.filter((m) => m.team === 'ATTACKERS') ?? [];
  const defenders = room?.members.filter((m) => m.team === 'DEFENDERS') ?? [];
  const meInRoom = room?.members.find((m) => m.username === multiplayerClient.username);

  return (
    <div
      data-testid="multiplayer-drawer"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1923]/88 backdrop-blur-sm p-3 sm:p-5 select-none"
    >
      <div className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col border border-[#ECE8E1]/20 bg-[#18232E] p-4 sm:p-6 shadow-2xl overflow-y-auto clip-val-panel">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECE8E1]/15 pb-3.5">
          <div className="flex items-center gap-3">
            <div
              className={`h-2.5 w-2.5 rotate-45 ${
                multiplayerClient.connected ? 'bg-[#17E5B8]' : 'bg-[#FF4655] animate-pulse'
              }`}
            />
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-extrabold uppercase tracking-[0.14em] text-[#ECE8E1]">
                MULTIPLAYER NETWORK & SOCIAL
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#8B978F]">
                {multiplayerClient.connected
                  ? 'LIVE WEBSOCKET SERVER CONNECTED · REAL-TIME SYNC'
                  : 'CONNECTING TO MULTIPLAYER SERVER...'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="bg-[#FF4655] px-4 py-2 font-display text-xs font-extrabold uppercase tracking-widest text-[#ECE8E1] hover:bg-[#ff5a68] transition cursor-pointer clip-val-btn"
          >
            ← BACK TO LOBBY
          </button>
        </div>

        {/* Unique Username Claim Bar */}
        <form
          onSubmit={handleClaimUsername}
          className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border border-[#ECE8E1]/15 bg-[#0F1923]/85 p-3 clip-val-card"
        >
          <div className="flex flex-col">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#8B978F]">
              Unique Operative Username (Cached Locally)
            </span>
            <span className="font-mono text-[10px] text-[#17E5B8]">
              {multiplayerClient.usernameClaimed
                ? `ACTIVE ID: @${multiplayerClient.username}`
                : 'Claim a unique 3-16 character handle to play custom matches & add friends'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              data-testid="mp-username-input"
              maxLength={16}
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Unique handle (3-16 chars)"
              className="border border-[#ECE8E1]/20 bg-[#18232E] px-3 py-1.5 font-mono text-xs font-bold text-[#ECE8E1] focus:border-[#17E5B8] focus:outline-none"
            />
            <button
              type="submit"
              data-testid="mp-claim-username-btn"
              className="bg-[#17E5B8] px-3.5 py-1.5 font-display text-xs font-extrabold uppercase tracking-wider text-[#0F1923] hover:opacity-90 transition cursor-pointer clip-val-card"
            >
              {multiplayerClient.usernameClaimed ? 'UPDATE' : 'CLAIM ID'}
            </button>
          </div>
        </form>

        {(multiplayerClient.usernameError || multiplayerClient.notice) && (
          <div
            className={`mt-2.5 flex items-center justify-between border px-3 py-2 font-mono text-xs clip-val-card ${
              multiplayerClient.usernameError
                ? 'border-[#FF4655]/60 bg-[#FF4655]/15 text-[#FF4655]'
                : 'border-[#17E5B8]/60 bg-[#17E5B8]/15 text-[#17E5B8]'
            }`}
          >
            <span>{multiplayerClient.usernameError ?? multiplayerClient.notice}</span>
            <button
              type="button"
              onClick={() => multiplayerClient.clearNotice()}
              className="opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Incoming Match Invites Banner */}
        {multiplayerClient.invites.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {multiplayerClient.invites.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 border border-[#fbbf24]/60 bg-[#fbbf24]/12 px-3 py-2 font-mono text-xs clip-val-card"
              >
                <span className="text-[#ECE8E1]">
                  <strong className="text-[#fbbf24]">@{inv.fromUsername}</strong> invited you to Room{' '}
                  <strong className="text-[#17E5B8]">{inv.roomCode}</strong> ({inv.mode})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      multiplayerClient.joinRoom(inv.roomCode);
                      multiplayerClient.dismissInvite(inv.id);
                      setTab('ROOMS');
                    }}
                    className="bg-[#17E5B8] px-3 py-1 font-bold uppercase text-[#0F1923] cursor-pointer"
                  >
                    JOIN ROOM
                  </button>
                  <button
                    type="button"
                    onClick={() => multiplayerClient.dismissInvite(inv.id)}
                    className="border border-[#ECE8E1]/20 px-2 py-1 text-[#8B978F] hover:text-[#ECE8E1] cursor-pointer"
                  >
                    DISMISS
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sub-Tabs: Custom Rooms vs Real-Time Friends */}
        <div className="mt-4 flex items-center gap-2 border-b border-[#ECE8E1]/10 pb-2.5">
          <button
            type="button"
            data-testid="mp-tab-rooms"
            onClick={() => setTab('ROOMS')}
            className={`flex items-center gap-2 px-4 py-1.5 font-display text-xs font-extrabold uppercase tracking-wider transition cursor-pointer clip-val-card ${
              tab === 'ROOMS'
                ? 'bg-[#FF4655] text-[#ECE8E1]'
                : 'border border-[#ECE8E1]/15 bg-[#0F1923] text-[#8B978F] hover:text-[#ECE8E1]'
            }`}
          >
            <Swords className="h-3.5 w-3.5" />
            CUSTOM & PUBLIC MATCHES
            {room && <span className="bg-[#0F1923]/60 px-1.5 text-[10px] font-mono">{room.code}</span>}
          </button>

          <button
            type="button"
            data-testid="mp-tab-friends"
            onClick={() => setTab('FRIENDS')}
            className={`flex items-center gap-2 px-4 py-1.5 font-display text-xs font-extrabold uppercase tracking-wider transition cursor-pointer clip-val-card ${
              tab === 'FRIENDS'
                ? 'bg-[#FF4655] text-[#ECE8E1]'
                : 'border border-[#ECE8E1]/15 bg-[#0F1923] text-[#8B978F] hover:text-[#ECE8E1]'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            FRIEND LIST ({multiplayerClient.friends.length})
            {multiplayerClient.pendingRequests.length > 0 && (
              <span className="bg-[#17E5B8] px-1.5 font-mono text-[10px] text-[#0F1923]">
                {multiplayerClient.pendingRequests.length} NEW
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        {!multiplayerClient.usernameClaimed ? (
          <div className="my-8 text-center font-mono text-xs text-[#8B978F]">
            Claim a unique username above to unlock Real-Time Custom Matches and Friends.
          </div>
        ) : tab === 'ROOMS' ? (
          room ? (
            /* ACTIVE CUSTOM ROOM LOBBY */
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border border-[#17E5B8]/40 bg-[#0F1923]/85 p-3.5 clip-val-card">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#8B978F]">
                      ROOM CODE:
                    </span>
                    <span
                      data-testid="mp-active-room-code"
                      className="font-mono text-lg font-black tracking-widest text-[#17E5B8]"
                    >
                      {room.code}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(room.code)}
                      className="border border-[#ECE8E1]/20 bg-[#18232E] px-2 py-0.5 font-mono text-[10px] text-[#ECE8E1] hover:border-[#17E5B8] cursor-pointer flex items-center gap-1"
                    >
                      {copiedCode ? <Check className="h-3 w-3 text-[#17E5B8]" /> : <Copy className="h-3 w-3" />}
                      {copiedCode ? 'COPIED' : 'COPY'}
                    </button>
                  </div>
                  <div className="font-mono text-[11px] text-[#8B978F] mt-0.5">
                    Host: @{room.hostUsername} · Map: <span className="text-[#ECE8E1] font-bold">{roomMapDef.name}</span> · Mode:{' '}
                    {roomIsTdm ? `${roomTeamCapacity}V${roomTeamCapacity} TDM (NO SPIKE)` : room.mode} · AI Fill:{' '}
                    {room.fillBots ? `${roomTeamCapacity}v${roomTeamCapacity} ON` : 'HUMANS ONLY'} ·{' '}
                    {room.isPublic ? 'PUBLIC' : 'PRIVATE'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isHost && (
                    <select
                      aria-label="Room Map"
                      data-testid="mp-active-room-map-select"
                      value={room.mapId || 'WAREHOUSE'}
                      onChange={(e) => {
                        onSelectMap(e.target.value);
                        multiplayerClient.updateRoomConfig({ mapId: e.target.value });
                      }}
                      className="border border-[#ECE8E1]/20 bg-[#18232E] px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase text-[#ECE8E1] focus:border-[#17E5B8] focus:outline-none cursor-pointer"
                    >
                      {availableMaps.map((m) => (
                        <option key={m.id} value={m.id}>
                          MAP: {m.name.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  )}

                  {isHost && roomIsTdm && (
                    <div className="flex items-center border border-[#FF4655]/50 bg-[#18232E]">
                      {([1, 2] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => multiplayerClient.updateRoomConfig({ tdmTeamSize: sz })}
                          className={`px-2 py-1.5 font-mono text-[10px] font-black uppercase cursor-pointer ${
                            roomTeamCapacity === sz ? 'bg-[#FF4655] text-white' : 'text-[#8B978F] hover:text-[#ECE8E1]'
                          }`}
                        >
                          {sz}V{sz}
                        </button>
                      ))}
                    </div>
                  )}

                  {isHost && (
                    <button
                      type="button"
                      onClick={() => multiplayerClient.updateRoomConfig({ fillBots: !room.fillBots })}
                      className={`border px-3 py-1.5 font-mono text-[10px] font-bold uppercase cursor-pointer ${
                        room.fillBots
                          ? 'border-[#17E5B8]/60 bg-[#17E5B8]/15 text-[#17E5B8]'
                          : 'border-[#ECE8E1]/20 bg-[#18232E] text-[#8B978F]'
                      }`}
                    >
                      {room.fillBots ? 'FILL BOTS: ON' : 'FILL BOTS: OFF'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => multiplayerClient.leaveRoom()}
                    className="flex items-center gap-1.5 border border-[#FF4655]/60 bg-[#FF4655]/15 px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-[#FF4655] hover:bg-[#FF4655] hover:text-white transition cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    LEAVE
                  </button>
                </div>
              </div>

              {/* ATT vs DEF Team Rosters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { side: 'ATTACKERS' as const, title: 'ATTACKERS (RED)', color: '#FF4655', list: attackers },
                  { side: 'DEFENDERS' as const, title: 'DEFENDERS (TEAL)', color: '#17E5B8', list: defenders },
                ].map((teamBox) => (
                  <div
                    key={teamBox.side}
                    className="border border-[#ECE8E1]/15 bg-[#0F1923]/80 p-3.5 space-y-2 clip-val-card"
                  >
                    <div className="flex items-center justify-between border-b border-[#ECE8E1]/10 pb-2">
                      <span className="font-display text-sm font-extrabold uppercase tracking-wider" style={{ color: teamBox.color }}>
                        {teamBox.title} ({teamBox.list.length}/{roomTeamCapacity})
                      </span>
                      {meInRoom?.team !== teamBox.side && (
                        <button
                          type="button"
                          onClick={() => multiplayerClient.switchTeam(teamBox.side)}
                          className="border border-[#ECE8E1]/20 bg-[#18232E] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#ECE8E1] hover:border-[#17E5B8] cursor-pointer"
                        >
                          JOIN TEAM
                        </button>
                      )}
                    </div>

                    {teamBox.list.length === 0 ? (
                      <div className="py-4 text-center font-mono text-[10px] text-[#8B978F]">
                        {room.fillBots ? 'Filled automatically with Smart AI Bots on launch' : 'Empty team slot'}
                      </div>
                    ) : (
                      teamBox.list.map((m) => (
                        <div
                          key={m.username}
                          className="flex items-center justify-between border border-[#ECE8E1]/10 bg-[#18232E] px-3 py-2 font-mono text-xs"
                        >
                          <div>
                            <span className="font-bold text-[#ECE8E1]">@{m.username}</span>
                            {m.isHost && (
                              <span className="ml-2 bg-[#fbbf24]/20 px-1 text-[9px] font-bold text-[#fbbf24]">HOST</span>
                            )}
                            <div className="text-[10px] text-[#8B978F]">
                              {AGENT_REGISTRY[m.agentId]?.name ?? m.agentId}
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold uppercase ${m.ready ? 'text-[#17E5B8]' : 'text-[#8B978F]'}`}>
                            {m.ready ? 'READY' : 'WAITING'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>

              {/* Squad Text & WebRTC Voice Chat */}
              <TacticalComms variant="embedded" />

              {/* Invite Online Friends Strip + Launch */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECE8E1]/10 pt-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {multiplayerClient.friends
                    .filter((f) => f.status !== 'OFFLINE' && f.roomCode !== room.code)
                    .map((f) => (
                      <button
                        key={f.username}
                        type="button"
                        onClick={() => multiplayerClient.inviteFriend(f.username)}
                        className="border border-[#17E5B8]/40 bg-[#0F1923] px-2.5 py-1 font-mono text-[10px] text-[#17E5B8] hover:bg-[#17E5B8]/15 cursor-pointer"
                      >
                        + INVITE @{f.username}
                      </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => multiplayerClient.toggleReady()}
                    className={`border px-4 py-2 font-display text-xs font-extrabold uppercase tracking-wider cursor-pointer clip-val-card ${
                      meInRoom?.ready
                        ? 'border-[#17E5B8] bg-[#17E5B8]/20 text-[#17E5B8]'
                        : 'border-[#ECE8E1]/25 bg-[#0F1923] text-[#ECE8E1]'
                    }`}
                  >
                    {meInRoom?.ready ? 'READY ✓' : 'SET READY'}
                  </button>

                  {isHost && (
                    <button
                      type="button"
                      data-testid="mp-start-custom-match-btn"
                      onClick={() => multiplayerClient.startMatch()}
                      className="flex items-center gap-2 bg-[#FF4655] px-6 py-2 font-display text-sm font-extrabold uppercase tracking-widest text-[#ECE8E1] hover:bg-[#ff5e6b] cursor-pointer clip-val-btn"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      LAUNCH LIVE MATCH
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ROOM BROWSER + CREATE + JOIN */
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Create / Quick Match */}
              <div className="border border-[#ECE8E1]/15 bg-[#0F1923]/80 p-4 space-y-3 clip-val-card">
                <h3 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#ECE8E1]">
                  CREATE CUSTOM MATCH OR QUICK PLAY
                </h3>

                <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                  {(['CUSTOM', 'COMPETITIVE', 'SKIRMISH'] as MatchMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCreateMode(m)}
                      className={`border py-1.5 font-bold uppercase cursor-pointer ${
                        createMode === m
                          ? 'border-[#FF4655] bg-[#FF4655]/20 text-[#ECE8E1]'
                          : 'border-[#ECE8E1]/15 bg-[#18232E] text-[#8B978F]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {/* Map Picker Pills for Room Creation */}
                <div className="space-y-1">
                  <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#8B978F]">
                    ARENA MAP
                  </div>
                  <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                    {availableMaps.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        data-testid={`mp-create-map-${m.id}`}
                        onClick={() => {
                          setCreateMapId(m.id);
                          onSelectMap(m.id);
                        }}
                        className={`border px-2.5 py-1 font-bold uppercase cursor-pointer transition ${
                          createMapId === m.id
                            ? 'border-[#17E5B8] bg-[#17E5B8]/18 text-[#17E5B8]'
                            : 'border-[#ECE8E1]/15 bg-[#18232E] text-[#8B978F] hover:text-[#ECE8E1]'
                        }`}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>

                {isTdmMap(resolveMapDef(createMapId)) && (
                  <div className="flex items-center justify-between border border-[#FF4655]/45 bg-[#FF4655]/10 px-2.5 py-1.5 font-mono text-[10px]">
                    <span className="font-bold text-[#FF4655]">TDM FORMAT (NO SPIKE)</span>
                    <div className="flex items-center gap-1">
                      {([1, 2] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setCreateTdmSize(sz)}
                          className={`border px-2 py-0.5 font-bold uppercase cursor-pointer ${
                            createTdmSize === sz
                              ? 'border-[#FF4655] bg-[#FF4655] text-white'
                              : 'border-[#ECE8E1]/20 bg-[#18232E] text-[#8B978F]'
                          }`}
                        >
                          {sz}V{sz}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                  <button
                    type="button"
                    onClick={() => setCreatePublic((v) => !v)}
                    className="flex items-center justify-center gap-1.5 border border-[#ECE8E1]/15 bg-[#18232E] py-2 font-bold text-[#ECE8E1] cursor-pointer"
                  >
                    {createPublic ? <Globe className="h-3.5 w-3.5 text-[#17E5B8]" /> : <Lock className="h-3.5 w-3.5 text-[#fbbf24]" />}
                    {createPublic ? 'PUBLIC ROOM' : 'PRIVATE INVITE'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateFillBots((v) => !v)}
                    className="flex items-center justify-center gap-1.5 border border-[#ECE8E1]/15 bg-[#18232E] py-2 font-bold text-[#ECE8E1] cursor-pointer"
                  >
                    <Shield className="h-3.5 w-3.5 text-[#17E5B8]" />
                    {createFillBots
                      ? `FILL ${isTdmMap(resolveMapDef(createMapId)) ? `${createTdmSize}V${createTdmSize}` : '5V5'} BOTS`
                      : 'HUMANS ONLY'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    data-testid="mp-create-room-btn"
                    onClick={() =>
                      multiplayerClient.createRoom({
                        mode: createMode,
                        mapId: createMapId,
                        tdmTeamSize: isTdmMap(resolveMapDef(createMapId)) ? createTdmSize : undefined,
                        botDifficulty: defaultDifficulty,
                        fillBots: createFillBots,
                        isPublic: createPublic,
                      })
                    }
                    className="flex items-center justify-center gap-1.5 bg-[#FF4655] py-2.5 font-display text-xs font-extrabold uppercase tracking-wider text-[#ECE8E1] hover:bg-[#ff5e6b] cursor-pointer clip-val-btn"
                  >
                    <Plus className="h-4 w-4" />
                    CREATE ROOM
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      multiplayerClient.quickMatch(
                        'CUSTOM',
                        defaultDifficulty,
                        createMapId,
                        isTdmMap(resolveMapDef(createMapId)) ? createTdmSize : undefined
                      )
                    }
                    className="flex items-center justify-center gap-1.5 border border-[#17E5B8]/60 bg-[#17E5B8]/15 py-2.5 font-display text-xs font-extrabold uppercase tracking-wider text-[#17E5B8] hover:bg-[#17E5B8]/25 cursor-pointer clip-val-card"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    QUICK MATCH
                  </button>
                </div>

                <form onSubmit={handleJoinCode} className="border-t border-[#ECE8E1]/10 pt-3 flex gap-2">
                  <input
                    type="text"
                    data-testid="mp-join-code-input"
                    maxLength={8}
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="ENTER 6-CHAR CODE"
                    className="flex-1 border border-[#ECE8E1]/20 bg-[#18232E] px-3 py-1.5 font-mono text-xs font-bold uppercase text-[#ECE8E1] focus:border-[#17E5B8] focus:outline-none"
                  />
                  <button
                    type="submit"
                    data-testid="mp-join-code-btn"
                    className="bg-[#ECE8E1] px-4 py-1.5 font-display text-xs font-extrabold uppercase text-[#0F1923] hover:bg-white cursor-pointer clip-val-card"
                  >
                    JOIN
                  </button>
                </form>
              </div>

              {/* Live Public Rooms List */}
              <div className="border border-[#ECE8E1]/15 bg-[#0F1923]/80 p-4 flex flex-col justify-between clip-val-card">
                <div>
                  <h3 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#ECE8E1] mb-2.5">
                    LIVE PUBLIC LOBBIES ({multiplayerClient.publicRooms.length})
                  </h3>

                  {multiplayerClient.publicRooms.length === 0 ? (
                    <div className="py-10 text-center font-mono text-xs text-[#8B978F]">
                      No open public rooms right now. Create one or hit Quick Match!
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {multiplayerClient.publicRooms.map((r) => {
                        const rDef = resolveMapDef(r.mapId);
                        const rCap = isTdmMap(rDef) ? clampTeamSizeForMap(rDef, r.tdmTeamSize) * 2 : 10;
                        return (
                        <div
                          key={r.code}
                          className="flex items-center justify-between border border-[#ECE8E1]/15 bg-[#18232E] px-3 py-2 font-mono text-xs"
                        >
                          <div>
                            <div className="font-bold text-[#ECE8E1]">{r.name}</div>
                            <div className="text-[10px] text-[#8B978F]">
                              Host @{r.hostUsername} · {rDef.name} · {isTdmMap(rDef) ? `${rCap / 2}V${rCap / 2} TDM` : r.mode} · {r.memberCount}/{rCap} Players
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => multiplayerClient.joinRoom(r.code)}
                            className="bg-[#17E5B8] px-3 py-1 font-bold uppercase text-[#0F1923] cursor-pointer"
                          >
                            JOIN
                          </button>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        ) : (
          /* REAL-TIME FRIEND LIST TAB */
          <div className="mt-4 space-y-4">
            <form onSubmit={handleAddFriend} className="flex gap-2">
              <input
                type="text"
                data-testid="mp-add-friend-input"
                maxLength={16}
                value={friendInput}
                onChange={(e) => setFriendInput(e.target.value)}
                placeholder="Add friend by unique username..."
                className="flex-1 border border-[#ECE8E1]/20 bg-[#0F1923] px-3.5 py-2 font-mono text-xs font-bold text-[#ECE8E1] focus:border-[#17E5B8] focus:outline-none"
              />
              <button
                type="submit"
                data-testid="mp-add-friend-btn"
                className="flex items-center gap-1.5 bg-[#17E5B8] px-4 py-2 font-display text-xs font-extrabold uppercase tracking-wider text-[#0F1923] hover:opacity-90 cursor-pointer clip-val-card"
              >
                <UserPlus className="h-4 w-4" />
                ADD FRIEND
              </button>
            </form>

            {multiplayerClient.pendingRequests.length > 0 && (
              <div className="border border-[#17E5B8]/40 bg-[#0F1923]/80 p-3 space-y-2 clip-val-card">
                <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#17E5B8]">
                  PENDING FRIEND REQUESTS ({multiplayerClient.pendingRequests.length})
                </div>
                {multiplayerClient.pendingRequests.map((reqUser) => (
                  <div
                    key={reqUser}
                    className="flex items-center justify-between border border-[#ECE8E1]/15 bg-[#18232E] px-3 py-2 font-mono text-xs"
                  >
                    <span className="font-bold text-[#ECE8E1]">@{reqUser}</span>
                    <button
                      type="button"
                      data-testid={`accept-friend-${reqUser}`}
                      onClick={() => multiplayerClient.acceptFriend(reqUser)}
                      className="flex items-center gap-1 bg-[#17E5B8] px-3 py-1 font-bold uppercase text-[#0F1923] cursor-pointer"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      ACCEPT
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {multiplayerClient.friends.length === 0 ? (
                <div className="border border-[#ECE8E1]/10 bg-[#0F1923]/60 py-8 text-center font-mono text-xs text-[#8B978F]">
                  No friends added yet. Enter another player&apos;s unique username above to connect in real time.
                </div>
              ) : (
                multiplayerClient.friends.map((f) => (
                  <div
                    key={f.username}
                    data-testid={`friend-row-${f.username}`}
                    className="flex flex-wrap items-center justify-between gap-2 border border-[#ECE8E1]/15 bg-[#0F1923]/85 px-3.5 py-2.5 font-mono text-xs clip-val-card"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[f.status]}`} />
                      <div>
                        <div className="font-bold text-[#ECE8E1]">@{f.username}</div>
                        <div className="text-[10px] text-[#8B978F]">
                          {f.status.replace('_', ' ')}
                          {f.roomCode ? ` · ROOM ${f.roomCode}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {room && f.status !== 'OFFLINE' && (
                        <button
                          type="button"
                          onClick={() => multiplayerClient.inviteFriend(f.username)}
                          className="border border-[#17E5B8]/60 bg-[#17E5B8]/15 px-2.5 py-1 text-[10px] font-bold uppercase text-[#17E5B8] cursor-pointer"
                        >
                          INVITE
                        </button>
                      )}
                      {f.roomCode && f.roomCode !== room?.code && (
                        <button
                          type="button"
                          onClick={() => {
                            multiplayerClient.joinRoom(f.roomCode!);
                            setTab('ROOMS');
                          }}
                          className="bg-[#17E5B8] px-2.5 py-1 text-[10px] font-bold uppercase text-[#0F1923] cursor-pointer"
                        >
                          JOIN
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => multiplayerClient.removeFriend(f.username)}
                        className="border border-[#ECE8E1]/15 px-2 py-1 text-[10px] text-[#8B978F] hover:border-[#FF4655] hover:text-[#FF4655] cursor-pointer"
                      >
                        REMOVE
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
