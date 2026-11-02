/**
 * Hollow Strike - In-Game Tactical HUD
 * High-performance, low-occlusion status display with tabular numerals and world-matched styling.
 */

import React from 'react';
import { PlayerStats, RoundPhase, TeamSide, WeaponDef, KillEvent, AgentDef } from '../game/types';
import { Minimap } from './Minimap';
import { BotCombatant } from '../game/botAI';

interface GameHUDProps {
  playerCombatant: BotCombatant;
  allCombatants: BotCombatant[];
  allStats: PlayerStats[];
  agent: AgentDef;
  weapon: WeaponDef;
  ammoInMag: number;
  reserveAmmo: number;
  isReloading: boolean;
  hp: number;
  armor: number;
  credits: number;
  roundPhase: RoundPhase;
  roundTimeRemaining: number;
  attackerRoundsWon: number;
  defenderRoundsWon: number;
  currentRound: number;
  spikeState: 'not_planted' | 'planted' | 'defused' | 'detonated';
  spikePosition: { x: number; z: number } | null;
  spikeTimer: number;
  plantProgress: number;
  defuseProgress: number;
  killFeed: KillEvent[];
  hitmarker: { active: boolean; isHeadshot: boolean } | null;
  fps: number;
  showFps: boolean;
  onOpenBuyMenu: () => void;
  onOpenScoreboard: () => void;
  onOpenPause: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  playerCombatant,
  allCombatants,
  allStats,
  agent,
  weapon,
  ammoInMag,
  reserveAmmo,
  isReloading,
  hp,
  armor,
  credits,
  roundPhase,
  roundTimeRemaining,
  attackerRoundsWon,
  defenderRoundsWon,
  currentRound,
  spikeState,
  spikePosition,
  spikeTimer,
  plantProgress,
  defuseProgress,
  killFeed,
  hitmarker,
  fps,
  showFps,
  onOpenBuyMenu,
  onOpenScoreboard,
  onOpenPause,
}) => {
  const isAttacker = playerCombatant.team === 'ATTACKERS';
  const aliveAttackers = allCombatants.filter((c) => c.alive && c.team === 'ATTACKERS').length;
  const aliveDefenders = allCombatants.filter((c) => c.alive && c.team === 'DEFENDERS').length;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 select-none">
      {/* Top Bar: Minimap, Score Banner, Kill Feed */}
      <div className="flex items-start justify-between">
        {/* Left: Minimap & Team alive counters */}
        <div className="flex flex-col gap-2">
          <Minimap
            playerCombatant={playerCombatant}
            allCombatants={allCombatants}
            spikePosition={spikePosition}
            spikeState={spikeState}
            playerTeam={playerCombatant.team}
          />

          {/* Team Alive Counter Pips */}
          <div className="flex items-center gap-3 rounded bg-slate-950/80 px-2.5 py-1 text-[11px] font-mono border border-slate-800">
            <div className="flex items-center gap-1 text-red-400">
              <span className="font-bold">ATT</span>
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-2 rounded-sm ${
                      i < aliveAttackers ? 'bg-red-500' : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>
            </div>

            <span className="text-slate-600">|</span>

            <div className="flex items-center gap-1 text-blue-400">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-2 rounded-sm ${
                      i < aliveDefenders ? 'bg-blue-500' : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>
              <span className="font-bold">DEF</span>
            </div>
          </div>
        </div>

        {/* Center: Tactical Scoreboard & Round Timer */}
        <div className="flex flex-col items-center">
          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950/90 shadow-2xl px-4 py-1.5 gap-4">
            {/* Attackers Score */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-red-400 uppercase">ATT</span>
              <span className="font-mono text-xl font-black text-white tabular-nums">
                {attackerRoundsWon}
              </span>
            </div>

            {/* Timer / Phase */}
            <div className="flex flex-col items-center border-x border-slate-800 px-4">
              {spikeState === 'planted' ? (
                <div className="flex items-center gap-1.5 text-red-500 font-mono font-black text-lg animate-pulse">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                  <span>{Math.max(0, spikeTimer).toFixed(1)}s</span>
                </div>
              ) : (
                <div className="font-mono text-xl font-black text-white tabular-nums">
                  {Math.floor(roundTimeRemaining / 60)}:
                  {Math.floor(roundTimeRemaining % 60).toString().padStart(2, '0')}
                </div>
              )}
              <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                {roundPhase === 'BUY_PHASE' ? 'BUY PHASE' : roundPhase === 'SPIKE_PLANTED' ? 'DETONATING' : `ROUND ${currentRound}`}
              </span>
            </div>

            {/* Defenders Score */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-black text-white tabular-nums">
                {defenderRoundsWon}
              </span>
              <span className="text-xs font-mono font-bold text-blue-400 uppercase">DEF</span>
            </div>
          </div>

          {/* Buy Phase Notification */}
          {roundPhase === 'BUY_PHASE' && (
            <div className="mt-1 flex items-center gap-2 rounded border border-amber-500/40 bg-amber-950/40 px-3 py-0.5 text-[11px] font-mono text-amber-300">
              <span>BUY BARRIER ACTIVE · PRESS [B] FOR SHOP</span>
            </div>
          )}
        </div>

        {/* Right: Kill Feed & Controls */}
        <div className="flex flex-col items-end gap-2">
          {/* Top Utility Dock */}
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/80 p-1">
            {showFps && (
              <span className="font-mono text-[10px] text-cyan-400 px-2 font-bold tabular-nums">
                {fps} FPS
              </span>
            )}
            <button
              onClick={onOpenScoreboard}
              className="rounded px-2 py-1 text-[10px] font-mono uppercase text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            >
              Scores [Tab]
            </button>
            <button
              onClick={onOpenPause}
              className="rounded px-2 py-1 text-[10px] font-mono uppercase text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            >
              Pause [Esc]
            </button>
          </div>

          {/* Kill Feed */}
          <div className="flex flex-col gap-1 w-64">
            {killFeed.slice(-4).map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-end gap-1.5 rounded bg-slate-950/85 px-2 py-1 text-[11px] font-mono border border-slate-800 shadow animate-fade-in"
              >
                <span className={k.killerTeam === 'ATTACKERS' ? 'text-red-400 font-bold' : 'text-blue-400 font-bold'}>
                  {k.killerName}
                </span>
                <span className="text-slate-400 text-[10px]">[{k.weaponName}]</span>
                {k.isHeadshot && (
                  <span className="text-amber-400 font-bold text-[10px]" title="Headshot">
                    💀
                  </span>
                )}
                <span className={k.victimTeam === 'ATTACKERS' ? 'text-red-400 font-bold' : 'text-blue-400 font-bold'}>
                  {k.victimName}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Center Screen: Reticle & Hitmarker */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Reticle */}
        <div className="relative flex items-center justify-center">
          <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 opacity-90 shadow-sm" />
          <div className="absolute -top-3 h-2 w-0.5 bg-cyan-400 opacity-75" />
          <div className="absolute -bottom-3 h-2 w-0.5 bg-cyan-400 opacity-75" />
          <div className="absolute -left-3 h-0.5 w-2 bg-cyan-400 opacity-75" />
          <div className="absolute -right-3 h-0.5 w-2 bg-cyan-400 opacity-75" />

          {/* Hitmarker Flash */}
          {hitmarker?.active && (
            <div className="absolute inset-0 flex items-center justify-center animate-ping">
              <div
                className={`h-5 w-5 rounded-full border-2 ${
                  hitmarker.isHeadshot ? 'border-amber-400 scale-125' : 'border-white'
                }`}
              />
            </div>
          )}
        </div>

        {/* Plant / Defuse Progress Bar */}
        {(plantProgress > 0 || defuseProgress > 0) && (
          <div className="absolute top-[58%] flex flex-col items-center gap-1">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              {plantProgress > 0 ? 'ARMING SPIKE' : 'DEFUSING SPIKE'}
            </span>
            <div className="h-2.5 w-48 overflow-hidden rounded-full border border-slate-700 bg-slate-900">
              <div
                className={`h-full transition-all duration-75 ${
                  plantProgress > 0 ? 'bg-red-500' : 'bg-cyan-400'
                }`}
                style={{ width: `${Math.round((plantProgress || defuseProgress) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row: Vitality Cluster (Left), Abilities (Center), Weapon/Ammo (Right) */}
      <div className="flex items-end justify-between">
        {/* Vitality & Armor */}
        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/90 p-3 shadow-2xl">
          {/* Health */}
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-mono uppercase text-slate-400">HP</span>
              <span className={`font-mono text-3xl font-black tabular-nums ${hp > 30 ? 'text-white' : 'text-red-500'}`}>
                {hp}
              </span>
            </div>
            <div className="h-2 w-28 overflow-hidden rounded bg-slate-800">
              <div
                className={`h-full transition-all duration-150 ${hp > 30 ? 'bg-emerald-500' : 'bg-red-500'}`}
                style={{ width: `${Math.max(0, hp)}%` }}
              />
            </div>
          </div>

          {/* Shield */}
          <div className="flex flex-col border-l border-slate-800 pl-3">
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-mono uppercase text-slate-400">SHIELD</span>
              <span className="font-mono text-2xl font-black text-cyan-400 tabular-nums">
                {armor}
              </span>
            </div>
            <div className="h-2 w-20 overflow-hidden rounded bg-slate-800">
              <div
                className="h-full bg-cyan-400 transition-all duration-150"
                style={{ width: `${Math.min(100, (armor / 50) * 100)}%` }}
              />
            </div>
          </div>

          {/* Credits */}
          <div className="flex flex-col border-l border-slate-800 pl-3">
            <span className="text-[10px] font-mono uppercase text-slate-400">CREDITS</span>
            <span className="font-mono text-base font-bold text-emerald-400 tabular-nums">
              ${credits.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Center: Agent Abilities Bar (Desktop only, mobile has virtual buttons) */}
        <div className="hidden md:flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/90 p-2 shadow-2xl">
          {agent.abilities.map((ab) => (
            <div
              key={ab.id}
              className={`flex flex-col items-center justify-center rounded border p-2 w-14 h-14 transition ${
                ab.isUltimate
                  ? 'border-amber-500/50 bg-amber-950/30 text-amber-300'
                  : 'border-slate-800 bg-slate-900/60 text-slate-200'
              }`}
            >
              <span className="font-mono text-xs font-black text-cyan-400">[{ab.keySlot}]</span>
              <span className="text-[9px] font-bold uppercase truncate max-w-full text-center mt-0.5">
                {ab.name.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>

        {/* Right: Weapon & Ammo Readout */}
        <div className="flex items-center gap-3 sm:gap-4 rounded-lg border border-slate-800 bg-slate-950/90 p-2.5 sm:p-3 shadow-2xl mb-1 sm:mb-0 mr-1 sm:mr-0">
          <div className="text-right">
            <div className="text-[9px] sm:text-[10px] font-mono uppercase text-slate-400">{weapon.category}</div>
            <div className="font-black text-xs sm:text-base text-white">{weapon.name}</div>
          </div>

          <div className="border-l border-slate-800 pl-3 sm:pl-4 text-right">
            {isReloading ? (
              <span className="font-mono text-xs sm:text-sm font-bold text-amber-400 uppercase animate-pulse">
                RELOAD...
              </span>
            ) : (
              <div className="flex items-baseline gap-1">
                <span className={`font-mono text-2xl sm:text-3xl font-black tabular-nums ${ammoInMag <= 4 ? 'text-red-400' : 'text-white'}`}>
                  {ammoInMag}
                </span>
                <span className="font-mono text-xs sm:text-sm text-slate-400 tabular-nums">/ {reserveAmmo}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
