/**
 * Hollow Strike - Minimalist Valorant-Style Responsive Tactical Minimap
 * Player-centered smoothly rotating radar with forward FOV cone, architectural wall/cover silhouettes,
 * directional teammate icons, diamond hostile markers, prominent Spike beacon, and north compass pip.
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
import { worldToRadarCoord, isTdmMap } from '../game/rules';
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
  const logicalSize = compact ? 116 : 156;
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

    const viewRadiusMeters = compact ? 25 : 27;
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
      ctx.fillStyle = 'rgba(10, 17, 25, 0.90)';
      ctx.fillRect(0, 0, logicalSize, logicalSize);

      // Rotating World Layer (forward = always straight UP)
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(pyaw);
      ctx.translate(-px * scale, -pz * scale);

      // Playable Arena Floor + Blueprint Grid
      const arenaLeft = -mapHalf * scale;
      const arenaSpan = mapHalf * 2 * scale;
      ctx.fillStyle = 'rgba(20, 31, 44, 0.72)';
      ctx.fillRect(arenaLeft, arenaLeft, arenaSpan, arenaSpan);

      ctx.strokeStyle = 'rgba(236, 232, 225, 0.05)';
      ctx.lineWidth = 0.6;
      const gridStep = 8 * scale;
      ctx.beginPath();
      for (let gx = arenaLeft; gx <= arenaLeft + arenaSpan; gx += gridStep) {
        ctx.moveTo(gx, arenaLeft);
        ctx.lineTo(gx, arenaLeft + arenaSpan);
        ctx.moveTo(arenaLeft, gx);
        ctx.lineTo(arenaLeft + arenaSpan, gx);
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(236, 232, 225, 0.16)';
      ctx.lineWidth = 1.1;
      ctx.strokeRect(arenaLeft, arenaLeft, arenaSpan, arenaSpan);

      // Bomb Site Floor Pads (Valorant Site Accent Rings — suppressed in TDM maps)
      const hideSpikeSites = isTdmMap(activeDef);
      if (!hideSpikeSites) {
        const drawSiteZone = (sx: number, sz: number, r: number, rgbaFill: string, rgbaStroke: string) => {
          ctx.fillStyle = rgbaFill;
          ctx.strokeStyle = rgbaStroke;
          ctx.lineWidth = 1.25;
          ctx.setLineDash([4, 2]);
          ctx.beginPath();
          ctx.arc(sx * scale, sz * scale, r * scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);
        };
        drawSiteZone(BOMB_SITE_A.x, BOMB_SITE_A.z, BOMB_SITE_A.radius, 'rgba(23, 229, 184, 0.14)', 'rgba(23, 229, 184, 0.75)');
        drawSiteZone(BOMB_SITE_B.x, BOMB_SITE_B.z, BOMB_SITE_B.radius, 'rgba(255, 70, 85, 0.14)', 'rgba(255, 70, 85, 0.75)');
      }

      // Crisp Architectural Walls & Waist Cover Silhouettes
      const colliders = getActiveMapColliders();
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        const x = c.minX * scale;
        const y = c.minZ * scale;
        const w = Math.max(1.6, (c.maxX - c.minX) * scale);
        const h = Math.max(1.6, (c.maxZ - c.minZ) * scale);
        const isTall = c.maxY >= 2.0;

        ctx.fillStyle = isTall ? 'rgba(46, 65, 86, 0.96)' : 'rgba(30, 44, 60, 0.88)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = isTall ? 'rgba(236, 232, 225, 0.42)' : 'rgba(23, 229, 184, 0.32)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(x, y, w, h);
      }

      ctx.restore(); // End rotating world transform

      // Radar Concentric Range Guides & Crosshair Axes
      ctx.strokeStyle = 'rgba(236, 232, 225, 0.08)';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.arc(center, center, radarRadius * 0.48, 0, Math.PI * 2);
      ctx.moveTo(center, 4);
      ctx.lineTo(center, logicalSize - 4);
      ctx.moveTo(4, center);
      ctx.lineTo(logicalSize - 4, center);
      ctx.stroke();

      // Player Forward FOV Vision Cone (pointing straight UP)
      const fovGrad = ctx.createRadialGradient(center, center, 2, center, center, radarRadius * 0.78);
      fovGrad.addColorStop(0, 'rgba(236, 232, 225, 0.28)');
      fovGrad.addColorStop(0.5, 'rgba(23, 229, 184, 0.14)');
      fovGrad.addColorStop(1, 'rgba(23, 229, 184, 0.0)');
      ctx.fillStyle = fovGrad;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radarRadius * 0.78, -Math.PI / 2 - 0.56, -Math.PI / 2 + 0.56);
      ctx.closePath();
      ctx.fill();

      // Clamped Upright Site A / B Badges (suppressed in TDM)
      if (!hideSpikeSites) {
        const drawSiteLabel = (wx: number, wz: number, label: string, color: string) => {
          const pos = worldToRadarCoord(wx, wz, px, pz, pyaw, logicalSize, viewRadiusMeters, radarRadius - 9);
          ctx.fillStyle = 'rgba(10, 17, 25, 0.94)';
          ctx.beginPath();
          ctx.arc(pos.cx, pos.cy, 6.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.25;
          ctx.stroke();
          ctx.fillStyle = color;
          ctx.font = 'bold 8.5px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, pos.cx, pos.cy + 0.5);
        };
        drawSiteLabel(BOMB_SITE_A.x, BOMB_SITE_A.z, 'A', '#17E5B8');
        drawSiteLabel(BOMB_SITE_B.x, BOMB_SITE_B.z, 'B', '#FF4655');
      }

      // Allies (Teal Circle + Chevron) & Spotted Enemies (Crimson Diamond)
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
          radarRadius - 7
        );

        if (isAlly) {
          const relYaw = pyaw - c.yaw;
          ctx.save();
          ctx.translate(pos.cx, pos.cy);
          ctx.rotate(relYaw);

          if (!hideSpikeSites && c.hasSpike && spikeState === 'not_planted') {
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(0, 0, 5.4, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.fillStyle = '#17E5B8';
          ctx.beginPath();
          ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ECE8E1';
          ctx.beginPath();
          ctx.moveTo(0, -5.6);
          ctx.lineTo(2.4, -2.5);
          ctx.lineTo(-2.4, -2.5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          // Hostile Diamond Icon
          ctx.save();
          ctx.translate(pos.cx, pos.cy);
          ctx.rotate(Math.PI / 4);
          if (isRevealed) {
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-4.2, -4.2, 8.4, 8.4);
          }
          ctx.fillStyle = '#FF4655';
          ctx.fillRect(-3.2, -3.2, 6.4, 6.4);
          ctx.strokeStyle = '#0A1118';
          ctx.lineWidth = 1;
          ctx.strokeRect(-3.2, -3.2, 6.4, 6.4);
          ctx.restore();
        }
      }

      // Planted Spike Pulsing Beacon
      if (!hideSpikeSites && spikePosition && spikeState === 'planted') {
        const sp = worldToRadarCoord(
          spikePosition.x,
          spikePosition.z,
          px,
          pz,
          pyaw,
          logicalSize,
          viewRadiusMeters,
          radarRadius - 8
        );
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.011);
        ctx.strokeStyle = `rgba(255, 70, 85, ${0.45 + pulse * 0.5})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(sp.cx, sp.cy, 5.5 + pulse * 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.save();
        ctx.translate(sp.cx, sp.cy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#FF4655';
        ctx.fillRect(-3.6, -3.6, 7.2, 7.2);
        ctx.strokeStyle = '#ECE8E1';
        ctx.lineWidth = 1.1;
        ctx.strokeRect(-3.6, -3.6, 7.2, 7.2);
        ctx.restore();
      }

      // Center Player Self-Marker
      if (!hideSpikeSites && playerCombatant.hasSpike && spikeState === 'not_planted') {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(center, center, 6.8, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#ECE8E1';
      ctx.beginPath();
      ctx.moveTo(center, center - 5.5);
      ctx.lineTo(center + 4.0, center + 3.8);
      ctx.lineTo(center, center + 1.8);
      ctx.lineTo(center - 4.0, center + 3.8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#17E5B8';
      ctx.lineWidth = 1.1;
      ctx.stroke();

      ctx.restore(); // End circular clip

      // Crisp Valorant Outer Bezel Ring
      ctx.strokeStyle = 'rgba(236, 232, 225, 0.34)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(center, center, radarRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(23, 229, 184, 0.25)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(center, center, radarRadius - 2.2, 0, Math.PI * 2);
      ctx.stroke();

      // North Compass Pip Rotating Along Outer Ring
      const northAngle = pyaw - Math.PI / 2;
      const nx = center + Math.cos(northAngle) * (radarRadius - 1);
      const ny = center + Math.sin(northAngle) * (radarRadius - 1);
      ctx.fillStyle = '#0F1923';
      ctx.beginPath();
      ctx.arc(nx, ny, 5.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(236, 232, 225, 0.45)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
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
      className={`relative overflow-hidden rounded-full bg-[#0A1118]/85 shadow-xl pointer-events-none ${
        compact
          ? 'h-[clamp(92px,20vw,116px)] w-[clamp(92px,20vw,116px)]'
          : 'h-[156px] w-[156px]'
      }`}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
};
