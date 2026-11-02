/**
 * Hollow Strike - Tactical Minimap
 * 2D Canvas-based radar projector displaying map lanes, bomb sites, teammates, and spike.
 */

import React, { useEffect, useRef } from 'react';
import { PlayerStats, TeamSide } from '../game/types';
import { BOMB_SITE_A, BOMB_SITE_B, MAP_COLLIDERS } from '../game/mapData';
import { BotCombatant } from '../game/botAI';

interface MinimapProps {
  playerCombatant: BotCombatant;
  allCombatants: BotCombatant[];
  spikePosition: { x: number; z: number } | null;
  spikeState: 'not_planted' | 'planted' | 'defused' | 'detonated';
  playerTeam: TeamSide;
}

export const Minimap: React.FC<MinimapProps> = ({
  playerCombatant,
  allCombatants,
  spikePosition,
  spikeState,
  playerTeam,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Minimap bounds: world coordinate map is ~90m x 90m (-45 to 45)
    const mapSize = 92;
    const canvasSize = 140;
    const scale = canvasSize / mapSize;
    const center = canvasSize / 2;

    const toCanvasX = (wx: number) => center + wx * scale;
    const toCanvasY = (wz: number) => center + wz * scale;

    // Background
    ctx.fillStyle = 'rgba(10, 16, 28, 0.85)';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Map colliders / walls
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;

    for (const c of MAP_COLLIDERS) {
      const x = toCanvasX(c.minX);
      const y = toCanvasY(c.minZ);
      const w = (c.maxX - c.minX) * scale;
      const h = (c.maxZ - c.minZ) * scale;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }

    // Site A Zone
    const ax = toCanvasX(BOMB_SITE_A.x);
    const ay = toCanvasY(BOMB_SITE_A.z);
    ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
    ctx.beginPath();
    ctx.arc(ax, ay, BOMB_SITE_A.radius * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#06b6d4';
    ctx.stroke();
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('A', ax - 3, ay + 3);

    // Site B Zone
    const bx = toCanvasX(BOMB_SITE_B.x);
    const by = toCanvasY(BOMB_SITE_B.z);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
    ctx.beginPath();
    ctx.arc(bx, by, BOMB_SITE_B.radius * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('B', bx - 3, by + 3);

    // Combatant Dots
    for (const c of allCombatants) {
      if (!c.alive) continue;
      const cx = toCanvasX(c.position.x);
      const cy = toCanvasY(c.position.z);
      const isAlly = c.team === playerTeam;

      if (isAlly) {
        ctx.fillStyle = c.isHuman ? '#38bdf8' : '#22c55e';
        ctx.beginPath();
        ctx.arc(cx, cy, c.isHuman ? 4.5 : 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Direction indicator for player
        if (c.isHuman) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.sin(c.yaw) * 10, cy + Math.cos(c.yaw) * 10);
          ctx.stroke();
        }
      } else {
        // Only show enemy if close or revealed
        const dist = playerCombatant.position.distanceTo(c.position);
        if (dist < 28) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Spike Icon
    if (spikePosition && spikeState === 'planted') {
      const sx = toCanvasX(spikePosition.x);
      const sy = toCanvasY(spikePosition.z);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Border
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvasSize, canvasSize);
  }, [playerCombatant, allCombatants, spikePosition, spikeState, playerTeam]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-700/80 bg-slate-950/80 shadow-2xl backdrop-blur-none pointer-events-none">
      <canvas ref={canvasRef} width={140} height={140} className="block" />
      <div className="absolute bottom-1 right-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-400">
        RADAR
      </div>
    </div>
  );
};
