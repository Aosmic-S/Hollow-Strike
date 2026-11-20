/**
 * Hollow Strike - Unified Tactical Settings Panel
 * Shared between Lobby full-screen Settings page and in-game Pause Settings modal.
 * Includes full Crosshair Reticle Customizer, On-Screen Controls HUD Layout Mapping,
 * Graphics/FPS controls, and Keybindings remapper.
 */

import React, { useEffect, useState } from 'react';
import {
  ControlMode,
  CROSSHAIR_PRESETS,
  CrosshairConfig,
  CrosshairStyle,
  DEFAULT_CROSSHAIR_CONFIG,
  DEFAULT_KEY_BINDINGS,
  GameSettings,
  GraphicsPreset,
  KeyBindings,
  TOUCH_LAYOUT_PRESETS,
  TouchLayoutPresetId,
} from '../game/types';
import { soundEngine } from '../game/audio';
import {
  applyTouchLayoutPreset,
  clampCrosshairConfig,
  formatKeyCode,
  remapKeyBinding,
  resolveCrosshairConfig,
} from '../game/rules';
import { CrosshairReticle } from './CrosshairReticle';
import { TouchLayoutEditor } from './TouchLayoutEditor';

const KEYBINDING_FIELDS: { action: keyof KeyBindings; label: string }[] = [
  { action: 'moveForward', label: 'Move Forward' },
  { action: 'moveBackward', label: 'Move Back' },
  { action: 'moveLeft', label: 'Strafe Left' },
  { action: 'moveRight', label: 'Strafe Right' },
  { action: 'jump', label: 'Jump' },
  { action: 'crouch', label: 'Crouch' },
  { action: 'reload', label: 'Reload' },
  { action: 'inspectWeapon', label: 'Inspect Weapon' },
  { action: 'plantDefuse', label: 'Plant / Defuse' },
  { action: 'primaryWeapon', label: 'Primary Slot' },
  { action: 'sidearmWeapon', label: 'Sidearm Slot' },
  { action: 'meleeWeapon', label: 'Hollow Blade [3]' },
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

const CROSSHAIR_STYLES: { id: CrosshairStyle; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'cross', label: 'Cross' },
  { id: 'dot', label: 'Dot' },
  { id: 'circle', label: 'Circle' },
  { id: 'chevron', label: 'Chevron' },
  { id: 't-shape', label: 'T-Bar' },
];

const CROSSHAIR_SWATCHES = [
  { hex: '#17e5b8', name: 'Teal' },
  { hex: '#22d3ee', name: 'Cyan' },
  { hex: '#ff4655', name: 'Crimson' },
  { hex: '#ece8e1', name: 'Parchment' },
  { hex: '#fbbf24', name: 'Amber' },
  { hex: '#a855f7', name: 'Violet' },
];

interface SettingsPanelProps {
  settings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
  compact?: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  compact = false,
}) => {
  const [listeningAction, setListeningAction] = useState<keyof KeyBindings | null>(null);
  const [showTouchEditor, setShowTouchEditor] = useState<boolean>(false);
  const [previewBloomTest, setPreviewBloomTest] = useState<boolean>(false);
  const currentBindings = settings.keyBindings ?? DEFAULT_KEY_BINDINGS;

  const chConfig = resolveCrosshairConfig({
    crosshairColor: settings.crosshairColor,
    crosshairSize: settings.crosshairSize,
    crosshairConfig: settings.crosshairConfig,
  });

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

  const updateCrosshair = (patch: Partial<CrosshairConfig>) => {
    const next = clampCrosshairConfig({ ...chConfig, ...patch });
    onUpdateSettings({ ...settings, crosshairConfig: next });
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

  return (
    <>
      {showTouchEditor && (
        <TouchLayoutEditor
          layout={settings.touchLayout}
          onSave={(nextLayout) => update('touchLayout', nextLayout)}
          onClose={() => setShowTouchEditor(false)}
        />
      )}

      <div
        className={`grid gap-6 font-mono text-xs text-[#ECE8E1]/90 ${
          compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'
        }`}
      >
        {/* SECTION 1: AIM & SENSITIVITY */}
        <section className="clip-val-panel border border-[#ECE8E1]/15 bg-[#18232E]/95 p-4 sm:p-5 space-y-4">
          <div className="border-b border-[#ECE8E1]/10 pb-2.5 flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold uppercase tracking-wider text-[#ECE8E1]">
                Controls & Sensitivity
              </h3>
              <p className="text-[11px] text-[#8B978F] mt-0.5">
                Calibrate input device mode, look speed, ADS scaling, and Y-axis orientation.
              </p>
            </div>
            <span className="h-2 w-2 bg-[#FF4655]" />
          </div>

          <div>
            <label className="block text-[#8B978F] uppercase tracking-wider mb-2 font-bold">
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
                  className={`border py-2 font-bold uppercase tracking-wider transition cursor-pointer ${
                    settings.controlMode === m.id
                      ? 'border-[#17E5B8] bg-[#17E5B8]/15 text-[#17E5B8]'
                      : 'border-[#ECE8E1]/15 bg-[#0F1923] text-[#8B978F] hover:border-[#ECE8E1]/35 hover:text-[#ECE8E1]'
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
                <span className="text-[#8B978F] uppercase">Mouse Look Sensitivity (PC)</span>
                <span className="text-[#ECE8E1] font-bold tabular-nums" data-testid="mouse-sens-value">
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#ECE8E1]/20 bg-[#0F1923] text-sm font-black text-[#ECE8E1] hover:border-[#FF4655] cursor-pointer"
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
                  className="w-full h-3 accent-[#FF4655] cursor-pointer touch-pan-x select-auto"
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#ECE8E1]/20 bg-[#0F1923] text-sm font-black text-[#ECE8E1] hover:border-[#FF4655] cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[#8B978F] uppercase">Touch Look Sensitivity (Mobile)</span>
                <span className="text-[#ECE8E1] font-bold tabular-nums" data-testid="touch-sens-value">
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#ECE8E1]/20 bg-[#0F1923] text-sm font-black text-[#ECE8E1] hover:border-[#FF4655] cursor-pointer"
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
                  className="w-full h-3 accent-[#FF4655] cursor-pointer touch-pan-x select-auto"
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#ECE8E1]/20 bg-[#0F1923] text-sm font-black text-[#ECE8E1] hover:border-[#FF4655] cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[#8B978F] uppercase">ADS / Scope Sensitivity Multiplier</span>
                <span className="text-[#ECE8E1] font-bold tabular-nums" data-testid="ads-sens-value">
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#ECE8E1]/20 bg-[#0F1923] text-sm font-black text-[#ECE8E1] hover:border-[#FF4655] cursor-pointer"
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
                  className="w-full h-3 accent-[#FF4655] cursor-pointer touch-pan-x select-auto"
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#ECE8E1]/20 bg-[#0F1923] text-sm font-black text-[#ECE8E1] hover:border-[#FF4655] cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#ECE8E1]/10 pt-3">
            <div>
              <div className="font-bold uppercase text-[#ECE8E1]">Invert Y-Axis</div>
              <div className="text-[10px] text-[#8B978F]">Flip vertical aim direction</div>
            </div>
            <button
              onClick={() => update('invertY', !settings.invertY)}
              className={`border px-4 py-1.5 font-bold uppercase tracking-wider transition cursor-pointer ${
                settings.invertY
                  ? 'border-[#17E5B8] bg-[#17E5B8]/15 text-[#17E5B8]'
                  : 'border-[#ECE8E1]/15 bg-[#0F1923] text-[#8B978F]'
              }`}
            >
              {settings.invertY ? 'INVERTED' : 'STANDARD'}
            </button>
          </div>
        </section>

        {/* SECTION 2: CUSTOMIZABLE CROSSHAIR & VIEWPORT */}
        <section className="clip-val-panel border border-[#ECE8E1]/15 bg-[#18232E]/95 p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between border-b border-[#ECE8E1]/10 pb-2.5">
            <div>
              <h3 className="font-display text-lg font-bold uppercase tracking-wider text-[#ECE8E1]">
                Crosshair Customizer & FOV
              </h3>
              <p className="text-[11px] text-[#8B978F] mt-0.5">
                Pick reticle style, hex color, thickness, gap, center dot & dynamic spread bloom.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, crosshairConfig: { ...DEFAULT_CROSSHAIR_CONFIG } })}
              className="border border-[#ECE8E1]/20 bg-[#0F1923] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#fbbf24] hover:border-[#fbbf24] cursor-pointer"
            >
              Reset Reticle
            </button>
          </div>

          {/* Live Preview + Style / Presets */}
          <div className="flex flex-col sm:flex-row gap-3 border border-[#ECE8E1]/10 bg-[#0F1923]/80 p-3">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="relative flex h-24 w-24 items-center justify-center border border-[#ECE8E1]/20 overflow-hidden bg-gradient-to-br from-[#0F1923] via-[#1f2d3b] to-[#52606d]">
                <CrosshairReticle config={chConfig} bloomPx={previewBloomTest ? 5 : 0} />
              </div>
              <button
                type="button"
                onClick={() => setPreviewBloomTest((v) => !v)}
                className={`border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider cursor-pointer ${
                  previewBloomTest
                    ? 'border-[#17E5B8] bg-[#17E5B8]/15 text-[#17E5B8]'
                    : 'border-[#ECE8E1]/15 bg-[#18232E] text-[#8B978F]'
                }`}
              >
                {previewBloomTest ? 'Testing Bloom' : 'Test Move Bloom'}
              </button>
            </div>

            <div className="flex-1 space-y-2.5">
              <div>
                <span className="block text-[10px] text-[#8B978F] uppercase mb-1 font-bold">
                  Presets
                </span>
                <div className="flex flex-wrap gap-1">
                  {CROSSHAIR_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      data-testid={`crosshair-preset-${preset.id}`}
                      onClick={() => updateCrosshair(preset.config)}
                      className="border border-[#ECE8E1]/15 bg-[#18232E] px-2 py-1 text-[10px] font-bold uppercase text-[#ECE8E1] hover:border-[#17E5B8] hover:text-[#17E5B8] transition cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-[10px] text-[#8B978F] uppercase mb-1 font-bold">
                  Reticle Shape
                </span>
                <div className="grid grid-cols-3 gap-1">
                  {CROSSHAIR_STYLES.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      data-testid={`crosshair-style-${st.id}`}
                      onClick={() => updateCrosshair({ style: st.id })}
                      className={`border py-1 text-[10px] font-bold uppercase transition cursor-pointer ${
                        chConfig.style === st.id
                          ? 'border-[#17E5B8] bg-[#17E5B8]/15 text-[#17E5B8]'
                          : 'border-[#ECE8E1]/15 bg-[#18232E] text-[#8B978F] hover:border-[#ECE8E1]/35'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Color Swatches + Custom Color Picker */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] text-[#8B978F] uppercase font-bold">Reticle Color</span>
            <div className="flex items-center gap-1.5">
              {CROSSHAIR_SWATCHES.map((sw) => (
                <button
                  key={sw.hex}
                  type="button"
                  onClick={() => updateCrosshair({ color: sw.hex })}
                  title={sw.name}
                  className={`h-6 w-6 border-2 transition cursor-pointer ${
                    chConfig.color.toLowerCase() === sw.hex
                      ? 'border-[#ECE8E1] scale-110'
                      : 'border-[#ECE8E1]/20 opacity-75 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: sw.hex }}
                />
              ))}
              <label className="flex items-center gap-1 border border-[#ECE8E1]/20 bg-[#0F1923] px-1.5 py-0.5 text-[10px] text-[#ECE8E1] cursor-pointer">
                <span>HEX</span>
                <input
                  type="color"
                  aria-label="Custom Crosshair Color"
                  value={chConfig.color}
                  onChange={(e) => updateCrosshair({ color: e.target.value })}
                  className="h-5 w-6 bg-transparent border-0 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Reticle Dimension Sliders */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <div>
              <div className="flex justify-between text-[10px]">
                <span className="text-[#8B978F] uppercase">Length</span>
                <span className="text-[#ECE8E1] font-bold tabular-nums">{chConfig.length}px</span>
              </div>
              <input
                type="range"
                aria-label="Crosshair Length"
                min="2"
                max="22"
                step="1"
                value={chConfig.length}
                onChange={(e) => updateCrosshair({ length: parseInt(e.target.value, 10) })}
                className="w-full h-2.5 accent-[#FF4655] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px]">
                <span className="text-[#8B978F] uppercase">Thickness</span>
                <span className="text-[#ECE8E1] font-bold tabular-nums">{chConfig.thickness}px</span>
              </div>
              <input
                type="range"
                aria-label="Crosshair Thickness"
                min="1"
                max="6"
                step="1"
                value={chConfig.thickness}
                onChange={(e) => updateCrosshair({ thickness: parseInt(e.target.value, 10) })}
                className="w-full h-2.5 accent-[#FF4655] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px]">
                <span className="text-[#8B978F] uppercase">Center Gap</span>
                <span className="text-[#ECE8E1] font-bold tabular-nums">{chConfig.gap}px</span>
              </div>
              <input
                type="range"
                aria-label="Crosshair Gap"
                min="0"
                max="16"
                step="1"
                value={chConfig.gap}
                onChange={(e) => updateCrosshair({ gap: parseInt(e.target.value, 10) })}
                className="w-full h-2.5 accent-[#FF4655] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px]">
                <span className="text-[#8B978F] uppercase">Opacity</span>
                <span className="text-[#ECE8E1] font-bold tabular-nums">{Math.round(chConfig.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                aria-label="Crosshair Opacity"
                min="0.25"
                max="1"
                step="0.05"
                value={chConfig.opacity}
                onChange={(e) => updateCrosshair({ opacity: parseFloat(e.target.value) })}
                className="w-full h-2.5 accent-[#FF4655] cursor-pointer"
              />
            </div>
          </div>

          {/* Center Dot + Contrast Toggles */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => updateCrosshair({ showDot: !chConfig.showDot })}
              className={`border py-1.5 text-[10px] font-bold uppercase cursor-pointer ${
                chConfig.showDot
                  ? 'border-[#17E5B8] bg-[#17E5B8]/15 text-[#17E5B8]'
                  : 'border-[#ECE8E1]/15 bg-[#0F1923] text-[#8B978F]'
              }`}
            >
              Dot: {chConfig.showDot ? `ON (${chConfig.dotSize}px)` : 'OFF'}
            </button>
            <button
              type="button"
              onClick={() => updateCrosshair({ outline: !chConfig.outline })}
              className={`border py-1.5 text-[10px] font-bold uppercase cursor-pointer ${
                chConfig.outline
                  ? 'border-[#17E5B8] bg-[#17E5B8]/15 text-[#17E5B8]'
                  : 'border-[#ECE8E1]/15 bg-[#0F1923] text-[#8B978F]'
              }`}
            >
              Outline: {chConfig.outline ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={() => updateCrosshair({ dynamic: !chConfig.dynamic })}
              className={`border py-1.5 text-[10px] font-bold uppercase cursor-pointer ${
                chConfig.dynamic
                  ? 'border-[#17E5B8] bg-[#17E5B8]/15 text-[#17E5B8]'
                  : 'border-[#ECE8E1]/15 bg-[#0F1923] text-[#8B978F]'
              }`}
            >
              Dynamic: {chConfig.dynamic ? 'ON' : 'STATIC'}
            </button>
          </div>

          {chConfig.showDot && (
            <div>
              <div className="flex justify-between text-[10px]">
                <span className="text-[#8B978F] uppercase">Center Dot Size</span>
                <span className="text-[#ECE8E1] font-bold tabular-nums">{chConfig.dotSize}px</span>
              </div>
              <input
                type="range"
                aria-label="Center Dot Size"
                min="2"
                max="8"
                step="1"
                value={chConfig.dotSize}
                onChange={(e) => updateCrosshair({ dotSize: parseInt(e.target.value, 10) })}
                className="w-full h-2.5 accent-[#FF4655] cursor-pointer"
              />
            </div>
          )}

          <div className="border-t border-[#ECE8E1]/10 pt-2.5">
            <div className="flex justify-between mb-1">
              <span className="text-[#8B978F] uppercase">Field of View (FOV)</span>
              <span className="text-[#ECE8E1] font-bold tabular-nums">{settings.fov}°</span>
            </div>
            <input
              type="range"
              aria-label="Field of View"
              min="80"
              max="115"
              step="1"
              value={settings.fov}
              onChange={(e) => update('fov', parseInt(e.target.value, 10))}
              className="w-full h-3 accent-[#FF4655] cursor-pointer touch-pan-x select-auto"
            />
          </div>
        </section>

        {/* SECTION 3: GRAPHICS & FRAME PACING */}
        <section className="clip-val-panel border border-[#ECE8E1]/15 bg-[#18232E]/95 p-4 sm:p-5 space-y-4">
          <div className="border-b border-[#ECE8E1]/10 pb-2.5">
            <h3 className="font-display text-lg font-bold uppercase tracking-wider text-[#ECE8E1]">
              Graphics & Performance
            </h3>
            <p className="text-[11px] text-[#8B978F] mt-0.5">
              Balance WebGL resolution scaling, shadows, and frame-rate cap.
            </p>
          </div>

          <div>
            <label className="block text-[#8B978F] uppercase tracking-wider mb-2 font-bold">
              Quality Preset
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['LOW', 'MEDIUM', 'HIGH', 'ULTRA'] as GraphicsPreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => update('graphics', preset)}
                  className={`border py-2 font-bold uppercase tracking-wider transition cursor-pointer ${
                    settings.graphics === preset
                      ? 'border-[#17E5B8] bg-[#17E5B8]/15 text-[#17E5B8]'
                      : 'border-[#ECE8E1]/15 bg-[#0F1923] text-[#8B978F] hover:border-[#ECE8E1]/35'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-[#8B978F]">
              {settings.graphics === 'LOW' && '65% render scale, dynamic shadows off (fastest on mobile).'}
              {settings.graphics === 'MEDIUM' && '85% resolution scale with standard lighting and shadows.'}
              {settings.graphics === 'HIGH' && 'Native sharpness up to 1.5x DPR with soft directional shadows.'}
              {settings.graphics === 'ULTRA' && 'Maximum pixel density (up to 2.0x DPR) and crisp shadow maps.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[#8B978F] uppercase tracking-wider mb-2 font-bold">
                FPS Cap
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {([30, 60, 120, 0] as (30 | 60 | 120 | 0)[]).map((cap) => (
                  <button
                    key={cap}
                    onClick={() => update('fpsCap', cap)}
                    className={`border py-1.5 font-bold transition cursor-pointer ${
                      settings.fpsCap === cap
                        ? 'border-[#17E5B8] bg-[#17E5B8]/15 text-[#17E5B8]'
                        : 'border-[#ECE8E1]/15 bg-[#0F1923] text-[#8B978F] hover:border-[#ECE8E1]/35'
                    }`}
                  >
                    {cap === 0 ? 'MAX' : cap}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[#8B978F] uppercase tracking-wider mb-2 font-bold">
                FPS Counter
              </label>
              <button
                onClick={() => update('showFps', !settings.showFps)}
                className={`w-full border py-1.5 font-bold uppercase tracking-wider transition cursor-pointer ${
                  settings.showFps
                    ? 'border-[#17E5B8]/60 bg-[#17E5B8]/15 text-[#17E5B8]'
                    : 'border-[#ECE8E1]/15 bg-[#0F1923] text-[#8B978F]'
                }`}
              >
                {settings.showFps ? 'VISIBLE ON HUD' : 'HIDDEN'}
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 4: ON-SCREEN CONTROLS MAPPING, MOBILE ASSIST & AUDIO */}
        <section className="clip-val-panel border border-[#ECE8E1]/15 bg-[#18232E]/95 p-4 sm:p-5 space-y-4">
          <div className="border-b border-[#ECE8E1]/10 pb-2.5">
            <h3 className="font-display text-lg font-bold uppercase tracking-wider text-[#ECE8E1]">
              On-Screen Touch Mapping & Audio
            </h3>
            <p className="text-[11px] text-[#8B978F] mt-0.5">
              Customize button positions, scale, claw presets, touch assists, and Web Audio volume.
            </p>
          </div>

          <div className="border border-[#FF4655]/30 bg-[#0F1923]/80 p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-[#ECE8E1]">
                  On-Screen Controls Layout
                </div>
                <div className="text-[10px] text-[#8B978F]">
                  Reposition joystick, fire, ADS, jump, reload & abilities
                </div>
              </div>
              <button
                type="button"
                data-testid="open-touch-editor-btn"
                onClick={() => setShowTouchEditor(true)}
                className="clip-val-btn bg-[#FF4655] px-4 py-2 font-display text-sm font-bold uppercase tracking-widest text-[#ECE8E1] shadow hover:bg-[#d93644] transition cursor-pointer"
              >
                Open HUD Layout Editor
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {(['DEFAULT', 'CLAW_4FINGER', 'LEFT_HANDED'] as TouchLayoutPresetId[]).map((pid) => (
                <button
                  key={pid}
                  type="button"
                  onClick={() => update('touchLayout', applyTouchLayoutPreset(pid))}
                  className="border border-[#ECE8E1]/15 bg-[#18232E] py-1.5 text-[10px] font-bold uppercase text-[#ECE8E1] hover:border-[#17E5B8] hover:text-[#17E5B8] transition cursor-pointer"
                >
                  {TOUCH_LAYOUT_PRESETS[pid].label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#8B978F] uppercase tracking-wider mb-1.5 font-bold">
                Touch Aim Assist
              </label>
              <button
                onClick={() => update('aimAssistMobile', !settings.aimAssistMobile)}
                className={`w-full border py-2 font-bold uppercase tracking-wider transition cursor-pointer ${
                  settings.aimAssistMobile
                    ? 'border-[#17E5B8] bg-[#17E5B8]/15 text-[#17E5B8]'
                    : 'border-[#ECE8E1]/15 bg-[#0F1923] text-[#8B978F]'
                }`}
              >
                {settings.aimAssistMobile ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            <div>
              <label className="block text-[#8B978F] uppercase tracking-wider mb-1.5 font-bold">
                Touch Auto-Fire
              </label>
              <button
                onClick={() => update('autoFireMobile', !settings.autoFireMobile)}
                className={`w-full border py-2 font-bold uppercase tracking-wider transition cursor-pointer ${
                  settings.autoFireMobile
                    ? 'border-[#fbbf24] bg-[#fbbf24]/15 text-[#fbbf24]'
                    : 'border-[#ECE8E1]/15 bg-[#0F1923] text-[#8B978F]'
                }`}
              >
                {settings.autoFireMobile ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[#8B978F] uppercase">Touch Scale</span>
                <span className="text-[#ECE8E1] font-bold tabular-nums">
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
                className="w-full h-3 accent-[#FF4655] cursor-pointer touch-pan-x select-auto"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[#8B978F] uppercase">Touch Opacity</span>
                <span className="text-[#ECE8E1] font-bold tabular-nums">
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
                className="w-full h-3 accent-[#FF4655] cursor-pointer touch-pan-x select-auto"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-[#ECE8E1]/10 pt-3">
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-[#8B978F] uppercase">Master Volume</span>
                <span className="text-[#ECE8E1] font-bold tabular-nums">
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
                className="w-full h-3 accent-[#FF4655] cursor-pointer touch-pan-x select-auto"
              />
            </div>
            <button
              onClick={() => update('soundEnabled', !settings.soundEnabled)}
              className={`border px-4 py-2 font-bold uppercase tracking-wider transition cursor-pointer ${
                settings.soundEnabled
                  ? 'border-[#17E5B8]/60 bg-[#17E5B8]/15 text-[#17E5B8]'
                  : 'border-[#FF4655]/60 bg-[#FF4655]/15 text-[#FF4655]'
              }`}
            >
              {settings.soundEnabled ? 'AUDIO ON' : 'MUTED'}
            </button>
          </div>
        </section>

        {/* SECTION 5: MAPPABLE PC KEYBINDINGS */}
        <section
          className={`clip-val-panel border border-[#ECE8E1]/15 bg-[#18232E]/95 p-4 sm:p-5 space-y-4 ${
            compact ? '' : 'lg:col-span-2'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECE8E1]/10 pb-2.5">
            <div>
              <h3 className="font-display text-lg font-bold uppercase tracking-wider text-[#ECE8E1]">
                Mappable Keyboard Controls
              </h3>
              <p className="text-[11px] text-[#8B978F] mt-0.5">
                Tap any binding and press a new key. Conflicting keys swap automatically; Esc cancels capture.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setListeningAction(null);
                update('keyBindings', { ...DEFAULT_KEY_BINDINGS });
              }}
              className="border border-[#ECE8E1]/20 bg-[#0F1923] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#fbbf24] hover:border-[#fbbf24] transition cursor-pointer"
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
                  className="flex items-center justify-between gap-2 border border-[#ECE8E1]/10 bg-[#0F1923]/80 px-2.5 py-2"
                >
                  <span className="text-[11px] font-bold uppercase text-[#ECE8E1]/85 truncate">
                    {field.label}
                  </span>
                  <button
                    type="button"
                    data-testid={`keybind-${field.action}`}
                    aria-label={`Rebind ${field.label}`}
                    onClick={() => setListeningAction(isListening ? null : field.action)}
                    className={`min-w-[64px] shrink-0 border px-2 py-1 text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                      isListening
                        ? 'border-[#FF4655] bg-[#FF4655]/20 text-[#FF4655]'
                        : 'border-[#17E5B8]/40 bg-[#18232E] text-[#17E5B8] hover:border-[#17E5B8]'
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
    </>
  );
};
