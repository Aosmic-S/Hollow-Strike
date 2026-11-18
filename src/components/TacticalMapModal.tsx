/**
 * Hollow Strike - Fullscreen Tactical Map Overview Modal
 * Displays complete 2D map layout, site A & B zones, chokepoints, player position, and spike.
 */

import React, { useEffect, useState } from 'react';
import { TeamSide } from '../game/types';
import { BOMB_SITE_A, BOMB_SITE_B, MAP_COLLIDERS } from '../game/mapData';
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
    const id = window.setInterval(() => setTick((t) => t + 1), 120);
    return () => window.clearInterval(id);
  }, []);

  const mapSize = 92;
  const canvasSize = 420;
  const scale = canvasSize / mapSize;
  const center = canvasSize / 2;

  const toCanvasX = (wx: number) => center + wx * scale;
  const toCanvasY = (wz: number) => center + wz * scale;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 select-none">
      <div className="relative flex flex-col items-center rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl max-h-[95dvh] overflow-y-auto">
        <div className="flex w-full items-center justify-between border-b border-slate-800 pb-3 mb-4 gap-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            <h2 className="font-mono text-base font-black uppercase text-white">TACTICAL MAP OVERVIEW</h2>
          </div>

          <button
            onClick={onClose}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 font-mono text-xs font-bold uppercase text-slate-300 hover:text-white transition cursor-pointer"
          >
            Close [M / Esc]
          </button>
        </div>

        {/* Tactical Map SVG Projection */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-[#090f1e] p-2 shadow-2xl">
          <svg width={canvasSize} height={canvasSize} viewBox={`0 0 ${canvasSize} ${canvasSize}`} className="block max-w-full h-auto">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width={canvasSize} height={canvasSize} fill="url(#grid)" />

            {/* Map Colliders / Structures */}
            {MAP_COLLIDERS.map((c, i) => {
              const x = toCanvasX(c.minX);
              const y = toCanvasY(c.minZ);
              const w = (c.maxX - c.minX) * scale;
              const h = (c.maxZ - c.minZ) * scale;
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="#1e293b"
                  stroke="#334155"
                  strokeWidth="1"
                  rx="2"
                />
              );
            })}

            {/* Bomb Site A */}
            <circle
              cx={toCanvasX(BOMB_SITE_A.x)}
              cy={toCanvasY(BOMB_SITE_A.z)}
              r={BOMB_SITE_A.radius * scale}
              fill="rgba(6, 182, 212, 0.25)"
              stroke="#06b6d4"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
            <text
              x={toCanvasX(BOMB_SITE_A.x)}
              y={toCanvasY(BOMB_SITE_A.z) + 4}
              fill="#06b6d4"
              fontSize="14"
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
            >
              SITE A
            </text>

            {/* Bomb Site B */}
            <circle
              cx={toCanvasX(BOMB_SITE_B.x)}
              cy={toCanvasY(BOMB_SITE_B.z)}
              r={BOMB_SITE_B.radius * scale}
              fill="rgba(245, 158, 11, 0.25)"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
            <text
              x={toCanvasX(BOMB_SITE_B.x)}
              y={toCanvasY(BOMB_SITE_B.z) + 4}
              fill="#f59e0b"
              fontSize="14"
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
            >
              SITE B
            </text>

            {/* Combatants */}
            {allCombatants.map((c) => {
              if (!c.alive) return null;
              const isAlly = c.team === playerTeam;
              const dist = playerCombatant.position.distanceTo(c.position);
              const isRevealed = revealedEnemyIds?.has(c.id);
              if (!isAlly && dist >= 32 && !isRevealed) return null;

              const cx = toCanvasX(c.position.x);
              const cy = toCanvasY(c.position.z);

              return (
                <g key={c.id}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={c.isHuman ? 7 : 5}
                    fill={isAlly ? (c.isHuman ? '#38bdf8' : '#22c55e') : '#ef4444'}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  {c.isHuman && (
                    <line
                      x1={cx}
                      y1={cy}
                      x2={cx - Math.sin(c.yaw) * 18}
                      y2={cy - Math.cos(c.yaw) * 18}
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}
                </g>
              );
            })}

            {/* Spike Icon */}
            {spikePosition && spikeState === 'planted' && (
              <g>
                <circle
                  cx={toCanvasX(spikePosition.x)}
                  cy={toCanvasY(spikePosition.z)}
                  r="8"
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <text
                  x={toCanvasX(spikePosition.x)}
                  y={toCanvasY(spikePosition.z) + 3}
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  ⚡
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-6 font-mono text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-sky-400" />
            <span>You</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-emerald-500" />
            <span>Teammate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            <span>Spotted Hostile</span>
          </div>
        </div>
      </div>
    </div>
  );
};
