/**
 * Hollow Strike - Tactical Settings Menu
 * Configures graphics presets (Low/Medium/High/Ultra), FPS limits, sensitivities, and audio.
 */

import React, { useEffect } from 'react';
import { GameSettings, GraphicsPreset } from '../game/types';
import { soundEngine } from '../game/audio';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tactical-settings-title"
        className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/95 p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-5">
          <h2 id="tactical-settings-title" className="text-lg font-black uppercase tracking-widest text-white">
            TACTICAL SETTINGS
          </h2>
          <button
            onClick={onClose}
            aria-label="Save & Exit settings"
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold uppercase text-slate-300 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none transition cursor-pointer"
          >
            Save & Exit [Esc]
          </button>
        </div>

        <div className="space-y-6 text-xs font-mono text-slate-300">
          {/* Graphics Preset */}
          <div>
            <label className="block text-slate-400 uppercase tracking-wider mb-2 font-bold">
              Graphics Quality Preset
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['LOW', 'MEDIUM', 'HIGH', 'ULTRA'] as GraphicsPreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => update('graphics', preset)}
                  className={`rounded border py-2 font-bold uppercase transition cursor-pointer ${
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
              {settings.graphics === 'LOW' && 'Low-poly geometry, 65% render scale, no dynamic shadows (optimized for mobile).'}
              {settings.graphics === 'MEDIUM' && 'Balanced resolution, light fog, and basic shadows.'}
              {settings.graphics === 'HIGH' && 'Native resolution, soft directional shadows, and PBR highlights.'}
              {settings.graphics === 'ULTRA' && 'Super-sampled resolution, maximum shadow fidelity, and extended draw distance.'}
            </p>
          </div>

          {/* FPS Cap & FPS Counter */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 uppercase tracking-wider mb-2 font-bold">FPS Cap</label>
              <div className="grid grid-cols-4 gap-1.5">
                {([30, 60, 120, 0] as (30 | 60 | 120 | 0)[]).map((cap) => (
                  <button
                    key={cap}
                    onClick={() => update('fpsCap', cap)}
                    className={`rounded border py-1.5 font-bold transition cursor-pointer ${
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
              <label className="block text-slate-400 uppercase tracking-wider mb-2 font-bold">FPS Counter</label>
              <button
                onClick={() => update('showFps', !settings.showFps)}
                className={`w-full rounded border py-1.5 font-bold uppercase transition cursor-pointer ${
                  settings.showFps
                    ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300'
                    : 'border-slate-800 bg-slate-900/60 text-slate-500'
                }`}
              >
                {settings.showFps ? 'DISPLAY ACTIVE' : 'HIDDEN'}
              </button>
            </div>
          </div>

          {/* Sensitivities */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <label htmlFor="mouse-sensitivity-slider" className="text-slate-400 uppercase cursor-pointer">Mouse Look Sensitivity (PC)</label>
                <span className="text-white font-bold">{settings.mouseSensitivity.toFixed(4)}</span>
              </div>
              <input id="mouse-sensitivity-slider" type="range" min="0.0008" max="0.006" step="0.0002" aria-label="Mouse Look Sensitivity" aria-valuenow={settings.mouseSensitivity} aria-valuetext={settings.mouseSensitivity.toFixed(4)} value={settings.mouseSensitivity} onChange={(e) => update('mouseSensitivity', parseFloat(e.target.value))} className="w-full accent-cyan-400 focus-visible:outline-2 focus-visible:outline-cyan-400 rounded cursor-pointer" />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label htmlFor="touch-sensitivity-slider" className="text-slate-400 uppercase cursor-pointer">Touch Swipe Sensitivity (Mobile)</label>
                <span className="text-white font-bold">{settings.touchSensitivity.toFixed(4)}</span>
              </div>
              <input id="touch-sensitivity-slider" type="range" min="0.001" max="0.008" step="0.0002" aria-label="Touch Swipe Sensitivity" aria-valuenow={settings.touchSensitivity} aria-valuetext={settings.touchSensitivity.toFixed(4)} value={settings.touchSensitivity} onChange={(e) => update('touchSensitivity', parseFloat(e.target.value))} className="w-full accent-cyan-400 focus-visible:outline-2 focus-visible:outline-cyan-400 rounded cursor-pointer" />
            </div>
          </div>

          {/* FOV */}
          <div>
            <div className="flex justify-between mb-1">
              <label htmlFor="fov-slider" className="text-slate-400 uppercase cursor-pointer">Field of View (FOV)</label>
              <span className="text-white font-bold">{settings.fov}°</span>
            </div>
            <input id="fov-slider" type="range" min="80" max="115" step="1" aria-label="Field of View" aria-valuenow={settings.fov} aria-valuetext={`${settings.fov} degrees`} value={settings.fov} onChange={(e) => update('fov', parseInt(e.target.value))} className="w-full accent-cyan-400 focus-visible:outline-2 focus-visible:outline-cyan-400 rounded cursor-pointer" />
          </div>

          {/* Audio */}
          <div>
            <div className="flex justify-between mb-1">
              <label htmlFor="master-volume-slider" className="text-slate-400 uppercase cursor-pointer">Master Volume</label>
              <span className="text-white font-bold">{Math.round(settings.volume * 100)}%</span>
            </div>
            <input id="master-volume-slider" type="range" min="0" max="1" step="0.05" aria-label="Master Volume" aria-valuenow={Math.round(settings.volume * 100)} aria-valuetext={`${Math.round(settings.volume * 100)} percent`} value={settings.volume} onChange={(e) => update('volume', parseFloat(e.target.value))} className="w-full accent-cyan-400 focus-visible:outline-2 focus-visible:outline-cyan-400 rounded cursor-pointer" />
          </div>

          {/* Mobile Assists */}
          <div className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-3">
            <button
              onClick={() => update('autoFireMobile', !settings.autoFireMobile)}
              className={`rounded border p-2 text-left transition cursor-pointer ${
                settings.autoFireMobile
                  ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-300'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400'
              }`}
            >
              <div className="font-bold uppercase text-[11px]">Mobile Auto-Fire</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Fire when crosshair aligns with enemy</div>
            </button>

            <button
              onClick={() => update('aimAssistMobile', !settings.aimAssistMobile)}
              className={`rounded border p-2 text-left transition cursor-pointer ${
                settings.aimAssistMobile
                  ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-300'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400'
              }`}
            >
              <div className="font-bold uppercase text-[11px]">Aim Magnetic Pull</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Subtle crosshair friction on target</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
