/**
 * Hollow Strike - Mobile Virtual Controls
 * Pointer Events with Pointer Capture and touch-action: none for reliable multi-touch play,
 * including drag-to-aim while holding Fire, live ADS/Crouch state, weapon swap, and ability charges.
 */

import React, { useRef, useState } from 'react';
import { InputManager } from '../game/inputManager';
import { AbilitySlotState, AgentDef, GameSettings, RoundPhase } from '../game/types';

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
  canPlantOrDefuse: boolean;
  isPlantingOrDefusing: boolean;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  input,
  agent,
  abilityStates,
  settings,
  roundPhase,
  hasPrimaryWeapon,
  activeSlot,
  onSwitchWeapon,
  onSkipBuyPhase,
  onOpenBuyMenu,
  onOpenMap,
  canPlantOrDefuse,
  isPlantingOrDefusing,
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

    // Up (dy < 0) = forward (+1.0), Down (dy > 0) = backward (-1.0)
    // Right (dx > 0) = right (+1.0), Left (dx < 0) = left (-1.0)
    input.setMobileMove(-dy / maxRadius, dx / maxRadius);
  };

  // Swipe Look Surface Pointer Handlers (Right 62% of screen)
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
    <div
      className="fixed inset-0 z-30 pointer-events-none select-none touch-none"
      style={{ opacity: touchOpacity }}
    >
      {/* Touch Look Swipe Surface (z-10, below action buttons z-40) */}
      <div
        onPointerDown={handleLookPointerDown}
        onPointerMove={handleLookPointerMove}
        onPointerUp={handleLookPointerUp}
        onPointerCancel={handleLookPointerUp}
        className="pointer-events-auto absolute right-0 top-0 z-10 h-full w-[62%] touch-none"
      />

      {/* Analog Joystick (Bottom Left - 144px diameter) */}
      <div
        className="pointer-events-auto absolute bottom-5 left-5 z-40 origin-bottom-left"
        style={{
          transform: `scale(${touchScale})`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
        }}
      >
        <div
          ref={joystickRef}
          onPointerDown={handleJoystickPointerDown}
          onPointerMove={handleJoystickPointerMove}
          onPointerUp={handleJoystickPointerUp}
          onPointerCancel={handleJoystickPointerUp}
          className="relative flex h-36 w-36 items-center justify-center rounded-full border-2 border-slate-700/80 bg-slate-950/75 touch-none shadow-2xl backdrop-blur-sm"
        >
          <div className="absolute h-full w-full rounded-full border border-cyan-500/30" />
          <div className="absolute top-2.5 h-2.5 w-0.5 bg-cyan-400" />
          <div className="absolute bottom-2.5 h-2.5 w-0.5 bg-cyan-400" />
          <div className="absolute left-2.5 h-0.5 w-2.5 bg-cyan-400" />
          <div className="absolute right-2.5 h-0.5 w-2.5 bg-cyan-400" />

          <div
            className={`h-14 w-14 rounded-full border border-cyan-300 shadow-lg transition-transform duration-75 ${
              isJoystickActive ? 'scale-110 bg-cyan-400' : 'scale-100 bg-cyan-500/85'
            }`}
            style={{
              transform: `translate3d(${joystickPos.x}px, ${joystickPos.y}px, 0)`,
            }}
          />
        </div>
      </div>

      {/* Action Buttons Cluster (Bottom Right, >= 56px hit targets) */}
      <div
        className="pointer-events-auto absolute bottom-5 right-5 z-40 flex items-end gap-2.5 origin-bottom-right"
        style={{
          transform: `scale(${touchScale})`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
        }}
      >
        {/* Ability Column (Q / E / C / X with live charges & cooldowns) */}
        <div className="flex flex-col gap-2 mb-1">
          {agent.abilities.map((ab) => {
            const st = abilityStates.find((s) => s.keySlot === ab.keySlot);
            const onCd = (st?.cooldownRemaining ?? 0) > 0.05;
            const isUltReady = ab.isUltimate ? (st?.ultPoints ?? 0) >= (st?.ultRequired ?? 5) : true;
            const hasCharge = ab.isUltimate ? isUltReady : (st?.charges ?? 1) > 0;

            return (
              <button
                key={ab.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  input.triggerMobileAbility(ab.keySlot);
                }}
                className={`relative flex h-14 w-14 flex-col items-center justify-center rounded-2xl border font-mono text-xs font-black shadow-xl active:scale-95 transition cursor-pointer touch-none ${
                  !hasCharge || onCd
                    ? 'border-slate-800 bg-slate-950/75 text-slate-500'
                    : ab.isUltimate
                      ? 'border-amber-400 bg-amber-600/90 text-white shadow-amber-500/30'
                      : 'bg-slate-900/90 text-white'
                }`}
                style={
                  hasCharge && !onCd && !ab.isUltimate
                    ? { borderColor: agent.primaryColor, color: agent.primaryColor }
                    : undefined
                }
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
        </div>

        {/* Utility Column: Crouch, ADS, Reload, Jump */}
        <div className="flex flex-col gap-2 mb-1">
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              const next = !crouchActive;
              setCrouchActive(next);
              input.setMobileCrouch(next);
            }}
            className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-[10px] font-mono font-bold uppercase shadow-xl active:scale-95 transition cursor-pointer touch-none ${
              crouchActive
                ? 'border-cyan-400 bg-cyan-500 text-slate-950 font-black'
                : 'border-slate-700 bg-slate-900/90 text-slate-200'
            }`}
          >
            CROUCH
          </button>

          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              const next = !adsActive;
              setAdsActive(next);
              input.setMobileADS(next);
            }}
            className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-[11px] font-mono font-bold uppercase shadow-xl active:scale-95 transition cursor-pointer touch-none ${
              adsActive
                ? 'border-cyan-400 bg-cyan-500 text-slate-950 font-black'
                : 'border-slate-700 bg-slate-900/90 text-slate-200'
            }`}
          >
            ADS
          </button>

          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              input.triggerMobileReload();
            }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/90 text-[10px] font-mono font-bold uppercase text-slate-200 shadow-xl active:scale-95 transition cursor-pointer touch-none"
          >
            RELOAD
          </button>

          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              input.triggerMobileJump();
            }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/90 text-[11px] font-mono font-bold uppercase text-slate-200 shadow-xl active:scale-95 transition cursor-pointer touch-none"
          >
            JUMP
          </button>
        </div>

        {/* Primary Fire, Weapon Swap & Plant/Defuse Column */}
        <div className="flex flex-col items-end gap-2.5">
          {hasPrimaryWeapon && (
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                onSwitchWeapon(activeSlot === 1 ? 2 : 1);
              }}
              className="flex h-14 w-16 items-center justify-center rounded-2xl border border-cyan-500/60 bg-slate-900/90 text-[10px] font-mono font-black uppercase text-cyan-300 shadow-xl active:scale-95 transition cursor-pointer touch-none"
            >
              {activeSlot === 1 ? 'SIDEARM' : 'PRIMARY'}
            </button>
          )}

          {canPlantOrDefuse && (
            <button
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
              className={`h-16 w-20 rounded-2xl border-2 text-[10px] font-mono font-black uppercase tracking-wider shadow-2xl active:scale-95 transition cursor-pointer touch-none ${
                isPlantingOrDefusing
                  ? 'border-red-400 bg-red-600 text-white animate-pulse'
                  : 'border-amber-400 bg-amber-600 text-white'
              }`}
            >
              PLANT / DEFUSE
            </button>
          )}

          <button
            onPointerDown={handleFirePointerDown}
            onPointerMove={handleFirePointerMove}
            onPointerUp={handleFirePointerUp}
            onPointerCancel={handleFirePointerUp}
            className={`flex h-20 w-20 items-center justify-center rounded-full border-2 text-xs font-mono font-black uppercase tracking-widest text-white shadow-2xl transition cursor-pointer touch-none ${
              fireActive
                ? 'border-amber-300 bg-rose-500 scale-95 shadow-rose-500/50'
                : 'border-rose-500 bg-rose-600/95 shadow-rose-600/35'
            }`}
          >
            FIRE
          </button>
        </div>
      </div>

      {/* Top Mobile Utility Buttons: Armory, Map & Start Fight */}
      <div
        className="pointer-events-auto absolute top-3 left-40 z-40 flex items-center gap-2"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            onOpenBuyMenu();
          }}
          className="min-h-11 rounded-lg border border-cyan-500/60 bg-slate-900/90 px-3.5 py-2 font-mono text-xs font-bold uppercase text-cyan-300 shadow-lg active:scale-95 transition cursor-pointer touch-none"
        >
          ARMORY [B]
        </button>

        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            onOpenMap();
          }}
          className="min-h-11 rounded-lg border border-slate-700 bg-slate-900/90 px-3.5 py-2 font-mono text-xs font-bold uppercase text-slate-200 shadow-lg active:scale-95 transition cursor-pointer touch-none"
        >
          MAP [M]
        </button>

        {roundPhase === 'BUY_PHASE' && (
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              onSkipBuyPhase();
            }}
            className="min-h-11 rounded-lg border border-emerald-400/70 bg-emerald-600/90 px-3.5 py-2 font-mono text-xs font-black uppercase text-white shadow-lg active:scale-95 transition cursor-pointer touch-none"
          >
            START FIGHT
          </button>
        )}
      </div>
    </div>
  );
};
