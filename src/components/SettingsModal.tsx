/**
 * Hollow Strike - Tactical Settings Menu
 * Categorized tabs: Graphics, Controls, Audio, Gameplay.
 * Includes numeric sliders, toggles, reset to defaults, and live application.
 */

import React, { useState } from 'react';
import { GameSettings, GraphicsPreset } from '../game/types';
import { soundEngine } from '../game/audio';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
  onClose: () => void;
}

type SettingsTab = 'GRAPHICS' | 'CONTROLS' | 'AUDIO' | 'GAMEPLAY';

const DEFAULT_SETTINGS: GameSettings = {
  graphics: 'HIGH',
  fpsCap: 60,
  showFps: false,
  mouseSensitivity: 0.0022,
  touchSensitivity: 0.0035,
  fov: 90,
  volume: 0.7,
  soundEnabled: true,
  autoFireMobile: false,
  aimAssistMobile: true,
  touchScale: 1.0,
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('GRAPHICS');

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

  const handleResetDefaults = () => {
    onUpdateSettings(DEFAULT_SETTINGS);
    soundEngine.setVolume(DEFAULT_SETTINGS.volume);
    soundEngine.setMuted(!DEFAULT_SETTINGS.soundEnabled);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-hidden rounded-xl border border-slate-700 bg-slate-950/95 p-6 shadow-2xl flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
            <h2 className="text-lg font-black uppercase tracking-widest text-white">TACTICAL SETTINGS</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDefaults}
              className="rounded border border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-xs font-bold uppercase text-slate-400 hover:border-slate-700 hover:text-white transition cursor-pointer"
            >
              Reset Defaults
            </button>
            <button
              onClick={onClose}
              className="rounded border border-cyan-500/50 bg-cyan-950/60 px-4 py-1.5 font-mono text-xs font-bold uppercase text-cyan-300 hover:bg-cyan-900/60 transition cursor-pointer"
            >
              Save & Exit
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 mb-5 font-mono text-xs">
          {(['GRAPHICS', 'CONTROLS', 'AUDIO', 'GAMEPLAY'] as SettingsTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 font-black uppercase tracking-wider text-center transition cursor-pointer ${
                activeTab === tab
                  ? 'border-b-2 border-cyan-400 text-white bg-slate-900/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="overflow-y-auto space-y-6 text-xs font-mono text-slate-300 pr-1 flex-1">
          {/* TAB 1: GRAPHICS */}
          {activeTab === 'GRAPHICS' && (
            <div className="space-y-5">
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

              {/* FOV */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400 uppercase">Field of View (FOV)</span>
                  <span className="text-white font-bold">{settings.fov}°</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="115"
                  step="1"
                  value={settings.fov}
                  onChange={(e) => update('fov', parseInt(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 2: CONTROLS */}
          {activeTab === 'CONTROLS' && (
            <div className="space-y-5">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400 uppercase">Mouse Look Sensitivity (PC)</span>
                  <span className="text-white font-bold">{settings.mouseSensitivity.toFixed(4)}</span>
                </div>
                <input
                  type="range"
                  min="0.0008"
                  max="0.006"
                  step="0.0002"
                  value={settings.mouseSensitivity}
                  onChange={(e) => update('mouseSensitivity', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400 uppercase">Touch Swipe Sensitivity (Mobile)</span>
                  <span className="text-white font-bold">{settings.touchSensitivity.toFixed(4)}</span>
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
                  <span className="text-slate-400 uppercase">Mobile Virtual Button Scale</span>
                  <span className="text-white font-bold">{Math.round(settings.touchScale * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.2"
                  step="0.05"
                  value={settings.touchScale}
                  onChange={(e) => update('touchScale', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 3: AUDIO */}
          {activeTab === 'AUDIO' && (
            <div className="space-y-5">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400 uppercase">Master Volume</span>
                  <span className="text-white font-bold">{Math.round(settings.volume * 100)}%</span>
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

              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-2 font-bold">Sound Output</label>
                <button
                  onClick={() => update('soundEnabled', !settings.soundEnabled)}
                  className={`w-full rounded border py-2 font-bold uppercase transition cursor-pointer ${
                    settings.soundEnabled
                      ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300'
                      : 'border-slate-800 bg-slate-900/60 text-slate-500'
                  }`}
                >
                  {settings.soundEnabled ? 'SOUND ENABLED 🔊' : 'MUTED 🔇'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: GAMEPLAY */}
          {activeTab === 'GAMEPLAY' && (
            <div className="space-y-4">
              <label className="block text-slate-400 uppercase tracking-wider font-bold">Mobile Aim & Assist</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => update('autoFireMobile', !settings.autoFireMobile)}
                  className={`rounded border p-3 text-left transition cursor-pointer ${
                    settings.autoFireMobile
                      ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-300'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400'
                  }`}
                >
                  <div className="font-bold uppercase text-xs">Mobile Auto-Fire</div>
                  <div className="text-[10px] text-slate-500 mt-1">Fire automatically when crosshair aligns with enemy target.</div>
                  <div className="mt-2 text-[10px] font-bold text-cyan-400">
                    {settings.autoFireMobile ? '● ENABLED' : '○ DISABLED'}
                  </div>
                </button>

                <button
                  onClick={() => update('aimAssistMobile', !settings.aimAssistMobile)}
                  className={`rounded border p-3 text-left transition cursor-pointer ${
                    settings.aimAssistMobile
                      ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-300'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400'
                  }`}
                >
                  <div className="font-bold uppercase text-xs">Aim Magnetic Assist</div>
                  <div className="text-[10px] text-slate-500 mt-1">Subtle crosshair friction and slowdown when sweeping past targets.</div>
                  <div className="mt-2 text-[10px] font-bold text-cyan-400">
                    {settings.aimAssistMobile ? '● ENABLED' : '○ DISABLED'}
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
