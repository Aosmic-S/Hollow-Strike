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
        <div className="fixed inset-0 z-40 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_45%,rgba(255,70,85,0.52)_100%)] transition-opacity duration-150" />
      )}

      {/* Blinded Flash Overlay */}
      {isBlinded && (
        <div className="fixed inset-0 z-50 bg-white/85 pointer-events-none transition-opacity duration-300" />
      )}

      {/* Top Bar: Minimap, Score Banner, Kill Feed */}
      <div className="flex items-start justify-between gap-2">
        {/* Left: Minimap & Team alive counters */}
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
            <div className="absolute top-1 right-1 font-mono text-[8px] font-bold uppercase text-[#17E5B8] bg-[#0F1923]/90 px-1 border border-[#ECE8E1]/15">
              {isMobile ? 'MAP' : 'TAP MAP [M]'}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 bg-[#0F1923]/88 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-mono border border-[#ECE8E1]/15 clip-val-card">
            <div className="flex items-center gap-1 text-[#FF4655]">
              <span className="font-bold">ATT</span>
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 sm:h-2 sm:w-2 ${i < aliveAttackers ? 'bg-[#FF4655]' : 'bg-[#18232E]'}`}
                  />
                ))}
              </div>
            </div>

            <span className="text-[#8B978F]/50">|</span>

            <div className="flex items-center gap-1 text-[#17E5B8]">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 sm:h-2 sm:w-2 ${i < aliveDefenders ? 'bg-[#17E5B8]' : 'bg-[#18232E]'}`}
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
            className={`flex items-center border border-[#ECE8E1]/20 bg-[#0F1923]/92 shadow-2xl clip-val-panel ${
              isMobile ? 'px-2.5 py-1 gap-2.5' : 'px-5 py-1.5 gap-5'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-[10px] sm:text-xs font-mono font-bold text-[#FF4655] uppercase">ATT</span>
              <span className={`font-display font-extrabold text-[#ECE8E1] tabular-nums ${isMobile ? 'text-lg' : 'text-2xl'}`}>
                {attackerRoundsWon}
              </span>
            </div>

            <div className={`flex flex-col items-center border-x border-[#ECE8E1]/15 ${isMobile ? 'px-2.5' : 'px-4'}`}>
              {spikeState === 'planted' ? (
                <div className="flex items-center gap-1 text-[#FF4655] font-mono font-black text-base sm:text-lg animate-pulse">
                  <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                  <span>{Math.max(0, spikeTimer).toFixed(1)}s</span>
                </div>
              ) : (
                <div className={`font-display font-extrabold text-[#ECE8E1] tabular-nums ${isMobile ? 'text-lg' : 'text-2xl'}`}>
                  {Math.floor(roundTimeRemaining / 60)}:
                  {Math.floor(roundTimeRemaining % 60).toString().padStart(2, '0')}
                </div>
              )}
              <span className="text-[8px] sm:text-[9px] font-mono uppercase tracking-widest text-[#8B978F]">
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
              <span className={`font-display font-extrabold text-[#ECE8E1] tabular-nums ${isMobile ? 'text-lg' : 'text-2xl'}`}>
                {defenderRoundsWon}
              </span>
              <span className="text-[10px] sm:text-xs font-mono font-bold text-[#17E5B8] uppercase">DEF</span>
            </div>
          </div>

          {/* Buy Phase Banner with Skip Button */}
          {roundPhase === 'BUY_PHASE' && (
            <div className="pointer-events-auto relative z-40 mt-1 flex items-center gap-1.5 sm:gap-2 border border-[#FF4655]/50 bg-[#18232E]/95 px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-mono text-[#ECE8E1] shadow-lg clip-val-card">
              {!isMobile && <span className="hidden md:inline text-[#8B978F]">BUY PHASE · WEAPONS LOCKED BEHIND BARRIER</span>}
              {isMobile && <span>BUY</span>}
              <button
                onClick={onOpenBuyMenu}
                className="border border-[#ECE8E1]/30 bg-[#0F1923] px-2 py-0.5 font-bold text-[#ECE8E1] hover:border-[#17E5B8] hover:text-[#17E5B8] cursor-pointer"
              >
                {isMobile ? 'SHOP' : '[B] SHOP'}
              </button>
              <button
                onClick={onSkipBuyPhase}
                className="bg-[#17E5B8] px-2.5 py-0.5 font-black text-[#0F1923] hover:opacity-90 cursor-pointer"
              >
                {isMobile ? 'START FIGHT' : 'START FIGHT [G]'}
              </button>
            </div>
          )}

          {/* Desktop aim lock hint */}
          {!isMobile && !isPointerLocked && roundPhase !== 'BUY_PHASE' && !isSpectating && (
            <div className="mt-1.5 border border-[#17E5B8]/40 bg-[#0F1923]/88 px-2.5 py-0.5 font-mono text-[10px] text-[#17E5B8] clip-val-card">
              CLICK GAME VIEW TO LOCK AIM · OR DRAG TO LOOK
            </div>
          )}
        </div>

        {/* Right: Kill Feed & Desktop Controls */}
        <div className="flex flex-1 flex-col items-end gap-2">
          {!isMobile && (
            <div className="pointer-events-auto relative z-40 flex items-center gap-1.5 border border-[#ECE8E1]/15 bg-[#0F1923]/92 p-1 clip-val-card">
              {showFps && (
                <span className="font-mono text-[10px] text-[#17E5B8] px-2 font-bold tabular-nums">{fps} FPS</span>
              )}
              <button
                onClick={onOpenBuyMenu}
                className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase text-[#ECE8E1] bg-[#FF4655]/20 border border-[#FF4655]/50 hover:bg-[#FF4655] hover:text-white transition cursor-pointer"
              >
                Armory [B]
              </button>
              <button
                onClick={onOpenMap}
                className="px-2 py-1 text-[10px] font-mono font-bold uppercase text-[#17E5B8] bg-[#17E5B8]/10 border border-[#17E5B8]/40 hover:bg-[#17E5B8]/25 transition cursor-pointer"
              >
                Map [M]
              </button>
              <button
                onClick={onOpenScoreboard}
                className="px-2 py-1 text-[10px] font-mono uppercase text-[#ECE8E1]/80 hover:bg-[#18232E] hover:text-[#ECE8E1] transition cursor-pointer"
              >
                Scores [Tab]
              </button>
              <button
                onClick={onOpenSettings}
                className="px-2 py-1 text-[10px] font-mono uppercase text-[#17E5B8] hover:bg-[#18232E] hover:text-white transition cursor-pointer"
              >
                Settings
              </button>
              <button
                onClick={onOpenPause}
                className="px-2 py-1 text-[10px] font-mono uppercase text-[#ECE8E1]/80 hover:bg-[#18232E] hover:text-[#ECE8E1] transition cursor-pointer"
              >
                Pause [Esc]
              </button>
            </div>
          )}

          <div className={`flex flex-col gap-1 ${isMobile ? 'mt-12 items-end max-w-[52vw]' : 'w-64'}`}>
            {killFeed.slice(isMobile ? -2 : -4).map((k) => (
              <div
                key={k.id}
                className={`flex items-center justify-end gap-1 bg-[#0F1923]/90 border border-[#ECE8E1]/15 shadow font-mono whitespace-nowrap clip-val-card ${
                  isMobile ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[11px] gap-1.5'
                }`}
              >
                <span className={k.killerTeam === 'ATTACKERS' ? 'text-[#FF4655] font-bold' : 'text-[#17E5B8] font-bold'}>
                  {k.killerName}
                </span>
                <span className="text-[#8B978F] text-[9px]">[{k.weaponName}]</span>
                {k.isHeadshot && (
                  <span className="text-[#fbbf24] font-bold text-[9px]" title="Headshot">
                    HS
                  </span>
                )}
                <span className={k.victimTeam === 'ATTACKERS' ? 'text-[#FF4655] font-bold' : 'text-[#17E5B8] font-bold'}>
                  {k.victimName}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Center Screen: Reticle, Crisp X-Hitmarker & Live Damage Popup */}
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
                      hitmarker.isHeadshot ? 'bg-[#FF4655]' : 'bg-[#ECE8E1]'
                    }`}
                  />
                  <span
                    className={`absolute left-1/2 bottom-0 h-2.5 w-0.5 -translate-x-1/2 ${
                      hitmarker.isHeadshot ? 'bg-[#FF4655]' : 'bg-[#ECE8E1]'
                    }`}
                  />
                  <span
                    className={`absolute top-1/2 left-0 w-2.5 h-0.5 -translate-y-1/2 ${
                      hitmarker.isHeadshot ? 'bg-[#FF4655]' : 'bg-[#ECE8E1]'
                    }`}
                  />
                  <span
                    className={`absolute top-1/2 right-0 w-2.5 h-0.5 -translate-y-1/2 ${
                      hitmarker.isHeadshot ? 'bg-[#FF4655]' : 'bg-[#ECE8E1]'
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
                      ? 'text-[#FF4655]'
                      : hitFeedback.isHeadshot
                        ? 'text-[#fbbf24]'
                        : 'text-[#ECE8E1]'
                  }`}
                >
                  -{hitFeedback.damage} {hitFeedback.isKill ? 'ELIMINATED' : hitFeedback.isHeadshot ? 'HEADSHOT' : ''}
                </span>
                <div className="mt-0.5 h-1.5 w-20 overflow-hidden bg-[#0F1923]/90 border border-[#ECE8E1]/20">
                  <div
                    className="h-full bg-[#FF4655] transition-all duration-150"
                    style={{ width: `${Math.max(0, Math.min(100, (hitFeedback.targetHp / hitFeedback.targetMaxHp) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Plant / Defuse Progress Bar */}
          {(plantProgress > 0 || defuseProgress > 0) && (
            <div className="absolute top-[58%] flex flex-col items-center gap-1">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#ECE8E1]">
                {plantProgress > 0 ? 'ARMING SPIKE' : 'DEFUSING SPIKE'}
              </span>
              <div className="h-2.5 w-48 overflow-hidden border border-[#ECE8E1]/25 bg-[#0F1923]">
                <div
                  className={`h-full transition-all duration-75 ${plantProgress > 0 ? 'bg-[#FF4655]' : 'bg-[#17E5B8]'}`}
                  style={{ width: `${Math.round((plantProgress || defuseProgress) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Row: Spectator Card OR Mobile Strip OR Desktop Vitality/Abilities/Weapon */}
      {isSpectating && spectateState ? (
        <div className="pointer-events-auto relative z-40 mx-auto mb-1 sm:mb-2 w-full max-w-lg sm:max-w-xl">
          <div
            data-testid="spectator-hud"
            className="border border-[#17E5B8]/40 bg-[#0F1923]/95 px-3 py-2 sm:px-4 sm:py-3 shadow-2xl font-mono clip-val-panel"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECE8E1]/15 pb-1.5 sm:pb-2">
              <div className="flex items-center gap-2">
                <span className="bg-[#FF4655] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#ECE8E1]">
                  ELIMINATED · SPECTATING
                </span>
                {spectateState.practiceRespawnIn > 0 && (
                  <span className="bg-[#17E5B8] px-2 py-0.5 text-[10px] font-black uppercase text-[#0F1923] tabular-nums">
                    RESPAWN IN {spectateState.practiceRespawnIn}S
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[#8B978F] uppercase">
                {spectateState.aliveTeammatesCount > 0
                  ? `${spectateState.aliveTeammatesCount} ALLY ALIVE`
                  : 'ROUND ENDING'}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div
                  className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center border text-base sm:text-lg font-extrabold font-display clip-val-card"
                  style={{
                    borderColor: AGENT_REGISTRY[spectateState.agentId]?.primaryColor || '#17E5B8',
                    color: AGENT_REGISTRY[spectateState.agentId]?.primaryColor || '#17E5B8',
                    backgroundColor: '#18232E',
                  }}
                >
                  {spectateState.targetName[0] || 'A'}
                </div>
                <div>
                  <div className="font-display text-sm sm:text-base font-extrabold uppercase text-[#ECE8E1]">
                    {spectateState.targetName}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-[#8B978F]">
                    {AGENT_REGISTRY[spectateState.agentId]?.name ?? spectateState.agentId} ·{' '}
                    <span className="text-[#17E5B8] font-bold">{spectateState.hp} HP</span> ·{' '}
                    <span className="text-[#ECE8E1] font-bold">{spectateState.armor} AP</span> ·{' '}
                    <span className="text-[#ECE8E1]">{spectateState.weaponName}</span> ({spectateState.ammoInMag}/{spectateState.reserveAmmo})
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onSpectatePrev}
                  className="min-h-10 border border-[#ECE8E1]/20 bg-[#18232E] px-3 py-1.5 text-[11px] font-bold uppercase text-[#ECE8E1] hover:border-[#17E5B8] cursor-pointer clip-val-card"
                >
                  ◀ PREV
                </button>
                <button
                  type="button"
                  onClick={onToggleSpectateMode}
                  className="min-h-10 border border-[#17E5B8]/60 bg-[#17E5B8]/15 px-3 py-1.5 text-[11px] font-black uppercase text-[#17E5B8] hover:bg-[#17E5B8]/25 cursor-pointer clip-val-card"
                >
                  {spectateState.mode === 'THIRD_PERSON' ? '3P CAM' : '1P CAM'}
                </button>
                <button
                  type="button"
                  onClick={onSpectateNext}
                  className="min-h-10 border border-[#ECE8E1]/20 bg-[#18232E] px-3 py-1.5 text-[11px] font-bold uppercase text-[#ECE8E1] hover:border-[#17E5B8] cursor-pointer clip-val-card"
                >
                  NEXT ▶
                </button>
              </div>
            </div>

            {!isMobile && (
              <div className="mt-2 text-[10px] text-[#8B978F] uppercase tracking-wider">
                Controls: [A / ←] Prev · [D / → / Click] Next · [V / Space] Toggle 3P/1P Camera
              </div>
            )}
          </div>
        </div>
      ) : isMobile ? (
        /* Compact bottom-center strip for mobile */
        <div className="pointer-events-none mx-auto mb-0.5 flex items-center gap-2.5 border border-[#ECE8E1]/20 bg-[#0F1923]/92 px-3 py-1.5 shadow-2xl font-mono clip-val-card">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase text-[#8B978F]">HP</span>
            <span className={`text-lg font-black tabular-nums leading-none ${hp > 30 ? 'text-[#ECE8E1]' : 'text-[#FF4655]'}`}>
              {hp}
            </span>
          </div>
          <div className="h-4 w-px bg-[#ECE8E1]/15" />
          <div className="flex items-center gap-1">
            <span className="text-[9px] uppercase text-[#8B978F]">AP</span>
            <span className="text-sm font-black text-[#17E5B8] tabular-nums leading-none">{armor}</span>
          </div>
          <div className="h-4 w-px bg-[#ECE8E1]/15" />
          <span className="text-xs font-bold text-[#17E5B8] tabular-nums leading-none">
            ${credits.toLocaleString()}
          </span>
          <div className="h-4 w-px bg-[#ECE8E1]/15" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-bold uppercase text-[#ECE8E1] max-w-[74px] truncate">{weapon.name}</span>
            {isReloading ? (
              <span className="text-[10px] font-bold text-[#FF4655] uppercase animate-pulse">RLD</span>
            ) : (
              <span className={`text-sm font-black tabular-nums leading-none ${ammoInMag <= 4 ? 'text-[#FF4655]' : 'text-[#ECE8E1]'}`}>
                {ammoInMag}<span className="text-[10px] font-normal text-[#8B978F]">/{reserveAmmo}</span>
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-end justify-between">
          {/* Vitality & Armor */}
          <div className="flex items-center gap-3 border border-[#ECE8E1]/15 bg-[#0F1923]/92 p-3 shadow-2xl clip-val-card">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] font-mono uppercase text-[#8B978F]">HP</span>
                <span className={`font-display text-4xl font-extrabold leading-none tabular-nums ${hp > 30 ? 'text-[#ECE8E1]' : 'text-[#FF4655]'}`}>
                  {hp}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-28 overflow-hidden bg-[#18232E]">
                <div
                  className={`h-full transition-all duration-150 ${hp > 30 ? 'bg-[#17E5B8]' : 'bg-[#FF4655]'}`}
                  style={{ width: `${Math.max(0, hp)}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col border-l border-[#ECE8E1]/15 pl-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] font-mono uppercase text-[#8B978F]">SHIELD</span>
                <span className="font-display text-3xl font-extrabold leading-none text-[#17E5B8] tabular-nums">{armor}</span>
              </div>
              <div className="mt-1 h-1.5 w-20 overflow-hidden bg-[#18232E]">
                <div
                  className="h-full bg-[#17E5B8] transition-all duration-150"
                  style={{ width: `${Math.min(100, (armor / 50) * 100)}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col border-l border-[#ECE8E1]/15 pl-3">
              <span className="text-[10px] font-mono uppercase text-[#8B978F]">CREDITS</span>
              <span className="font-mono text-base font-bold text-[#17E5B8] tabular-nums">
                ${credits.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Center: Live Agent Abilities Bar */}
          <div className="pointer-events-auto flex items-center gap-2 border border-[#ECE8E1]/15 bg-[#0F1923]/92 p-2 shadow-2xl clip-val-card">
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
                  className={`relative flex flex-col items-center justify-center border px-1.5 py-1 w-[72px] h-16 transition cursor-pointer clip-val-card ${
                    !hasCharge || onCd
                      ? 'border-[#ECE8E1]/10 bg-[#18232E]/50 text-[#8B978F]'
                      : ab.isUltimate
                        ? 'border-[#FF4655] bg-[#FF4655]/15 text-[#ECE8E1] hover:bg-[#FF4655]/25'
                        : 'border-[#ECE8E1]/25 bg-[#18232E] text-[#ECE8E1] hover:border-[#17E5B8]'
                  }`}
                  style={hasCharge && !onCd && !ab.isUltimate ? { borderColor: `${agent.primaryColor}99` } : undefined}
                >
                  <span
                    className="font-mono text-[11px] font-black leading-none"
                    style={{ color: ab.isUltimate ? '#FF4655' : agent.primaryColor }}
                  >
                    [{ab.keySlot}]
                  </span>
                  <span className="text-[9px] font-bold uppercase truncate max-w-full text-center mt-1 leading-none">
                    {ab.name.split(' ')[0]}
                  </span>
                  {onCd ? (
                    <span className="text-[9px] font-mono font-bold text-[#fbbf24] mt-1 leading-none">
                      {Math.ceil(st!.cooldownRemaining)}s
                    </span>
                  ) : ab.isUltimate ? (
                    <span className="text-[9px] font-mono font-bold whitespace-nowrap mt-1 leading-none">
                      {isUltReady ? 'READY' : `${st?.ultPoints ?? 0}/${st?.ultRequired ?? 5}`}
                    </span>
                  ) : (
                    <div className="flex gap-1 mt-1">
                      {[...Array(ab.maxCharges)].map((_, idx) => (
                        <span
                          key={idx}
                          className={`h-1.5 w-2.5 ${
                            idx < (st?.charges ?? 0) ? 'bg-[#17E5B8]' : 'bg-[#0F1923]'
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
          <div className="pointer-events-auto flex items-center gap-3 sm:gap-4 border border-[#ECE8E1]/15 bg-[#0F1923]/92 p-2.5 sm:p-3 shadow-2xl clip-val-card">
            {hasPrimaryWeapon && (
              <div className="hidden sm:flex flex-col gap-1 border-r border-[#ECE8E1]/15 pr-3 font-mono text-[10px]">
                <button
                  onClick={() => onSwitchWeapon(1)}
                  className={`px-1.5 py-0.5 text-left font-bold cursor-pointer ${
                    activeSlot === 1
                      ? 'bg-[#FF4655]/20 text-[#ECE8E1] border border-[#FF4655]/60'
                      : 'text-[#8B978F] hover:text-[#ECE8E1]'
                  }`}
                >
                  [1] PRIMARY
                </button>
                <button
                  onClick={() => onSwitchWeapon(2)}
                  className={`px-1.5 py-0.5 text-left font-bold cursor-pointer ${
                    activeSlot === 2
                      ? 'bg-[#FF4655]/20 text-[#ECE8E1] border border-[#FF4655]/60'
                      : 'text-[#8B978F] hover:text-[#ECE8E1]'
                  }`}
                >
                  [2] SIDEARM
                </button>
              </div>
            )}

            <div className="text-right">
              <div className="text-[9px] sm:text-[10px] font-mono uppercase text-[#8B978F]">{weapon.category}</div>
              <div className="font-display font-extrabold uppercase tracking-wide text-sm sm:text-lg text-[#ECE8E1]">
                {weapon.name}
              </div>
            </div>

            <div className="border-l border-[#ECE8E1]/15 pl-3 sm:pl-4 text-right">
              {isReloading ? (
                <span className="font-mono text-xs sm:text-sm font-bold text-[#FF4655] uppercase animate-pulse">
                  RELOAD...
                </span>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span
                    className={`font-display text-3xl sm:text-4xl font-extrabold leading-none tabular-nums ${
                      ammoInMag <= 4 ? 'text-[#FF4655]' : 'text-[#ECE8E1]'
                    }`}
                  >
                    {ammoInMag}
                  </span>
                  <span className="font-mono text-xs sm:text-sm text-[#8B978F] tabular-nums">/ {reserveAmmo}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
