/**
 * Hollow Strike - In-Game Tactical HUD
 * Displays minimap, score banner, kill feed, crisp X-hitmarker + damage readout,
 * interactive abilities bar with live charges/cooldowns, and weapon/ammo controls.
 */

import React from 'react';
import {
  AbilitySlotState,
  AgentDef,
  CrosshairColor,
  CrosshairSize,
  HitFeedback,
  KillEvent,
  PlayerStats,
  RoundPhase,
  WeaponDef,
} from '../game/types';
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
  isBlinded: boolean;
  isPointerLocked: boolean;
  isMobile: boolean;
  revealedEnemyIds?: Map<string, number>;
  fps: number;
  showFps: boolean;
  onTriggerAbility: (slot: 'Q' | 'E' | 'C' | 'X') => void;
  onSwitchWeapon: (slot: 1 | 2) => void;
  onSkipBuyPhase: () => void;
  onOpenBuyMenu: () => void;
  onOpenMap: () => void;
  onOpenScoreboard: () => void;
  onOpenPause: () => void;
}

const CROSSHAIR_HEX: Record<CrosshairColor, string> = {
  cyan: '#22d3ee',
  green: '#34d399',
  amber: '#fbbf24',
  white: '#f8fafc',
  rose: '#fb7185',
};

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
  isBlinded,
  isPointerLocked,
  isMobile,
  revealedEnemyIds,
  fps,
  showFps,
  onTriggerAbility,
  onSwitchWeapon,
  onSkipBuyPhase,
  onOpenBuyMenu,
  onOpenMap,
  onOpenScoreboard,
  onOpenPause,
}) => {
  const aliveAttackers = allCombatants.filter((c) => c.alive && c.team === 'ATTACKERS').length;
  const aliveDefenders = allCombatants.filter((c) => c.alive && c.team === 'DEFENDERS').length;

  const chColor = CROSSHAIR_HEX[crosshairColor] ?? '#22d3ee';
  const chLen = crosshairSize === 'small' ? 6 : crosshairSize === 'large' ? 12 : 8;
  const chGap = crosshairSize === 'small' ? 4 : crosshairSize === 'large' ? 7 : 5;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 select-none">
      {/* Incoming Damage Crimson Edge Vignette */}
      {damageFlash && (
        <div className="fixed inset-0 z-40 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_45%,rgba(220,38,38,0.52)_100%)] transition-opacity duration-150" />
      )}

      {/* Blinded Flash Overlay */}
      {isBlinded && (
        <div className="fixed inset-0 z-50 bg-white/85 pointer-events-none transition-opacity duration-300" />
      )}

      {/* Top Bar: Minimap, Score Banner, Kill Feed */}
      <div className="flex items-start justify-between">
        {/* Left: Minimap (Clickable to expand) & Team alive counters */}
        <div className="flex flex-col gap-2">
          <div
            onClick={onOpenMap}
            className="pointer-events-auto cursor-pointer hover:opacity-90 transition group relative"
            title="Click to expand Tactical Map [M]"
          >
            <Minimap
              playerCombatant={playerCombatant}
              allCombatants={allCombatants}
              spikePosition={spikePosition}
              spikeState={spikeState}
              playerTeam={playerCombatant.team}
              revealedEnemyIds={revealedEnemyIds}
            />
            <div className="absolute top-1 right-1.5 font-mono text-[8px] font-bold uppercase text-cyan-300 bg-slate-900/90 px-1 rounded">
              TAP MAP [M]
            </div>
          </div>

          <div className="flex items-center gap-3 rounded bg-slate-950/80 px-2.5 py-1 text-[11px] font-mono border border-slate-800">
            <div className="flex items-center gap-1 text-red-400">
              <span className="font-bold">ATT</span>
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-2 rounded-sm ${i < aliveAttackers ? 'bg-red-500' : 'bg-slate-800'}`}
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
                    className={`h-2 w-2 rounded-sm ${i < aliveDefenders ? 'bg-blue-500' : 'bg-slate-800'}`}
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
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-red-400 uppercase">ATT</span>
              <span className="font-mono text-xl font-black text-white tabular-nums">{attackerRoundsWon}</span>
            </div>

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
                {roundPhase === 'BUY_PHASE'
                  ? 'BUY PHASE'
                  : roundPhase === 'SPIKE_PLANTED'
                    ? 'DETONATING'
                    : roundPhase === 'ROUND_END'
                      ? 'ROUND OVER'
                      : `ROUND ${currentRound}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-black text-white tabular-nums">{defenderRoundsWon}</span>
              <span className="text-xs font-mono font-bold text-blue-400 uppercase">DEF</span>
            </div>
          </div>

          {/* Buy Phase Banner with Skip Button */}
          {roundPhase === 'BUY_PHASE' && (
            <div className="pointer-events-auto mt-1.5 flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-950/75 px-3 py-1 text-[11px] font-mono text-amber-200 shadow-lg">
              <span>BUY PHASE · WEAPONS LOCKED BEHIND BARRIER</span>
              <button
                onClick={onOpenBuyMenu}
                className="rounded border border-amber-400/60 bg-amber-500/20 px-2 py-0.5 font-bold text-amber-200 hover:bg-amber-500/40 cursor-pointer"
              >
                [B] SHOP
              </button>
              <button
                onClick={onSkipBuyPhase}
                className="rounded bg-emerald-500 px-2 py-0.5 font-black text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                START FIGHT [G]
              </button>
            </div>
          )}

          {/* Desktop aim lock hint */}
          {!isMobile && !isPointerLocked && roundPhase !== 'BUY_PHASE' && (
            <div className="mt-1.5 rounded border border-cyan-500/40 bg-slate-950/80 px-2.5 py-0.5 font-mono text-[10px] text-cyan-300">
              CLICK GAME VIEW TO LOCK AIM · OR DRAG TO LOOK
            </div>
          )}
        </div>

        {/* Right: Kill Feed & Controls */}
        <div className="flex flex-col items-end gap-2">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/80 p-1">
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
              onClick={onOpenPause}
              className="rounded px-2 py-1 text-[10px] font-mono uppercase text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            >
              Pause [Esc]
            </button>
          </div>

          <div className="flex flex-col gap-1 w-64">
            {killFeed.slice(-4).map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-end gap-1.5 rounded bg-slate-950/85 px-2 py-1 text-[11px] font-mono border border-slate-800 shadow"
              >
                <span className={k.killerTeam === 'ATTACKERS' ? 'text-red-400 font-bold' : 'text-blue-400 font-bold'}>
                  {k.killerName}
                </span>
                <span className="text-slate-400 text-[10px]">[{k.weaponName}]</span>
                {k.isHeadshot && (
                  <span className="text-amber-400 font-bold text-[10px]" title="Headshot">
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

      {/* Center Screen: Reticle, Crisp X-Hitmarker & Live Damage Popup */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative flex items-center justify-center">
          <div
            className="h-1.5 w-1.5 rounded-full opacity-95 shadow-sm"
            style={{ backgroundColor: chColor }}
          />
          <div
            className="absolute w-0.5 opacity-85"
            style={{
              backgroundColor: chColor,
              height: chLen,
              bottom: `calc(50% + ${chGap}px)`,
            }}
          />
          <div
            className="absolute w-0.5 opacity-85"
            style={{
              backgroundColor: chColor,
              height: chLen,
              top: `calc(50% + ${chGap}px)`,
            }}
          />
          <div
            className="absolute h-0.5 opacity-85"
            style={{
              backgroundColor: chColor,
              width: chLen,
              right: `calc(50% + ${chGap}px)`,
            }}
          />
          <div
            className="absolute h-0.5 opacity-85"
            style={{
              backgroundColor: chColor,
              width: chLen,
              left: `calc(50% + ${chGap}px)`,
            }}
          />

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

      {/* Bottom Row: Vitality Cluster (Left), Live Abilities Bar (Center), Weapon/Ammo (Right) */}
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
        <div className="pointer-events-auto hidden md:flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/90 p-2 shadow-2xl">
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
                className={`relative flex flex-col items-center justify-center rounded border px-2 py-1.5 w-16 h-16 transition cursor-pointer ${
                  !hasCharge || onCd
                    ? 'border-slate-800 bg-slate-900/40 text-slate-500'
                    : ab.isUltimate
                      ? 'border-amber-400 bg-amber-950/50 text-amber-200 hover:bg-amber-900/60'
                      : 'border-slate-700 bg-slate-900/90 text-slate-100 hover:border-cyan-400'
                }`}
                style={hasCharge && !onCd && !ab.isUltimate ? { borderColor: `${agent.primaryColor}88` } : undefined}
              >
                <span
                  className="font-mono text-xs font-black"
                  style={{ color: ab.isUltimate ? '#fbbf24' : agent.primaryColor }}
                >
                  [{ab.keySlot}]
                </span>
                <span className="text-[9px] font-bold uppercase truncate max-w-full text-center mt-0.5">
                  {ab.name.split(' ')[0]}
                </span>
                {onCd ? (
                  <span className="text-[9px] font-mono font-bold text-amber-400">
                    {Math.ceil(st!.cooldownRemaining)}s
                  </span>
                ) : ab.isUltimate ? (
                  <span className="text-[9px] font-mono font-bold">
                    {isUltReady ? 'ULT READY' : `${st?.ultPoints ?? 0}/${st?.ultRequired ?? 5}`}
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
        <div className="pointer-events-auto flex items-center gap-3 sm:gap-4 rounded-lg border border-slate-800 bg-slate-950/90 p-2.5 sm:p-3 shadow-2xl mb-1 sm:mb-0 mr-1 sm:mr-0">
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
    </div>
  );
};
