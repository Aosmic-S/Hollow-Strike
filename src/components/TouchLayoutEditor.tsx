/**
 * Hollow Strike - Interactive On-Screen Controls Layout Mapper
 * Fullscreen drag-and-drop customization for touch virtual joystick & action buttons,
 * complete with Lucide tactical icons, layout presets, scaling, visibility toggles, and instant save.
 */

import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowUp,
  Bomb,
  Crosshair,
  Focus,
  Gamepad2,
  Repeat,
  RotateCw,
  Zap,
} from 'lucide-react';
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

const CONTROL_META: Record<
  TouchControlId,
  {
    label: string;
    sizePx: number;
    isCircle?: boolean;
    color: string;
    required?: boolean;
    icon: React.ReactNode;
  }
> = {
  joystick: {
    label: 'MOVE',
    sizePx: 128,
    isCircle: true,
    color: 'border-[#17E5B8] bg-[#0F1923]/90 text-[#17E5B8]',
    required: true,
    icon: <Gamepad2 className="h-6 w-6" />,
  },
  fire: {
    label: 'FIRE',
    sizePx: 76,
    isCircle: true,
    color: 'border-[#FF4655] bg-[#FF4655]/90 text-[#ECE8E1]',
    required: true,
    icon: <Crosshair className="h-6 w-6" />,
  },
  ads: {
    label: 'SCOPE',
    sizePx: 54,
    color: 'border-[#ECE8E1]/30 bg-[#18232E]/95 text-[#ECE8E1]',
    icon: <Focus className="h-4.5 w-4.5" />,
  },
  crouch: {
    label: 'CROUCH',
    sizePx: 54,
    color: 'border-[#ECE8E1]/30 bg-[#18232E]/95 text-[#ECE8E1]',
    icon: <ArrowDown className="h-4.5 w-4.5" />,
  },
  jump: {
    label: 'JUMP',
    sizePx: 54,
    color: 'border-[#ECE8E1]/30 bg-[#18232E]/95 text-[#ECE8E1]',
    icon: <ArrowUp className="h-4.5 w-4.5" />,
  },
  reload: {
    label: 'RELOAD',
    sizePx: 54,
    color: 'border-[#ECE8E1]/30 bg-[#18232E]/95 text-[#ECE8E1]',
    icon: <RotateCw className="h-4 w-4" />,
  },
  weaponSwap: {
    label: 'SWAP',
    sizePx: 58,
    color: 'border-[#17E5B8]/60 bg-[#18232E]/95 text-[#17E5B8]',
    icon: <Repeat className="h-4.5 w-4.5" />,
  },
  plantDefuse: {
    label: 'SPIKE',
    sizePx: 64,
    color: 'border-[#fbbf24] bg-[#fbbf24]/25 text-[#fbbf24]',
    icon: <Bomb className="h-5 w-5" />,
  },
  abilityE: {
    label: 'AB [E]',
    sizePx: 52,
    color: 'border-[#17E5B8]/60 bg-[#18232E]/95 text-[#17E5B8]',
    icon: <Zap className="h-3.5 w-3.5" />,
  },
  abilityQ: {
    label: 'AB [Q]',
    sizePx: 52,
    color: 'border-[#17E5B8]/60 bg-[#18232E]/95 text-[#17E5B8]',
    icon: <Zap className="h-3.5 w-3.5" />,
  },
  abilityC: {
    label: 'AB [C]',
    sizePx: 52,
    color: 'border-[#17E5B8]/60 bg-[#18232E]/95 text-[#17E5B8]',
    icon: <Zap className="h-3.5 w-3.5" />,
  },
  abilityX: {
    label: 'ULT [X]',
    sizePx: 52,
    color: 'border-[#FF4655] bg-[#FF4655]/25 text-[#FF4655]',
    icon: <Zap className="h-3.5 w-3.5" />,
  },
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

  return createPortal(
    <div
      ref={stageRef}
      data-testid="touch-layout-editor"
      className="fixed inset-0 z-[100] bg-[#0F1923] val-grid-bg font-mono select-none overflow-hidden touch-none"
    >
      <div className="pointer-events-none absolute top-0 inset-x-0 h-[2px] bg-[#FF4655]/60" />

      <div className="pointer-events-none absolute top-3 left-3 h-24 w-24 border border-dashed border-[#ECE8E1]/20 bg-[#18232E]/45 flex items-center justify-center text-[9px] tracking-widest text-[#8B978F]">
        RADAR ZONE
      </div>
      <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 border border-dashed border-[#ECE8E1]/20 bg-[#18232E]/45 px-4 py-1 text-[9px] tracking-widest text-[#8B978F]">
        MATCH TIMER ZONE
      </div>

      {/* Center Floating Control Bar */}
      <div className="relative z-30 mx-auto mt-14 max-w-2xl clip-val-panel border border-[#ECE8E1]/20 bg-[#18232E]/96 p-3.5 sm:p-4 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECE8E1]/10 pb-2.5">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold uppercase tracking-wider text-[#ECE8E1]">
              On-Screen HUD Layout Mapping
            </h2>
            <p className="text-[10px] text-[#8B978F]">
              Drag any icon button or joystick anywhere on screen. Tap one to resize or toggle visibility.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleReset}
              className="border border-[#ECE8E1]/20 bg-[#0F1923] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#fbbf24] hover:border-[#fbbf24] transition cursor-pointer"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="border border-[#ECE8E1]/20 bg-[#0F1923] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#ECE8E1]/75 hover:text-[#ECE8E1] hover:border-[#ECE8E1]/40 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="save-touch-layout-btn"
              onClick={handleSaveAndClose}
              className="clip-val-btn bg-[#FF4655] px-4 py-1.5 font-display text-sm font-bold uppercase tracking-widest text-[#ECE8E1] hover:bg-[#d93644] transition cursor-pointer"
            >
              Save Layout
            </button>
          </div>
        </div>

        {/* Presets + Selected Slot Inspector */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B978F] mr-1">Presets:</span>
            {(['DEFAULT', 'CLAW_4FINGER', 'LEFT_HANDED'] as TouchLayoutPresetId[]).map((pid) => (
              <button
                key={pid}
                type="button"
                onClick={() => handlePreset(pid)}
                className="border border-[#ECE8E1]/15 bg-[#0F1923] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#ECE8E1] hover:border-[#17E5B8] hover:text-[#17E5B8] transition cursor-pointer"
              >
                {TOUCH_LAYOUT_PRESETS[pid].label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[10px]">
            <span className="font-black tracking-wider text-[#17E5B8]">
              {selectedMeta.label} ({Math.round(selectedSlot.xPct)}%, {Math.round(selectedSlot.yPct)}%)
            </span>
            <label className="flex items-center gap-1.5 text-[#ECE8E1]/85">
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
                className="w-24 accent-[#FF4655] cursor-pointer"
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
                className={`border px-2 py-1 font-bold uppercase tracking-wider cursor-pointer transition ${
                  selectedSlot.visible
                    ? 'border-[#17E5B8]/60 bg-[#17E5B8]/15 text-[#17E5B8]'
                    : 'border-[#FF4655]/60 bg-[#FF4655]/15 text-[#FF4655]'
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
            className={`absolute z-20 flex flex-col items-center justify-center gap-0.5 border-2 text-center font-black uppercase shadow-xl cursor-grab active:cursor-grabbing touch-none ${
              meta.isCircle ? 'rounded-full' : 'clip-val-card'
            } ${meta.color} ${isSelected ? 'ring-2 ring-[#FF4655] ring-offset-2 ring-offset-[#0F1923]' : ''}`}
          >
            <div className="pointer-events-none">{meta.icon}</div>
            <span className="text-[8px] leading-tight px-1 pointer-events-none">{meta.label}</span>
          </div>
        );
      })}
    </div>,
    document.body
  );
};
