/**
 * Hollow Strike - Minimalist Valorant-Style Responsive Tactical Minimap
 * Player-centered smoothly rotating radar with forward FOV cone, live 3D map geometry,
 * directional teammate markers, clamped outer-rim site/spike indicators, and north compass pip.
 */

import React, { useEffect, useRef, useState } from 'react';
import { TeamSide } from '../game/types';
import {
  BOMB_SITE_A,
  BOMB_SITE_B,
  getActiveMapColliders,
  getActiveMapDef,
  subscribeMapColliders,
} from '../game/mapData';
import { worldToRadarCoord } from '../game/rules';
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
  const logicalSize = compact ? 112 : 148;
  const [colliderVersion, setColliderVersion] = useState(0);

  useEffect(() => {
    return subscribeMapColliders(() => setColliderVersion((v) => v + 1));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== logicalSize * dpr || canvas.height !== logicalSize * dpr) {
      canvas.width = logicalSize * dpr;
      canvas.height = logicalSize * dpr;
    }

    const viewRadiusMeters = compact ? 24 : 26;
    const center = logicalSize * 0.5;
    const radarRadius = center - 3;
    const scale = center / viewRadiusMeters;

    const drawRadar = () => {
      const px = playerCombatant.position.x;
      const pz = playerCombatant.position.z;
      const pyaw = playerCombatant.yaw;
      const activeDef = getActiveMapDef();
      const mapHalf = activeDef.halfExtent;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, logicalSize, logicalSize);

      // Clip cleanly to circular radar perimeter
      ctx.save();
      ctx.beginPath();
      ctx.arc(center, center, radarRadius, 0, Math.PI * 2);
      ctx.clip();

      // Deep Valorant tactical slate fill
      ctx.fillStyle = 'rgba(11, 18, 26, 0.88)';
      ctx.fillRect(0, 0, logicalSize, logicalSize);

      // Subtle range rings around player
      ctx.strokeStyle = 'rgba(236, 232, 225, 0.07)';
      ctx.lineWidth = 0.8;
      for (const frac of [0.38, 0.72]) {
        ctx.beginPath();
        ctx.arc(center, center, radarRadius * frac, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Rotating World Layer (forward = always straight UP)
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(pyaw);
      ctx.translate(-px * scale, -pz * scale);

      // Playable Arena Boundary Outline
      ctx.fillStyle = 'rgba(24, 36, 50, 0.55)';
      ctx.fillRect(-mapHalf * scale, -mapHalf * scale, mapHalf * 2 * scale, mapHalf * 2 * scale);
      ctx.strokeStyle = 'rgba(236, 232, 225, 0.14)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-mapHalf * scale, -mapHalf * scale, mapHalf * 2 * scale, mapHalf * 2 * scale);

      // Bomb Site Floor Pads
      ctx.fillStyle = 'rgba(23, 229, 184, 0.14)';
      ctx.strokeStyle = 'rgba(23, 229, 184, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(BOMB_SITE_A.x * scale, BOMB_SITE_A.z * scale, BOMB_SITE_A.radius * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 70, 85, 0.14)';
      ctx.strokeStyle = 'rgba(255, 70, 85, 0.75)';
      ctx.beginPath();
      ctx.arc(BOMB_SITE_B.x * scale, BOMB_SITE_B.z * scale, BOMB_SITE_B.radius * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Simplified Crisp Walls & Cover Solids
      const colliders = getActiveMapColliders();
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        const x = c.minX * scale;
        const y = c.minZ * scale;
        const w = Math.max(1.5, (c.maxX - c.minX) * scale);
        const h = Math.max(1.5, (c.maxZ - c.minZ) * scale);
        const isTall = c.maxY >= 2.2;

        ctx.fillStyle = isTall ? 'rgba(56, 76, 98, 0.92)' : 'rgba(38, 54, 72, 0.85)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = isTall ? 'rgba(236, 232, 225, 0.36)' : 'rgba(23, 229, 184, 0.28)';
        ctx.lineWidth = 0.75;
        ctx.strokeRect(x, y, w, h);
      }

      ctx.restore(); // End rotating world transform

      // Player Forward FOV Vision Cone (pointing straight UP)
      const fovGrad = ctx.createRadialGradient(center, center, 2, center, center, radarRadius * 0.72);
      fovGrad.addColorStop(0, 'rgba(23, 229, 184, 0.28)');
      fovGrad.addColorStop(1, 'rgba(23, 229, 184, 0.0)');
      ctx.fillStyle = fovGrad;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radarRadius * 0.72, -Math.PI / 2 - 0.52, -Math.PI / 2 + 0.52);
      ctx.closePath();
      ctx.fill();

      // Clamped Upright Site A / B Badges
      const drawSiteLabel = (wx: number, wz: number, label: string, color: string) => {
        const pos = worldToRadarCoord(wx, wz, px, pz, pyaw, logicalSize, viewRadiusMeters, radarRadius - 8);
        ctx.fillStyle = 'rgba(11, 18, 26, 0.9)';
        ctx.beginPath();
        ctx.arc(pos.cx, pos.cy, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.1;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, pos.cx, pos.cy + 0.5);
      };
      drawSiteLabel(BOMB_SITE_A.x, BOMB_SITE_A.z, 'A', '#17E5B8');
      drawSiteLabel(BOMB_SITE_B.x, BOMB_SITE_B.z, 'B', '#FF4655');

      // Teammates & Spotted Enemies
      for (const c of allCombatants) {
        if (!c.alive || c.isHuman) continue;
        const isAlly = c.team === playerTeam;
        const dist = playerCombatant.position.distanceTo(c.position);
        const isRevealed = Boolean(revealedEnemyIds?.has(c.id));

        if (!isAlly && dist >= 28 && !isRevealed) continue;

        const pos = worldToRadarCoord(
          c.position.x,
          c.position.z,
          px,
          pz,
          pyaw,
          logicalSize,
          viewRadiusMeters,
          radarRadius - 6
        );

        if (isAlly) {
          // Directional teammate arrow rotated relative to player yaw
          const relYaw = pyaw - c.yaw;
          ctx.save();
          ctx.translate(pos.cx, pos.cy);
          ctx.rotate(relYaw);
          ctx.fillStyle = '#17E5B8';
          ctx.beginPath();
          ctx.moveTo(0, -4.5);
          ctx.lineTo(3.4, 3.5);
          ctx.lineTo(0, 1.8);
          ctx.lineTo(-3.4, 3.5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = isRevealed ? '#fbbf24' : '#FF4655';
          ctx.beginPath();
          ctx.arc(pos.cx, pos.cy, isRevealed ? 4.2 : 3.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#0B121A';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Planted Spike Pulsing Beacon
      if (spikePosition && spikeState === 'planted') {
        const sp = worldToRadarCoord(
          spikePosition.x,
          spikePosition.z,
          px,
          pz,
          pyaw,
          logicalSize,
          viewRadiusMeters,
          radarRadius - 7
        );
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.01);
        ctx.strokeStyle = `rgba(255, 70, 85, ${0.4 + pulse * 0.55})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sp.cx, sp.cy, 5 + pulse * 3, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#FF4655';
        ctx.beginPath();
        ctx.arc(sp.cx, sp.cy, 3.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Center Player Self-Chevron
      ctx.fillStyle = '#ECE8E1';
      ctx.beginPath();
      ctx.moveTo(center, center - 5);
      ctx.lineTo(center + 3.8, center + 3.5);
      ctx.lineTo(center, center + 1.8);
      ctx.lineTo(center - 3.8, center + 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#17E5B8';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore(); // End circular clip

      // Minimalist Outer Radar Ring
      ctx.strokeStyle = 'rgba(236, 232, 225, 0.28)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(center, center, radarRadius, 0, Math.PI * 2);
      ctx.stroke();

      // North Compass Pip Rotating Along Outer Ring
      const northAngle = pyaw - Math.PI / 2;
      const nx = center + Math.cos(northAngle) * (radarRadius - 1);
      const ny = center + Math.sin(northAngle) * (radarRadius - 1);
      ctx.fillStyle = '#0F1923';
      ctx.beginPath();
      ctx.arc(nx, ny, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ECE8E1';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', nx, ny + 0.5);

      ctx.restore();
    };

    drawRadar();
    const interval = window.setInterval(drawRadar, 60);
    return () => window.clearInterval(interval);
  }, [
    playerCombatant,
    allCombatants,
    spikePosition,
    spikeState,
    playerTeam,
    revealedEnemyIds,
    logicalSize,
    compact,
    colliderVersion,
  ]);

  return (
    <div
      data-testid="minimap-radar"
      className={`relative overflow-hidden rounded-full bg-[#0B121A]/85 shadow-xl pointer-events-none ${
        compact
          ? 'h-[clamp(92px,20vw,112px)] w-[clamp(92px,20vw,112px)]'
          : 'h-[148px] w-[148px]'
      }`}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
};
