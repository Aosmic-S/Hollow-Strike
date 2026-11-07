/**
 * Hollow Strike - Tactical Match Lobby
 * Widescreen tactical lobby with squad slots, queue modes, and agent selection.
 */

import React, { useState } from 'react';
import { AGENT_REGISTRY, AgentDef, BotDifficulty } from '../game/types';
import { PWAInstallButton } from './PWAInstallButton';
import { soundEngine } from '../game/audio';

interface LobbyScreenProps {
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
  difficulty: BotDifficulty;
  onSelectDifficulty: (diff: BotDifficulty) => void;
  onStartGame: () => void;
  onOpenSettings: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  selectedAgentId,
  onSelectAgent,
  difficulty,
  onSelectDifficulty,
  onStartGame,
  onOpenSettings,
}) => {
  const currentAgent = AGENT_REGISTRY[selectedAgentId] || AGENT_REGISTRY.ZEPHYR;

  // Queue Mode Selection
  const [queueMode, setQueueMode] = useState<string>('PLANT / DEFUSE 5V5');
  const [isPartyClosed, setIsPartyClosed] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'PLAY' | 'AGENTS' | 'ARMORY' | 'CAREER'>('PLAY');
  const [showAgentModal, setShowAgentModal] = useState<boolean>(false);

  // Party slots (Player + empty invite slots)
  const [partyMembers, setPartyMembers] = useState<Array<{ name: string; agent: AgentDef; ready: boolean; isLeader: boolean }>>([
    { name: 'OPERATOR', agent: currentAgent, ready: true, isLeader: true },
  ]);

  const handleStart = async () => {
    soundEngine.init();
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen denied or unsupported
    }

    try {
      if (screen.orientation && 'lock' in screen.orientation) {
        await (screen.orientation as unknown as { lock: (mode: string) => Promise<void> }).lock('landscape');
      }
    } catch {
      // Orientation lock unsupported
    }
    onStartGame();
  };

  const handleAddBotSlot = () => {
    if (partyMembers.length >= 5) return;
    const agentKeys = Object.keys(AGENT_REGISTRY);
    const nextAgent = AGENT_REGISTRY[agentKeys[partyMembers.length % agentKeys.length]];
    setPartyMembers([
      ...partyMembers,
      { name: `Bot ${nextAgent.name}`, agent: nextAgent, ready: true, isLeader: false },
    ]);
  };

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[#0a0f1d] text-slate-100 select-none font-sans">
      {/* Background Atmosphere Image / Gradient Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/90 via-[#070b15] to-[#04060b] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0f_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0f_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      {/* TOP NAVIGATION CONTRACT BAR */}
      <header className="relative z-20 flex h-14 items-center justify-between border-b border-slate-800/80 bg-slate-950/80 px-6 backdrop-blur-none">
        {/* Left Zone: BACK // PLAY Breadcrumb */}
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition cursor-pointer">
            <svg className="h-4 w-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span>BACK // PLAY</span>
          </button>
        </div>

        {/* Center Zone: Nav Icons & Active Tab Header */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1">
            {(['PLAY', 'AGENTS', 'ARMORY', 'CAREER'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === 'AGENTS') setShowAgentModal(true);
                }}
                className={`px-4 py-1.5 font-mono text-xs font-black uppercase tracking-widest transition cursor-pointer ${
                  activeTab === tab
                    ? 'border-b-2 border-cyan-400 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Right Zone: Party Status, Currencies, PWA Install & Settings */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <PWAInstallButton />

          <div className="flex items-center gap-3 border-l border-slate-800 pl-4 text-slate-300">
            <div className="flex items-center gap-1">
              <span className="text-amber-400">❖</span>
              <span className="font-bold tabular-nums">2,786</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-cyan-400">◈</span>
              <span className="font-bold tabular-nums">635</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-emerald-400">⬡</span>
              <span className="font-bold tabular-nums">4,214</span>
            </div>
          </div>

          <button
            onClick={onOpenSettings}
            aria-label="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900 text-slate-300 hover:border-cyan-500 hover:text-white transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* MAIN LOBBY STAGE */}
      <div className="relative z-10 flex flex-1 overflow-hidden px-8 py-4">
        {/* LEFT SIDEBAR: Queue Mode & Party Options */}
        <div className="flex w-64 flex-col justify-between border-r border-slate-800/60 pr-6">
          <div className="space-y-6">
            {/* Queue Selector Dropdown / Buttons */}
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                QUEUE // MODE
              </span>
              <div className="mt-2 space-y-1.5">
                {[
                  { id: 'PLANT / DEFUSE 5V5', label: 'PLANT / DEFUSE 5V5', desc: '13 Rounds · Competitive rules' },
                  { id: 'UNRATED', label: 'UNRATED 5V5', desc: 'Standard tactical match' },
                  { id: 'PRACTICE', label: 'PRACTICE RANGE', desc: 'Bot recoil shooting range' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setQueueMode(mode.id)}
                    className={`w-full rounded-lg border p-2.5 text-left transition cursor-pointer ${
                      queueMode === mode.id
                        ? 'border-cyan-400 bg-cyan-950/40 text-white shadow-lg shadow-cyan-500/10'
                        : 'border-slate-800/80 bg-slate-900/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-mono text-xs font-black uppercase text-cyan-300">{mode.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{mode.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Bot Difficulty Configuration */}
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                BOT AI DIFFICULTY
              </span>
              <div className="mt-2 grid grid-cols-3 gap-1.5 font-mono text-xs">
                {(['EASY', 'MEDIUM', 'HARD'] as BotDifficulty[]).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => onSelectDifficulty(diff)}
                    className={`rounded border py-1.5 font-bold uppercase transition cursor-pointer ${
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

            {/* Party Settings Toggles */}
            <div className="space-y-2 border-t border-slate-800/80 pt-4 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>PARTY CODE</span>
                <span className="text-cyan-400 font-bold">#HS-9204</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>PARTY CLOSED</span>
                <button
                  onClick={() => setIsPartyClosed(!isPartyClosed)}
                  className={`h-5 w-9 rounded-full p-0.5 transition cursor-pointer ${
                    isPartyClosed ? 'bg-cyan-500' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`h-4 w-4 rounded-full bg-white transition-transform ${
                      isPartyClosed ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Active Agent Brief Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="text-[10px] font-mono font-bold uppercase text-slate-400">ACTIVE AGENT</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-mono text-sm font-black text-white">{currentAgent.name}</span>
              <button
                onClick={() => setShowAgentModal(true)}
                className="font-mono text-[10px] font-bold text-cyan-400 uppercase hover:underline cursor-pointer"
              >
                CHANGE
              </button>
            </div>
            <div className="mt-1 text-[11px] text-slate-400 leading-tight">
              {currentAgent.role} · {currentAgent.abilities.length} Tactical Abilities
            </div>
          </div>
        </div>

        {/* CENTER STAGE: Event Banner & 5 Party Cards */}
        <div className="flex flex-1 flex-col items-center justify-between px-8">
          {/* Top Announcement Banner */}
          <div className="flex w-full max-w-2xl items-center justify-between rounded-lg border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-900/80 to-amber-950/40 px-6 py-2.5 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-amber-400 font-bold text-lg">⚡</span>
              <div>
                <div className="font-mono text-xs font-black uppercase text-amber-300">
                  JOIN THE CONFLICT // ALPHA VS OMEGA
                </div>
                <div className="text-[10px] text-slate-400">Season 2 Tactical Battlepass & Exclusive Agent Skins</div>
              </div>
            </div>
            <span className="rounded border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-amber-300">
              EVENT LIVE
            </span>
          </div>

          {/* 5 Party Cards Stage */}
          <div className="my-auto flex items-center justify-center gap-4 w-full max-w-4xl">
            {[0, 1, 2, 3, 4].map((idx) => {
              const member = partyMembers[idx];

              if (member) {
                return (
                  <div
                    key={idx}
                    className={`relative flex h-80 w-44 flex-col justify-between rounded-xl border p-4 shadow-2xl transition ${
                      member.isLeader
                        ? 'border-amber-400/80 bg-gradient-to-b from-amber-950/30 via-slate-900/90 to-slate-950 shadow-amber-500/10'
                        : 'border-cyan-500/50 bg-gradient-to-b from-cyan-950/20 via-slate-900/90 to-slate-950'
                    }`}
                  >
                    {/* Top Level / Leader Badge */}
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-300">
                        LVL 238
                      </span>
                      {member.isLeader && (
                        <span className="text-amber-400 text-xs" title="Party Leader">
                          ★
                        </span>
                      )}
                    </div>

                    {/* Agent Graphic / Banner Icon */}
                    <div className="my-auto flex flex-col items-center text-center">
                      <div
                        className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-700 shadow-inner"
                        style={{ backgroundColor: `${member.agent.primaryColor}22` }}
                      >
                        <span className="font-mono text-2xl font-black" style={{ color: member.agent.primaryColor }}>
                          {member.agent.name[0]}
                        </span>
                      </div>
                      <span className="mt-3 font-mono text-sm font-black text-white">{member.name}</span>
                      <span className="font-mono text-[10px] text-cyan-400 uppercase font-bold">
                        {member.agent.name} · {member.agent.role}
                      </span>
                    </div>

                    {/* Ready Badge */}
                    <div className="border-t border-slate-800/80 pt-2 text-center">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        ✓ READY
                      </span>
                    </div>
                  </div>
                );
              }

              // Empty Slot
              return (
                <div
                  key={idx}
                  onClick={handleAddBotSlot}
                  className="flex h-80 w-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-4 transition hover:border-slate-600 hover:bg-slate-900/40 cursor-pointer group"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-slate-500 group-hover:border-cyan-500 group-hover:text-cyan-400 transition">
                    +
                  </div>
                  <span className="mt-3 font-mono text-xs font-bold uppercase text-slate-500 group-hover:text-slate-300 transition">
                    INVITE BOT
                  </span>
                </div>
              );
            })}
          </div>

          {/* Bottom Action Dock: Practice, Red START Button, Leave Party */}
          <div className="flex items-center gap-4 w-full max-w-xl justify-center mb-2">
            <button
              onClick={() => {
                setQueueMode('PRACTICE');
                handleStart();
              }}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-200 hover:bg-slate-700 hover:text-white transition cursor-pointer"
            >
              PRACTICE 🎯
            </button>

            <button
              data-start="true"
              onClick={handleStart}
              className="flex-1 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 px-10 py-4 font-mono text-lg font-black uppercase tracking-widest text-white shadow-2xl shadow-red-600/40 hover:from-red-500 hover:to-rose-500 active:scale-95 transition cursor-pointer text-center"
            >
              START
            </button>

            <button
              onClick={() => setPartyMembers([partyMembers[0]])}
              className="rounded-lg border border-slate-800 bg-slate-900/80 px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition cursor-pointer"
            >
              LEAVE PARTY
            </button>
          </div>
        </div>

        {/* RIGHT SIDEBAR: Friends / Party List */}
        <div className="flex w-56 flex-col border-l border-slate-800/60 pl-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
              FRIENDS // ONLINE (4)
            </span>
          </div>

          <div className="space-y-2 font-mono text-xs overflow-y-auto">
            {[
              { name: 'ViperMain', status: 'In Lobby', color: 'bg-emerald-400' },
              { name: 'ShadowGamer', status: 'In Match 8-4', color: 'bg-cyan-400' },
              { name: 'TacticalPro', status: 'In Lobby', color: 'bg-emerald-400' },
              { name: 'AcesHigh', status: 'Offline', color: 'bg-slate-600' },
            ].map((friend, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded border border-slate-800/60 bg-slate-900/30 p-2">
                <span className={`h-2 w-2 rounded-full ${friend.color}`} />
                <div>
                  <div className="font-bold text-slate-200">{friend.name}</div>
                  <div className="text-[10px] text-slate-500">{friend.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AGENT SELECTION MODAL */}
      {showAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="relative w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-mono text-base font-black uppercase text-white">SELECT TACTICAL AGENT</h3>
              <button
                onClick={() => setShowAgentModal(false)}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-1 font-mono text-xs font-bold uppercase text-slate-300 hover:text-white transition cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {Object.values(AGENT_REGISTRY).map((ag: AgentDef) => {
                const isSelected = ag.id === selectedAgentId;
                return (
                  <div
                    key={ag.id}
                    onClick={() => {
                      onSelectAgent(ag.id);
                      setShowAgentModal(false);
                    }}
                    className={`flex flex-col justify-between rounded-xl border p-4 transition cursor-pointer ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/40 text-white'
                        : 'border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold uppercase">{ag.name}</span>
                        <span className="font-mono text-[9px] text-cyan-400 uppercase">{ag.role}</span>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400 leading-snug">{ag.description}</p>
                    </div>

                    <button className="mt-4 w-full rounded bg-cyan-600 py-1.5 font-mono text-xs font-bold uppercase text-white hover:bg-cyan-500 transition">
                      {isSelected ? 'SELECTED' : 'SELECT'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
