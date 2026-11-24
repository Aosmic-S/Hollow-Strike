/**
 * Hollow Strike - Agent Artwork, Emblem & Tactical Portrait Utilities
 * Shared visual tokens across the stepped Lobby Chevron Pennants and Pre-Match 5v5 Versus Screen.
 */

import React from 'react';
import { AGENT_REGISTRY, AgentDef } from '../game/types';
import cardBannerCrimson from '../assets/images/card_banner_crimson_1795193459992.jpg';
import cardBannerTeal from '../assets/images/card_banner_teal_1795193460064.jpg';
import mapCourtyardBg from '../assets/images/map_courtyard_loading_bg_1795193460615.jpg';
import lobbyGoldenRaysBg from '../assets/images/lobby_golden_rays_bg_1795193459396.jpg';
import splashBackdropBg from '../assets/images/loading_splash_art_1795091195232.jpg';

export const LOBBY_BACKDROP_ART = lobbyGoldenRaysBg;
export const WAREHOUSE_MAP_ART = mapCourtyardBg;
export const COURTYARD_ALT_ART = splashBackdropBg;
export const ARMORY_SPOTLIGHT_ART = cardBannerCrimson;

export function getMapArtwork(mapId?: string): string {
  if (mapId === 'COURTYARD') return COURTYARD_ALT_ART;
  if (mapId === 'PROVING_GRID' || mapId === 'TRAINING_GROUND') return cardBannerTeal;
  return WAREHOUSE_MAP_ART;
}

const CARD_ART_BY_AGENT: Record<string, string[]> = {
  KAEL: [cardBannerCrimson, cardBannerTeal],
  ZED: [cardBannerCrimson, '/assets/aistudio/350024580_1795088286721343_bce24b44.jpg'],
  KORA: [cardBannerTeal, mapCourtyardBg],
  SOREN: ['/assets/aistudio/350024580_1795088286721343_bce24b44.jpg', cardBannerTeal],
  PULSE: [cardBannerTeal, cardBannerCrimson],
  AEGIS: [cardBannerTeal, mapCourtyardBg],
  ROOK: [cardBannerCrimson, mapCourtyardBg],
};

export function getPlayerCardArt(agentId: string, variantIndex = 0): string {
  const pool = CARD_ART_BY_AGENT[agentId] || [cardBannerCrimson, cardBannerTeal];
  return pool[Math.abs(variantIndex) % pool.length];
}

export function getAgentTitleLabel(agentId: string, isLeader = false, isBot = false): string {
  if (isLeader) return 'SQUAD LEADER';
  if (isBot) return 'TACTICAL UNIT';
  switch (agentId) {
    case 'KAEL':
      return 'VOID DUELIST';
    case 'ZED':
      return 'CYBER-BLADE DUELIST';
    case 'KORA':
      return 'ASTRAL CONTROLLER';
    case 'SOREN':
      return 'SOLAR INITIATOR';
    case 'PULSE':
      return 'RECON INITIATOR';
    case 'AEGIS':
      return 'HARD-LIGHT SENTINEL';
    case 'ROOK':
      return 'HEAVY TECH SENTINEL';
    default:
      return 'OPERATIVE';
  }
}

interface AgentEmblemMarkProps {
  agentId: string;
  accentColor?: string;
  className?: string;
}

/**
 * Bold angular twin-wing emblem with subtle agent motif
 * rendered inside the Lobby stepped chevron banners.
 */
export const AgentEmblemMark: React.FC<AgentEmblemMarkProps> = ({
  agentId,
  accentColor,
  className = 'w-14 h-14',
}) => {
  const agent: AgentDef = AGENT_REGISTRY[agentId] || AGENT_REGISTRY.KAEL;
  const fill = accentColor || '#FF4655';

  return (
    <svg
      viewBox="0 0 100 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Left angled wing */}
      <path d="M10 14L44 56V78L10 38V14Z" fill={fill} />
      {/* Right fractured wing */}
      <path d="M90 14L56 56V78L90 38V14Z" fill={fill} fillOpacity="0.92" />
      {/* Center diamond core accent per agent role */}
      {(agent.id === 'KAEL' || agent.id === 'KORA') && (
        <path d="M50 16L60 32L50 48L40 32L50 16Z" fill="#ECE8E1" fillOpacity="0.88" />
      )}
      {agent.id === 'ZED' && (
        <path d="M53 14L41 36H51L47 52L60 30H50L53 14Z" fill="#ECE8E1" fillOpacity="0.92" />
      )}
      {(agent.id === 'AEGIS' || agent.id === 'ROOK') && (
        <path d="M41 18H59V36L50 48L41 36V18Z" fill="#ECE8E1" fillOpacity="0.88" />
      )}
      {(agent.id === 'SOREN' || agent.id === 'PULSE') && (
        <circle cx="50" cy="30" r="9" stroke="#ECE8E1" strokeWidth="4" strokeOpacity="0.9" />
      )}
    </svg>
  );
};

interface AgentPortraitTileProps {
  agentId: string;
  teamColor?: string;
  className?: string;
}

/**
 * Stylized tactical operative portrait square for Pre-Match 5v5 Versus rows.
 */
export const AgentPortraitTile: React.FC<AgentPortraitTileProps> = ({
  agentId,
  teamColor,
  className = 'h-full w-full',
}) => {
  const agent: AgentDef = AGENT_REGISTRY[agentId] || AGENT_REGISTRY.KAEL;
  const glow = teamColor || agent.primaryColor;

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-[#0E1722] ${className}`}
      style={{
        backgroundImage: `radial-gradient(circle at 50% 25%, ${agent.primaryColor}45, #0B131D 76%)`,
      }}
    >
      {/* Subtle tactical backdrop stripes */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'repeating-linear-gradient(-45deg, rgba(236,232,225,0.22) 0px, rgba(236,232,225,0.22) 1px, transparent 1px, transparent 7px)',
        }}
      />

      {/* Operative Tactical Bust Silhouette + Visor */}
      <svg viewBox="0 0 80 80" className="relative z-10 h-[86%] w-[86%]" aria-hidden="true">
        {/* Shoulders / Collar */}
        <path
          d="M12 78L20 56L33 50H47L60 56L68 78H12Z"
          fill="#172331"
          stroke={agent.primaryColor}
          strokeOpacity="0.7"
          strokeWidth="1.5"
        />
        {/* Neck / Tactical Hood */}
        <path d="M34 44H46V54H34V44Z" fill="#0F1824" />
        {/* Angular Helmet / Head Silhouette */}
        <path
          d="M27 28L33 16H47L53 28L51 44L40 49L29 44L27 28Z"
          fill="#1E2C3C"
          stroke="#ECE8E1"
          strokeOpacity="0.35"
          strokeWidth="1.4"
        />
        {/* Glowing Visor Motif */}
        {(agent.id === 'KAEL' || agent.id === 'KORA') && (
          <path d="M30 28L40 31L50 28L48 34L40 36L32 34L30 28Z" fill={agent.primaryColor} />
        )}
        {agent.id === 'ZED' && (
          <path d="M29 29L38 30L36 34L29 33V29ZM42 30L51 29V33L44 34L42 30Z" fill={agent.primaryColor} />
        )}
        {(agent.id === 'AEGIS' || agent.id === 'ROOK') && (
          <rect x="30" y="27" width="20" height="6" rx="1" fill={agent.primaryColor} />
        )}
        {(agent.id === 'SOREN' || agent.id === 'PULSE') && (
          <>
            <circle cx="35" cy="31" r="3" fill={agent.primaryColor} />
            <circle cx="45" cy="31" r="3" fill={agent.primaryColor} />
          </>
        )}
        {/* Shoulder emblem line */}
        <path d="M22 62L40 69L58 62" stroke={glow} strokeWidth="2" strokeOpacity="0.85" fill="none" />
      </svg>

      {/* Bottom accent bar */}
      <div
        className="absolute inset-x-0 bottom-0 h-[3px]"
        style={{ backgroundColor: glow }}
      />
    </div>
  );
};
