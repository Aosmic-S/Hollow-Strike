/**
 * Hollow Strike - Mobile Virtual Controls
 * Reads customizable TouchControlLayout coordinates and per-control scale/visibility,
 * with Pointer Events + Pointer Capture for responsive multi-touch aim, movement, and abilities.
 */

import React, { useRef, useState } from 'react';
import { InputManager } from '../game/inputManager';
import { normalizeTouchLayout } from '../game/rules';
import {
  AbilitySlotState,
  AgentDef,
  GameSettings,
  RoundPhase,
  TouchControlId,
} from '../game/types';

interface MobileControlsProps {
  input: InputManager;
  agent: AgentDef;
  abilityStates: AbilitySlotState[];
  settings: GameSettings;
  roundPhase: RoundPhase;
  hasPrimaryWeapon: boolean;
  activeSlot: 1 | 2;
  onSwitchWeapon: (slot: 1 | 2) => void;
  onSkipBuyPhase: () => void;
  onOpenBuyMenu: () => void;
  onOpenMap: () => void;
  onOpenSettings: () => void;
  onOpenScoreboard: () => void;
  onOpenPause: () => void;
  canPlantOrDefuse: boolean;
  isPlantingOrDefusing: boolean;
  isSpectating?: boolean;
}

const ABILITY_LAYOUT_ID: Record<'E' | 'Q' | 'C' | 'X', TouchControlId> = {
  E: 'abilityE',
  Q: 'abilityQ',
  C: 'abilityC',
  X: 'abilityX',
};

export const MobileControls: React.FC<MobileControlsProps> = ({
  input,
  agent,
  abilityStates,
  settings,
  hasPrimaryWeapon,
  activeSlot,
  onSwitchWeapon,
  onOpenBuyMenu,
  onOpenMap,
  onOpenSettings,
  onOpenScoreboard,
  onOpenPause,
  canPlantOrDefuse,
  isPlantingOrDefusing,
  isSpectating = false,
}) => {
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState<boolean>(false);
  const joystickPointerId = useRef<number | null>(null);

  const lookPointerId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const firePointerId = useRef<number | null>(null);
  const lastFirePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [fireActive, setFireActive] = useState<boolean>(false);
  const [adsActive, setAdsActive] = useState<boolean>(false);
  const [crouchActive, setCrouchActive] = useState<boolean>(false);

  const touchScale = settings.touchScale ?? 1.0;
  const touchOpacity = settings.touchOpacity ?? 0.85;
  const layout = normalizeTouchLayout(settings.touchLayout);

  const getSlotStyle = (id: TouchControlId): React.CSSProperties => {
    const slot = layout[id];
    return {
      left: `${slot.xPct}%`,
      top: `${slot.yPct}%`,
      transform: `translate(-50%, -50%) scale(${slot.scale * touchScale})`,
    };
  };

  // Joystick Pointer Event Handlers
  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (joystickPointerId.current !== null) return;

    joystickPointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsJoystickActive(true);
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.pointerId !== joystickPointerId.current) return;
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoystickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.pointerId === joystickPointerId.current) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      joystickPointerId.current = null;
      setIsJoystickActive(false);
      setJoystickPos({ x: 0, y: 0 });
      input.setMobileMove(0, 0);
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const maxRadius = rect.width / 2;

    const distance = Math.min(maxRadius, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);

    setJoystickPos({ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance });
    input.setMobileMove(-dy / maxRadius, dx / maxRadius);
  };

  // Full background Swipe Look Surface (supports Left-Handed & Custom Claw layouts cleanly!)
  const handleLookPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== null) return;
    lookPointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    lastLookPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleLookPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== lookPointerId.current) return;
    const dx = e.clientX - lastLookPos.current.x;
    const dy = e.clientY - lastLookPos.current.y;
    lastLookPos.current = { x: e.clientX, y: e.clientY };
    input.addMobileLook(dx, dy);
  };

  const handleLookPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === lookPointerId.current) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      lookPointerId.current = null;
    }
  };

  // Fire Button with built-in drag-to-aim tracking
  const handleFirePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (firePointerId.current !== null) return;
    firePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    lastFirePos.current = { x: e.clientX, y: e.clientY };
    setFireActive(true);
    input.setMobileFire(true);
  };

  const handleFirePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (e.pointerId !== firePointerId.current) return;
    const dx = e.clientX - lastFirePos.current.x;
    const dy = e.clientY - lastFirePos.current.y;
    lastFirePos.current = { x: e.clientX, y: e.clientY };
    input.addMobileLook(dx, dy);
  };

  const handleFirePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (e.pointerId === firePointerId.current) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      firePointerId.current = null;
      setFireActive(false);
      input.setMobileFire(false);
    }
  };

  return (
    <>
      {/* Full-field Look Swipe Surface behind buttons & HUD banners */}
      <div
        onPointerDown={handleLookPointerDown}
        onPointerMove={handleLookPointerMove}
        onPointerUp={handleLookPointerUp}
        onPointerCancel={handleLookPointerUp}
        className="pointer-events-auto fixed inset-x-0 top-14 bottom-0 z-10 touch-none"
      />

      <div
        className="fixed inset-0 z-30 pointer-events-none select-none touch-none"
        style={{ opacity: touchOpacity }}
      >
        {!isSpectating && (
          <>
            {/* Analog Joystick */}
            {layout.joystick.visible && (
              <div
                data-testid="touch-ctrl-joystick"
                className="pointer-events-auto absolute z-40"
                style={getSlotStyle('joystick')}
              >
                <div
                  ref={joystickRef}
                  onPointerDown={handleJoystickPointerDown}
                  onPointerMove={handleJoystickPointerMove}
                  onPointerUp={handleJoystickPointerUp}
                  onPointerCancel={handleJoystickPointerUp}
                  className="relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-slate-700/80 bg-slate-950/80 touch-none shadow-2xl"
                >
                  <div className="absolute h-full w-full rounded-full border border-cyan-500/30" />
                  <div className="absolute top-2 h-2.5 w-0.5 bg-cyan-400" />
                  <div className="absolute bottom-2 h-2.5 w-0.5 bg-cyan-400" />
                  <div className="absolute left-2 h-0.5 w-2.5 bg-cyan-400" />
                  <div className="absolute right-2 h-0.5 w-2.5 bg-cyan-400" />

                  <div
                    className={`h-13 w-13 rounded-full border border-cyan-300 shadow-lg transition-transform duration-75 ${
                      isJoystickActive ? 'scale-110 bg-cyan-400' : 'scale-100 bg-cyan-500/85'
                    }`}
                    style={{
                      transform: `translate3d(${joystickPos.x}px, ${joystickPos.y}px, 0)`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Fire Button */}
            {layout.fire.visible && (
              <button
                type="button"
                data-testid="touch-ctrl-fire"
                onPointerDown={handleFirePointerDown}
                onPointerMove={handleFirePointerMove}
                onPointerUp={handleFirePointerUp}
                onPointerCancel={handleFirePointerUp}
                style={getSlotStyle('fire')}
                className={`pointer-events-auto absolute z-40 flex h-19 w-19 items-center justify-center rounded-full border-2 text-xs font-mono font-black uppercase tracking-widest text-white shadow-2xl transition cursor-pointer touch-none ${
                  fireActive
                    ? 'border-amber-300 bg-rose-500 scale-95 shadow-rose-500/50'
                    : 'border-rose-500 bg-rose-600/95 shadow-rose-600/35'
                }`}
              >
                FIRE
              </button>
            )}

            {/* Jump */}
            {layout.jump.visible && (
              <button
                type="button"
                data-testid="touch-ctrl-jump"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  input.triggerMobileJump();
                }}
                style={getSlotStyle('jump')}
                className="pointer-events-auto absolute z-40 flex h-13.5 w-13.5 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/90 text-[11px] font-mono font-bold uppercase text-slate-200 shadow-xl active:scale-95 transition cursor-pointer touch-none"
              >
                JUMP
              </button>
            )}

            {/* Reload */}
            {layout.reload.visible && (
              <button
                type="button"
                data-testid="touch-ctrl-reload"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  input.triggerMobileReload();
                }}
                style={getSlotStyle('reload')}
                className="pointer-events-auto absolute z-40 flex h-13.5 w-13.5 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/90 text-[10px] font-mono font-bold uppercase text-slate-200 shadow-xl active:scale-95 transition cursor-pointer touch-none"
              >
                RELOAD
              </button>
            )}

            {/* ADS */}
            {layout.ads.visible && (
              <button
                type="button"
                data-testid="touch-ctrl-ads"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const next = !adsActive;
                  setAdsActive(next);
                  input.setMobileADS(next);
                }}
                style={getSlotStyle('ads')}
                className={`pointer-events-auto absolute z-40 flex h-13.5 w-13.5 items-center justify-center rounded-2xl border text-[11px] font-mono font-bold uppercase shadow-xl active:scale-95 transition cursor-pointer touch-none ${
                  adsActive
                    ? 'border-cyan-400 bg-cyan-500 text-slate-950 font-black'
                    : 'border-slate-700 bg-slate-900/90 text-slate-200'
                }`}
              >
                ADS
              </button>
            )}

            {/* Crouch */}
            {layout.crouch.visible && (
              <button
                type="button"
                data-testid="touch-ctrl-crouch"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const next = !crouchActive;
                  setCrouchActive(next);
                  input.setMobileCrouch(next);
                }}
                style={getSlotStyle('crouch')}
                className={`pointer-events-auto absolute z-40 flex h-13.5 w-13.5 items-center justify-center rounded-2xl border text-[10px] font-mono font-bold uppercase shadow-xl active:scale-95 transition cursor-pointer touch-none ${
                  crouchActive
                    ? 'border-cyan-400 bg-cyan-500 text-slate-950 font-black'
                    : 'border-slate-700 bg-slate-900/90 text-slate-200'
                }`}
              >
                CROUCH
              </button>
            )}

            {/* Weapon Swap */}
            {hasPrimaryWeapon && layout.weaponSwap.visible && (
              <button
                type="button"
                data-testid="touch-ctrl-weaponSwap"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSwitchWeapon(activeSlot === 1 ? 2 : 1);
                }}
                style={getSlotStyle('weaponSwap')}
                className="pointer-events-auto absolute z-40 flex h-13.5 w-15 items-center justify-center rounded-2xl border border-cyan-500/60 bg-slate-900/90 text-[10px] font-mono font-black uppercase text-cyan-300 shadow-xl active:scale-95 transition cursor-pointer touch-none"
              >
                {activeSlot === 1 ? 'SIDEARM' : 'PRIMARY'}
              </button>
            )}

            {/* Plant / Defuse */}
            {canPlantOrDefuse && layout.plantDefuse.visible && (
              <button
                type="button"
                data-testid="touch-ctrl-plantDefuse"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  input.setMobilePlantDefuse(true);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  input.setMobilePlantDefuse(false);
                }}
                onPointerCancel={(e) => {
                  e.stopPropagation();
                  input.setMobilePlantDefuse(false);
                }}
                style={getSlotStyle('plantDefuse')}
                className={`pointer-events-auto absolute z-40 h-15 w-18 rounded-2xl border-2 text-[10px] font-mono font-black uppercase tracking-wider shadow-2xl active:scale-95 transition cursor-pointer touch-none ${
                  isPlantingOrDefusing
                    ? 'border-red-400 bg-red-600 text-white animate-pulse'
                    : 'border-amber-400 bg-amber-600 text-white'
                }`}
              >
                PLANT / DEFUSE
              </button>
            )}

            {/* Abilities Q / E / C / X */}
            {agent.abilities.map((ab) => {
              const slotId = ABILITY_LAYOUT_ID[ab.keySlot];
              const slotCfg = layout[slotId];
              if (!slotCfg.visible) return null;

              const st = abilityStates.find((s) => s.keySlot === ab.keySlot);
              const onCd = (st?.cooldownRemaining ?? 0) > 0.05;
              const isUltReady = ab.isUltimate ? (st?.ultPoints ?? 0) >= (st?.ultRequired ?? 5) : true;
              const hasCharge = ab.isUltimate ? isUltReady : (st?.charges ?? 1) > 0;

              return (
                <button
                  key={ab.id}
                  type="button"
                  data-testid={`touch-ctrl-${slotId}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    input.triggerMobileAbility(ab.keySlot);
                  }}
                  style={{
                    ...getSlotStyle(slotId),
                    ...(hasCharge && !onCd && !ab.isUltimate
                      ? { borderColor: agent.primaryColor, color: agent.primaryColor }
                      : {}),
                  }}
                  className={`pointer-events-auto absolute z-40 flex h-13 w-13 flex-col items-center justify-center rounded-2xl border font-mono text-xs font-black shadow-xl active:scale-95 transition cursor-pointer touch-none ${
                    !hasCharge || onCd
                      ? 'border-slate-800 bg-slate-950/75 text-slate-500'
                      : ab.isUltimate
                        ? 'border-amber-400 bg-amber-600/90 text-white shadow-amber-500/30'
                        : 'bg-slate-900/90 text-white'
                  }`}
                >
                  <span>{ab.keySlot}</span>
                  {onCd ? (
                    <span className="text-[9px] text-amber-300">{Math.ceil(st!.cooldownRemaining)}s</span>
                  ) : ab.isUltimate ? (
                    <span className="text-[8px] font-bold">
                      {isUltReady ? 'READY' : `${st?.ultPoints ?? 0}/${st?.ultRequired ?? 5}`}
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-300">×{st?.charges ?? ab.maxCharges}</span>
                  )}
                </button>
              );
            })}
          </>
        )}

        {/* Top-Right Mobile Utility Bar */}
        <div
          className="pointer-events-auto absolute top-2 right-2.5 z-40 flex flex-nowrap items-center justify-end gap-1"
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)',
          }}
        >
          <button
            type="button"
            aria-label="Settings"
            onPointerDown={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
            className="flex min-h-11 items-center gap-1 rounded-lg border border-cyan-400/70 bg-slate-900/95 px-2 py-1.5 font-mono text-[10px] font-black uppercase text-cyan-300 shadow-lg active:scale-95 transition cursor-pointer touch-none"
          >
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>SET</span>
          </button>

          {!isSpectating && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onOpenBuyMenu();
              }}
              className="min-h-11 rounded-lg border border-amber-500/60 bg-slate-900/95 px-2 py-1.5 font-mono text-[10px] font-bold uppercase text-amber-300 shadow-lg active:scale-95 transition cursor-pointer touch-none"
            >
              SHOP
            </button>
          )}

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onOpenMap();
            }}
            className="min-h-11 rounded-lg border border-slate-700 bg-slate-900/95 px-2 py-1.5 font-mono text-[10px] font-bold uppercase text-slate-200 shadow-lg active:scale-95 transition cursor-pointer touch-none"
          >
            MAP
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onOpenScoreboard();
            }}
            className="min-h-11 rounded-lg border border-slate-700 bg-slate-900/95 px-2 py-1.5 font-mono text-[10px] font-bold uppercase text-slate-200 shadow-lg active:scale-95 transition cursor-pointer touch-none"
          >
            TAB
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onOpenPause();
            }}
            className="min-h-11 rounded-lg border border-slate-700 bg-slate-900/95 px-2 py-1.5 font-mono text-[10px] font-bold uppercase text-slate-200 shadow-lg active:scale-95 transition cursor-pointer touch-none"
          >
            PAUSE
          </button>
        </div>
      </div>
    </>
  );
};
