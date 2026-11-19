/**
 * Hollow Strike - Interactive On-Screen Controls Layout Mapper
 * Fullscreen drag-and-drop customization for touch virtual joystick & action buttons,
 * complete with layout presets, individual control scaling, visibility toggles, and instant save.
 */

import React, { useRef, useState } from 'react';
import {
  DEFAULT_TOUCH_LAYOUT,
  TOUCH_LAYOUT_PRESETS,
  TouchControlId,
  TouchControlLayout,
  TouchLayoutPresetId,
} from '../game/types';
import {
  applyTouchLayoutPreset,
  normalizeTouchLayout,
  updateTouchControlSlot,
} from '../game/rules';

interface TouchLayoutEditorProps {
  layout?: TouchControlLayout;
  onSave: (nextLayout: TouchControlLayout) => void;
  onClose: () => void;
}

const CONTROL_META: Record<TouchControlId, { label: string; sizePx: number; isCircle?: boolean; color: string; required?: boolean }> = {
  joystick: { label: 'MOVE JOYSTICK', sizePx: 128, isCircle: true, color: 'border-cyan-400 bg-cyan-950/70 text-cyan-200', required: true },
  fire: { label: 'FIRE', sizePx: 76, isCircle: true, color: 'border-rose-400 bg-rose-700/80 text-white', required: true },
  ads: { label: 'ADS', sizePx: 54, color: 'border-slate-500 bg-slate-900/90 text-slate-100' },
  crouch: { label: 'CROUCH', sizePx: 54, color: 'border-slate-500 bg-slate-900/90 text-slate-100' },
  jump: { label: 'JUMP', sizePx: 54, color: 'border-slate-500 bg-slate-900/90 text-slate-100' },
  reload: { label: 'RELOAD', sizePx: 54, color: 'border-slate-500 bg-slate-900/90 text-slate-100' },
  weaponSwap: { label: 'SWAP', sizePx: 58, color: 'border-cyan-500 bg-slate-900/90 text-cyan-300' },
  plantDefuse: { label: 'PLANT / DEFUSE', sizePx: 64, color: 'border-amber-400 bg-amber-700/85 text-white' },
  abilityE: { label: 'AB [E]', sizePx: 52, color: 'border-cyan-400 bg-slate-900/90 text-cyan-300' },
  abilityQ: { label: 'AB [Q]', sizePx: 52, color: 'border-cyan-400 bg-slate-900/90 text-cyan-300' },
  abilityC: { label: 'AB [C]', sizePx: 52, color: 'border-cyan-400 bg-slate-900/90 text-cyan-300' },
  abilityX: { label: 'ULT [X]', sizePx: 52, color: 'border-amber-400 bg-amber-900/85 text-amber-200' },
};

export const TouchLayoutEditor: React.FC<TouchLayoutEditorProps> = ({
  layout,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<TouchControlLayout>(() => normalizeTouchLayout(layout));
  const [selectedId, setSelectedId] = useState<TouchControlId>('fire');
  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<{
    id: TouchControlId;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    origXPct: number;
    origYPct: number;
  } | null>(null);

  const selectedSlot = draft[selectedId];
  const selectedMeta = CONTROL_META[selectedId];

  const handleControlPointerDown = (
    id: TouchControlId,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    e.stopPropagation();
    setSelectedId(id);
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = {
      id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origXPct: draft[id].xPct,
      origYPct: draft[id].yPct,
    };
  };

  const handleControlPointerMove = (
    id: TouchControlId,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    const d = draggingRef.current;
    if (!d || d.id !== id || d.pointerId !== e.pointerId || !stageRef.current) return;
    e.stopPropagation();
    const rect = stageRef.current.getBoundingClientRect();
    const dxPct = ((e.clientX - d.startClientX) / Math.max(1, rect.width)) * 100;
    const dyPct = ((e.clientY - d.startClientY) / Math.max(1, rect.height)) * 100;
    setDraft((prev) =>
      updateTouchControlSlot(prev, id, {
        xPct: d.origXPct + dxPct,
        yPct: d.origYPct + dyPct,
      })
    );
  };

  const handleControlPointerUp = (
    id: TouchControlId,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    const d = draggingRef.current;
    if (!d || d.id !== id || d.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    draggingRef.current = null;
  };

  const handlePreset = (presetId: TouchLayoutPresetId) => {
    setDraft(applyTouchLayoutPreset(presetId));
  };

  const handleReset = () => {
    setDraft(normalizeTouchLayout(DEFAULT_TOUCH_LAYOUT));
  };

  const handleSaveAndClose = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div
      ref={stageRef}
      data-testid="touch-layout-editor"
      className="fixed inset-0 z-[70] bg-[#060a14]/95 font-mono select-none overflow-hidden touch-none"
    >
      {/* Tactical Blueprint Grid */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#1e293b33_1px,transparent_1px),linear-gradient(to_bottom,#1e293b33_1px,transparent_1px)] bg-[size:32px_32px]" />

      {/* HUD Reference Ghosts (Minimap & Top Scoreboard zone) */}
      <div className="pointer-events-none absolute top-3 left-3 h-24 w-24 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 flex items-center justify-center text-[9px] text-slate-500">
        RADAR ZONE
      </div>
      <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 px-4 py-1 text-[9px] text-slate-500">
        MATCH TIMER ZONE
      </div>

      {/* Center Floating Control Bar */}
      <div className="relative z-30 mx-auto mt-14 max-w-2xl rounded-2xl border border-cyan-500/40 bg-slate-950/92 p-3 sm:p-4 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div>
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
              On-Screen HUD Layout Mapping
            </h2>
            <p className="text-[10px] text-slate-400">
              Drag any button or joystick anywhere on screen. Tap one to resize or toggle visibility.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold uppercase text-amber-300 hover:border-amber-400 cursor-pointer"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold uppercase text-slate-300 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="save-touch-layout-btn"
              onClick={handleSaveAndClose}
              className="rounded-lg bg-cyan-600 px-3 py-1.5 text-[10px] font-black uppercase text-white hover:bg-cyan-500 cursor-pointer"
            >
              Save Layout
            </button>
          </div>
        </div>

        {/* Presets + Selected Slot Inspector */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">Presets:</span>
            {(['DEFAULT', 'CLAW_4FINGER', 'LEFT_HANDED'] as TouchLayoutPresetId[]).map((pid) => (
              <button
                key={pid}
                type="button"
                onClick={() => handlePreset(pid)}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase text-slate-200 hover:border-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                {TOUCH_LAYOUT_PRESETS[pid].label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[10px]">
            <span className="font-black text-cyan-300">
              {selectedMeta.label} ({Math.round(selectedSlot.xPct)}%, {Math.round(selectedSlot.yPct)}%)
            </span>
            <label className="flex items-center gap-1.5 text-slate-300">
              <span>Size: {Math.round(selectedSlot.scale * 100)}%</span>
              <input
                type="range"
                min="0.65"
                max="1.5"
                step="0.05"
                value={selectedSlot.scale}
                onChange={(e) =>
                  setDraft((prev) =>
                    updateTouchControlSlot(prev, selectedId, {
                      scale: parseFloat(e.target.value),
                    })
                  )
                }
                className="w-24 accent-cyan-400 cursor-pointer"
              />
            </label>
            {!selectedMeta.required && (
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) =>
                    updateTouchControlSlot(prev, selectedId, {
                      visible: !selectedSlot.visible,
                    })
                  )
                }
                className={`rounded border px-2 py-1 font-bold uppercase cursor-pointer ${
                  selectedSlot.visible
                    ? 'border-emerald-500/60 bg-emerald-950/50 text-emerald-300'
                    : 'border-rose-500/60 bg-rose-950/50 text-rose-300'
                }`}
              >
                {selectedSlot.visible ? 'Shown' : 'Hidden'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Draggable Virtual Control Nodes */}
      {(Object.keys(CONTROL_META) as TouchControlId[]).map((id) => {
        const slot = draft[id];
        const meta = CONTROL_META[id];
        const isSelected = selectedId === id;

        return (
          <div
            key={id}
            data-testid={`layout-node-${id}`}
            onPointerDown={(e) => handleControlPointerDown(id, e)}
            onPointerMove={(e) => handleControlPointerMove(id, e)}
            onPointerUp={(e) => handleControlPointerUp(id, e)}
            onPointerCancel={(e) => handleControlPointerUp(id, e)}
            style={{
              left: `${slot.xPct}%`,
              top: `${slot.yPct}%`,
              width: meta.sizePx,
              height: meta.sizePx,
              transform: `translate(-50%, -50%) scale(${slot.scale})`,
              opacity: slot.visible ? 1 : 0.35,
            }}
            className={`absolute z-20 flex flex-col items-center justify-center border-2 text-center font-black uppercase shadow-xl cursor-grab active:cursor-grabbing touch-none ${
              meta.isCircle ? 'rounded-full' : 'rounded-2xl'
            } ${meta.color} ${isSelected ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950' : ''}`}
          >
            <span className="text-[10px] leading-tight px-1 pointer-events-none">{meta.label}</span>
          </div>
        );
      })}
    </div>
  );
};
