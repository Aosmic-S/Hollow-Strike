/**
 * Hollow Strike - Title Screen & Agent Roster
 * Bespoke tactical emblem, agent selection, difficulty config, and landscape fullscreen entry.
 */

import React, { useEffect, useState } from 'react';
import { AGENT_REGISTRY, AgentDef, BotDifficulty } from '../game/types';
import { PWAInstallButton } from './PWAInstallButton';
import { soundEngine } from '../game/audio';

interface TitleScreenProps {
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
  difficulty: BotDifficulty;
  onSelectDifficulty: (diff: BotDifficulty) => void;
  onStartGame: () => void;
  onOpenSettings: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedAgentId,
  onSelectAgent,
  difficulty,
  onSelectDifficulty,
  onStartGame,
  onOpenSettings,
}) => {
  const currentAgent = AGENT_REGISTRY[selectedAgentId] || AGENT_REGISTRY.ZEPHYR;
  const [controlsTab, setControlsTab] = useState<'PC' | 'MOBILE'>('PC');

  useEffect(() => {
    // Keyboard Start Handshake (Enter or Space starts game)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStartGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStartGame]);

  const handleStartClick = () => {
    soundEngine.init();

    // Orientation lock & fullscreen for mobile landscape per prompt requirements
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      if (screen.orientation && 'lock' in screen.orientation) {
        (screen.orientation as unknown as { lock: (mode: string) => Promise<void> })
          .lock('landscape')
          .catch(() => {});
      }
    } catch {
      // Ignored if browser prevents orientation lock
    }

    onStartGame();
  };

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-y-auto bg-gradient-to-b from-[#080d18] via-[#050810] to-[#030508] p-6 text-white select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Tactical Chevron Logo */}
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-950/40 shadow-lg shadow-cyan-500/10">
            <svg className="h-6 w-6 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm0 4.5l5 2.8v3.7c0 3.1-2.15 6-5 6.8-2.85-.8-5-3.7-5-6.8V9.3l5-2.8z" />
            </svg>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400">Tactical 5v5 FPS</div>
            <div className="text-xs font-mono text-slate-400">First to 13 Rounds · Plant / Defuse</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <PWAInstallButton />

          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 font-mono text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white transition cursor-pointer"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Main Hero & Agent Selector */}
      <div className="my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-6xl mx-auto w-full py-4">
        {/* Left: Bespoke Title Lockup & Start CTA (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-start">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/30 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cyan-400">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
            PROTOCOL V2.4 ACTIVE
          </div>

          {/* Bespoke Title Emblem */}
          <h1 className="mt-4 text-5xl sm:text-6xl font-black uppercase tracking-tight text-white leading-none">
            HOLLOW<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
              STRIKE
            </span>
          </h1>

          <p className="mt-4 text-sm text-slate-300 leading-relaxed">
            High-precision procedural team shooter. 5v5 plant/defuse combat with lethal recoil, tactical smoke controllers, entry dashers, and bot AI across 13 rounds.
          </p>

          {/* Bot Difficulty Selector */}
          <div className="mt-5 w-full">
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold block mb-2">
              Bot Combat Training Difficulty
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['EASY', 'MEDIUM', 'HARD'] as BotDifficulty[]).map((diff) => (
                <button
                  key={diff}
                  onClick={() => onSelectDifficulty(diff)}
                  className={`rounded-lg border py-2 font-mono text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                    difficulty === diff
                      ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300 shadow-md shadow-cyan-500/20'
                      : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Start CTA */}
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full">
            <button
              data-start="true"
              onClick={handleStartClick}
              className="w-full sm:w-auto flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-4 font-mono text-base font-black uppercase tracking-widest text-white shadow-xl shadow-cyan-500/25 hover:from-cyan-400 hover:to-blue-500 active:scale-95 transition cursor-pointer text-center"
            >
              DEPLOY MISSION [SPACE]
            </button>
          </div>
        </div>

        {/* Right: Agent Selection Dossier (7 cols) */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
              TACTICAL AGENT ROSTER
            </span>
            <span className="font-mono text-xs font-bold text-cyan-400">
              SELECTED: {currentAgent.name}
            </span>
          </div>

          {/* 4 Agent Selector Tabs */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {Object.values(AGENT_REGISTRY).map((ag: AgentDef) => {
              const isSelected = ag.id === selectedAgentId;
              return (
                <button
                  key={ag.id}
                  onClick={() => onSelectAgent(ag.id)}
                  className={`flex flex-col items-center justify-center rounded-xl border p-3 transition cursor-pointer ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/50 shadow-lg shadow-cyan-500/10'
                      : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 opacity-75'
                  }`}
                >
                  <div
                    className="h-3 w-8 rounded-full mb-1.5"
                    style={{ backgroundColor: ag.primaryColor }}
                  />
                  <span className="font-black text-xs text-white uppercase">{ag.name}</span>
                  <span className="font-mono text-[9px] text-slate-400 uppercase mt-0.5">{ag.role}</span>
                </button>
              );
            })}
          </div>

          {/* Active Agent Dossier */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <h3 className="text-xl font-black text-white">{currentAgent.name}</h3>
                <span className="font-mono text-xs text-cyan-400 uppercase font-bold tracking-wider">
                  ROLE: {currentAgent.role}
                </span>
              </div>
            </div>

            <p className="mt-2 text-xs text-slate-300 leading-relaxed">{currentAgent.description}</p>

            {/* Abilities Grid */}
            <div className="mt-4">
              <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 font-bold">
                Agent Tactical Kit (3 Abilities + 1 Ultimate)
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {currentAgent.abilities.map((ab) => (
                  <div
                    key={ab.id}
                    className={`rounded-lg border p-2.5 ${
                      ab.isUltimate
                        ? 'border-amber-500/40 bg-amber-950/20'
                        : 'border-slate-800 bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-black text-cyan-400">[{ab.keySlot}]</span>
                      <span className="text-[9px] uppercase text-slate-400">
                        {ab.isUltimate ? 'ULTIMATE' : `$${ab.cost}`}
                      </span>
                    </div>
                    <div className="font-bold text-slate-200 mt-1">{ab.name}</div>
                    <div className="text-[10px] text-slate-400 leading-snug mt-0.5">{ab.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Flat Control Hint Line */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-800/80 pt-4 text-[11px] font-mono text-slate-400 safe-area-inset-bottom">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setControlsTab('PC')}
            className={`cursor-pointer ${controlsTab === 'PC' ? 'text-cyan-400 font-bold' : 'hover:text-white'}`}
          >
            PC Controls
          </button>
          <span>·</span>
          <button
            onClick={() => setControlsTab('MOBILE')}
            className={`cursor-pointer ${controlsTab === 'MOBILE' ? 'text-cyan-400 font-bold' : 'hover:text-white'}`}
          >
            Mobile Touch
          </button>
        </div>

        <div className="mt-2 sm:mt-0">
          {controlsTab === 'PC' ? (
            <span>WASD Move · Click Fire · Right-Click ADS · R Reload · Q/E/C/X Abilities · B Buy Armory · Tab Scores · Esc Pause</span>
          ) : (
            <span>Left Virtual Joystick · Right Touch Swipe Look · Thumb Fire & Abilities · Landscape Safe Area</span>
          )}
        </div>
      </div>
    </div>
  );
};
