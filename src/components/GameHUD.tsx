/**
 * Hollow Strike - In-Game Tactical HUD
 * Displays minimap, score banner, kill feed, crisp X-hitmarker + damage readout,
 * interactive abilities bar with live charges/cooldowns, and weapon/ammo controls.
 */

import React from 'react';
import {
  AbilitySlotState,
  AGENT_REGISTRY,
  AgentDef,
  CrosshairColor,
  CrosshairConfig,
  CrosshairSize,
  HitFeedback,
  KillEvent,
  PlayerStats,
  RoundPhase,
  SpectateState,
  WeaponDef,
} from '../game/types';
import { resolveCrosshairConfig } from '../game/rules';
import { CrosshairReticle } from './CrosshairReticle';
import { Minimap } from './Minimap';
import { BotCombatant } from '../game/botAI';

interface GameHUDProps {
  playerCombatant: BotCombatant;
  allCombatants: BotCombatant[];
  allStats: PlayerStats[];
  agent: AgentDef;
  abilityStates: AbilitySlotState[];
  weapon: WeaponDef;
  ammoInMag: number;
  reserveAmmo: number;
  isReloading: boolean;
  activeSlot: 1 | 2;
  hasPrimaryWeapon: boolean;
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
  hitFeedback: HitFeedback | null;
  damageFlash: boolean;
  crosshairColor?: CrosshairColor;
  crosshairSize?: CrosshairSize;
  crosshairConfig?: CrosshairConfig;
  crosshairBloomPx?: number;
  isBlinded: boolean;
  isPointerLocked: boolean;
  isMobile: boolean;
  revealedEnemyIds?: Map<string, number>;
  fps: number;
  showFps: boolean;
  spectateState?: SpectateState | null;
  onTriggerAbility: (slot: 'Q' | 'E' | 'C' | 'X') => void;
  onSwitchWeapon: (slot: 1 | 2) => void;
  onSkipBuyPhase: () => void;
  onOpenBuyMenu: () => void;
  onOpenMap: () => void;
  onOpenScoreboard: () => void;
  onOpenSettings: () => void;
  onOpenPause: () => void;
  onSpectatePrev?: () => void;
  onSpectateNext?: () => void;
  onToggleSpectateMode?: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  playerCombatant,
  allCombatants,
  agent,
  abilityStates,
  weapon,
  ammoInMag,
  reserveAmmo,
  isReloading,
  activeSlot,
  hasPrimaryWeapon,
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
  hitFeedback,
  damageFlash,
  crosshairColor = 'cyan',
  crosshairSize = 'medium',
  crosshairConfig,
  crosshairBloomPx = 0,
  isBlinded,
  isPointerLocked,
  isMobile,
  revealedEnemyIds,
  fps,
  showFps,
  spectateState = null,
  onTriggerAbility,
  onSwitchWeapon,
  onSkipBuyPhase,
  onOpenBuyMenu,
  onOpenMap,
  onOpenScoreboard,
  onOpenSettings,
  onOpenPause,
  onSpectatePrev,
  onSpectateNext,
  onToggleSpectateMode,
}) => {
  const isSpectating = Boolean(spectateState?.active);
  const aliveAttackers = allCombatants.filter((c) => c.alive && c.team === 'ATTACKERS').length;
  const aliveDefenders = allCombatants.filter((c) => c.alive && c.team === 'DEFENDERS').length;

  const resolvedCrosshair = resolveCrosshairConfig({
    crosshairColor,
    crosshairSize,
    crosshairConfig,
  });

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-2 sm:p-3 select-none">
      {/* Incoming Damage Crimson Edge Vignette */}
      {damageFlash && (
        <div className="fixed inset-0 z-40 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_45%,rgba(220,38,38,0.52)_100%)] transition-opacity duration-150" />
      )}

      {/* Blinded Flash Overlay */}
      {isBlinded && (
        <div className="fixed inset-0 z-50 bg-white/85 pointer-events-none transition-opacity duration-300" />
      )}

      {/* Top Bar: Minimap, Score Banner, Kill Feed */}
      <div className="flex items-start justify-between gap-2">
        {/* Left: Minimap (Clickable to expand) & Team alive counters */}
        <div className="flex flex-1 flex-col gap-1 sm:gap-2 items-start">
          <div
            onClick={onOpenMap}
            className="pointer-events-auto cursor-pointer hover:opacity-90 transition group relative self-start"
            title="Click to expand Tactical Map [M]"
          >
            <Minimap
              playerCombatant={playerCombatant}
              allCombatants={allCombatants}
              spikePosition={spikePosition}
              spikeState={spikeState}
              playerTeam={playerCombatant.team}
              revealedEnemyIds={revealedEnemyIds}
              compact={isMobile}
            />
            <div className="absolute top-1 right-1 font-mono text-[8px] font-bold uppercase text-cyan-300 bg-slate-900/90 px-1 rounded">
              {isMobile ? 'MAP' : 'TAP MAP [M]'}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 rounded bg-slate-950/80 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-mono border border-slate-800">
            <div className="flex items-center gap-1 text-red-400">
              <span className="font-bold">ATT</span>
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-sm ${i < aliveAttackers ? 'bg-red-500' : 'bg-slate-800'}`}
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
                    className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-sm ${i < aliveDefenders ? 'bg-blue-500' : 'bg-slate-800'}`}
                  />
                ))}
              </div>
              <span className="font-bold">DEF</span>
            </div>
          </div>
        </div>

        {/* Center: Tactical Scoreboard & Round Timer */}
        <div className="flex flex-col items-center">
          <div
            className={`flex items-center rounded-lg border border-slate-800 bg-slate-950/90 shadow-2xl ${
              isMobile ? 'px-2.5 py-1 gap-2.5' : 'px-4 py-1.5 gap-4'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-[10px] sm:text-xs font-mono font-bold text-red-400 uppercase">ATT</span>
              <span className={`font-mono font-black text-white tabular-nums ${isMobile ? 'text-base' : 'text-xl'}`}>
                {attackerRoundsWon}
              </span>
            </div>

            <div className={`flex flex-col items-center border-x border-slate-800 ${isMobile ? 'px-2.5' : 'px-4'}`}>
              {spikeState === 'planted' ? (
                <div className="flex items-center gap-1 text-red-500 font-mono font-black text-base sm:text-lg animate-pulse">
                  <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                  <span>{Math.max(0, spikeTimer).toFixed(1)}s</span>
                </div>
              ) : (
                <div className={`font-mono font-black text-white tabular-nums ${isMobile ? 'text-base' : 'text-xl'}`}>
                  {Math.floor(roundTimeRemaining / 60)}:
                  {Math.floor(roundTimeRemaining % 60).toString().padStart(2, '0')}
                </div>
              )}
              <span className="text-[8px] sm:text-[9px] font-mono uppercase tracking-wider text-slate-400">
                {roundPhase === 'BUY_PHASE'
                  ? 'BUY PHASE'
                  : roundPhase === 'SPIKE_PLANTED'
                    ? 'DETONATING'
                    : roundPhase === 'ROUND_END'
                      ? 'ROUND OVER'
                      : `RND ${currentRound}`}
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className={`font-mono font-black text-white tabular-nums ${isMobile ? 'text-base' : 'text-xl'}`}>
                {defenderRoundsWon}
              </span>
              <span className="text-[10px] sm:text-xs font-mono font-bold text-blue-400 uppercase">DEF</span>
            </div>
          </div>

          {/* Buy Phase Banner with Skip Button */}
          {roundPhase === 'BUY_PHASE' && (
            <div className="pointer-events-auto relative z-40 mt-1 flex items-center gap-1.5 sm:gap-2 rounded-lg border border-amber-500/50 bg-amber-950/80 px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-mono text-amber-200 shadow-lg">
              {!isMobile && <span className="hidden md:inline">BUY PHASE · WEAPONS LOCKED BEHIND BARRIER</span>}
              {isMobile && <span>BUY</span>}
              <button
                onClick={onOpenBuyMenu}
                className="rounded border border-amber-400/60 bg-amber-500/20 px-2 py-0.5 font-bold text-amber-200 hover:bg-amber-500/40 cursor-pointer"
              >
                {isMobile ? 'SHOP' : '[B] SHOP'}
              </button>
              <button
                onClick={onSkipBuyPhase}
                className="rounded bg-emerald-500 px-2 py-0.5 font-black text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                {isMobile ? 'START FIGHT' : 'START FIGHT [G]'}
              </button>
            </div>
          )}

          {/* Desktop aim lock hint */}
          {!isMobile && !isPointerLocked && roundPhase !== 'BUY_PHASE' && !isSpectating && (
            <div className="mt-1.5 rounded border border-cyan-500/40 bg-slate-950/80 px-2.5 py-0.5 font-mono text-[10px] text-cyan-300">
              CLICK GAME VIEW TO LOCK AIM · OR DRAG TO LOOK
            </div>
          )}
        </div>

        {/* Right: Kill Feed & Desktop Controls (Mobile uses MobileControls top-right bar) */}
        <div className="flex flex-1 flex-col items-end gap-2">
          {!isMobile && (
            <div className="pointer-events-auto relative z-40 flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/85 p-1">
              {showFps && (
                <span className="font-mono text-[10px] text-cyan-400 px-2 font-bold tabular-nums">{fps} FPS</span>
              )}
              <button
                onClick={onOpenBuyMenu}
                className="rounded px-2.5 py-1 text-[10px] font-mono font-bold uppercase text-amber-300 bg-amber-950/40 border border-amber-500/40 hover:bg-amber-900/60 transition cursor-pointer"
              >
                Armory [B]
              </button>
              <button
                onClick={onOpenMap}
                className="rounded px-2 py-1 text-[10px] font-mono font-bold uppercase text-cyan-300 bg-cyan-950/40 border border-cyan-500/40 hover:bg-cyan-900/60 transition cursor-pointer"
              >
                Map [M]
              </button>
              <button
                onClick={onOpenScoreboard}
                className="rounded px-2 py-1 text-[10px] font-mono uppercase text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              >
                Scores [Tab]
              </button>
              <button
                onClick={onOpenSettings}
                className="rounded px-2 py-1 text-[10px] font-mono uppercase text-cyan-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              >
                Settings
              </button>
              <button
                onClick={onOpenPause}
                className="rounded px-2 py-1 text-[10px] font-mono uppercase text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              >
                Pause [Esc]
              </button>
            </div>
          )}

          <div className={`flex flex-col gap-1 ${isMobile ? 'mt-12 items-end max-w-[52vw]' : 'w-64'}`}>
            {killFeed.slice(isMobile ? -2 : -4).map((k) => (
              <div
                key={k.id}
                className={`flex items-center justify-end gap-1 rounded bg-slate-950/85 border border-slate-800 shadow font-mono whitespace-nowrap ${
                  isMobile ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[11px] gap-1.5'
                }`}
              >
                <span className={k.killerTeam === 'ATTACKERS' ? 'text-red-400 font-bold' : 'text-blue-400 font-bold'}>
                  {k.killerName}
                </span>
                <span className="text-slate-400 text-[9px]">[{k.weaponName}]</span>
                {k.isHeadshot && (
                  <span className="text-amber-400 font-bold text-[9px]" title="Headshot">
                    HS
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

      {/* Center Screen: Reticle, Crisp X-Hitmarker & Live Damage Popup (hidden when spectating) */}
      {!isSpectating && (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative flex items-center justify-center">
          <CrosshairReticle config={resolvedCrosshair} bloomPx={crosshairBloomPx} />

          {/* Crisp X Hitmarker */}
          {hitmarker?.active && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative h-7 w-7 rotate-45">
                <span
                  className={`absolute left-1/2 top-0 h-2.5 w-0.5 -translate-x-1/2 ${
                    hitmarker.isHeadshot ? 'bg-amber-400' : 'bg-white'
                  }`}
                />
                <span
                  className={`absolute left-1/2 bottom-0 h-2.5 w-0.5 -translate-x-1/2 ${
                    hitmarker.isHeadshot ? 'bg-amber-400' : 'bg-white'
                  }`}
                />
                <span
                  className={`absolute top-1/2 left-0 w-2.5 h-0.5 -translate-y-1/2 ${
                    hitmarker.isHeadshot ? 'bg-amber-400' : 'bg-white'
                  }`}
                />
                <span
                  className={`absolute top-1/2 right-0 w-2.5 h-0.5 -translate-y-1/2 ${
                    hitmarker.isHeadshot ? 'bg-amber-400' : 'bg-white'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Damage Number & Target Health Feedback */}
          {hitFeedback?.active && (
            <div className="absolute top-7 flex flex-col items-center whitespace-nowrap">
              <span
                className={`font-mono text-xs font-black tracking-wider drop-shadow ${
                  hitFeedback.isKill
                    ? 'text-rose-400'
                    : hitFeedback.isHeadshot
                      ? 'text-amber-300'
                      : 'text-white'
                }`}
              >
                -{hitFeedback.damage} {hitFeedback.isKill ? 'ELIMINATED' : hitFeedback.isHeadshot ? 'HEADSHOT' : ''}
              </span>
              <div className="mt-0.5 h-1.5 w-20 overflow-hidden rounded-full bg-slate-900/90 border border-slate-700">
                <div
                  className={`h-full transition-all duration-150 ${
                    hitFeedback.targetHp > 35 ? 'bg-rose-500' : 'bg-red-600'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, (hitFeedback.targetHp / hitFeedback.targetMaxHp) * 100))}%` }}
                />
              </div>
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
                className={`h-full transition-all duration-75 ${plantProgress > 0 ? 'bg-red-500' : 'bg-cyan-400'}`}
                style={{ width: `${Math.round((plantProgress || defuseProgress) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
      )}

      {/* Bottom Row: Spectator Card (when dead) OR Mobile Centered Strip OR Desktop Vitality/Abilities/Weapon */}
      {isSpectating && spectateState ? (
        <div className="pointer-events-auto relative z-40 mx-auto mb-1 sm:mb-2 w-full max-w-lg sm:max-w-xl">
          <div
            data-testid="spectator-hud"
            className="rounded-xl border border-cyan-500/40 bg-slate-950/92 px-3 py-2 sm:px-4 sm:py-3 shadow-2xl font-mono"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-1.5 sm:pb-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-rose-600/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                  ELIMINATED · SPECTATING
                </span>
                {spectateState.practiceRespawnIn > 0 && (
                  <span className="rounded bg-emerald-600/80 px-2 py-0.5 text-[10px] font-black uppercase text-white tabular-nums">
                    RESPAWN IN {spectateState.practiceRespawnIn}S
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 uppercase">
                {spectateState.aliveTeammatesCount > 0
                  ? `${spectateState.aliveTeammatesCount} ALLY ALIVE`
                  : 'ROUND ENDING'}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div
                  className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg border text-base sm:text-lg font-black"
                  style={{
                    borderColor: AGENT_REGISTRY[spectateState.agentId]?.primaryColor || '#06b6d4',
                    color: AGENT_REGISTRY[spectateState.agentId]?.primaryColor || '#06b6d4',
                    backgroundColor: '#0f172a',
                  }}
                >
                  {spectateState.targetName[0] || 'A'}
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-black text-white">{spectateState.targetName}</div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400">
                    {AGENT_REGISTRY[spectateState.agentId]?.name ?? spectateState.agentId} ·{' '}
                    <span className="text-emerald-400 font-bold">{spectateState.hp} HP</span> ·{' '}
                    <span className="text-cyan-400 font-bold">{spectateState.armor} AP</span> ·{' '}
                    <span className="text-slate-200">{spectateState.weaponName}</span> ({spectateState.ammoInMag}/{spectateState.reserveAmmo})
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onSpectatePrev}
                  className="min-h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-bold uppercase text-slate-200 hover:border-cyan-400 cursor-pointer"
                >
                  ◀ PREV
                </button>
                <button
                  type="button"
                  onClick={onToggleSpectateMode}
                  className="min-h-10 rounded-lg border border-cyan-500/60 bg-cyan-950/60 px-3 py-1.5 text-[11px] font-black uppercase text-cyan-300 hover:bg-cyan-900/70 cursor-pointer"
                >
                  {spectateState.mode === 'THIRD_PERSON' ? '3P CAM' : '1P CAM'}
                </button>
                <button
                  type="button"
                  onClick={onSpectateNext}
                  className="min-h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-bold uppercase text-slate-200 hover:border-cyan-400 cursor-pointer"
                >
                  NEXT ▶
                </button>
              </div>
            </div>

            {!isMobile && (
              <div className="mt-2 text-[10px] text-slate-500 uppercase tracking-wider">
                Controls: [A / ←] Prev · [D / → / Click] Next · [V / Space] Toggle 3P/1P Camera
              </div>
            )}
          </div>
        </div>
      ) : isMobile ? (
        /* Compact bottom-center strip for mobile so Joystick (left) and Buttons (right) never overlap HUD */
        <div className="pointer-events-none mx-auto mb-0.5 flex items-center gap-2.5 rounded-xl border border-slate-800/90 bg-slate-950/90 px-3 py-1.5 shadow-2xl font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase text-slate-400">HP</span>
            <span className={`text-lg font-black tabular-nums leading-none ${hp > 30 ? 'text-white' : 'text-red-500'}`}>
              {hp}
            </span>
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-1">
            <span className="text-[9px] uppercase text-slate-400">AP</span>
            <span className="text-sm font-black text-cyan-400 tabular-nums leading-none">{armor}</span>
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <span className="text-xs font-bold text-emerald-400 tabular-nums leading-none">
            ${credits.toLocaleString()}
          </span>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-300 max-w-[74px] truncate">{weapon.name}</span>
            {isReloading ? (
              <span className="text-[10px] font-bold text-amber-400 uppercase animate-pulse">RLD</span>
            ) : (
              <span className={`text-sm font-black tabular-nums leading-none ${ammoInMag <= 4 ? 'text-red-400' : 'text-white'}`}>
                {ammoInMag}<span className="text-[10px] font-normal text-slate-400">/{reserveAmmo}</span>
              </span>
            )}
          </div>
        </div>
      ) : (
      <div className="flex items-end justify-between">
        {/* Vitality & Armor */}
        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/90 p-3 shadow-2xl">
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

          <div className="flex flex-col border-l border-slate-800 pl-3">
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-mono uppercase text-slate-400">SHIELD</span>
              <span className="font-mono text-2xl font-black text-cyan-400 tabular-nums">{armor}</span>
            </div>
            <div className="h-2 w-20 overflow-hidden rounded bg-slate-800">
              <div
                className="h-full bg-cyan-400 transition-all duration-150"
                style={{ width: `${Math.min(100, (armor / 50) * 100)}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col border-l border-slate-800 pl-3">
            <span className="text-[10px] font-mono uppercase text-slate-400">CREDITS</span>
            <span className="font-mono text-base font-bold text-emerald-400 tabular-nums">
              ${credits.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Center: Live Agent Abilities Bar (Desktop interactive + live charges/CD/Ult) */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/90 p-2 shadow-2xl">
          {agent.abilities.map((ab) => {
            const st = abilityStates.find((s) => s.keySlot === ab.keySlot);
            const onCd = (st?.cooldownRemaining ?? 0) > 0.05;
            const isUltReady = ab.isUltimate ? (st?.ultPoints ?? 0) >= (st?.ultRequired ?? 5) : true;
            const hasCharge = ab.isUltimate ? isUltReady : (st?.charges ?? 1) > 0;

            return (
              <button
                key={ab.id}
                onClick={() => onTriggerAbility(ab.keySlot)}
                title={`${ab.name}: ${ab.description}`}
                className={`relative flex flex-col items-center justify-center rounded border px-1.5 py-1 w-[70px] h-16 transition cursor-pointer ${
                  !hasCharge || onCd
                    ? 'border-slate-800 bg-slate-900/40 text-slate-500'
                    : ab.isUltimate
                      ? 'border-amber-400 bg-amber-950/50 text-amber-200 hover:bg-amber-900/60'
                      : 'border-slate-700 bg-slate-900/90 text-slate-100 hover:border-cyan-400'
                }`}
                style={hasCharge && !onCd && !ab.isUltimate ? { borderColor: `${agent.primaryColor}88` } : undefined}
              >
                <span
                  className="font-mono text-[11px] font-black leading-none"
                  style={{ color: ab.isUltimate ? '#fbbf24' : agent.primaryColor }}
                >
                  [{ab.keySlot}]
                </span>
                <span className="text-[9px] font-bold uppercase truncate max-w-full text-center mt-1 leading-none">
                  {ab.name.split(' ')[0]}
                </span>
                {onCd ? (
                  <span className="text-[9px] font-mono font-bold text-amber-400 mt-1 leading-none">
                    {Math.ceil(st!.cooldownRemaining)}s
                  </span>
                ) : ab.isUltimate ? (
                  <span className="text-[9px] font-mono font-bold whitespace-nowrap mt-1 leading-none">
                    {isUltReady ? 'READY' : `${st?.ultPoints ?? 0}/${st?.ultRequired ?? 5}`}
                  </span>
                ) : (
                  <div className="flex gap-1 mt-0.5">
                    {[...Array(ab.maxCharges)].map((_, idx) => (
                      <span
                        key={idx}
                        className={`h-1.5 w-2.5 rounded-sm ${
                          idx < (st?.charges ?? 0) ? 'bg-cyan-400' : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Weapon & Ammo Readout + Quick Slot Switch */}
        <div className="pointer-events-auto flex items-center gap-3 sm:gap-4 rounded-lg border border-slate-800 bg-slate-950/90 p-2.5 sm:p-3 shadow-2xl">
          {hasPrimaryWeapon && (
            <div className="hidden sm:flex flex-col gap-1 border-r border-slate-800 pr-3 font-mono text-[10px]">
              <button
                onClick={() => onSwitchWeapon(1)}
                className={`rounded px-1.5 py-0.5 text-left font-bold cursor-pointer ${
                  activeSlot === 1 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                [1] PRIMARY
              </button>
              <button
                onClick={() => onSwitchWeapon(2)}
                className={`rounded px-1.5 py-0.5 text-left font-bold cursor-pointer ${
                  activeSlot === 2 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                [2] SIDEARM
              </button>
            </div>
          )}

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
                <span
                  className={`font-mono text-2xl sm:text-3xl font-black tabular-nums ${
                    ammoInMag <= 4 ? 'text-red-400' : 'text-white'
                  }`}
                >
                  {ammoInMag}
                </span>
                <span className="font-mono text-xs sm:text-sm text-slate-400 tabular-nums">/ {reserveAmmo}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
