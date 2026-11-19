/**
 * Hollow Strike - Customizable Crosshair Reticle Renderer
 * Shared between in-game GameHUD (with live dynamic spread bloom) and SettingsPanel live preview.
 */

import React from 'react';
import { CrosshairConfig } from '../game/types';

interface CrosshairReticleProps {
  config: CrosshairConfig;
  bloomPx?: number;
}

export const CrosshairReticle: React.FC<CrosshairReticleProps> = ({
  config,
  bloomPx = 0,
}) => {
  const effectiveGap = config.gap + (config.dynamic ? bloomPx : 0);
  const { style, color, length, thickness, showDot, dotSize, opacity, outline } = config;
  const half = 48;
  const strokeFilter = outline ? 'drop-shadow(0 0 1px #000) drop-shadow(0 0 1.5px rgba(0,0,0,0.95))' : undefined;

  return (
    <svg
      width={half * 2}
      height={half * 2}
      viewBox={`-${half} -${half} ${half * 2} ${half * 2}`}
      className="pointer-events-none overflow-visible"
      style={{ opacity, filter: strokeFilter }}
      data-testid="crosshair-reticle"
      data-style={style}
    >
      {/* Classic 4-bar tactical */}
      {(style === 'classic' || style === 't-shape') && (
        <>
          {style === 'classic' && (
            <line
              x1={0}
              y1={-(effectiveGap + length)}
              x2={0}
              y2={-effectiveGap}
              stroke={color}
              strokeWidth={thickness}
              strokeLinecap="square"
            />
          )}
          <line
            x1={0}
            y1={effectiveGap}
            x2={0}
            y2={effectiveGap + length}
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="square"
          />
          <line
            x1={-(effectiveGap + length)}
            y1={0}
            x2={-effectiveGap}
            y2={0}
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="square"
          />
          <line
            x1={effectiveGap}
            y1={0}
            x2={effectiveGap + length}
            y2={0}
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="square"
          />
        </>
      )}

      {/* Solid Cross */}
      {style === 'cross' && (
        <>
          <line
            x1={0}
            y1={-(length + effectiveGap * 0.5)}
            x2={0}
            y2={length + effectiveGap * 0.5}
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
          />
          <line
            x1={-(length + effectiveGap * 0.5)}
            y1={0}
            x2={length + effectiveGap * 0.5}
            y2={0}
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
          />
        </>
      )}

      {/* Holo Circle */}
      {style === 'circle' && (
        <circle
          cx={0}
          cy={0}
          r={Math.max(4, effectiveGap + length * 0.65)}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
        />
      )}

      {/* Tactical Chevron */}
      {style === 'chevron' && (
        <>
          <polyline
            points={`${-(length + effectiveGap * 0.4)},${length + effectiveGap * 0.4} 0,${Math.max(0, effectiveGap * 0.25)} ${length + effectiveGap * 0.4},${length + effectiveGap * 0.4}`}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1={-(effectiveGap + length * 0.75)}
            y1={0}
            x2={-(effectiveGap + 2)}
            y2={0}
            stroke={color}
            strokeWidth={Math.max(1, thickness - 0.5)}
            strokeLinecap="round"
          />
          <line
            x1={effectiveGap + 2}
            y1={0}
            x2={effectiveGap + length * 0.75}
            y2={0}
            stroke={color}
            strokeWidth={Math.max(1, thickness - 0.5)}
            strokeLinecap="round"
          />
        </>
      )}

      {/* Center Precision Dot (always on for 'dot' style, optional otherwise) */}
      {(showDot || style === 'dot') && (
        <circle
          cx={0}
          cy={0}
          r={Math.max(1, dotSize * 0.5)}
          fill={color}
        />
      )}
    </svg>
  );
};
