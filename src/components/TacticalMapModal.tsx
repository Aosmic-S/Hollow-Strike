/**
 * Hollow Strike - Fullscreen Tactical Map Overview Modal
 * Displays real-time 2D projection synced from extracted 3D map geometry, site A & B zones, spawns, players, and spike.
 */

import React, { useEffect, useState } from 'react';
import { TeamSide } from '../game/types';
import {
  BOMB_SITE_A,
  BOMB_SITE_B,
  SPAWN_ATTACKERS,
  SPAWN_DEFENDERS,
  getActiveMapColliders,
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
    const id = window.setInterval(() => setTick((t) => t + 1), 120);
    const unsub = subscribeMapColliders(() => setTick((t) => t + 1));
    return () => {
      window.clearInterval(id);
      unsub();
    };
  }, []);

  const mapSize = 128;
  const canvasSize = 420;
  const scale = canvasSize / mapSize;
  const center = canvasSize / 2;

  const toCanvasX = (wx: number) => center + wx * scale;
  const toCanvasY = (wz: number) => center + wz * scale;

  const activeColliders = getActiveMapColliders();
  const extractedCount = getExtractedWallColliders().length;

  return (
    <div
      data-testid="tactical-map-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1923]/88 backdrop-blur-sm p-4 select-none"
    >
      <div className="relative flex flex-col items-center border border-[#ECE8E1]/20 bg-[#18232E] p-5 sm:p-6 shadow-2xl max-h-[95dvh] overflow-y-auto clip-val-panel">
        <div className="flex w-full items-center justify-between border-b border-[#ECE8E1]/15 pb-3 mb-4 gap-6">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rotate-45 bg-[#17E5B8]" />
            <div>
              <h2 className="font-display text-xl font-extrabold uppercase tracking-wider text-[#ECE8E1]">
                TACTICAL MAP OVERVIEW
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#8B978F]">
                Live Geometry Sync · {extractedCount > 0 ? `${extractedCount} 3D Wall Solids` : 'Arena Layout'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-[#FF4655] px-4 py-2 font-display text-xs font-extrabold uppercase tracking-widest text-[#ECE8E1] hover:bg-[#ff5a68] transition cursor-pointer clip-val-btn"
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

        {/* Tactical Map SVG Projection */}
        <div className="relative overflow-hidden border border-[#ECE8E1]/15 bg-[#0F1923] p-2 shadow-2xl clip-val-card">
          <svg
            width={canvasSize}
            height={canvasSize}
            viewBox={`0 0 ${canvasSize} ${canvasSize}`}
            className="block max-w-full h-auto"
          >
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#18232E" strokeWidth="0.75" />
              </pattern>
            </defs>
            <rect width={canvasSize} height={canvasSize} fill="url(#grid)" />

            {/* Live Map Colliders / Structures */}
            {activeColliders.map((c, i) => {
              const x = toCanvasX(c.minX);
              const y = toCanvasY(c.minZ);
              const w = Math.max(2, (c.maxX - c.minX) * scale);
              const h = Math.max(2, (c.maxZ - c.minZ) * scale);
              const isTallWall = c.maxY >= 2.2;
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill={isTallWall ? '#243343' : '#18232E'}
                  stroke={isTallWall ? '#5a6d80' : '#2a4d54'}
                  strokeWidth="1"
                  rx="1"
                />
              );
            })}

            {/* Attacker & Defender Spawns */}
            <g>
              <circle
                cx={toCanvasX(SPAWN_ATTACKERS.x)}
                cy={toCanvasY(SPAWN_ATTACKERS.z)}
                r={12}
                fill="rgba(255, 70, 85, 0.14)"
                stroke="#FF4655"
                strokeWidth="1"
              />
              <text
                x={toCanvasX(SPAWN_ATTACKERS.x)}
                y={toCanvasY(SPAWN_ATTACKERS.z) + 18}
                fill="#FF4655"
                fontSize="8"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
              >
                ATT SPAWN
              </text>
            </g>

            <g>
              <circle
                cx={toCanvasX(SPAWN_DEFENDERS.x)}
                cy={toCanvasY(SPAWN_DEFENDERS.z)}
                r={12}
                fill="rgba(23, 229, 184, 0.14)"
                stroke="#17E5B8"
                strokeWidth="1"
              />
              <text
                x={toCanvasX(SPAWN_DEFENDERS.x)}
                y={toCanvasY(SPAWN_DEFENDERS.z) - 13}
                fill="#17E5B8"
                fontSize="8"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
              >
                DEF SPAWN
              </text>
            </g>

            {/* Bomb Site A */}
            <circle
              cx={toCanvasX(BOMB_SITE_A.x)}
              cy={toCanvasY(BOMB_SITE_A.z)}
              r={BOMB_SITE_A.radius * scale}
              fill="rgba(23, 229, 184, 0.22)"
              stroke="#17E5B8"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
            <text
              x={toCanvasX(BOMB_SITE_A.x)}
              y={toCanvasY(BOMB_SITE_A.z) + 4}
              fill="#17E5B8"
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
              fill="rgba(255, 70, 85, 0.22)"
              stroke="#FF4655"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
            <text
              x={toCanvasX(BOMB_SITE_B.x)}
              y={toCanvasY(BOMB_SITE_B.z) + 4}
              fill="#FF4655"
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
                    fill={isAlly ? (c.isHuman ? '#ECE8E1' : '#17E5B8') : '#FF4655'}
                    stroke="#0F1923"
                    strokeWidth="1.5"
                  />
                  {c.isHuman && (
                    <line
                      x1={cx}
                      y1={cy}
                      x2={cx - Math.sin(c.yaw) * 18}
                      y2={cy - Math.cos(c.yaw) * 18}
                      stroke="#17E5B8"
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
                  fill="#FF4655"
                  stroke="#ECE8E1"
                  strokeWidth="2"
                />
                <text
                  x={toCanvasX(spikePosition.x)}
                  y={toCanvasY(spikePosition.z) + 3}
                  fill="#ECE8E1"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  !
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-5 font-mono text-xs text-[#ECE8E1]">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ECE8E1]" />
            <span>You</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#17E5B8]" />
            <span>Teammate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#FF4655]" />
            <span>Spotted Hostile</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 border border-[#5a6d80] bg-[#243343]" />
            <span>Building Wall</span>
          </div>
        </div>
      </div>
    </div>
  );
};
