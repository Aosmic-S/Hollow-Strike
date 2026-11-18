/**
 * Hollow Strike - Main Tactical Lobby Shell
 * Dedicated full-screen pages for Play, Agents, Armory, Career, Profile, and Settings.
 * Zero simulated demo data: displays authentic persistent PlayerProfile metrics and custom 5v5 AI squad setup.
 */

import React, { useRef, useState } from 'react';
import {
  AGENT_REGISTRY,
  AgentDef,
  BotDifficulty,
  GameSettings,
  MatchMode,
  PlayerProfile,
} from '../game/types';
import { formatKeyCode } from '../game/rules';
import { computeRankProgress } from '../game/profileStore';
import { PWAInstallButton } from './PWAInstallButton';
import { SettingsPanel } from './SettingsPanel';
import { AgentsPage } from './lobby/AgentsPage';
import { ArmoryPage } from './lobby/ArmoryPage';
import { CareerPage } from './lobby/CareerPage';
import { ProfilePage } from './lobby/ProfilePage';
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
  onStartGame: (mode: MatchMode) => void;
}

const DEFAULT_BOT_AGENTS = ['BLITZ', 'BASTION', 'LUMEN', 'ZEPHYR'];

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

  const [queueMode, setQueueMode] = useState<MatchMode>('COMPETITIVE');
  const [activeTab, setActiveTab] = useState<LobbyTab>('PLAY');
  const [botAgentIds, setBotAgentIds] = useState<string[]>(DEFAULT_BOT_AGENTS);
  const playScrollRef = useRef<HTMLDivElement | null>(null);
  const startSectionRef = useRef<HTMLDivElement | null>(null);

  const scrollToStartMatch = () => {
    if (startSectionRef.current) {
      startSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (playScrollRef.current) {
      playScrollRef.current.scrollTo({ top: playScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const handleStart = async (overrideMode?: MatchMode) => {
    soundEngine.init();
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
      if (screen.orientation && 'lock' in screen.orientation) {
        await (screen.orientation as unknown as { lock: (mode: string) => Promise<void> }).lock('landscape').catch(() => {});
      }
    } catch {
      // Ignored if unsupported (e.g. iOS Safari)
    }
    onStartGame(overrideMode ?? queueMode);
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

  const squadMembers = [
    {
      name: profile.callsign || 'Operative',
      agent: currentAgent,
      isLeader: true,
      subLabel: `${rank.tier} · LVL ${rank.level}`,
      botIndex: -1,
    },
    ...botAgentIds.map((agId, idx) => {
      const ag: AgentDef = AGENT_REGISTRY[agId] || AGENT_REGISTRY.ZEPHYR;
      return {
        name: `Ally ${ag.name}`,
        agent: ag,
        isLeader: false,
        subLabel: `${difficulty} AI · TAP TO SWAP`,
        botIndex: idx,
      };
    }),
  ];

  const winRate =
    profile.totalMatches > 0 ? Math.round((profile.wins / profile.totalMatches) * 100) : 0;
  const kdRatio =
    profile.deaths > 0 ? (profile.kills / profile.deaths).toFixed(2) : profile.kills.toFixed(2);

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[#060913] text-slate-100 select-none font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/60 via-[#060913] to-[#03050a] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b12_1px,transparent_1px),linear-gradient(to_bottom,#1e293b12_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* TOP NAVIGATION BAR */}
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-3 sm:px-6 backdrop-blur-md">
        <div
          onClick={() => setActiveTab('PLAY')}
          className="flex items-center gap-2.5 cursor-pointer shrink-0"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-950/40 shadow-inner">
            <svg className="h-5 w-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="hidden md:inline font-mono text-sm font-black tracking-widest text-white uppercase">
            HOLLOW <span className="text-cyan-400">STRIKE</span>
          </span>
        </div>

        <nav className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar">
          {(['PLAY', 'AGENTS', 'ARMORY', 'CAREER', 'PROFILE', 'SETTINGS'] as LobbyTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 sm:px-4 py-1.5 font-mono text-[11px] sm:text-xs font-black uppercase tracking-wider transition cursor-pointer whitespace-nowrap rounded-t-lg ${
                activeTab === tab
                  ? 'border-b-2 border-cyan-400 bg-cyan-950/30 text-cyan-300'
                  : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
          <PWAInstallButton />

          <button
            onClick={() => setActiveTab('PROFILE')}
            className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 hover:border-cyan-500/60 transition cursor-pointer"
            title="View Profile"
          >
            <span className="text-cyan-400 font-black">LVL {rank.level}</span>
            <span className="text-slate-200 font-bold max-w-[100px] truncate">{profile.callsign}</span>
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
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-mono text-lg font-black uppercase tracking-wider text-white">
                  System & Combat Settings
                </h2>
                <p className="font-mono text-xs text-slate-400">
                  Configure sensitivities, reticle appearance, graphics scaling, and mobile controls.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('PLAY')}
                className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-1.5 font-mono text-xs font-bold uppercase text-slate-200 hover:border-cyan-400 cursor-pointer"
              >
                Back to Play
              </button>
            </div>
            <SettingsPanel settings={settings} onUpdateSettings={onUpdateSettings} />
          </div>
        </div>
      ) : (
        /* PLAY LOBBY STAGE - scrollable vertically on mobile/compact screens so Start Match is always reachable */
        <div
          ref={playScrollRef}
          data-testid="lobby-play-scroll"
          className="relative z-10 flex flex-1 flex-col md:flex-row overflow-y-auto overscroll-contain px-3 sm:px-6 py-3 gap-4 sm:gap-6"
        >
          {/* Mobile / Compact Quick-Scroll Action Banner */}
          <div className="flex lg:hidden items-center justify-between gap-2 rounded-xl border border-rose-500/40 bg-slate-950/90 px-3 py-2 shrink-0 md:hidden">
            <span className="font-mono text-[11px] font-bold uppercase text-slate-300 truncate">
              {queueMode} · {currentAgent.name}
            </span>
            <button
              type="button"
              data-testid="scroll-to-start-btn"
              onClick={scrollToStartMatch}
              className="shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 font-mono text-[11px] font-black uppercase tracking-wider text-white shadow hover:bg-rose-500 active:scale-95 transition cursor-pointer"
            >
              ↓ Start Match
            </button>
          </div>

          {/* LEFT PANEL: Queue & Difficulty */}
          <div className="flex w-full md:w-56 lg:w-64 shrink-0 flex-col justify-between md:border-r md:border-slate-800/60 md:pr-4">
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                  TACTICAL QUEUE
                </span>
                <div className="mt-1.5 space-y-1.5">
                  {[
                    { id: 'COMPETITIVE' as MatchMode, label: 'PLANT / DEFUSE 5V5', desc: 'First to 13 rounds · Halftime swap' },
                    { id: 'SKIRMISH' as MatchMode, label: 'SKIRMISH 5V5', desc: '8s buy phase · $2,900 start credits' },
                    { id: 'PRACTICE' as MatchMode, label: 'PRACTICE RANGE', desc: 'Instant combat · Respawning bots' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setQueueMode(mode.id)}
                      className={`w-full rounded-xl border p-2.5 text-left transition cursor-pointer ${
                        queueMode === mode.id
                          ? 'border-cyan-400/80 bg-cyan-950/40 text-white'
                          : 'border-slate-800/80 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      <div className="font-mono text-xs font-black uppercase text-cyan-300">{mode.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                  BOT AI DIFFICULTY
                </span>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5 font-mono text-xs">
                  {(['EASY', 'MEDIUM', 'HARD'] as BotDifficulty[]).map((diff) => (
                    <button
                      key={diff}
                      onClick={() => onSelectDifficulty(diff)}
                      className={`rounded-lg border py-1.5 font-bold uppercase transition cursor-pointer ${
                        difficulty === diff
                          ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300'
                          : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 mt-3">
              <div className="text-[10px] font-mono font-bold uppercase text-slate-400">EQUIPPED AGENT</div>
              <div className="mt-0.5 flex items-center justify-between">
                <span className="font-mono text-sm font-black text-white">{currentAgent.name}</span>
                <button
                  onClick={() => setActiveTab('AGENTS')}
                  className="font-mono text-[10px] font-bold text-cyan-400 uppercase hover:underline cursor-pointer"
                >
                  ROSTER
                </button>
              </div>
              <div className="mt-0.5 text-[11px] font-mono uppercase" style={{ color: currentAgent.primaryColor }}>
                {currentAgent.role}
              </div>
            </div>
          </div>

          {/* CENTER STAGE: 5-Slot Tactical Squad */}
          <div className="flex flex-1 flex-col items-center justify-between gap-3 px-1 sm:px-2 min-w-0 pb-4">
            <div className="hidden md:flex lg:hidden w-full items-center justify-between rounded-xl border border-rose-500/40 bg-slate-950/90 px-3 py-1.5">
              <span className="font-mono text-[10px] font-bold uppercase text-slate-300">
                5V5 TACTICAL SQUAD · SCROLL DOWN FOR MATCH LAUNCH
              </span>
              <button
                type="button"
                data-testid="scroll-to-start-landscape-btn"
                onClick={scrollToStartMatch}
                className="shrink-0 rounded-lg bg-rose-600 px-3 py-1 font-mono text-[11px] font-black uppercase tracking-wider text-white shadow hover:bg-rose-500 active:scale-95 transition cursor-pointer"
              >
                ↓ Scroll To Start
              </button>
            </div>

            <div className="my-auto flex items-center justify-start md:justify-center gap-2.5 sm:gap-3.5 w-full max-w-4xl overflow-x-auto pb-1">
              {[0, 1, 2, 3, 4].map((idx) => {
                const member = squadMembers[idx];

                if (member) {
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (member.isLeader) {
                          setActiveTab('AGENTS');
                        } else {
                          handleCycleBotAgent(member.botIndex);
                        }
                      }}
                      className="relative flex h-56 sm:h-64 lg:h-72 w-32 sm:w-40 lg:w-44 shrink-0 flex-col justify-between rounded-2xl border p-3.5 shadow-2xl transition hover:brightness-110 cursor-pointer"
                      style={{
                        borderColor: `${member.agent.primaryColor}66`,
                        background: `linear-gradient(to bottom, ${member.agent.primaryColor}16, #090d18 82%)`,
                      }}
                    >
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="font-bold text-slate-300 uppercase">
                          {member.isLeader ? `LVL ${rank.level}` : 'AI ALLY'}
                        </span>
                        {member.isLeader ? (
                          <span className="text-amber-400 font-bold">LEADER</span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveBot(member.botIndex);
                            }}
                            className="text-slate-500 hover:text-rose-400 font-bold cursor-pointer"
                            title="Remove Bot"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="my-auto flex flex-col items-center text-center">
                        <div
                          className="flex h-14 w-14 sm:h-18 sm:w-18 items-center justify-center rounded-2xl border font-mono text-2xl sm:text-3xl font-black"
                          style={{
                            borderColor: member.agent.primaryColor,
                            backgroundColor: `${member.agent.primaryColor}20`,
                            color: member.agent.primaryColor,
                          }}
                        >
                          {member.agent.name[0]}
                        </div>
                        <span className="mt-2.5 font-mono text-xs sm:text-sm font-black text-white tracking-wide truncate max-w-full">
                          {member.name}
                        </span>
                        <span
                          className="font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-0.5"
                          style={{ color: member.agent.primaryColor }}
                        >
                          {member.agent.name} · {member.agent.role}
                        </span>
                      </div>

                      <div className="border-t border-slate-800/80 pt-2 text-center font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        {member.subLabel}
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={idx}
                    onClick={handleAddBotSlot}
                    className="flex h-56 sm:h-64 lg:h-72 w-32 sm:w-40 lg:w-44 shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-4 transition hover:border-cyan-500/50 hover:bg-slate-900/40 cursor-pointer group"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-slate-500 group-hover:border-cyan-500 group-hover:text-cyan-400 transition">
                      +
                    </div>
                    <span className="mt-3 font-mono text-xs font-bold uppercase text-slate-500 group-hover:text-slate-300 transition">
                      ADD AI ALLY
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bottom Action Bar */}
            <div
              ref={startSectionRef}
              className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-4 w-full max-w-xl justify-center pb-2"
            >
              <button
                onClick={() => handleStart('PRACTICE')}
                className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 sm:px-5 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-200 hover:bg-slate-700 hover:text-white transition cursor-pointer"
              >
                PRACTICE
              </button>

              <button
                data-start="true"
                onClick={() => handleStart()}
                className="flex-1 rounded-2xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-600 px-8 py-3.5 font-mono text-base sm:text-lg font-black uppercase tracking-widest text-white shadow-2xl shadow-rose-600/35 hover:from-rose-500 hover:to-red-500 active:scale-95 transition cursor-pointer text-center border border-rose-400/30"
              >
                START MATCH
              </button>

              {botAgentIds.length < 4 ? (
                <button
                  onClick={() => setBotAgentIds(DEFAULT_BOT_AGENTS)}
                  className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 sm:px-5 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-cyan-300 hover:border-cyan-500/60 transition cursor-pointer"
                >
                  FILL 5V5
                </button>
              ) : (
                <button
                  onClick={() => setBotAgentIds([])}
                  className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 sm:px-5 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition cursor-pointer"
                >
                  SOLO TEST
                </button>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: Real Combat Standing & Keybinds */}
          <div className="hidden lg:flex w-56 shrink-0 flex-col justify-between border-l border-slate-800/60 pl-4 font-mono">
            <div className="space-y-4">
              <div>
                <div className="border-b border-slate-800/80 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  OPERATIVE STANDING
                </div>
                {profile.totalMatches === 0 ? (
                  <p className="mt-2.5 text-[11px] text-slate-500 leading-relaxed">
                    No matches completed yet. Play a match to track K/D ratio, win percentage, and weapon accuracy.
                  </p>
                ) : (
                  <div className="mt-2.5 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">RANK</span>
                      <span className="font-black text-cyan-300">{rank.tier}</span>
                    </div>
                    <div className="flex justify-between tabular-nums">
                      <span className="text-slate-400">MATCHES</span>
                      <span className="font-bold text-white">{profile.totalMatches}</span>
                    </div>
                    <div className="flex justify-between tabular-nums">
                      <span className="text-slate-400">WIN RATE</span>
                      <span className="font-bold text-emerald-400">{winRate}%</span>
                    </div>
                    <div className="flex justify-between tabular-nums">
                      <span className="text-slate-400">K / D</span>
                      <span className="font-bold text-white">{kdRatio}</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="border-b border-slate-800/80 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  COMBAT CONTROLS
                </div>
                <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Move / Jump</span>
                    <span className="text-slate-200">
                      {formatKeyCode(settings.keyBindings.moveForward)}
                      {formatKeyCode(settings.keyBindings.moveLeft)}
                      {formatKeyCode(settings.keyBindings.moveBackward)}
                      {formatKeyCode(settings.keyBindings.moveRight)} / {formatKeyCode(settings.keyBindings.jump)}
                    </span>
                  </div>
                  <div className="flex justify-between"><span>Fire / ADS</span><span className="text-slate-200">LMB / RMB</span></div>
                  <div className="flex justify-between">
                    <span>Weapons</span>
                    <span className="text-slate-200">
                      {formatKeyCode(settings.keyBindings.primaryWeapon)} / {formatKeyCode(settings.keyBindings.sidearmWeapon)} · {formatKeyCode(settings.keyBindings.reload)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Abilities</span>
                    <span className="text-slate-200">
                      {formatKeyCode(settings.keyBindings.abilityQ)} {formatKeyCode(settings.keyBindings.abilityE)} {formatKeyCode(settings.keyBindings.abilityC)} {formatKeyCode(settings.keyBindings.abilityX)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Armory / Map</span>
                    <span className="text-slate-200">
                      {formatKeyCode(settings.keyBindings.buyMenu)} / {formatKeyCode(settings.keyBindings.tacticalMap)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Plant / Defuse</span>
                    <span className="text-slate-200">Hold {formatKeyCode(settings.keyBindings.plantDefuse)}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('CAREER')}
              className="rounded-xl border border-slate-800 bg-slate-900/60 py-2 text-[11px] font-bold uppercase text-cyan-300 hover:border-cyan-500/60 transition cursor-pointer"
            >
              View Full Career
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
