/**
 * Hollow Strike - Pre-Match 5v5 Versus Loading Screen
 * Mirrored Defending (Teal) vs Attacking (Crimson) tactical squad cards,
 * centered VS diamond emblem, atmospheric Courtyard map backdrop, and live deploy countdown.
 */

import React, { useEffect, useRef, useState } from 'react';
import { resolveMapDef } from '../game/mapData';
import { AGENT_REGISTRY, MatchMode, TeamSide } from '../game/types';
import {
  AgentEmblemMark,
  AgentPortraitTile,
  getAgentTitleLabel,
  getMapArtwork,
  getPlayerCardArt,
} from './AgentAvatar';

export interface PreMatchPlayer {
  id: string;
  name: string;
  agentId: string;
  team: TeamSide;
  isLocalPlayer: boolean;
  isHuman: boolean;
  titleLabel?: string;
}

interface PreMatchScreenProps {
  mode: MatchMode;
  mapId?: string;
  playerTeam: TeamSide;
  defenders: PreMatchPlayer[];
  attackers: PreMatchPlayer[];
  durationSeconds?: number;
  onDeployNow: () => void;
}

const MODE_SUBTITLE: Record<MatchMode, string> = {
  CUSTOM: 'MULTIPLAYER 5V5',
  COMPETITIVE: 'COMPETITIVE // PLANT & DEFUSE',
  SKIRMISH: 'SKIRMISH // TACTICAL AI',
  PRACTICE: 'PRACTICE RANGE',
};

export const PreMatchScreen: React.FC<PreMatchScreenProps> = ({
  mode,
  mapId,
  playerTeam,
  defenders,
  attackers,
  durationSeconds = 3.2,
  onDeployNow,
}) => {
  const activeMap = resolveMapDef(mapId);
  const [remainingMs, setRemainingMs] = useState<number>(Math.round(durationSeconds * 1000));
  const deployRef = useRef(onDeployNow);
  deployRef.current = onDeployNow;

  useEffect(() => {
    const totalMs = Math.round(durationSeconds * 1000);
    const started = performance.now();

    const interval = window.setInterval(() => {
      const elapsed = performance.now() - started;
      const next = Math.max(0, totalMs - elapsed);
      setRemainingMs(next);
      if (next <= 0) {
        window.clearInterval(interval);
        deployRef.current();
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, [durationSeconds]);

  const progressPct = Math.min(
    100,
    Math.max(0, Math.round((1 - remainingMs / (durationSeconds * 1000)) * 100))
  );
  const secondsLeft = Math.max(1, Math.ceil(remainingMs / 1000));

  const defenderSlots: (PreMatchPlayer | null)[] = Array.from({ length: 5 }, (_, i) => defenders[i] ?? null);
  const attackerSlots: (PreMatchPlayer | null)[] = Array.from({ length: 5 }, (_, i) => attackers[i] ?? null);

  return (
    <div
      data-testid="prematch-screen"
      className="fixed inset-0 z-40 flex flex-col justify-between overflow-y-auto overflow-x-hidden bg-[#0A1118] text-[#ECE8E1] select-none"
    >
      {/* Full-bleed Atmospheric Map Backdrop */}
      <img
        src={getMapArtwork(activeMap.id)}
        alt={`${activeMap.name} Arena`}
        className="pointer-events-none fixed inset-0 h-full w-full object-cover object-center opacity-55 scale-[1.02]"
      />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(15,25,35,0.42)_0%,_rgba(8,13,20,0.88)_75%,_rgba(6,10,16,0.96)_100%)]" />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#080E16]/85 via-transparent to-[#080E16]/90" />

      {/* Top-Right Rotated Studio Emblem Crest */}
      <div className="pointer-events-none fixed top-4 right-5 z-20 hidden sm:flex items-center gap-3 opacity-85">
        <div className="flex h-10 w-10 rotate-45 items-center justify-center border border-[#ECE8E1]/30 bg-[#0F1923]/75 backdrop-blur-sm">
          <img
            src="/assets/aistudio/IMG_20260612_142121_950_4842057d.webp"
            alt="AosmiC Studio"
            className="h-6 w-6 -rotate-45 object-contain mix-blend-screen"
          />
        </div>
      </div>

      {/* TOP CENTER HEADER: MAP NAME + MODE + DEPLOY PROGRESS */}
      <header className="relative z-10 flex flex-col items-center pt-4 sm:pt-6 pb-2 px-4 text-center shrink-0">
        <span className="font-mono text-[10px] tracking-[0.28em] text-[#8B978F] uppercase">
          {activeMap.sector} · YOUR SIDE:{' '}
          <span className={playerTeam === 'DEFENDERS' ? 'text-[#17E5B8]' : 'text-[#FF4655]'}>
            {playerTeam}
          </span>
        </span>
        <h1 className="mt-0.5 font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold uppercase tracking-[0.14em] text-[#ECE8E1] leading-none drop-shadow-[0_4px_18px_rgba(0,0,0,0.75)]">
          {activeMap.name.toUpperCase()}
        </h1>
        <div className="mt-1 font-display text-xs sm:text-sm font-bold uppercase tracking-[0.26em] text-[#ECE8E1]/75">
          {MODE_SUBTITLE[mode]}
        </div>

        {/* Sleek Inline Deploy Progress Bar */}
        <div className="mt-2.5 flex items-center gap-3">
          <div className="h-1 w-32 sm:w-44 bg-[#ECE8E1]/15 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#17E5B8] to-[#FF4655] transition-all duration-75"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#8B978F] tabular-nums">
            DEPLOY {secondsLeft}S
          </span>
          <button
            type="button"
            data-testid="prematch-deploy-btn"
            onClick={onDeployNow}
            className="border border-[#ECE8E1]/30 bg-[#18232E]/90 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ECE8E1] hover:border-[#FF4655] hover:bg-[#FF4655] transition cursor-pointer clip-val-card"
          >
            DEPLOY NOW &gt;&gt;
          </button>
        </div>
      </header>

      {/* MAIN VERSUS GRID: DEFENDING (LEFT) vs ATTACKING (RIGHT) */}
      <main className="relative z-10 mx-auto my-auto flex w-full max-w-[1360px] flex-1 items-center justify-center px-3 sm:px-6 lg:px-10 py-2">
        <div className="relative grid w-full grid-cols-1 lg:grid-cols-[1fr_110px_1fr] items-center gap-4 lg:gap-0">
          {/* LEFT COLUMN: DEFENDING (TEAL) */}
          <section className="flex flex-col">
            <div className="mb-2 flex items-center justify-between border-b border-[#17E5B8]/40 pb-1 px-1">
              <span className="font-display text-sm sm:text-base font-extrabold uppercase tracking-[0.28em] text-[#17E5B8]">
                DEFENDING
              </span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#8B978F]">
                {defenders.length}/5 ACTIVE
              </span>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              {defenderSlots.map((player, idx) => {
                if (!player) {
                  return (
                    <div
                      key={`def-empty-${idx}`}
                      className="flex h-14 sm:h-[68px] items-center justify-between border border-[#ECE8E1]/10 bg-[#0D151F]/70 px-3 opacity-55"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 border border-[#ECE8E1]/15 bg-[#121D2B] flex items-center justify-center font-mono text-[10px] text-[#8B978F]">
                          --
                        </div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#8B978F]">
                          STANDBY SLOT
                        </span>
                      </div>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-[#8B978F]/70">
                        HUMANS ONLY
                      </span>
                    </div>
                  );
                }

                const agent = AGENT_REGISTRY[player.agentId] || AGENT_REGISTRY.KAEL;
                const artUrl = getPlayerCardArt(agent.id, idx);
                const titleText =
                  player.titleLabel || getAgentTitleLabel(agent.id, player.isLocalPlayer, !player.isHuman);

                return (
                  <div
                    key={player.id}
                    data-testid={`prematch-def-${idx}`}
                    className={`group relative flex h-16 sm:h-[74px] overflow-hidden border transition ${
                      player.isLocalPlayer
                        ? 'border-[#17E5B8] shadow-[0_0_24px_rgba(23,229,184,0.22)]'
                        : 'border-[#ECE8E1]/20'
                    } bg-[#0D1621]/95`}
                  >
                    {/* Teal Outer Edge Accent */}
                    <div className="w-1.5 shrink-0 bg-[#17E5B8]" />

                    {/* Outer Left Agent Portrait */}
                    <div className="w-14 sm:w-[70px] shrink-0 border-r border-[#ECE8E1]/15">
                      <AgentPortraitTile agentId={agent.id} teamColor="#17E5B8" />
                    </div>

                    {/* Right Banner Strip + Nameplate */}
                    <div className="relative flex flex-1 flex-col justify-between overflow-hidden">
                      {/* Card Art Top Strip */}
                      <div className="relative flex flex-1 items-center justify-end overflow-hidden px-3">
                        <img
                          src={artUrl}
                          alt={agent.name}
                          className="absolute inset-0 h-full w-full object-cover object-center opacity-75"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-[#0D1621]/80 via-[#0D1621]/35 to-[#0D1621]/80" />
                        <span className="relative z-10 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#ECE8E1]/90 drop-shadow">
                          {titleText}
                        </span>
                      </div>

                      {/* Dark Bottom Nameplate */}
                      <div className="relative z-10 flex h-6 sm:h-7 items-center justify-between border-t border-[#ECE8E1]/15 bg-[#090F17]/95 px-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`font-display text-xs sm:text-sm font-extrabold uppercase tracking-wider truncate ${
                              player.isLocalPlayer ? 'text-[#17E5B8]' : 'text-[#ECE8E1]'
                            }`}
                          >
                            {player.name}
                          </span>
                          {player.isLocalPlayer && (
                            <span className="font-mono text-[9px] font-bold uppercase text-[#FBBF24]">
                              YOU
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#8B978F]">
                          {agent.name}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* CENTER FLOATING ROTATED DIAMOND VS EMBLEM */}
          <div className="hidden lg:flex items-center justify-center relative">
            <div className="relative flex h-24 w-24 rotate-45 items-center justify-center border border-[#ECE8E1]/35 bg-[#0F1923]/75 backdrop-blur-md shadow-[0_0_40px_rgba(0,0,0,0.65)]">
              <div className="absolute inset-1.5 border border-[#ECE8E1]/15" />
              <span className="-rotate-45 font-display text-3xl font-extrabold italic tracking-wider text-[#ECE8E1]">
                VS
              </span>
            </div>
          </div>

          {/* RIGHT COLUMN: ATTACKING (CRIMSON) */}
          <section className="flex flex-col">
            <div className="mb-2 flex items-center justify-between border-b border-[#FF4655]/45 pb-1 px-1">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#8B978F]">
                {attackers.length}/5 ACTIVE
              </span>
              <span className="font-display text-sm sm:text-base font-extrabold uppercase tracking-[0.28em] text-[#FF4655]">
                ATTACKING
              </span>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              {attackerSlots.map((player, idx) => {
                if (!player) {
                  return (
                    <div
                      key={`att-empty-${idx}`}
                      className="flex h-14 sm:h-[68px] items-center justify-between border border-[#ECE8E1]/10 bg-[#0D151F]/70 px-3 opacity-55"
                    >
                      <span className="font-mono text-[9px] uppercase tracking-widest text-[#8B978F]/70">
                        HUMANS ONLY
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#8B978F]">
                          STANDBY SLOT
                        </span>
                        <div className="h-9 w-9 border border-[#ECE8E1]/15 bg-[#121D2B] flex items-center justify-center font-mono text-[10px] text-[#8B978F]">
                          --
                        </div>
                      </div>
                    </div>
                  );
                }

                const agent = AGENT_REGISTRY[player.agentId] || AGENT_REGISTRY.KAEL;
                const artUrl = getPlayerCardArt(agent.id, idx + 1);
                const titleText =
                  player.titleLabel || getAgentTitleLabel(agent.id, player.isLocalPlayer, !player.isHuman);

                return (
                  <div
                    key={player.id}
                    data-testid={`prematch-att-${idx}`}
                    className={`group relative flex h-16 sm:h-[74px] overflow-hidden border transition ${
                      player.isLocalPlayer
                        ? 'border-[#FF4655] shadow-[0_0_24px_rgba(255,70,85,0.24)]'
                        : 'border-[#ECE8E1]/20'
                    } bg-[#0D1621]/95`}
                  >
                    {/* Left Banner Strip + Nameplate */}
                    <div className="relative flex flex-1 flex-col justify-between overflow-hidden">
                      {/* Card Art Top Strip */}
                      <div className="relative flex flex-1 items-center justify-start overflow-hidden px-3">
                        <img
                          src={artUrl}
                          alt={agent.name}
                          className="absolute inset-0 h-full w-full object-cover object-center opacity-75"
                        />
                        <div className="absolute inset-0 bg-gradient-to-l from-[#0D1621]/80 via-[#0D1621]/35 to-[#0D1621]/80" />
                        <span className="relative z-10 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#ECE8E1]/90 drop-shadow">
                          {titleText}
                        </span>
                      </div>

                      {/* Dark Bottom Nameplate */}
                      <div className="relative z-10 flex h-6 sm:h-7 items-center justify-between border-t border-[#ECE8E1]/15 bg-[#090F17]/95 px-3">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#8B978F]">
                          {agent.name}
                        </span>
                        <div className="flex items-center gap-2 min-w-0">
                          {player.isLocalPlayer && (
                            <span className="font-mono text-[9px] font-bold uppercase text-[#FBBF24]">
                              YOU
                            </span>
                          )}
                          <span
                            className={`font-display text-xs sm:text-sm font-extrabold uppercase tracking-wider truncate ${
                              player.isLocalPlayer ? 'text-[#FF4655]' : 'text-[#ECE8E1]'
                            }`}
                          >
                            {player.name}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Outer Right Agent Portrait */}
                    <div className="w-14 sm:w-[70px] shrink-0 border-l border-[#ECE8E1]/15">
                      <AgentPortraitTile agentId={agent.id} teamColor="#FF4655" />
                    </div>

                    {/* Crimson Outer Edge Accent */}
                    <div className="w-1.5 shrink-0 bg-[#FF4655]" />
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      {/* BOTTOM-LEFT STUDIO WATERMARK FOOTER */}
      <footer className="relative z-10 flex items-center justify-between px-5 sm:px-8 pb-3 pt-1 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center border border-[#FF4655]/60 bg-[#FF4655]/15">
            <AgentEmblemMark agentId="KAEL" accentColor="#FF4655" className="h-4 w-4" />
          </div>
          <span className="font-display text-sm font-extrabold uppercase tracking-[0.22em] text-[#ECE8E1]">
            HOLLOW STRIKE
          </span>
          <span className="text-[#ECE8E1]/30">|</span>
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#FF4655]">
            AOSMIC STUDIO
          </span>
        </div>

        <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.2em] text-[#8B978F]">
          FIRST TO 13 ROUNDS · SWAP SIDES AT ROUND 12
        </span>
      </footer>
    </div>
  );
};
