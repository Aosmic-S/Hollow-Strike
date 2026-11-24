/**
 * Hollow Strike - The Range (Training Area) Control Bar & Live Telemetry HUD
 * Compact Valorant-inspired Range panel for switching live drills (Practice, Speed 30, Streak 50,
 * Strafe, Temple Plant Drill, Dock Defuse Drill, Free Roam), toggling Bot Armor / Strafe / Inf Mag,
 * setting target board lane distance (10m/18m/26m), warping across island zones, and reading Accuracy/HS%.
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Crosshair,
  MapPin,
  RotateCcw,
  Shield,
  Target,
  Timer,
} from 'lucide-react';
import {
  TRAINING_ZONES,
  TrainingDrillMode,
  TrainingSessionState,
  TrainingZoneId,
} from '../game/types';

interface TrainingHUDProps {
  trainingState: TrainingSessionState;
  isMobile?: boolean;
  onSelectDrill: (mode: TrainingDrillMode) => void;
  onWarpZone: (zoneId: TrainingZoneId) => void;
  onUpdateConfig: (
    patch: Partial<
      Pick<TrainingSessionState, 'botArmor' | 'botsStrafe' | 'infiniteMag' | 'activeTargetDistance'>
    >
  ) => void;
  onResetStats: () => void;
}

const DRILL_OPTIONS: Array<{ id: TrainingDrillMode; label: string }> = [
  { id: 'PRACTICE', label: 'GALLERY' },
  { id: 'SPEED_30', label: 'SPEED 30' },
  { id: 'STREAK_50', label: 'STREAK 50' },
  { id: 'STRAFE', label: 'STRAFE' },
  { id: 'PLANT_DRILL', label: 'PLANT' },
  { id: 'DEFUSE_DRILL', label: 'DEFUSE' },
  { id: 'FREE_ROAM', label: 'ROAM' },
];

export const TrainingHUD: React.FC<TrainingHUDProps> = ({
  trainingState,
  isMobile = false,
  onSelectDrill,
  onWarpZone,
  onUpdateConfig,
  onResetStats,
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(isMobile);

  const accuracyPct =
    trainingState.shotsFired > 0
      ? Math.round((trainingState.shotsHit / trainingState.shotsFired) * 100)
      : 0;
  const headshotPct =
    trainingState.shotsHit > 0
      ? Math.round((trainingState.headshots / trainingState.shotsHit) * 100)
      : 0;

  return (
    <div
      data-testid="training-hud"
      className="pointer-events-none fixed inset-x-0 top-[74px] sm:top-[68px] z-30 flex flex-col items-center px-2 select-none"
    >
      {/* Active Spike Objective / Speed Trial Banner */}
      {trainingState.spikeObjectiveLabel && (
        <div
          data-testid="training-objective-banner"
          className="mb-1.5 flex items-center gap-2 border border-[#fbbf24]/60 bg-[#0A1118]/92 px-3 py-1 font-mono text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#fbbf24] shadow-lg clip-val-card"
        >
          <Target className="h-3.5 w-3.5 shrink-0" />
          <span>{trainingState.spikeObjectiveLabel}</span>
          {trainingState.spikeObjectiveActive && trainingState.drillMode === 'DEFUSE_DRILL' && (
            <span className="bg-[#FF4655] px-1.5 py-0.5 text-[10px] font-black text-white tabular-nums">
              {Math.max(0, trainingState.spikeObjectiveTimer).toFixed(1)}s
            </span>
          )}
        </div>
      )}

      {/* Compact Collapsible Range Command Console */}
      <div className="pointer-events-auto w-full max-w-3xl border border-[#17E5B8]/35 bg-[#0A1118]/88 backdrop-blur-md shadow-2xl clip-val-card">
        {/* Top Row: Live Telemetry + Collapse Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 font-mono text-[10px]">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
            <div className="flex items-center gap-1 text-[#17E5B8] font-black uppercase tracking-wider">
              <Crosshair className="h-3.5 w-3.5" />
              <span>THE RANGE</span>
            </div>

            <div className="flex items-center gap-1 text-[#ECE8E1]">
              <span className="text-[#8B978F]">ACC</span>
              <span data-testid="training-accuracy" className="font-bold text-[#17E5B8] tabular-nums">
                {accuracyPct}%
              </span>
            </div>

            <div className="flex items-center gap-1 text-[#ECE8E1]">
              <span className="text-[#8B978F]">HS</span>
              <span data-testid="training-hs" className="font-bold text-[#fbbf24] tabular-nums">
                {headshotPct}%
              </span>
            </div>

            {(trainingState.drillMode === 'SPEED_30' || trainingState.drillMode === 'STREAK_50') && (
              <div className="flex items-center gap-1.5 border-l border-[#ECE8E1]/15 pl-2.5 text-[#ECE8E1]">
                <Timer className="h-3 w-3 text-[#FF4655]" />
                <span className="font-bold text-[#FF4655] tabular-nums">
                  {trainingState.trialKills}/{trainingState.trialTarget}
                </span>
                <span className="text-[#8B978F] tabular-nums">
                  {trainingState.trialTimeElapsed.toFixed(1)}s
                </span>
                {trainingState.trialStatus === 'COMPLETE' && (
                  <span className="bg-[#17E5B8] px-1.5 py-0.5 text-[9px] font-black text-[#0A1118]">
                    DONE
                  </span>
                )}
              </div>
            )}

            {trainingState.bestSpeedTime !== null && (
              <span className="hidden md:inline text-[9px] text-[#8B978F]">
                PB 30: <strong className="text-[#ECE8E1]">{trainingState.bestSpeedTime}s</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="training-reset-btn"
              onClick={onResetStats}
              title="Reset Range Stats & Restart Trial"
              className="flex items-center gap-1 border border-[#ECE8E1]/15 bg-[#121D29] px-2 py-0.5 text-[9px] font-bold uppercase text-[#ECE8E1] hover:border-[#FF4655] hover:text-[#FF4655] cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              RESET
            </button>

            <button
              type="button"
              data-testid="training-collapse-btn"
              onClick={() => setCollapsed((v) => !v)}
              className="flex items-center gap-1 border border-[#17E5B8]/40 bg-[#121D29] px-2 py-0.5 text-[9px] font-bold uppercase text-[#17E5B8] hover:bg-[#17E5B8]/15 cursor-pointer"
            >
              {collapsed ? (
                <>
                  <span>RANGE CONTROLS</span>
                  <ChevronDown className="h-3 w-3" />
                </>
              ) : (
                <>
                  <span>HIDE</span>
                  <ChevronUp className="h-3 w-3" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Expanded Drill Selector + Bot Toggles + Zone Warps */}
        {!collapsed && (
          <div className="border-t border-[#ECE8E1]/10 px-2.5 py-2 space-y-1.5 font-mono text-[9px]">
            {/* Row 1: Drills + Config Toggles + Target Distances */}
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex flex-wrap items-center gap-1">
                {DRILL_OPTIONS.map((d) => {
                  const active = trainingState.drillMode === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      data-testid={`training-drill-${d.id}`}
                      onClick={() => onSelectDrill(d.id)}
                      className={`border px-2 py-1 font-bold uppercase tracking-wider transition cursor-pointer ${
                        active
                          ? 'border-[#FF4655] bg-[#FF4655] text-white'
                          : 'border-[#ECE8E1]/15 bg-[#121C27] text-[#8B978F] hover:text-[#ECE8E1]'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  data-testid="training-toggle-armor"
                  onClick={() => onUpdateConfig({ botArmor: !trainingState.botArmor })}
                  className={`flex items-center gap-1 border px-2 py-1 font-bold uppercase cursor-pointer ${
                    trainingState.botArmor
                      ? 'border-[#17E5B8] bg-[#17E5B8]/20 text-[#17E5B8]'
                      : 'border-[#ECE8E1]/15 bg-[#121C27] text-[#8B978F]'
                  }`}
                >
                  <Shield className="h-2.5 w-2.5" />
                  ARMOR: {trainingState.botArmor ? '50' : '0'}
                </button>

                <button
                  type="button"
                  data-testid="training-toggle-strafe"
                  onClick={() => onUpdateConfig({ botsStrafe: !trainingState.botsStrafe })}
                  className={`border px-2 py-1 font-bold uppercase cursor-pointer ${
                    trainingState.botsStrafe
                      ? 'border-[#17E5B8] bg-[#17E5B8]/20 text-[#17E5B8]'
                      : 'border-[#ECE8E1]/15 bg-[#121C27] text-[#8B978F]'
                  }`}
                >
                  STRAFE: {trainingState.botsStrafe ? 'ON' : 'OFF'}
                </button>

                <button
                  type="button"
                  data-testid="training-toggle-infmag"
                  onClick={() => onUpdateConfig({ infiniteMag: !trainingState.infiniteMag })}
                  className={`border px-2 py-1 font-bold uppercase cursor-pointer ${
                    trainingState.infiniteMag
                      ? 'border-[#fbbf24] bg-[#fbbf24]/20 text-[#fbbf24]'
                      : 'border-[#ECE8E1]/15 bg-[#121C27] text-[#8B978F]'
                  }`}
                >
                  INF MAG: {trainingState.infiniteMag ? 'ON' : 'OFF'}
                </button>

                <div className="flex items-center border border-[#ECE8E1]/15 bg-[#121C27] divide-x divide-[#ECE8E1]/15">
                  {([10, 18, 26] as const).map((dist) => (
                    <button
                      key={dist}
                      type="button"
                      data-testid={`training-dist-${dist}`}
                      onClick={() => onUpdateConfig({ activeTargetDistance: dist })}
                      className={`px-1.5 py-1 font-bold uppercase cursor-pointer ${
                        trainingState.activeTargetDistance === dist
                          ? 'bg-[#17E5B8] text-[#0A1118]'
                          : 'text-[#8B978F] hover:text-[#ECE8E1]'
                      }`}
                    >
                      {dist}M
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Instant 1-Click Island Zone Warps */}
            <div className="flex flex-wrap items-center gap-1 border-t border-[#ECE8E1]/10 pt-1.5">
              <span className="flex items-center gap-1 text-[#8B978F] uppercase mr-1">
                <MapPin className="h-2.5 w-2.5 text-[#17E5B8]" />
                WARP:
              </span>
              {TRAINING_ZONES.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  data-testid={`training-warp-${z.id}`}
                  onClick={() => onWarpZone(z.id)}
                  className="border border-[#ECE8E1]/15 bg-[#121C27] px-2 py-0.5 font-bold uppercase text-[#ECE8E1]/85 hover:border-[#17E5B8] hover:text-[#17E5B8] transition cursor-pointer"
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
