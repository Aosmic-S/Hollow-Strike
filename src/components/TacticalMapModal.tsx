/**
 * Hollow Strike - Valorant-Style Fullscreen Tactical Map Overview Modal
 * Crisp two-tier blueprint grid, shaded A/B plant sites, architectural wall vs waist-cover separation,
 * directional Ally chevrons, spotted Enemy diamonds, FOV cone, and prominent Spike indicator.
 */

import React, { useEffect, useState } from 'react';
import { TRAINING_ZONES, TeamSide } from '../game/types';
import { isTdmMap } from '../game/rules';
import {
  BOMB_SITE_A,
  BOMB_SITE_B,
  MAP_HALF_EXTENT,
  SPAWN_ATTACKERS,
  SPAWN_DEFENDERS,
  getActiveMapColliders,
  getActiveMapDef,
  getExtractedWallColliders,
  subscribeMapColliders,
} from '../game/mapData';
import { BotCombatant } from '../game/botAI';

interface TacticalMapModalProps {
  playerCombatant: BotCombatant;
  allCombatants: BotCombatant[];
  spikePosition: { x: number; z: number } | null;
  spikeState: 'not_planted' | 'planted' | 'defused' | 'detonated';
  playerTeam: TeamSide;
  revealedEnemyIds?: Map<string, number>;
  onClose: () => void;
}

export const TacticalMapModal: React.FC<TacticalMapModalProps> = ({
  playerCombatant,
  allCombatants,
  spikePosition,
  spikeState,
  playerTeam,
  revealedEnemyIds,
  onClose,
}) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 100);
    const unsub = subscribeMapColliders(() => setTick((t) => t + 1));
    return () => {
      window.clearInterval(id);
      unsub();
    };
  }, []);

  const activeDef = getActiveMapDef();
  const hideSpike = isTdmMap(activeDef);
  const isTraining = Boolean(activeDef.isTrainingMap);
  const mapSize = MAP_HALF_EXTENT * 2;
  const canvasSize = 460;
  const scale = canvasSize / mapSize;
  const center = canvasSize / 2;

  const toCanvasX = (wx: number) => center + wx * scale;
  const toCanvasY = (wz: number) => center + wz * scale;

  const activeColliders = getActiveMapColliders();
  const extractedCount = getExtractedWallColliders().length;
  const spikeCarrier = !hideSpike
    ? allCombatants.find((c) => c.alive && c.hasSpike && c.team === playerTeam)
    : undefined;

  return (
    <div
      data-testid="tactical-map-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A1118]/92 p-2 sm:p-4 select-none"
    >
      <div className="relative flex w-full max-w-[min(96vw,580px)] flex-col items-center border border-[#ECE8E1]/20 bg-[#121D28] p-3 sm:p-5 shadow-2xl max-h-[95dvh] overflow-y-auto clip-val-panel">
        <div className="flex w-full items-center justify-between border-b border-[#ECE8E1]/15 pb-2.5 sm:pb-3 mb-3 sm:mb-4 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-2.5 w-2.5 shrink-0 rotate-45 bg-[#17E5B8]" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-base sm:text-lg font-extrabold uppercase tracking-wider text-[#ECE8E1]">
                  {activeDef.name} — TACTICAL MAP
                </h2>
                {hideSpike && (
                  <span className="bg-[#FF4655]/25 border border-[#FF4655]/60 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-[#FF4655]">
                    TDM ARENA · NO SPIKE
                  </span>
                )}
                {!hideSpike && spikeState === 'planted' && (
                  <span className="animate-pulse bg-[#FF4655] px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-[#ECE8E1]">
                    SPIKE PLANTED
                  </span>
                )}
              </div>
              <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-wider text-[#8B978F]">
                {extractedCount > 0 ? `3D Geometry Sync · ${extractedCount} Solids` : 'Arena Sector Grid'} ·{' '}
                {isTraining
                  ? 'Training Island Blueprint'
                  : playerTeam === 'ATTACKERS'
                    ? 'Attacking Side'
                    : 'Defending Side'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden bg-[#FF4655] px-3 py-1.5 font-display text-[11px] font-extrabold uppercase tracking-widest text-[#ECE8E1] hover:bg-[#ff5a68] transition cursor-pointer clip-val-btn"
            >
              ← BACK
            </button>
            <button
              type="button"
              onClick={onClose}
              className="hidden sm:block border border-[#ECE8E1]/20 bg-[#0F1923] px-3 py-1.5 font-mono text-xs font-bold uppercase text-[#ECE8E1] hover:border-[#FF4655] hover:text-[#FF4655] transition cursor-pointer clip-val-card"
            >
              Close [M / Esc]
            </button>
          </div>
        </div>

        {/* Responsive Valorant Blueprint SVG Projection */}
        <div className="relative w-full max-w-[min(64dvh,88vw,460px)] overflow-hidden border border-[#ECE8E1]/20 bg-[#0A1118] p-1 sm:p-1.5 shadow-2xl clip-val-card">
          <svg
            width={canvasSize}
            height={canvasSize}
            viewBox={`0 0 ${canvasSize} ${canvasSize}`}
            className="block w-full h-auto aspect-square"
          >
            <defs>
              {/* Two-Tier Valorant Tactical Grid */}
              <pattern id="val-grid-minor" width="23" height="23" patternUnits="userSpaceOnUse">
                <path d="M 23 0 L 0 0 0 23" fill="none" stroke="rgba(236,232,225,0.045)" strokeWidth="0.7" />
              </pattern>
              <pattern id="val-grid-major" width="92" height="92" patternUnits="userSpaceOnUse">
                <rect width="92" height="92" fill="url(#val-grid-minor)" />
                <path d="M 92 0 L 0 0 0 92" fill="none" stroke="rgba(23,229,184,0.12)" strokeWidth="1" />
              </pattern>

              {/* Site Hatched Fills */}
              <pattern id="site-a-hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(23,229,184,0.28)" strokeWidth="2.5" />
              </pattern>
              <pattern id="site-b-hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,70,85,0.28)" strokeWidth="2.5" />
              </pattern>

              <radialGradient id="player-fov-grad" cx="50%" cy="100%" r="90%">
                <stop offset="0%" stopColor="rgba(236, 232, 225, 0.34)" />
                <stop offset="60%" stopColor="rgba(23, 229, 184, 0.14)" />
                <stop offset="100%" stopColor="rgba(23, 229, 184, 0)" />
              </radialGradient>
            </defs>

            {/* Blueprint Backdrop + Major/Minor Grid */}
            <rect width={canvasSize} height={canvasSize} fill="#0A1118" />
            <rect width={canvasSize} height={canvasSize} fill="url(#val-grid-major)" />

            {/* Alphanumeric Sector Ticks */}
            {['A', 'B', 'C', 'D', 'E'].map((col, idx) => (
              <text
                key={col}
                x={idx * 92 + 46}
                y={12}
                fill="rgba(236,232,225,0.22)"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {col}
              </text>
            ))}
            {[1, 2, 3, 4, 5].map((row, idx) => (
              <text
                key={row}
                x={8}
                y={idx * 92 + 50}
                fill="rgba(236,232,225,0.22)"
                fontSize="9"
                fontFamily="monospace"
              >
                {row}
              </text>
            ))}

            {/* Bomb Site A & B (Hidden in TDM Arena, labeled Plant/Defuse Drills in Training Range) */}
            {!hideSpike && (
              <>
                <g>
                  <circle
                    cx={toCanvasX(BOMB_SITE_A.x)}
                    cy={toCanvasY(BOMB_SITE_A.z)}
                    r={BOMB_SITE_A.radius * scale}
                    fill="url(#site-a-hatch)"
                    stroke="#17E5B8"
                    strokeWidth="1.8"
                    strokeDasharray="6 3"
                  />
                  <circle
                    cx={toCanvasX(BOMB_SITE_A.x)}
                    cy={toCanvasY(BOMB_SITE_A.z)}
                    r={14}
                    fill="rgba(10, 17, 24, 0.9)"
                    stroke="#17E5B8"
                    strokeWidth="1.5"
                  />
                  <text
                    x={toCanvasX(BOMB_SITE_A.x)}
                    y={toCanvasY(BOMB_SITE_A.z) + 5}
                    fill="#17E5B8"
                    fontSize="15"
                    fontWeight="900"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    A
                  </text>
                </g>

                <g>
                  <circle
                    cx={toCanvasX(BOMB_SITE_B.x)}
                    cy={toCanvasY(BOMB_SITE_B.z)}
                    r={BOMB_SITE_B.radius * scale}
                    fill="url(#site-b-hatch)"
                    stroke="#FF4655"
                    strokeWidth="1.8"
                    strokeDasharray="6 3"
                  />
                  <circle
                    cx={toCanvasX(BOMB_SITE_B.x)}
                    cy={toCanvasY(BOMB_SITE_B.z)}
                    r={14}
                    fill="rgba(10, 17, 24, 0.9)"
                    stroke="#FF4655"
                    strokeWidth="1.5"
                  />
                  <text
                    x={toCanvasX(BOMB_SITE_B.x)}
                    y={toCanvasY(BOMB_SITE_B.z) + 5}
                    fill="#FF4655"
                    fontSize="15"
                    fontWeight="900"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    B
                  </text>
                </g>
              </>
            )}

            {/* Architectural Walls & Waist-High Cover Solids */}
            {activeColliders.map((c, i) => {
              const x = toCanvasX(c.minX);
              const y = toCanvasY(c.minZ);
              const w = Math.max(2, (c.maxX - c.minX) * scale);
              const h = Math.max(2, (c.maxZ - c.minZ) * scale);
              const isTallWall = c.maxY >= 2.0;
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill={isTallWall ? '#273849' : '#1A2735'}
                  stroke={isTallWall ? '#6E859C' : '#2E6068'}
                  strokeWidth={isTallWall ? '1.1' : '0.85'}
                  rx="0.5"
                />
              );
            })}

            {/* Attacker & Defender Spawn Zones */}
            <g>
              <rect
                x={toCanvasX(SPAWN_ATTACKERS.x) - 18}
                y={toCanvasY(SPAWN_ATTACKERS.z) - 8}
                width={36}
                height={16}
                fill="rgba(255, 70, 85, 0.14)"
                stroke="#FF4655"
                strokeWidth="1"
              />
              <text
                x={toCanvasX(SPAWN_ATTACKERS.x)}
                y={toCanvasY(SPAWN_ATTACKERS.z) + 3}
                fill="#FF4655"
                fontSize="8.5"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
              >
                ATT
              </text>
            </g>

            <g>
              <rect
                x={toCanvasX(SPAWN_DEFENDERS.x) - 18}
                y={toCanvasY(SPAWN_DEFENDERS.z) - 8}
                width={36}
                height={16}
                fill="rgba(23, 229, 184, 0.14)"
                stroke="#17E5B8"
                strokeWidth="1"
              />
              <text
                x={toCanvasX(SPAWN_DEFENDERS.x)}
                y={toCanvasY(SPAWN_DEFENDERS.z) + 3}
                fill="#17E5B8"
                fontSize="8.5"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
              >
                DEF
              </text>
            </g>

            {/* Training Range Zone Pins */}
            {isTraining &&
              TRAINING_ZONES.map((z) => (
                <g key={z.id} transform={`translate(${toCanvasX(z.x)}, ${toCanvasY(z.z)})`}>
                  <rect
                    x={-22}
                    y={-7}
                    width={44}
                    height={14}
                    rx={2}
                    fill="rgba(10, 17, 24, 0.88)"
                    stroke="rgba(56, 189, 248, 0.65)"
                    strokeWidth="0.9"
                  />
                  <text
                    y="3"
                    fill="#38bdf8"
                    fontSize="8"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {z.label.toUpperCase()}
                  </text>
                </g>
              ))}

            {/* Combatants: Allies vs Enemies */}
            {allCombatants.map((c) => {
              if (!c.alive) return null;
              const isAlly = c.team === playerTeam;
              const dist = playerCombatant.position.distanceTo(c.position);
              const isRevealed = Boolean(revealedEnemyIds?.has(c.id));
              if (!isAlly && dist >= 34 && !isRevealed) return null;

              const cx = toCanvasX(c.position.x);
              const cy = toCanvasY(c.position.z);
              const deg = (-c.yaw * 180) / Math.PI;

              if (c.isHuman) {
                return (
                  <g key={c.id} transform={`translate(${cx}, ${cy})`}>
                    {/* Player View Cone */}
                    <g transform={`rotate(${deg})`}>
                      <path d="M 0 0 L -26 -58 A 62 62 0 0 1 26 -58 Z" fill="url(#player-fov-grad)" />
                      {!hideSpike && c.hasSpike && spikeState === 'not_planted' && (
                        <circle r="11" fill="none" stroke="#FBBF24" strokeWidth="1.8" strokeDasharray="3 2" />
                      )}
                      <polygon
                        points="0,-9 6.5,6 0,2.5 -6.5,6"
                        fill="#ECE8E1"
                        stroke="#17E5B8"
                        strokeWidth="1.6"
                      />
                    </g>
                  </g>
                );
              }

              if (isAlly) {
                return (
                  <g key={c.id} transform={`translate(${cx}, ${cy})`}>
                    <g transform={`rotate(${deg})`}>
                      {!hideSpike && c.hasSpike && spikeState === 'not_planted' && (
                        <circle r="9.5" fill="none" stroke="#FBBF24" strokeWidth="1.6" strokeDasharray="3 2" />
                      )}
                      <circle r="5.2" fill="#17E5B8" stroke="#0A1118" strokeWidth="1.4" />
                      <polygon points="0,-9 3.5,-4.5 -3.5,-4.5" fill="#ECE8E1" />
                    </g>
                  </g>
                );
              }

              // Hostile Diamond Indicator
              return (
                <g key={c.id} transform={`translate(${cx}, ${cy})`}>
                  {isRevealed && <circle r="10" fill="rgba(251, 191, 36, 0.16)" stroke="#FBBF24" strokeWidth="1.3" />}
                  <polygon
                    points="0,-6.5 6.5,0 0,6.5 -6.5,0"
                    fill="#FF4655"
                    stroke={isRevealed ? '#FBBF24' : '#ECE8E1'}
                    strokeWidth="1.3"
                  />
                </g>
              );
            })}

            {/* Prominent Spike Planted Beacon */}
            {!hideSpike && spikePosition && spikeState === 'planted' && (
              <g transform={`translate(${toCanvasX(spikePosition.x)}, ${toCanvasY(spikePosition.z)})`}>
                <circle r="18" fill="rgba(255, 70, 85, 0.18)" stroke="#FF4655" strokeWidth="1.2" strokeDasharray="4 3">
                  <animate attributeName="r" values="12;20;12" dur="1.1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.25;0.9" dur="1.1s" repeatCount="indefinite" />
                </circle>
                <polygon points="0,-10 9,0 0,10 -9,0" fill="#FF4655" stroke="#ECE8E1" strokeWidth="1.8" />
                <circle r="2.6" fill="#ECE8E1" />
                <text
                  y="21"
                  fill="#ECE8E1"
                  fontSize="8.5"
                  fontWeight="900"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  SPIKE
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Tactical Map Legend */}
        <div className="mt-3 sm:mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 font-mono text-[10px] sm:text-xs text-[#ECE8E1]">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rotate-45 bg-[#ECE8E1] border border-[#17E5B8]" />
            <span>You</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#17E5B8]" />
            <span>Allies</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rotate-45 bg-[#FF4655] border border-[#ECE8E1]" />
            <span>Enemies</span>
          </div>
          {!hideSpike && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rotate-45 bg-[#FF4655] ring-2 ring-[#FBBF24]/70" />
              <span>
                Spike{spikeCarrier ? ` (${spikeCarrier.isHuman ? 'You' : spikeCarrier.name})` : ''}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 border border-[#6E859C] bg-[#273849]" />
            <span>Cover / Wall</span>
          </div>
        </div>
      </div>
    </div>
  );
};
