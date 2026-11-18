/**
 * Hollow Strike - Unified Tactical Settings Panel
 * Shared between Lobby full-screen Settings page and in-game Pause Settings modal.
 * Every control applies live and persists automatically.
 */

import React, { useEffect, useState } from 'react';
import {
  ControlMode,
  CrosshairColor,
  CrosshairSize,
  DEFAULT_KEY_BINDINGS,
  GameSettings,
  GraphicsPreset,
  KeyBindings,
} from '../game/types';
import { soundEngine } from '../game/audio';
import { formatKeyCode, remapKeyBinding } from '../game/rules';

const KEYBINDING_FIELDS: { action: keyof KeyBindings; label: string }[] = [
  { action: 'moveForward', label: 'Move Forward' },
  { action: 'moveBackward', label: 'Move Back' },
  { action: 'moveLeft', label: 'Strafe Left' },
  { action: 'moveRight', label: 'Strafe Right' },
  { action: 'jump', label: 'Jump' },
  { action: 'crouch', label: 'Crouch' },
  { action: 'reload', label: 'Reload' },
  { action: 'plantDefuse', label: 'Plant / Defuse' },
  { action: 'primaryWeapon', label: 'Primary Slot' },
  { action: 'sidearmWeapon', label: 'Sidearm Slot' },
  { action: 'abilityQ', label: 'Ability Q' },
  { action: 'abilityE', label: 'Ability E' },
  { action: 'abilityC', label: 'Ability C' },
  { action: 'abilityX', label: 'Ultimate X' },
  { action: 'buyMenu', label: 'Armory / Shop' },
  { action: 'tacticalMap', label: 'Tactical Map' },
  { action: 'scoreboard', label: 'Scoreboard' },
  { action: 'startRound', label: 'Start Fight' },
  { action: 'pause', label: 'Pause Menu' },
];

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
  const [listeningAction, setListeningAction] = useState<keyof KeyBindings | null>(null);
  const currentBindings = settings.keyBindings ?? DEFAULT_KEY_BINDINGS;

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

  useEffect(() => {
    if (!listeningAction) {
      delete document.body.dataset.rebinding;
      return;
    }

    document.body.dataset.rebinding = '1';
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.code === 'Escape') {
        setListeningAction(null);
        return;
      }

      if (e.code) {
        const nextBindings = remapKeyBinding(currentBindings, listeningAction, e.code);
        onUpdateSettings({ ...settings, keyBindings: nextBindings });
        setListeningAction(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      delete document.body.dataset.rebinding;
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [listeningAction, currentBindings, settings, onUpdateSettings]);

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
              <span className="text-white font-bold tabular-nums" data-testid="mouse-sens-value">
                {(settings.mouseSensitivity * 1000).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease mouse sensitivity"
                onClick={() =>
                  update(
                    'mouseSensitivity',
                    Number(Math.max(0.0004, settings.mouseSensitivity - 0.0002).toFixed(4))
                  )
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-sm font-black text-slate-200 hover:border-cyan-400 cursor-pointer"
              >
                -
              </button>
              <input
                type="range"
                aria-label="Mouse Look Sensitivity"
                min="0.0004"
                max="0.01"
                step="0.0002"
                value={settings.mouseSensitivity}
                onChange={(e) => update('mouseSensitivity', parseFloat(e.target.value))}
                className="w-full h-3 accent-cyan-400 cursor-pointer touch-pan-x select-auto"
              />
              <button
                type="button"
                aria-label="Increase mouse sensitivity"
                onClick={() =>
                  update(
                    'mouseSensitivity',
                    Number(Math.min(0.01, settings.mouseSensitivity + 0.0002).toFixed(4))
                  )
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-sm font-black text-slate-200 hover:border-cyan-400 cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-400 uppercase">Touch Look Sensitivity (Mobile)</span>
              <span className="text-white font-bold tabular-nums" data-testid="touch-sens-value">
                {(settings.touchSensitivity * 1000).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease touch sensitivity"
                onClick={() =>
                  update(
                    'touchSensitivity',
                    Number(Math.max(0.0008, settings.touchSensitivity - 0.0002).toFixed(4))
                  )
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-sm font-black text-slate-200 hover:border-cyan-400 cursor-pointer"
              >
                -
              </button>
              <input
                type="range"
                aria-label="Touch Look Sensitivity"
                min="0.0008"
                max="0.015"
                step="0.0002"
                value={settings.touchSensitivity}
                onChange={(e) => update('touchSensitivity', parseFloat(e.target.value))}
                className="w-full h-3 accent-cyan-400 cursor-pointer touch-pan-x select-auto"
              />
              <button
                type="button"
                aria-label="Increase touch sensitivity"
                onClick={() =>
                  update(
                    'touchSensitivity',
                    Number(Math.min(0.015, settings.touchSensitivity + 0.0002).toFixed(4))
                  )
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-sm font-black text-slate-200 hover:border-cyan-400 cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-400 uppercase">ADS / Scope Sensitivity Multiplier</span>
              <span className="text-white font-bold tabular-nums" data-testid="ads-sens-value">
                {Math.round((settings.adsSensitivityMultiplier ?? 0.7) * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease ADS sensitivity"
                onClick={() =>
                  update(
                    'adsSensitivityMultiplier',
                    Number(Math.max(0.3, (settings.adsSensitivityMultiplier ?? 0.7) - 0.05).toFixed(2))
                  )
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-sm font-black text-slate-200 hover:border-cyan-400 cursor-pointer"
              >
                -
              </button>
              <input
                type="range"
                aria-label="ADS Sensitivity Multiplier"
                min="0.3"
                max="1.2"
                step="0.05"
                value={settings.adsSensitivityMultiplier ?? 0.7}
                onChange={(e) => update('adsSensitivityMultiplier', parseFloat(e.target.value))}
                className="w-full h-3 accent-cyan-400 cursor-pointer touch-pan-x select-auto"
              />
              <button
                type="button"
                aria-label="Increase ADS sensitivity"
                onClick={() =>
                  update(
                    'adsSensitivityMultiplier',
                    Number(Math.min(1.2, (settings.adsSensitivityMultiplier ?? 0.7) + 0.05).toFixed(2))
                  )
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-sm font-black text-slate-200 hover:border-cyan-400 cursor-pointer"
              >
                +
              </button>
            </div>
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
            aria-label="Field of View"
            min="80"
            max="115"
            step="1"
            value={settings.fov}
            onChange={(e) => update('fov', parseInt(e.target.value, 10))}
            className="w-full h-3 accent-cyan-400 cursor-pointer touch-pan-x select-auto"
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
              aria-label="Touch Scale"
              min="0.8"
              max="1.3"
              step="0.05"
              value={settings.touchScale ?? 1.0}
              onChange={(e) => update('touchScale', parseFloat(e.target.value))}
              className="w-full h-3 accent-cyan-400 cursor-pointer touch-pan-x select-auto"
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
              aria-label="Touch Opacity"
              min="0.3"
              max="1.0"
              step="0.05"
              value={settings.touchOpacity ?? 0.85}
              onChange={(e) => update('touchOpacity', parseFloat(e.target.value))}
              className="w-full h-3 accent-cyan-400 cursor-pointer touch-pan-x select-auto"
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
              aria-label="Master Volume"
              min="0"
              max="1"
              step="0.05"
              value={settings.volume}
              onChange={(e) => update('volume', parseFloat(e.target.value))}
              className="w-full h-3 accent-cyan-400 cursor-pointer touch-pan-x select-auto"
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

      {/* SECTION 5: MAPPABLE PC KEYBINDINGS */}
      <section
        className={`rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 space-y-4 ${
          compact ? '' : 'lg:col-span-2'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              Mappable Controls (Keybindings)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tap any binding and press a new key. Conflicting keys swap automatically; Esc cancels capture.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setListeningAction(null);
              update('keyBindings', { ...DEFAULT_KEY_BINDINGS });
            }}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-bold uppercase text-amber-300 hover:border-amber-400 transition cursor-pointer"
          >
            Reset Defaults
          </button>
        </div>

        <div className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
          {KEYBINDING_FIELDS.map((field) => {
            const isListening = listeningAction === field.action;
            const code = currentBindings[field.action] ?? DEFAULT_KEY_BINDINGS[field.action];
            return (
              <div
                key={field.action}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/90 bg-slate-900/60 px-2.5 py-2"
              >
                <span className="text-[11px] font-bold uppercase text-slate-300 truncate">
                  {field.label}
                </span>
                <button
                  type="button"
                  data-testid={`keybind-${field.action}`}
                  aria-label={`Rebind ${field.label}`}
                  onClick={() => setListeningAction(isListening ? null : field.action)}
                  className={`min-w-[64px] shrink-0 rounded border px-2 py-1 text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                    isListening
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200 animate-pulse'
                      : 'border-cyan-500/40 bg-slate-950 text-cyan-300 hover:border-cyan-400'
                  }`}
                >
                  {isListening ? 'PRESS KEY...' : formatKeyCode(code)}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
