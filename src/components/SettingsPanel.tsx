/**
 * Hollow Strike - Unified Tactical Settings Panel
 * Shared between Lobby full-screen Settings page and in-game Pause Settings modal.
 * Every control applies live and persists automatically.
 */

import React from 'react';
import {
  ControlMode,
  CrosshairColor,
  CrosshairSize,
  GameSettings,
  GraphicsPreset,
} from '../game/types';
import { soundEngine } from '../game/audio';

interface SettingsPanelProps {
  settings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
  compact?: boolean;
}

const CROSSHAIR_HEX: Record<CrosshairColor, string> = {
  cyan: '#22d3ee',
  green: '#34d399',
  amber: '#fbbf24',
  white: '#f8fafc',
  rose: '#fb7185',
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  compact = false,
}) => {
  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    const updated = { ...settings, [key]: value };
    onUpdateSettings(updated);

    if (key === 'volume') {
      soundEngine.setVolume(value as number);
    }
    if (key === 'soundEnabled') {
      soundEngine.setMuted(!(value as boolean));
    }
  };

  const previewLength =
    settings.crosshairSize === 'small' ? 6 : settings.crosshairSize === 'large' ? 12 : 8;
  const previewGap =
    settings.crosshairSize === 'small' ? 4 : settings.crosshairSize === 'large' ? 7 : 5;
  const previewColor = CROSSHAIR_HEX[settings.crosshairColor ?? 'cyan'];

  return (
    <div
      className={`grid gap-6 font-mono text-xs text-slate-300 ${
        compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'
      }`}
    >
      {/* SECTION 1: AIM & SENSITIVITY */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 space-y-4">
        <div className="border-b border-slate-800/80 pb-2">
          <h3 className="text-sm font-black uppercase tracking-wider text-white">
            Controls & Sensitivity
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Calibrate input device mode, look speed, ADS scaling, and Y-axis orientation.
          </p>
        </div>

        <div>
          <label className="block text-slate-400 uppercase tracking-wider mb-2 font-bold">
            Input Control Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'AUTO', label: 'AUTO DETECT' },
              { id: 'DESKTOP', label: 'PC (KBM)' },
              { id: 'TOUCH', label: 'MOBILE TOUCH' },
            ] as { id: ControlMode; label: string }[]).map((m) => (
              <button
                key={m.id}
                onClick={() => update('controlMode', m.id)}
                className={`rounded-lg border py-2 font-bold uppercase transition cursor-pointer ${
                  settings.controlMode === m.id
                    ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-600'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-400 uppercase">Mouse Look Sensitivity (PC)</span>
              <span className="text-white font-bold tabular-nums">
                {(settings.mouseSensitivity * 1000).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.0006"
              max="0.006"
              step="0.0002"
              value={settings.mouseSensitivity}
              onChange={(e) => update('mouseSensitivity', parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-400 uppercase">Touch Look Sensitivity (Mobile)</span>
              <span className="text-white font-bold tabular-nums">
                {(settings.touchSensitivity * 1000).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.001"
              max="0.008"
              step="0.0002"
              value={settings.touchSensitivity}
              onChange={(e) => update('touchSensitivity', parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-400 uppercase">ADS / Scope Sensitivity Multiplier</span>
              <span className="text-white font-bold tabular-nums">
                {Math.round((settings.adsSensitivityMultiplier ?? 0.7) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.3"
              max="1.2"
              step="0.05"
              value={settings.adsSensitivityMultiplier ?? 0.7}
              onChange={(e) => update('adsSensitivityMultiplier', parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
          <div>
            <div className="font-bold uppercase text-slate-200">Invert Y-Axis</div>
            <div className="text-[10px] text-slate-500">Flip vertical aim direction</div>
          </div>
          <button
            onClick={() => update('invertY', !settings.invertY)}
            className={`rounded-lg border px-4 py-1.5 font-bold uppercase transition cursor-pointer ${
              settings.invertY
                ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300'
                : 'border-slate-800 bg-slate-900/60 text-slate-400'
            }`}
          >
            {settings.invertY ? 'INVERTED' : 'STANDARD'}
          </button>
        </div>
      </section>

      {/* SECTION 2: RETICLE & VIEWPORT */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 space-y-4">
        <div className="border-b border-slate-800/80 pb-2">
          <h3 className="text-sm font-black uppercase tracking-wider text-white">
            Crosshair & Viewport
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Customize reticle color, gap size, and first-person field of view.
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded border border-slate-800 bg-[#0b1220]">
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: previewColor }}
            />
            <div
              className="absolute w-0.5"
              style={{
                backgroundColor: previewColor,
                height: previewLength,
                bottom: `calc(50% + ${previewGap}px)`,
              }}
            />
            <div
              className="absolute w-0.5"
              style={{
                backgroundColor: previewColor,
                height: previewLength,
                top: `calc(50% + ${previewGap}px)`,
              }}
            />
            <div
              className="absolute h-0.5"
              style={{
                backgroundColor: previewColor,
                width: previewLength,
                right: `calc(50% + ${previewGap}px)`,
              }}
            />
            <div
              className="absolute h-0.5"
              style={{
                backgroundColor: previewColor,
                width: previewLength,
                left: `calc(50% + ${previewGap}px)`,
              }}
            />
          </div>

          <div className="flex-1 space-y-2.5">
            <div>
              <span className="block text-[10px] text-slate-400 uppercase mb-1.5 font-bold">
                Crosshair Color
              </span>
              <div className="flex items-center gap-2">
                {(['cyan', 'green', 'amber', 'white', 'rose'] as CrosshairColor[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => update('crosshairColor', c)}
                    title={c.toUpperCase()}
                    className={`h-7 w-7 rounded-md border-2 transition cursor-pointer ${
                      (settings.crosshairColor ?? 'cyan') === c
                        ? 'border-white scale-110'
                        : 'border-slate-700 opacity-75 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: CROSSHAIR_HEX[c] }}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="block text-[10px] text-slate-400 uppercase mb-1.5 font-bold">
                Crosshair Size
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['small', 'medium', 'large'] as CrosshairSize[]).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => update('crosshairSize', sz)}
                    className={`rounded border py-1 text-[10px] font-bold uppercase transition cursor-pointer ${
                      (settings.crosshairSize ?? 'medium') === sz
                        ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300'
                        : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span className="text-slate-400 uppercase">Field of View (FOV)</span>
            <span className="text-white font-bold tabular-nums">{settings.fov}°</span>
          </div>
          <input
            type="range"
            min="80"
            max="115"
            step="1"
            value={settings.fov}
            onChange={(e) => update('fov', parseInt(e.target.value, 10))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>
      </section>

      {/* SECTION 3: GRAPHICS & FRAME PACING */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 space-y-4">
        <div className="border-b border-slate-800/80 pb-2">
          <h3 className="text-sm font-black uppercase tracking-wider text-white">
            Graphics & Performance
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Balance WebGL resolution scaling, shadows, and frame-rate cap.
          </p>
        </div>

        <div>
          <label className="block text-slate-400 uppercase tracking-wider mb-2 font-bold">
            Quality Preset
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(['LOW', 'MEDIUM', 'HIGH', 'ULTRA'] as GraphicsPreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => update('graphics', preset)}
                className={`rounded-lg border py-2 font-bold uppercase transition cursor-pointer ${
                  settings.graphics === preset
                    ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-600'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-slate-500">
            {settings.graphics === 'LOW' && '65% render scale, dynamic shadows off (fastest on mobile).'}
            {settings.graphics === 'MEDIUM' && '85% resolution scale with standard lighting and shadows.'}
            {settings.graphics === 'HIGH' && 'Native sharpness up to 1.5x DPR with soft directional shadows.'}
            {settings.graphics === 'ULTRA' && 'Maximum pixel density (up to 2.0x DPR) and crisp shadow maps.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 uppercase tracking-wider mb-2 font-bold">
              FPS Cap
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {([30, 60, 120, 0] as (30 | 60 | 120 | 0)[]).map((cap) => (
                <button
                  key={cap}
                  onClick={() => update('fpsCap', cap)}
                  className={`rounded-lg border py-1.5 font-bold transition cursor-pointer ${
                    settings.fpsCap === cap
                      ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {cap === 0 ? 'MAX' : cap}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-slate-400 uppercase tracking-wider mb-2 font-bold">
              FPS Counter
            </label>
            <button
              onClick={() => update('showFps', !settings.showFps)}
              className={`w-full rounded-lg border py-1.5 font-bold uppercase transition cursor-pointer ${
                settings.showFps
                  ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300'
                  : 'border-slate-800 bg-slate-900/60 text-slate-500'
              }`}
            >
              {settings.showFps ? 'VISIBLE ON HUD' : 'HIDDEN'}
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 4: MOBILE TOUCH & AUDIO */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 space-y-4">
        <div className="border-b border-slate-800/80 pb-2">
          <h3 className="text-sm font-black uppercase tracking-wider text-white">
            Mobile Layout & Audio
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Configure touch overlays, combat assists, and Web Audio volume.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 uppercase tracking-wider mb-1.5 font-bold">
              Touch Aim Assist
            </label>
            <button
              onClick={() => update('aimAssistMobile', !settings.aimAssistMobile)}
              className={`w-full rounded-lg border py-2 font-bold uppercase transition cursor-pointer ${
                settings.aimAssistMobile
                  ? 'border-cyan-400 bg-cyan-950/50 text-cyan-300'
                  : 'border-slate-800 bg-slate-900/60 text-slate-500'
              }`}
            >
              {settings.aimAssistMobile ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>

          <div>
            <label className="block text-slate-400 uppercase tracking-wider mb-1.5 font-bold">
              Touch Auto-Fire
            </label>
            <button
              onClick={() => update('autoFireMobile', !settings.autoFireMobile)}
              className={`w-full rounded-lg border py-2 font-bold uppercase transition cursor-pointer ${
                settings.autoFireMobile
                  ? 'border-amber-400 bg-amber-950/50 text-amber-300'
                  : 'border-slate-800 bg-slate-900/60 text-slate-500'
              }`}
            >
              {settings.autoFireMobile ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-400 uppercase">Touch Scale</span>
              <span className="text-white font-bold tabular-nums">
                {Math.round((settings.touchScale ?? 1.0) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.3"
              step="0.05"
              value={settings.touchScale ?? 1.0}
              onChange={(e) => update('touchScale', parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-400 uppercase">Touch Opacity</span>
              <span className="text-white font-bold tabular-nums">
                {Math.round((settings.touchOpacity ?? 0.85) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.3"
              max="1.0"
              step="0.05"
              value={settings.touchOpacity ?? 0.85}
              onChange={(e) => update('touchOpacity', parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-slate-800/80 pt-3">
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span className="text-slate-400 uppercase">Master Volume</span>
              <span className="text-white font-bold tabular-nums">
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.volume}
              onChange={(e) => update('volume', parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
          <button
            onClick={() => update('soundEnabled', !settings.soundEnabled)}
            className={`rounded-lg border px-4 py-2 font-bold uppercase transition cursor-pointer ${
              settings.soundEnabled
                ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300'
                : 'border-red-500/60 bg-red-950/40 text-red-300'
            }`}
          >
            {settings.soundEnabled ? 'AUDIO ON' : 'MUTED'}
          </button>
        </div>
      </section>
    </div>
  );
};
