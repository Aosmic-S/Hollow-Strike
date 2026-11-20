/**
 * Hollow Strike - Main Tactical Lobby Shell
 * Inspired by tactical hero-shooter lobby staging: obsidian golden-ray atmosphere,
 * left crimson-framed lobby plaque + mode stack, 5 stepped chevron-bottom squad pennants,
 * right featured cards, and dedicated full-screen pages for Agents, Armory, Career, Profile & Settings.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Plus, Users, X } from 'lucide-react';
import {
  AGENT_REGISTRY,
  AgentDef,
  BotDifficulty,
  CustomRoomState,
  GameSettings,
  MatchMode,
  PlayerProfile,
} from '../game/types';
import { formatKeyCode } from '../game/rules';
import { computeRankProgress } from '../game/profileStore';
import { multiplayerClient } from '../game/multiplayerClient';
import { PWAInstallButton } from './PWAInstallButton';
import { SettingsPanel } from './SettingsPanel';
import { AgentsPage } from './lobby/AgentsPage';
import { ArmoryPage } from './lobby/ArmoryPage';
import { CareerPage } from './lobby/CareerPage';
import { ProfilePage } from './lobby/ProfilePage';
import { MultiplayerDrawer } from './lobby/MultiplayerDrawer';
import {
  ARMORY_SPOTLIGHT_ART,
  AgentEmblemMark,
  COURTYARD_MAP_ART,
  LOBBY_BACKDROP_ART,
  getPlayerCardArt,
} from './AgentAvatar';
import { soundEngine } from '../game/audio';

type LobbyTab = 'PLAY' | 'AGENTS' | 'ARMORY' | 'CAREER' | 'PROFILE' | 'SETTINGS';

interface LobbyScreenProps {
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
  difficulty: BotDifficulty;
  onSelectDifficulty: (diff: BotDifficulty) => void;
  settings: GameSettings;
  onUpdateSettings: (settings: GameSettings) => void;
  profile: PlayerProfile;
  onUpdateProfile: (profile: PlayerProfile) => void;
  onResetProfile: () => void;
  onStartGame: (mode: MatchMode, customRoom?: CustomRoomState | null, allyBotAgentIds?: string[]) => void;
}

const DEFAULT_BOT_AGENTS: string[] = [];

const QUEUE_MODES: { id: MatchMode; shortLabel: string; fullLabel: string; desc: string }[] = [
  {
    id: 'CUSTOM',
    shortLabel: 'MP 5V5',
    fullLabel: 'MULTIPLAYER 5V5',
    desc: 'Real players · Rooms, codes & friends',
  },
  {
    id: 'COMPETITIVE',
    shortLabel: 'PLANT AI',
    fullLabel: 'PLANT / DEFUSE (AI)',
    desc: 'First to 13 rounds · Halftime swap',
  },
  {
    id: 'SKIRMISH',
    shortLabel: 'SKIRMISH',
    fullLabel: 'SKIRMISH (AI)',
    desc: 'Buy phase · $2,900 start credits',
  },
  {
    id: 'PRACTICE',
    shortLabel: 'RANGE',
    fullLabel: 'PRACTICE RANGE',
    desc: 'Instant combat · Respawning targets',
  },
];

// Order on desktop md+ puts slot 0 (Leader) in dead center: [3, 1, 0, 2, 4]
const DESKTOP_STEPPED_CLASSES: Record<number, { orderClass: string; heightClass: string }> = {
  0: {
    orderClass: 'order-1 md:order-3',
    heightClass: 'h-[248px] sm:h-[280px] md:h-[328px] lg:h-[358px] xl:h-[380px] md:mt-0',
  },
  1: {
    orderClass: 'order-2 md:order-2',
    heightClass: 'h-[234px] sm:h-[264px] md:h-[302px] lg:h-[328px] xl:h-[346px] md:mt-4',
  },
  2: {
    orderClass: 'order-3 md:order-4',
    heightClass: 'h-[234px] sm:h-[264px] md:h-[302px] lg:h-[328px] xl:h-[346px] md:mt-4',
  },
  3: {
    orderClass: 'order-4 md:order-1',
    heightClass: 'h-[222px] sm:h-[248px] md:h-[276px] lg:h-[300px] xl:h-[316px] md:mt-8',
  },
  4: {
    orderClass: 'order-5 md:order-5',
    heightClass: 'h-[222px] sm:h-[248px] md:h-[276px] lg:h-[300px] xl:h-[316px] md:mt-8',
  },
};

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  selectedAgentId,
  onSelectAgent,
  difficulty,
  onSelectDifficulty,
  settings,
  onUpdateSettings,
  profile,
  onUpdateProfile,
  onResetProfile,
  onStartGame,
}) => {
  const currentAgent = AGENT_REGISTRY[selectedAgentId] || AGENT_REGISTRY.ZEPHYR;
  const rank = computeRankProgress(profile);
  const agentKeys = Object.keys(AGENT_REGISTRY);

  const [queueMode, setQueueMode] = useState<MatchMode>('CUSTOM');
  const [activeTab, setActiveTab] = useState<LobbyTab>('PLAY');
  const [botAgentIds, setBotAgentIds] = useState<string[]>(DEFAULT_BOT_AGENTS);
  const [showSocialDrawer, setShowSocialDrawer] = useState<boolean>(false);
  const [, setSocialTick] = useState<number>(0);

  const playScrollRef = useRef<HTMLDivElement | null>(null);
  const startSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    multiplayerClient.connect();
    multiplayerClient.setAgent(selectedAgentId);
    return multiplayerClient.subscribe(() => setSocialTick((t) => t + 1));
  }, [selectedAgentId]);

  const scrollToStartMatch = () => {
    if (startSectionRef.current) {
      startSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (playScrollRef.current) {
      playScrollRef.current.scrollTo({ top: playScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const handleStart = async (overrideMode?: MatchMode) => {
    const modeToRun = overrideMode ?? queueMode;
    if (modeToRun === 'CUSTOM') {
      if (multiplayerClient.currentRoom && multiplayerClient.currentRoom.hostUsername === multiplayerClient.username) {
        multiplayerClient.startMatch();
      } else {
        setShowSocialDrawer(true);
      }
      return;
    }

    soundEngine.init();
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
      if (screen.orientation && 'lock' in screen.orientation) {
        await (screen.orientation as unknown as { lock: (mode: string) => Promise<void> })
          .lock('landscape')
          .catch(() => {});
      }
    } catch {
      // Ignored if unsupported (e.g. iOS Safari)
    }
    onStartGame(modeToRun, null, botAgentIds);
  };

  const handleCycleBotAgent = (botIndex: number) => {
    setBotAgentIds((prev) => {
      const current = prev[botIndex];
      const nextIdx = (agentKeys.indexOf(current) + 1) % agentKeys.length;
      const copy = [...prev];
      copy[botIndex] = agentKeys[nextIdx];
      return copy;
    });
  };

  const handleRemoveBot = (botIndex: number) => {
    setBotAgentIds((prev) => prev.filter((_, i) => i !== botIndex));
  };

  const handleAddBotSlot = () => {
    if (botAgentIds.length >= 4) return;
    const nextAgentId = agentKeys[(botAgentIds.length + 1) % agentKeys.length];
    setBotAgentIds([...botAgentIds, nextAgentId]);
  };

  const handleCycleDifficulty = () => {
    const order: BotDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];
    const next = order[(order.indexOf(difficulty) + 1) % order.length];
    onSelectDifficulty(next);
  };

  const activeRoom = multiplayerClient.currentRoom;
  const myUsernameLower = (multiplayerClient.username || '').toLowerCase();
  const myRoomMember = activeRoom?.members.find((m) => m.username.toLowerCase() === myUsernameLower);
  const myRoomTeam = myRoomMember?.team ?? 'ATTACKERS';
  const roomTeammates =
    activeRoom?.members.filter(
      (m) => m.team === myRoomTeam && m.username.toLowerCase() !== myUsernameLower
    ) ?? [];

  const squadMembers = [
    {
      name: multiplayerClient.usernameClaimed
        ? `@${multiplayerClient.username}`
        : profile.callsign || 'Operative',
      agent: currentAgent,
      isLeader: true,
      isHumanTeammate: true,
      readyLabel: activeRoom ? (myRoomMember?.isHost ? 'HOST' : 'READY') : 'READY',
      subLabel: activeRoom
        ? `${myRoomTeam} · ROOM ${activeRoom.code}`
        : `${currentAgent.name} · ${currentAgent.role}`,
      botIndex: -1,
    },
    ...(queueMode === 'CUSTOM'
      ? roomTeammates.slice(0, 4).map((tm) => {
          const ag: AgentDef = AGENT_REGISTRY[tm.agentId] || AGENT_REGISTRY.ZEPHYR;
          return {
            name: `@${tm.username}`,
            agent: ag,
            isLeader: false,
            isHumanTeammate: true,
            readyLabel: tm.isHost ? 'HOST' : tm.ready ? 'READY' : 'WAITING',
            subLabel: `${ag.name} · ${ag.role}`,
            botIndex: -1,
          };
        })
      : botAgentIds.map((agId, idx) => {
          const ag: AgentDef = AGENT_REGISTRY[agId] || AGENT_REGISTRY.ZEPHYR;
          return {
            name: `Ally ${ag.name}`,
            agent: ag,
            isLeader: false,
            isHumanTeammate: false,
            readyLabel: `${difficulty} AI`,
            subLabel: `${ag.name} · TAP TO SWAP`,
            botIndex: idx,
          };
        })),
  ];

  const activeModeMeta = QUEUE_MODES.find((q) => q.id === queueMode) || QUEUE_MODES[0];
  const winRate =
    profile.totalMatches > 0 ? Math.round((profile.wins / profile.totalMatches) * 100) : 0;
  const kdRatio =
    profile.deaths > 0 ? (profile.kills / profile.deaths).toFixed(2) : profile.kills.toFixed(2);
  const pendingBadgeCount =
    multiplayerClient.pendingRequests.length + multiplayerClient.invites.length;

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[#0A0E14] text-[#ECE8E1] select-none">
      {/* Warm Obsidian Golden-Ray Atmospheric Backdrop */}
      <img
        src={LOBBY_BACKDROP_ART}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-75"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,_rgba(245,194,107,0.08)_0%,_rgba(10,14,20,0.72)_58%,_rgba(7,10,15,0.95)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#070B10]/90 via-transparent to-[#070B10]/90" />

      {/* Crisp Diagonal Corner Architectural Hairlines */}
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
        aria-hidden="true"
      >
        <line x1="180" y1="54" x2="0" y2="260" stroke="#ECE8E1" strokeWidth="1" />
        <line x1="1440" y1="680" x2="1220" y2="900" stroke="#ECE8E1" strokeWidth="1" />
      </svg>

      {showSocialDrawer && (
        <MultiplayerDrawer
          selectedAgentId={selectedAgentId}
          defaultDifficulty={difficulty}
          onClose={() => setShowSocialDrawer(false)}
        />
      )}

      {/* ULTRA-CLEAN TOP BAR */}
      <header className="relative z-20 flex h-13 sm:h-14 shrink-0 items-center justify-between border-b border-[#ECE8E1]/10 bg-[#0A0F16]/85 px-2.5 sm:px-5 backdrop-blur-md">
        {/* Left: Back Button (mobile secondary tabs) + Play Crest + Nav Tabs */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {activeTab !== 'PLAY' && (
            <button
              type="button"
              data-testid="mobile-tab-back-btn"
              onClick={() => setActiveTab('PLAY')}
              className="flex sm:hidden items-center gap-1 border border-[#FF4655]/60 bg-[#FF4655]/15 px-2.5 py-1 font-display text-xs font-extrabold uppercase tracking-wider text-[#ECE8E1] cursor-pointer shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>BACK</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('PLAY')}
            className="flex items-center gap-2 cursor-pointer shrink-0 group"
          >
            <div className="flex h-8 w-8 items-center justify-center border border-[#FF4655]/70 bg-[#FF4655]/15 group-hover:bg-[#FF4655] transition">
              <AgentEmblemMark agentId="BLITZ" accentColor="#ECE8E1" className="h-5 w-5" />
            </div>
            <span className="hidden xl:inline font-display text-base font-extrabold tracking-[0.2em] text-[#ECE8E1] uppercase">
              HOLLOW <span className="text-[#FF4655]">STRIKE</span>
            </span>
          </button>

          <nav className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar">
            {(['PLAY', 'AGENTS', 'ARMORY', 'CAREER', 'PROFILE', 'SETTINGS'] as LobbyTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-2 sm:px-3.5 py-2 font-display text-[11px] sm:text-xs font-bold uppercase tracking-[0.16em] transition cursor-pointer whitespace-nowrap ${
                  activeTab === tab
                    ? 'text-[#ECE8E1] after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:bg-[#FF4655]'
                    : 'text-[#8B978F] hover:text-[#ECE8E1]'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Center Level & Real Standing Diamond Crest (Matches Reference Top-Center Crest) */}
        <div className="hidden lg:flex items-center gap-4 font-mono text-[10px] shrink-0">
          <div className="text-right leading-tight">
            <div className="text-[#8B978F] uppercase tracking-[0.18em]">WINS</div>
            <div className="font-bold text-[#ECE8E1] tabular-nums">
              {profile.wins}/{profile.totalMatches}
            </div>
          </div>

          <div
            onClick={() => setActiveTab('PROFILE')}
            className="flex h-10 w-10 items-center justify-center bg-[#18232E]/90 border border-[#ECE8E1]/35 clip-diamond cursor-pointer hover:border-[#F59E0B] transition"
            title={`${rank.tier} · LVL ${rank.level}`}
          >
            <span className="font-display text-sm font-extrabold text-[#ECE8E1] tabular-nums">
              {rank.level}
            </span>
          </div>

          <div className="text-left leading-tight">
            <div className="text-[#8B978F] uppercase tracking-[0.18em]">K / D</div>
            <div className="font-bold text-[#17E5B8] tabular-nums">{kdRatio}</div>
          </div>
        </div>

        {/* Right: PWA Install + Online/Friends Trigger + Operative */}
        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
          <PWAInstallButton />

          <button
            type="button"
            data-testid="open-multiplayer-btn"
            onClick={() => setShowSocialDrawer(true)}
            className="relative flex items-center gap-1.5 border border-[#17E5B8]/55 bg-[#121C27]/90 px-2.5 sm:px-3 py-1.5 text-[11px] font-bold uppercase text-[#17E5B8] hover:bg-[#17E5B8]/15 transition cursor-pointer"
            title="Multiplayer Rooms & Friend List"
          >
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline max-w-[115px] truncate">
              {multiplayerClient.usernameClaimed
                ? `@${multiplayerClient.username}`
                : 'ONLINE / FRIENDS'}
            </span>
            {pendingBadgeCount > 0 && (
              <span className="bg-[#FF4655] px-1 text-[9px] font-black text-white">
                {pendingBadgeCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PROFILE')}
            className="hidden md:flex items-center gap-2 border border-[#ECE8E1]/15 bg-[#121C27]/90 px-2.5 py-1.5 hover:border-[#F59E0B] transition cursor-pointer"
            title="View Profile"
          >
            <span className="text-[#F59E0B] font-bold">LVL {rank.level}</span>
            <span className="text-[#ECE8E1] font-bold max-w-[85px] truncate">{profile.callsign}</span>
          </button>
        </div>
      </header>

      {/* ACTIVE PAGE CONTENT */}
      {activeTab === 'AGENTS' ? (
        <AgentsPage
          selectedAgentId={selectedAgentId}
          onSelectAgent={onSelectAgent}
          onDeployNow={() => handleStart()}
        />
      ) : activeTab === 'ARMORY' ? (
        <ArmoryPage />
      ) : activeTab === 'CAREER' ? (
        <CareerPage profile={profile} onStartQuickMatch={() => handleStart('COMPETITIVE')} />
      ) : activeTab === 'PROFILE' ? (
        <ProfilePage
          profile={profile}
          onUpdateProfile={onUpdateProfile}
          onResetProfile={onResetProfile}
        />
      ) : activeTab === 'SETTINGS' ? (
        <div className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex items-center justify-between border-b border-[#ECE8E1]/15 pb-3">
              <div>
                <h2 className="font-display text-2xl font-extrabold uppercase tracking-wider text-[#ECE8E1]">
                  System & Combat Settings
                </h2>
                <p className="font-mono text-xs text-[#8B978F]">
                  Configure sensitivities, reticle appearance, graphics scaling, and on-screen touch mapping.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('PLAY')}
                className="border border-[#ECE8E1]/20 bg-[#18232E] px-4 py-1.5 font-display text-xs font-bold uppercase tracking-widest text-[#ECE8E1] hover:border-[#FF4655] cursor-pointer clip-val-card"
              >
                Back to Play
              </button>
            </div>
            <SettingsPanel settings={settings} onUpdateSettings={onUpdateSettings} />
          </div>
        </div>
      ) : (
        /* PLAY LOBBY STAGE: 3-COLUMN VALORANT HOME UI */
        <div
          ref={playScrollRef}
          data-testid="lobby-play-scroll"
          className="relative z-10 flex flex-1 flex-col md:flex-row items-stretch justify-between overflow-y-auto md:overflow-hidden px-3 sm:px-6 py-3 sm:py-4 gap-4"
        >
          {/* Mobile Quick Jump Header Strip */}
          <div className="flex md:hidden items-center justify-between gap-2 border border-[#FF4655]/55 bg-[#0E1620]/90 px-3 py-2 shrink-0">
            <span className="font-mono text-[11px] font-bold uppercase text-[#ECE8E1] truncate">
              {activeModeMeta.fullLabel} · {currentAgent.name}
            </span>
            <button
              type="button"
              data-testid="scroll-to-start-btn"
              onClick={scrollToStartMatch}
              className="shrink-0 bg-[#FF4655] px-3 py-1 font-display text-xs font-extrabold uppercase tracking-wider text-white cursor-pointer"
            >
              ↓ PLAY
            </button>
          </div>

          {/* LEFT DOCK: Crimson-Framed Lobby Plaque + Mode Preview + Dark Tabular Stack */}
          <aside className="flex w-full md:w-56 lg:w-64 shrink-0 flex-col justify-between gap-3">
            <div className="space-y-2.5">
              {/* Crimson-Framed Angular Lobby Plaque (Close-up Reference #1 Top-Left Motif) */}
              <div className="relative flex items-stretch border border-[#FF4655]/85 bg-[#0C121A]/95 shadow-[0_8px_24px_rgba(0,0,0,0.55)] clip-val-plaque">
                {/* Left Vertical Cream/Red Tab */}
                <div className="flex w-8 shrink-0 flex-col items-center justify-center bg-[#ECE8E1] px-1 py-2 text-[#0F1923]">
                  <img
                    src="/assets/aistudio/IMG_20260612_142121_950_4842057d.webp"
                    alt="AosmiC Studio"
                    className="h-4 w-4 object-contain invert opacity-85"
                  />
                  <span className="mt-1 font-mono text-[8px] font-black tracking-tighter uppercase">
                    S01
                  </span>
                </div>

                {/* Plaque Title */}
                <div className="flex flex-1 flex-col justify-center px-3 py-2.5">
                  <h1 className="font-display text-xl sm:text-2xl font-extrabold uppercase tracking-[0.14em] text-[#ECE8E1] leading-none">
                    LOBBY
                  </h1>
                  <span className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF4655]">
                    {activeModeMeta.fullLabel}
                  </span>
                </div>
              </div>

              {/* Map & Mode Selector Card (Matches Left Thumbnail Card in Reference #1 & #3) */}
              <div className="border border-[#ECE8E1]/15 bg-[#0D141D]/92 overflow-hidden">
                <div className="relative h-20 sm:h-24 w-full overflow-hidden">
                  <img
                    src={COURTYARD_MAP_ART}
                    alt="Courtyard 5v5 Map"
                    className="h-full w-full object-cover object-center opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0D141D] via-[#0D141D]/30 to-transparent" />
                  <div className="absolute bottom-1.5 left-2.5 right-2.5 flex items-end justify-between">
                    <div>
                      <div className="font-display text-sm font-extrabold uppercase tracking-[0.18em] text-[#ECE8E1] leading-none">
                        COURTYARD
                      </div>
                      <div className="font-mono text-[9px] text-[#8B978F] uppercase tracking-wider mt-0.5">
                        {activeModeMeta.desc}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4-Mode Selector Grid */}
                <div className="grid grid-cols-4 border-t border-[#ECE8E1]/10 divide-x divide-[#ECE8E1]/10">
                  {QUEUE_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      data-testid={`queue-mode-${m.id}`}
                      onClick={() => setQueueMode(m.id)}
                      className={`py-2 px-1 text-center font-mono text-[9px] font-bold uppercase tracking-wider transition cursor-pointer ${
                        queueMode === m.id
                          ? 'bg-[#FF4655] text-white'
                          : 'bg-[#0C131B] text-[#8B978F] hover:bg-[#172230] hover:text-[#ECE8E1]'
                      }`}
                    >
                      {m.shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stacked Dark Tactical Menu Rows (Reference #1 Close-Up Stack) */}
              <div className="border border-[#ECE8E1]/15 bg-[#0C131B]/92 divide-y divide-[#ECE8E1]/10 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => handleStart('PRACTICE')}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-[#172330] transition cursor-pointer group"
                >
                  <span className="font-bold uppercase tracking-wider text-[#ECE8E1]/90 group-hover:text-[#17E5B8]">
                    PRACTICE RANGE
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-[#8B978F] group-hover:text-[#17E5B8]" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowSocialDrawer(true)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-[#172330] transition cursor-pointer group"
                >
                  <span className="font-bold uppercase tracking-wider text-[#ECE8E1]/90">
                    {activeRoom ? `ROOM ${activeRoom.code}` : 'ROOM / CODE'}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-[#17E5B8]">
                    {activeRoom
                      ? `${activeRoom.members.length}/10`
                      : `${multiplayerClient.publicRooms.length} OPEN`}
                  </span>
                </button>

                {queueMode === 'CUSTOM' ? (
                  <button
                    type="button"
                    onClick={() => setShowSocialDrawer(true)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-[#172330] transition cursor-pointer"
                  >
                    <span className="font-bold uppercase tracking-wider text-[#ECE8E1]/90">
                      BOT FILL
                    </span>
                    <span className="text-[10px] font-bold uppercase text-[#8B978F]">
                      HUMANS ONLY
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCycleDifficulty}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-[#172330] transition cursor-pointer"
                  >
                    <span className="font-bold uppercase tracking-wider text-[#ECE8E1]/90">
                      BOT SKILL
                    </span>
                    <span className="text-[10px] font-bold uppercase text-[#17E5B8]">
                      {difficulty} ↻
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab('AGENTS')}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-[#172330] transition cursor-pointer group"
                >
                  <span className="font-bold uppercase tracking-wider text-[#ECE8E1]/90">
                    AGENT
                  </span>
                  <span
                    className="text-[10px] font-bold uppercase"
                    style={{ color: currentAgent.primaryColor }}
                  >
                    {currentAgent.name} &gt;
                  </span>
                </button>
              </div>
            </div>

            {/* Bottom Connection Status Readout (Minimal unboxed text) */}
            <div className="hidden md:flex items-center justify-between px-1 font-mono text-[10px] text-[#8B978F]">
              <span className="uppercase tracking-[0.16em]">
                WS {multiplayerClient.connected ? 'CONNECTED' : 'SYNCING'}
              </span>
              <span className="uppercase tracking-[0.14em] text-[#ECE8E1]/70">
                AOSMIC STUDIO
              </span>
            </div>
          </aside>

          {/* CENTER STAGE: 5 STEPPED CHEVRON-BOTTOM PENNANTS + SINGLE PRIMARY CTA */}
          <main className="flex flex-1 flex-col items-center justify-center min-w-0 py-1">
            <div
              data-testid="lobby-squad-scroll"
              className="w-full overflow-x-auto no-scrollbar pb-2"
            >
              <div className="mx-auto flex w-max items-start justify-center gap-2 sm:gap-3 lg:gap-3.5 px-2 pt-3">
                {[0, 1, 2, 3, 4].map((idx) => {
                  const member = squadMembers[idx];
                  const slotLayout = DESKTOP_STEPPED_CLASSES[idx];

                  if (member) {
                    const artUrl = getPlayerCardArt(member.agent.id, idx);
                    return (
                      <div
                        key={idx}
                        data-testid={`squad-card-${idx}`}
                        onClick={() => {
                          if (member.isLeader) {
                            setActiveTab('AGENTS');
                          } else if (member.botIndex >= 0) {
                            handleCycleBotAgent(member.botIndex);
                          } else {
                            setShowSocialDrawer(true);
                          }
                        }}
                        className={`group relative flex w-[114px] sm:w-[126px] lg:w-[138px] xl:w-[152px] shrink-0 flex-col items-center cursor-pointer transition-transform duration-200 hover:-translate-y-1 ${slotLayout.orderClass} ${slotLayout.heightClass}`}
                      >
                        {/* Top Straddling Level / Role Diamond Crest */}
                        <div
                          className={`relative z-20 -mb-2.5 flex h-6 min-w-[34px] items-center justify-center border px-1.5 font-mono text-[10px] font-extrabold tracking-wider shadow-lg ${
                            member.isLeader
                              ? 'border-[#ECE8E1] bg-[#18232E] text-[#ECE8E1]'
                              : 'border-[#ECE8E1]/50 bg-[#111A24] text-[#ECE8E1]/90'
                          }`}
                        >
                          {member.isLeader
                            ? rank.level
                            : member.isHumanTeammate
                              ? 'MP'
                              : 'AI'}
                        </div>

                        {/* Remove AI Bot Button if AI Ally */}
                        {member.botIndex >= 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveBot(member.botIndex);
                            }}
                            className="absolute top-3 right-1.5 z-30 flex h-5 w-5 items-center justify-center bg-[#0B1118]/85 text-[#8B978F] hover:text-[#FF4655] transition cursor-pointer"
                            title="Remove AI Ally"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}

                        {/* Main Clipped Chevron Pennant Body */}
                        <div
                          className={`relative flex w-full flex-1 flex-col justify-between overflow-hidden clip-pennant border-t-2 shadow-[0_18px_40px_rgba(0,0,0,0.65)] ${
                            member.isLeader
                              ? 'border-[#ECE8E1] bg-[#141D28]'
                              : 'border-[#17E5B8]/80 bg-[#121B25]'
                          }`}
                        >
                          {/* Full-Bleed Card Artwork + Atmospheric Scrim */}
                          <img
                            src={artUrl}
                            alt={member.agent.name}
                            className="absolute inset-0 h-full w-full object-cover object-center opacity-60 transition duration-300 group-hover:scale-105 group-hover:opacity-75"
                          />
                          <div
                            className="absolute inset-0"
                            style={{
                              background:
                                'linear-gradient(180deg, rgba(11,17,24,0.35) 0%, rgba(14,22,31,0.58) 52%, rgba(9,14,21,0.96) 82%)',
                            }}
                          />

                          {/* Centered Geometric Agent V-Emblem */}
                          <div className="relative z-10 flex flex-1 items-center justify-center pt-4">
                            <AgentEmblemMark
                              agentId={member.agent.id}
                              accentColor="#FF4655"
                              className="h-14 w-14 sm:h-16 sm:w-16 drop-shadow-[0_6px_18px_rgba(255,70,85,0.45)] transition-transform duration-200 group-hover:scale-105"
                            />
                          </div>

                          {/* Lower Player Nameplate */}
                          <div className="relative z-10 w-full pb-2 text-center px-2">
                            <div className="bg-[#0B121A]/90 border-y border-[#ECE8E1]/15 py-1 px-1.5">
                              <div className="font-display text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#ECE8E1] truncate">
                                {member.name}
                              </div>
                              <div
                                className="font-mono text-[8px] sm:text-[9px] font-bold uppercase tracking-widest truncate"
                                style={{ color: member.agent.primaryColor }}
                              >
                                {member.subLabel}
                              </div>
                            </div>
                          </div>

                          {/* Pointed Chevron Footer Band (Gold for Leader, Teal for Ready Teammates) */}
                          <div
                            className={`relative z-10 flex h-12 sm:h-14 w-full items-start justify-center pt-1.5 clip-pennant-chevron ${
                              member.isLeader
                                ? 'bg-gradient-to-b from-[#D99B26] to-[#8C5E12] text-[#0B0F14]'
                                : 'bg-gradient-to-b from-[#17E5B8] to-[#0B8A70] text-[#061310]'
                            }`}
                          >
                            <span className="font-mono text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em]">
                              {member.readyLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  /* Empty Sleek Obsidian Chevron Slot */
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (queueMode === 'CUSTOM') {
                          setShowSocialDrawer(true);
                        } else {
                          handleAddBotSlot();
                        }
                      }}
                      className={`group relative flex w-[114px] sm:w-[126px] lg:w-[138px] xl:w-[152px] shrink-0 flex-col items-center cursor-pointer transition-transform duration-200 hover:-translate-y-1 ${slotLayout.orderClass} ${slotLayout.heightClass}`}
                    >
                      <div className="relative z-20 -mb-2.5 flex h-6 w-6 items-center justify-center border border-[#ECE8E1]/20 bg-[#0E1620] text-[#8B978F] group-hover:border-[#17E5B8] group-hover:text-[#17E5B8] transition">
                        <span className="font-mono text-[9px]">+</span>
                      </div>

                      <div className="relative flex w-full flex-1 flex-col items-center justify-center clip-pennant border-t border-[#ECE8E1]/18 bg-[#0C141E]/75 backdrop-blur-sm group-hover:bg-[#13202E]/88 group-hover:border-[#17E5B8]/60 transition">
                        {/* Hairline Inner Frame */}
                        <div className="pointer-events-none absolute inset-2 clip-pennant border border-[#ECE8E1]/10 group-hover:border-[#17E5B8]/25 transition" />

                        <div className="flex h-10 w-10 items-center justify-center border border-[#ECE8E1]/20 bg-[#0A1017]/90 text-[#8B978F] group-hover:border-[#17E5B8] group-hover:text-[#17E5B8] transition">
                          <Plus className="h-4 w-4" />
                        </div>
                        <span className="mt-3 font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em] text-[#8B978F] group-hover:text-[#ECE8E1] transition">
                          {queueMode === 'CUSTOM' ? 'INVITE PLAYER' : 'ADD AI ALLY'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom-Center Dominant Crimson CTA */}
            <div
              ref={startSectionRef}
              className="mt-2 sm:mt-4 flex items-center justify-center w-full max-w-sm px-2 pb-2"
            >
              <button
                type="button"
                data-start="true"
                onClick={() => handleStart()}
                className="w-full whitespace-nowrap bg-[#FF4655] px-8 py-3 font-display text-xl sm:text-2xl font-extrabold uppercase tracking-[0.2em] text-[#ECE8E1] shadow-[0_12px_32px_rgba(255,70,85,0.4)] hover:bg-[#ff5b69] active:scale-[0.98] transition cursor-pointer text-center clip-val-btn"
              >
                {queueMode === 'CUSTOM'
                  ? activeRoom
                    ? activeRoom.hostUsername === multiplayerClient.username
                      ? `LAUNCH ROOM ${activeRoom.code}`
                      : `ROOM ${activeRoom.code}`
                    : 'PLAY MULTIPLAYER'
                  : 'FIND MATCH'}
              </button>
            </div>
          </main>

          {/* RIGHT DOCK: FEATURED CARDS & STANDING (Matches Reference #3 Right Column) */}
          <aside className="hidden lg:flex w-56 xl:w-64 shrink-0 flex-col justify-between gap-3">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#ECE8E1]/15 pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#8B978F]">
                <span>FEATURED</span>
                <span className="text-[#ECE8E1]/50">ARSENAL &amp; MAP</span>
              </div>

              {/* Card 1: Armory Spotlight */}
              <button
                type="button"
                onClick={() => setActiveTab('ARMORY')}
                className="group relative block w-full overflow-hidden border border-[#ECE8E1]/15 bg-[#0D151F] text-left hover:border-[#FF4655]/80 transition cursor-pointer"
              >
                <div className="relative h-28 w-full overflow-hidden">
                  <img
                    src={ARMORY_SPOTLIGHT_ART}
                    alt="Hollow Armory Spotlight"
                    className="h-full w-full object-cover object-center opacity-85 transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0D151F] via-[#0D151F]/35 to-transparent" />
                </div>
                <div className="px-3 py-2">
                  <div className="font-display text-sm font-extrabold uppercase tracking-wider text-[#ECE8E1] group-hover:text-[#FF4655] transition">
                    HOLLOW ARSENAL
                  </div>
                  <div className="font-mono text-[9px] text-[#8B978F] uppercase tracking-wider mt-0.5">
                    18 WEAPONS · REAPER · ORACLE · BLADE
                  </div>
                </div>
              </button>

              {/* Card 2: Arena Brief */}
              <button
                type="button"
                onClick={() => setShowSocialDrawer(true)}
                className="group relative block w-full overflow-hidden border border-[#ECE8E1]/15 bg-[#0D151F] text-left hover:border-[#17E5B8]/80 transition cursor-pointer"
              >
                <div className="relative h-24 w-full overflow-hidden">
                  <img
                    src={COURTYARD_MAP_ART}
                    alt="Courtyard 5v5 Arena"
                    className="h-full w-full object-cover object-center opacity-75 transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0D151F] via-[#0D151F]/35 to-transparent" />
                </div>
                <div className="px-3 py-2">
                  <div className="font-display text-sm font-extrabold uppercase tracking-wider text-[#ECE8E1] group-hover:text-[#17E5B8] transition">
                    COURTYARD 5V5
                  </div>
                  <div className="font-mono text-[9px] text-[#8B978F] uppercase tracking-wider mt-0.5">
                    A &amp; B SITES · REAL-TIME ROOMS
                  </div>
                </div>
              </button>

              {/* Card 3: Real Operative Standing & Quick Binds */}
              <div className="border border-[#ECE8E1]/15 bg-[#0C131B]/90 p-3 font-mono">
                <div className="flex items-center justify-between border-b border-[#ECE8E1]/10 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8B978F]">
                  <span>STANDING</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('CAREER')}
                    className="text-[#FF4655] hover:underline cursor-pointer"
                  >
                    CAREER &gt;
                  </button>
                </div>

                {profile.totalMatches === 0 ? (
                  <p className="mt-2 text-[10px] leading-relaxed text-[#8B978F]">
                    Play a match to track win rate, K/D, and weapon accuracy.
                  </p>
                ) : (
                  <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                    <div>
                      <div className="text-[9px] text-[#8B978F]">RANK</div>
                      <div className="text-[11px] font-bold text-[#17E5B8] truncate">{rank.tier}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#8B978F]">WIN %</div>
                      <div className="text-[11px] font-bold text-[#ECE8E1] tabular-nums">{winRate}%</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#8B978F]">K / D</div>
                      <div className="text-[11px] font-bold text-[#ECE8E1] tabular-nums">{kdRatio}</div>
                    </div>
                  </div>
                )}

                <div className="mt-2.5 border-t border-[#ECE8E1]/10 pt-2 text-[9px] text-[#8B978F] space-y-1">
                  <div className="flex justify-between">
                    <span>Move / Jump</span>
                    <span className="text-[#ECE8E1]">
                      {formatKeyCode(settings.keyBindings.moveForward)}
                      {formatKeyCode(settings.keyBindings.moveLeft)}
                      {formatKeyCode(settings.keyBindings.moveBackward)}
                      {formatKeyCode(settings.keyBindings.moveRight)} / {formatKeyCode(settings.keyBindings.jump)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Armory / Map</span>
                    <span className="text-[#ECE8E1]">
                      {formatKeyCode(settings.keyBindings.buyMenu)} / {formatKeyCode(settings.keyBindings.tacticalMap)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
