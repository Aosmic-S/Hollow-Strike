/**
 * Hollow Strike - Tactical Minimap
 * 2D Canvas-based radar projector displaying map lanes, bomb sites, teammates, revealed enemies, and spike.
 */

import React, { useEffect, useRef } from 'react';
import { TeamSide } from '../game/types';
import { BOMB_SITE_A, BOMB_SITE_B, MAP_COLLIDERS } from '../game/mapData';
import { BotCombatant } from '../game/botAI';

interface MinimapProps {
  playerCombatant: BotCombatant;
  allCombatants: BotCombatant[];
  spikePosition: { x: number; z: number } | null;
  spikeState: 'not_planted' | 'planted' | 'defused' | 'detonated';
  playerTeam: TeamSide;
  revealedEnemyIds?: Map<string, number>;
  compact?: boolean;
}

export const Minimap: React.FC<MinimapProps> = ({
  playerCombatant,
  allCombatants,
  spikePosition,
  spikeState,
  playerTeam,
  revealedEnemyIds,
  compact = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasSize = compact ? 104 : 140;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mapSize = 92;
    const scale = canvasSize / mapSize;
    const center = canvasSize / 2;

    const toCanvasX = (wx: number) => center + wx * scale;
    const toCanvasY = (wz: number) => center + wz * scale;

    const drawRadar = () => {
      ctx.fillStyle = 'rgba(15, 25, 35, 0.9)';
      ctx.fillRect(0, 0, canvasSize, canvasSize);

      // Map colliders / walls
      ctx.fillStyle = '#18232E';
      ctx.strokeStyle = 'rgba(236, 232, 225, 0.22)';
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
      ctx.fillStyle = 'rgba(23, 229, 184, 0.18)';
      ctx.beginPath();
      ctx.arc(ax, ay, BOMB_SITE_A.radius * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#17E5B8';
      ctx.stroke();
      ctx.fillStyle = '#17E5B8';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('A', ax - 3, ay + 3);

      // Site B Zone
      const bx = toCanvasX(BOMB_SITE_B.x);
      const by = toCanvasY(BOMB_SITE_B.z);
      ctx.fillStyle = 'rgba(255, 70, 85, 0.18)';
      ctx.beginPath();
      ctx.arc(bx, by, BOMB_SITE_B.radius * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FF4655';
      ctx.stroke();
      ctx.fillStyle = '#FF4655';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('B', bx - 3, by + 3);

      // Combatants
      for (const c of allCombatants) {
        if (!c.alive) continue;
        const cx = toCanvasX(c.position.x);
        const cy = toCanvasY(c.position.z);
        const isAlly = c.team === playerTeam;

        if (isAlly) {
          ctx.fillStyle = c.isHuman ? '#ECE8E1' : '#17E5B8';
          ctx.beginPath();
          ctx.arc(cx, cy, c.isHuman ? 4.2 : 3.2, 0, Math.PI * 2);
          ctx.fill();

          if (c.isHuman) {
            ctx.strokeStyle = '#17E5B8';
            ctx.lineWidth = 1.75;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx - Math.sin(c.yaw) * (compact ? 9 : 12), cy - Math.cos(c.yaw) * (compact ? 9 : 12));
            ctx.stroke();
          }
        } else {
          const dist = playerCombatant.position.distanceTo(c.position);
          const isRevealed = revealedEnemyIds?.has(c.id);
          if (dist < 28 || isRevealed) {
            ctx.fillStyle = isRevealed ? '#fbbf24' : '#FF4655';
            ctx.beginPath();
            ctx.arc(cx, cy, isRevealed ? 4 : 3.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Spike Icon
      if (spikePosition && spikeState === 'planted') {
        const sx = toCanvasX(spikePosition.x);
        const sy = toCanvasY(spikePosition.z);
        ctx.fillStyle = '#FF4655';
        ctx.beginPath();
        ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ECE8E1';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(23, 229, 184, 0.38)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvasSize, canvasSize);
    };

    drawRadar();
    const interval = window.setInterval(drawRadar, 66);
    return () => window.clearInterval(interval);
  }, [playerCombatant, allCombatants, spikePosition, spikeState, playerTeam, revealedEnemyIds, canvasSize, compact]);

  return (
    <div className="relative overflow-hidden border border-[#ECE8E1]/20 bg-[#0F1923]/90 shadow-2xl pointer-events-none clip-val-card">
      <canvas ref={canvasRef} width={canvasSize} height={canvasSize} className="block" />
      <div className="absolute bottom-0.5 right-1 font-mono text-[8px] sm:text-[9px] uppercase tracking-wider text-[#8B978F]">
        RADAR
      </div>
    </div>
  );
};
