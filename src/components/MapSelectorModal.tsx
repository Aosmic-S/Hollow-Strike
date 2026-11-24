/**
 * Hollow Strike - Tactical Map Selector Modal
 * Displays all playable tactical arenas (Warehouse, Courtyard, Proving Grid, and any custom GLBs in /models/Map)
 * with tactical previews, A/B site callouts, and instant map switching for Solo & Custom Room Hosts.
 */

import React from 'react';
import { Check, Crosshair, Layers, MapPin, ShieldAlert, Swords, X, Zap } from 'lucide-react';
import { MapDef } from '../game/types';
import { isTdmMap } from '../game/rules';
import { getMapArtwork } from './AgentAvatar';

interface MapSelectorModalProps {
  maps: MapDef[];
  selectedMapId: string;
  isRoomLockedNonHost?: boolean;
  onSelectMap: (mapId: string) => void;
  onClose: () => void;
}

export const MapSelectorModal: React.FC<MapSelectorModalProps> = ({
  maps,
  selectedMapId,
  isRoomLockedNonHost = false,
  onSelectMap,
  onClose,
}) => {
  return (
    <div
      data-testid="map-selector-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#090E15]/88 backdrop-blur-sm p-3 sm:p-6 select-none"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90dvh] w-full max-w-5xl flex-col border border-[#ECE8E1]/20 bg-[#121A24] p-4 sm:p-6 shadow-2xl overflow-y-auto clip-val-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECE8E1]/15 pb-3.5">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#17E5B8]">
              <MapPin className="h-3.5 w-3.5" />
              DEPLOYMENT SECTOR SELECTION
            </div>
            <h2 className="mt-0.5 font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-[0.14em] text-[#ECE8E1]">
              SELECT ARENA MAP
            </h2>
          </div>

          <button
            type="button"
            data-testid="close-map-selector-btn"
            onClick={onClose}
            className="flex items-center gap-1.5 border border-[#ECE8E1]/20 bg-[#0B1118] px-3.5 py-2 font-display text-xs font-extrabold uppercase tracking-wider text-[#ECE8E1] hover:border-[#FF4655] hover:bg-[#FF4655] transition cursor-pointer clip-val-card"
          >
            <X className="h-3.5 w-3.5" />
            CLOSE
          </button>
        </div>

        {isRoomLockedNonHost && (
          <div className="mt-3 border border-[#fbbf24]/50 bg-[#fbbf24]/10 px-3 py-2 font-mono text-[11px] text-[#fbbf24] flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            You are inside a multiplayer room — only the Room Host can change the active map for the lobby.
          </div>
        )}

        {/* Map Card Grid (2-column balanced layout for 4 maps) */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {maps.map((map) => {
            const isSelected = map.id === selectedMapId;
            const artUrl = getMapArtwork(map.id);
            const isInstant = map.modelUrl === 'procedural';
            const isTdm = isTdmMap(map);
            const isTraining = Boolean(map.isTrainingMap);

            return (
              <button
                key={map.id}
                type="button"
                data-testid={`map-option-${map.id}`}
                disabled={isRoomLockedNonHost}
                onClick={() => {
                  if (isRoomLockedNonHost) return;
                  onSelectMap(map.id);
                  onClose();
                }}
                className={`group relative flex flex-col overflow-hidden border text-left transition clip-val-card ${
                  isSelected
                    ? 'border-[#FF4655] bg-[#182330] shadow-[0_0_24px_rgba(255,70,85,0.22)]'
                    : 'border-[#ECE8E1]/15 bg-[#0D151F] hover:border-[#17E5B8]/75 hover:bg-[#131E2C]'
                } ${isRoomLockedNonHost ? 'opacity-65 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {/* Artwork Header */}
                <div className="relative h-36 w-full overflow-hidden border-b border-[#ECE8E1]/10 bg-[#0A1018]">
                  <img
                    src={artUrl}
                    alt={`${map.name} Arena Preview`}
                    className={`h-full w-full object-cover object-center transition duration-300 group-hover:scale-105 ${
                      isInstant ? 'opacity-45 hue-rotate-15' : 'opacity-80'
                    }`}
                  />
                  {isInstant && (
                    <div
                      className="absolute inset-0 opacity-35"
                      style={{
                        backgroundImage:
                          'linear-gradient(to right, rgba(23,229,184,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(23,229,184,0.28) 1px, transparent 1px)',
                        backgroundSize: '20px 20px',
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0D151F] via-[#0D151F]/35 to-transparent" />

                  {/* Sector Pill */}
                  <div className="absolute top-2.5 left-2.5 bg-[#090E15]/90 border border-[#ECE8E1]/20 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#ECE8E1]/85">
                    {map.sector.split('//')[0].trim()}
                  </div>

                  {/* Selected / Mode Badge */}
                  {isSelected ? (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-[#FF4655] px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-white">
                      <Check className="h-3 w-3" />
                      ACTIVE
                    </div>
                  ) : isTdm ? (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-[#FF4655]/20 border border-[#FF4655]/65 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#FF4655]">
                      <Swords className="h-2.5 w-2.5" />
                      1V1 / 2V2 TDM
                    </div>
                  ) : isTraining ? (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-[#38bdf8]/20 border border-[#38bdf8]/65 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#38bdf8]">
                      <Crosshair className="h-2.5 w-2.5" />
                      THE RANGE
                    </div>
                  ) : isInstant ? (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-[#17E5B8]/20 border border-[#17E5B8]/60 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#17E5B8]">
                      <Zap className="h-2.5 w-2.5" />
                      INSTANT
                    </div>
                  ) : null}

                  <div className="absolute bottom-2 left-3 right-3 flex items-baseline justify-between">
                    <h3 className="font-display text-2xl font-extrabold uppercase tracking-[0.14em] text-[#ECE8E1] leading-none">
                      {map.name}
                    </h3>
                  </div>
                </div>

                {/* Details */}
                <div className="flex flex-1 flex-col justify-between p-3.5 space-y-3">
                  <div>
                    <div
                      className="font-mono text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: map.accentColor }}
                    >
                      {map.tagline}
                    </div>
                    <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-[#8B978F]">
                      {map.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#ECE8E1]/10 pt-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {map.tags.map((tag) => (
                        <span
                          key={tag}
                          className="border border-[#ECE8E1]/15 bg-[#0A1018] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#ECE8E1]/75"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <span className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-[#17E5B8]">
                      <Layers className="h-3 w-3" />
                      {isSelected ? 'EQUIPPED' : 'SELECT >'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
