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
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[#0F1923] text-[#ECE8E1] select-none">
      {/* Subtle Valorant atmospheric wash + architectural coordinate grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(255,70,85,0.12),_transparent_52%),radial-gradient(ellipse_at_bottom_right,_rgba(23,229,184,0.08),_transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 val-grid-bg pointer-events-none" />

      {/* TOP NAVIGATION BAR */}
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-[#ECE8E1]/15 bg-[#0F1923]/95 px-3 sm:px-6 backdrop-blur-md">
        <div
          onClick={() => setActiveTab('PLAY')}
          className="flex items-center gap-2.5 cursor-pointer shrink-0 group"
        >
          <div className="flex h-9 w-9 items-center justify-center border border-[#FF4655]/50 bg-[#0F1923] overflow-hidden shadow-md clip-val-card group-hover:border-[#FF4655] transition">
            <img
              src="/assets/aistudio/592741050_1795088378575204_98fcd619.jpg"
              alt="Hollow Strike"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="hidden md:flex flex-col leading-none">
            <span className="font-display text-lg font-extrabold tracking-widest text-[#ECE8E1] uppercase">
              HOLLOW <span className="text-[#FF4655]">STRIKE</span>
            </span>
            <span className="font-mono text-[9px] tracking-[0.22em] text-[#8B978F] uppercase">
              TACTICAL 5V5
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-0.5 sm:gap-1.5 overflow-x-auto no-scrollbar">
          {(['PLAY', 'AGENTS', 'ARMORY', 'CAREER', 'PROFILE', 'SETTINGS'] as LobbyTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-2.5 sm:px-4 py-2 font-display text-xs sm:text-sm font-bold uppercase tracking-[0.14em] transition cursor-pointer whitespace-nowrap ${
                activeTab === tab
                  ? 'border-b-2 border-[#FF4655] bg-[#18232E] text-[#ECE8E1]'
                  : 'text-[#8B978F] hover:bg-[#18232E]/60 hover:text-[#ECE8E1]'
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
            className="hidden sm:flex items-center gap-2 border border-[#ECE8E1]/15 bg-[#18232E] px-3 py-1.5 hover:border-[#17E5B8] transition cursor-pointer clip-val-card"
            title="View Profile"
          >
            <span className="text-[#17E5B8] font-bold">LVL {rank.level}</span>
            <span className="text-[#ECE8E1] font-bold max-w-[100px] truncate">{profile.callsign}</span>
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
        /* PLAY LOBBY STAGE */
        <div
          ref={playScrollRef}
          data-testid="lobby-play-scroll"
          className="relative z-10 flex flex-1 flex-col md:flex-row overflow-y-auto overscroll-contain px-3 sm:px-6 py-3 gap-4 sm:gap-6"
        >
          {/* Mobile / Compact Quick-Scroll Action Banner */}
          <div className="flex lg:hidden items-center justify-between gap-2 border border-[#FF4655]/50 bg-[#18232E] px-3 py-2 shrink-0 md:hidden clip-val-card">
            <span className="font-mono text-[11px] font-bold uppercase text-[#ECE8E1] truncate">
              {queueMode} · {currentAgent.name}
            </span>
            <button
              type="button"
              data-testid="scroll-to-start-btn"
              onClick={scrollToStartMatch}
              className="shrink-0 bg-[#FF4655] px-3 py-1.5 font-display text-xs font-extrabold uppercase tracking-wider text-white hover:bg-[#ff5e6b] active:scale-95 transition cursor-pointer clip-val-btn"
            >
              ↓ Start Match
            </button>
          </div>

          {/* LEFT PANEL: Queue & Difficulty */}
          <div className="flex w-full md:w-52 lg:w-60 shrink-0 flex-col justify-between md:border-r md:border-[#ECE8E1]/15 md:pr-4">
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#8B978F]">
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
                      className={`w-full border-l-2 p-2.5 text-left transition cursor-pointer clip-val-card ${
                        queueMode === mode.id
                          ? 'border-l-[#FF4655] border border-[#FF4655]/45 bg-[#18232E] text-[#ECE8E1]'
                          : 'border-l-transparent border border-[#ECE8E1]/10 bg-[#18232E]/50 text-[#8B978F] hover:border-[#ECE8E1]/25 hover:text-[#ECE8E1]'
                      }`}
                    >
                      <div className={`font-display text-sm font-bold uppercase tracking-wider ${queueMode === mode.id ? 'text-[#ECE8E1]' : 'text-[#ECE8E1]/85'}`}>
                        {mode.label}
                      </div>
                      <div className="text-[10px] text-[#8B978F] mt-0.5 leading-tight">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#8B978F]">
                  BOT AI DIFFICULTY
                </span>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5 font-mono text-xs">
                  {(['EASY', 'MEDIUM', 'HARD'] as BotDifficulty[]).map((diff) => (
                    <button
                      key={diff}
                      onClick={() => onSelectDifficulty(diff)}
                      className={`border py-1.5 font-bold uppercase transition cursor-pointer clip-val-card ${
                        difficulty === diff
                          ? 'border-[#17E5B8] bg-[#17E5B8]/15 text-[#17E5B8]'
                          : 'border-[#ECE8E1]/15 bg-[#18232E]/60 text-[#8B978F] hover:border-[#ECE8E1]/35 hover:text-[#ECE8E1]'
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border border-[#ECE8E1]/15 bg-[#18232E] p-3 mt-3 clip-val-card">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#8B978F]">
                EQUIPPED AGENT
              </div>
              <div className="mt-0.5 flex items-center justify-between">
                <span className="font-display text-lg font-extrabold uppercase tracking-wide text-[#ECE8E1]">
                  {currentAgent.name}
                </span>
                <button
                  onClick={() => setActiveTab('AGENTS')}
                  className="font-mono text-[10px] font-bold text-[#FF4655] uppercase hover:underline cursor-pointer"
                >
                  ROSTER
                </button>
              </div>
              <div className="mt-0.5 text-[11px] font-mono font-bold uppercase" style={{ color: currentAgent.primaryColor }}>
                {currentAgent.role}
              </div>
            </div>
          </div>

          {/* CENTER STAGE: 5-Slot Tactical Squad */}
          <div className="flex flex-1 flex-col items-center justify-between gap-3 px-1 sm:px-2 min-w-0 pb-4">
            <div className="hidden md:flex lg:hidden w-full items-center justify-between border border-[#FF4655]/45 bg-[#18232E] px-3 py-1.5 clip-val-card">
              <span className="font-mono text-[10px] font-bold uppercase text-[#ECE8E1]">
                5V5 TACTICAL SQUAD · SCROLL DOWN FOR MATCH LAUNCH
              </span>
              <button
                type="button"
                data-testid="scroll-to-start-landscape-btn"
                onClick={scrollToStartMatch}
                className="shrink-0 bg-[#FF4655] px-3 py-1 font-display text-xs font-bold uppercase tracking-wider text-white hover:bg-[#ff5e6b] active:scale-95 transition cursor-pointer clip-val-btn"
              >
                ↓ Scroll To Start
              </button>
            </div>

            <div
              data-testid="lobby-squad-scroll"
              className="my-auto w-full max-w-4xl overflow-x-auto pb-1"
            >
              <div className="mx-auto flex w-max items-center gap-2.5 sm:gap-3 px-1">
                {[0, 1, 2, 3, 4].map((idx) => {
                  const member = squadMembers[idx];

                  if (member) {
                    return (
                      <div
                        key={idx}
                        data-testid={`squad-card-${idx}`}
                        onClick={() => {
                          if (member.isLeader) {
                            setActiveTab('AGENTS');
                          } else {
                            handleCycleBotAgent(member.botIndex);
                          }
                        }}
                        className="relative flex h-52 sm:h-60 lg:h-68 w-28 sm:w-32 lg:w-36 xl:w-42 shrink-0 flex-col justify-between border p-3 shadow-2xl transition hover:brightness-110 cursor-pointer clip-val-panel"
                        style={{
                          borderColor: member.isLeader ? '#FF4655' : `${member.agent.primaryColor}66`,
                          background: `linear-gradient(to bottom, ${member.agent.primaryColor}1c, #18232E 68%, #0F1923 100%)`,
                        }}
                      >
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <span className="font-bold text-[#ECE8E1]/90 uppercase">
                            {member.isLeader ? `LVL ${rank.level}` : 'AI ALLY'}
                          </span>
                          {member.isLeader ? (
                            <span className="text-[#FF4655] font-bold">LEADER</span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveBot(member.botIndex);
                              }}
                              className="text-[#8B978F] hover:text-[#FF4655] font-bold cursor-pointer"
                              title="Remove Bot"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        <div className="my-auto flex flex-col items-center text-center">
                          <div
                            className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center border font-display text-2xl sm:text-3xl font-extrabold clip-val-card"
                            style={{
                              borderColor: member.agent.primaryColor,
                              backgroundColor: `${member.agent.primaryColor}20`,
                              color: member.agent.primaryColor,
                            }}
                          >
                            {member.agent.name[0]}
                          </div>
                          <span className="mt-2 font-display text-sm sm:text-base font-extrabold uppercase tracking-wide text-[#ECE8E1] truncate max-w-full">
                            {member.name}
                          </span>
                          <span
                            className="font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-0.5"
                            style={{ color: member.agent.primaryColor }}
                          >
                            {member.agent.name} · {member.agent.role}
                          </span>
                        </div>

                        <div className="border-t border-[#ECE8E1]/15 pt-2 text-center font-mono text-[9px] font-bold uppercase tracking-wider text-[#8B978F]">
                          {member.subLabel}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={idx}
                      onClick={handleAddBotSlot}
                      className="flex h-52 sm:h-60 lg:h-68 w-28 sm:w-32 lg:w-36 xl:w-42 shrink-0 flex-col items-center justify-center border border-dashed border-[#ECE8E1]/20 bg-[#18232E]/45 p-3 transition hover:border-[#17E5B8] hover:bg-[#18232E] cursor-pointer group clip-val-panel"
                    >
                      <div className="flex h-10 w-10 items-center justify-center border border-[#ECE8E1]/25 bg-[#0F1923] text-[#8B978F] group-hover:border-[#17E5B8] group-hover:text-[#17E5B8] transition">
                        +
                      </div>
                      <span className="mt-3 font-mono text-[11px] font-bold uppercase text-[#8B978F] group-hover:text-[#ECE8E1] transition">
                        ADD AI ALLY
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div
              ref={startSectionRef}
              className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-4 w-full max-w-xl justify-center pb-2"
            >
              <button
                onClick={() => handleStart('PRACTICE')}
                className="border border-[#ECE8E1]/25 bg-[#18232E] px-4 sm:px-5 py-3.5 font-display text-sm font-bold uppercase tracking-widest text-[#ECE8E1] hover:border-[#17E5B8] hover:text-[#17E5B8] transition cursor-pointer clip-val-card"
              >
                PRACTICE
              </button>

              <button
                data-start="true"
                onClick={() => handleStart()}
                className="flex-1 whitespace-nowrap bg-[#FF4655] px-6 sm:px-8 py-3 font-display text-xl sm:text-2xl font-extrabold uppercase tracking-[0.18em] text-[#ECE8E1] shadow-2xl shadow-[#FF4655]/30 hover:bg-[#ff5a68] active:scale-[0.98] transition cursor-pointer text-center clip-val-btn"
              >
                START MATCH
              </button>

              {botAgentIds.length < 4 ? (
                <button
                  onClick={() => setBotAgentIds(DEFAULT_BOT_AGENTS)}
                  className="border border-[#17E5B8]/50 bg-[#18232E] px-4 sm:px-5 py-3.5 font-display text-sm font-bold uppercase tracking-widest text-[#17E5B8] hover:bg-[#17E5B8]/15 transition cursor-pointer clip-val-card"
                >
                  FILL 5V5
                </button>
              ) : (
                <button
                  onClick={() => setBotAgentIds([])}
                  className="border border-[#ECE8E1]/20 bg-[#18232E] px-4 sm:px-5 py-3.5 font-display text-sm font-bold uppercase tracking-widest text-[#8B978F] hover:text-[#ECE8E1] hover:border-[#ECE8E1]/40 transition cursor-pointer clip-val-card"
                >
                  SOLO TEST
                </button>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: Real Combat Standing & Keybinds */}
          <div className="hidden lg:flex w-56 shrink-0 flex-col justify-between border-l border-[#ECE8E1]/15 pl-4 font-mono">
            <div className="space-y-4">
              <div>
                <div className="border-b border-[#ECE8E1]/15 pb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8B978F]">
                  OPERATIVE STANDING
                </div>
                {profile.totalMatches === 0 ? (
                  <p className="mt-2.5 text-[11px] text-[#8B978F] leading-relaxed">
                    No matches completed yet. Play a match to track K/D ratio, win percentage, and weapon accuracy.
                  </p>
                ) : (
                  <div className="mt-2.5 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#8B978F]">RANK</span>
                      <span className="font-bold text-[#17E5B8]">{rank.tier}</span>
                    </div>
                    <div className="flex justify-between tabular-nums">
                      <span className="text-[#8B978F]">MATCHES</span>
                      <span className="font-bold text-[#ECE8E1]">{profile.totalMatches}</span>
                    </div>
                    <div className="flex justify-between tabular-nums">
                      <span className="text-[#8B978F]">WIN RATE</span>
                      <span className="font-bold text-[#17E5B8]">{winRate}%</span>
                    </div>
                    <div className="flex justify-between tabular-nums">
                      <span className="text-[#8B978F]">K / D</span>
                      <span className="font-bold text-[#ECE8E1]">{kdRatio}</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="border-b border-[#ECE8E1]/15 pb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8B978F]">
                  COMBAT CONTROLS
                </div>
                <div className="mt-2 space-y-1 text-[11px] text-[#8B978F]">
                  <div className="flex justify-between">
                    <span>Move / Jump</span>
                    <span className="text-[#ECE8E1]">
                      {formatKeyCode(settings.keyBindings.moveForward)}
                      {formatKeyCode(settings.keyBindings.moveLeft)}
                      {formatKeyCode(settings.keyBindings.moveBackward)}
                      {formatKeyCode(settings.keyBindings.moveRight)} / {formatKeyCode(settings.keyBindings.jump)}
                    </span>
                  </div>
                  <div className="flex justify-between"><span>Fire / ADS</span><span className="text-[#ECE8E1]">LMB / RMB</span></div>
                  <div className="flex justify-between">
                    <span>Weapons / Inspect</span>
                    <span className="text-[#ECE8E1]">
                      {formatKeyCode(settings.keyBindings.primaryWeapon)} / {formatKeyCode(settings.keyBindings.sidearmWeapon)} · {formatKeyCode(settings.keyBindings.reload)} · {formatKeyCode(settings.keyBindings.inspectWeapon)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Abilities</span>
                    <span className="text-[#ECE8E1]">
                      {formatKeyCode(settings.keyBindings.abilityQ)} {formatKeyCode(settings.keyBindings.abilityE)} {formatKeyCode(settings.keyBindings.abilityC)} {formatKeyCode(settings.keyBindings.abilityX)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Armory / Map</span>
                    <span className="text-[#ECE8E1]">
                      {formatKeyCode(settings.keyBindings.buyMenu)} / {formatKeyCode(settings.keyBindings.tacticalMap)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Plant / Defuse</span>
                    <span className="text-[#ECE8E1]">Hold {formatKeyCode(settings.keyBindings.plantDefuse)}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('CAREER')}
              className="border border-[#ECE8E1]/20 bg-[#18232E] py-2 text-[11px] font-bold uppercase tracking-wider text-[#ECE8E1] hover:border-[#FF4655] hover:text-[#FF4655] transition cursor-pointer clip-val-card"
            >
              View Full Career
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
