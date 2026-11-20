/**
 * Hollow Strike - Mobile Virtual Controls
 * Uses crisp tactical Lucide icons for all touch combat controls, supports 1 -> 2 -> 3 (Hollow Blade)
 * cycling, custom touch coordinate layout mapping, and multi-touch pointer capture.
 */

import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart2,
  Bomb,
  Crosshair,
  Focus,
  Map as MapIcon,
  Pause,
  Repeat,
  RotateCw,
  Settings,
  ShoppingBag,
  Swords,
} from 'lucide-react';
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
  activeSlot: 1 | 2 | 3;
  onSwitchWeapon: (slot: 1 | 2 | 3) => void;
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

  const getNextWeaponSlot = (): 1 | 2 | 3 => {
    if (hasPrimaryWeapon) {
      if (activeSlot === 1) return 2;
      if (activeSlot === 2) return 3;
      return 1;
    }
    return activeSlot === 2 ? 3 : 2;
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

  // Swipe Look Surface
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
                  className="relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-[#ECE8E1]/25 bg-[#0F1923]/82 touch-none shadow-2xl"
                >
                  <div className="absolute h-full w-full rounded-full border border-[#17E5B8]/35" />
                  <div className="absolute top-2 h-2.5 w-0.5 bg-[#17E5B8]" />
                  <div className="absolute bottom-2 h-2.5 w-0.5 bg-[#17E5B8]" />
                  <div className="absolute left-2 h-0.5 w-2.5 bg-[#17E5B8]" />
                  <div className="absolute right-2 h-0.5 w-2.5 bg-[#17E5B8]" />

                  <div
                    className={`h-13 w-13 rounded-full border border-[#17E5B8] shadow-lg transition-transform duration-75 ${
                      isJoystickActive ? 'scale-110 bg-[#17E5B8]' : 'scale-100 bg-[#17E5B8]/80'
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
                aria-label="Fire Weapon"
                data-testid="touch-ctrl-fire"
                onPointerDown={handleFirePointerDown}
                onPointerMove={handleFirePointerMove}
                onPointerUp={handleFirePointerUp}
                onPointerCancel={handleFirePointerUp}
                style={getSlotStyle('fire')}
                className={`pointer-events-auto absolute z-40 flex h-19 w-19 flex-col items-center justify-center gap-0.5 rounded-full border-2 text-[#ECE8E1] shadow-2xl transition cursor-pointer touch-none ${
                  fireActive
                    ? 'border-[#ECE8E1] bg-[#FF4655] scale-95 shadow-[#FF4655]/50'
                    : 'border-[#FF4655] bg-[#FF4655]/92 shadow-[#FF4655]/35'
                }`}
              >
                {activeSlot === 3 ? (
                  <Swords className="h-7 w-7 stroke-[2.2]" />
                ) : (
                  <Crosshair className="h-7 w-7 stroke-[2.2]" />
                )}
                <span className="font-mono text-[8px] font-black uppercase tracking-widest leading-none">
                  {activeSlot === 3 ? 'SLASH' : 'FIRE'}
                </span>
              </button>
            )}

            {/* Jump */}
            {layout.jump.visible && (
              <button
                type="button"
                aria-label="Jump"
                data-testid="touch-ctrl-jump"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  input.triggerMobileJump();
                }}
                style={getSlotStyle('jump')}
                className="pointer-events-auto absolute z-40 flex h-13.5 w-13.5 flex-col items-center justify-center gap-0.5 clip-val-card border border-[#ECE8E1]/25 bg-[#18232E]/94 text-[#ECE8E1] shadow-xl active:scale-95 transition cursor-pointer touch-none"
              >
                <ArrowUp className="h-5 w-5 text-[#17E5B8] stroke-[2.4]" />
                <span className="font-mono text-[8px] font-bold uppercase tracking-wider leading-none">JUMP</span>
              </button>
            )}

            {/* Reload */}
            {layout.reload.visible && (
              <button
                type="button"
                aria-label="Reload Weapon"
                data-testid="touch-ctrl-reload"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  input.triggerMobileReload();
                }}
                style={getSlotStyle('reload')}
                className="pointer-events-auto absolute z-40 flex h-13.5 w-13.5 flex-col items-center justify-center gap-0.5 clip-val-card border border-[#ECE8E1]/25 bg-[#18232E]/94 text-[#ECE8E1] shadow-xl active:scale-95 transition cursor-pointer touch-none"
              >
                <RotateCw className="h-4.5 w-4.5 stroke-[2.2]" />
                <span className="font-mono text-[8px] font-bold uppercase tracking-wider leading-none">RELOAD</span>
              </button>
            )}

            {/* ADS / Scope */}
            {layout.ads.visible && (
              <button
                type="button"
                aria-label="Aim Down Sights"
                data-testid="touch-ctrl-ads"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const next = !adsActive;
                  setAdsActive(next);
                  input.setMobileADS(next);
                }}
                style={getSlotStyle('ads')}
                className={`pointer-events-auto absolute z-40 flex h-13.5 w-13.5 flex-col items-center justify-center gap-0.5 clip-val-card border shadow-xl active:scale-95 transition cursor-pointer touch-none ${
                  adsActive
                    ? 'border-[#17E5B8] bg-[#17E5B8] text-[#0F1923] font-black'
                    : 'border-[#ECE8E1]/25 bg-[#18232E]/94 text-[#ECE8E1]'
                }`}
              >
                <Focus className="h-5 w-5 stroke-[2.2]" />
                <span className="font-mono text-[8px] font-bold uppercase tracking-wider leading-none">SCOPE</span>
              </button>
            )}

            {/* Crouch */}
            {layout.crouch.visible && (
              <button
                type="button"
                aria-label="Crouch"
                data-testid="touch-ctrl-crouch"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const next = !crouchActive;
                  setCrouchActive(next);
                  input.setMobileCrouch(next);
                }}
                style={getSlotStyle('crouch')}
                className={`pointer-events-auto absolute z-40 flex h-13.5 w-13.5 flex-col items-center justify-center gap-0.5 clip-val-card border shadow-xl active:scale-95 transition cursor-pointer touch-none ${
                  crouchActive
                    ? 'border-[#17E5B8] bg-[#17E5B8] text-[#0F1923] font-black'
                    : 'border-[#ECE8E1]/25 bg-[#18232E]/94 text-[#ECE8E1]'
                }`}
              >
                <ArrowDown className="h-5 w-5 stroke-[2.4]" />
                <span className="font-mono text-[8px] font-bold uppercase tracking-wider leading-none">CROUCH</span>
              </button>
            )}

            {/* Weapon Swap (Cycles 1 -> 2 -> 3 Hollow Blade) */}
            {layout.weaponSwap.visible && (
              <button
                type="button"
                aria-label="Switch Weapon or Hollow Blade"
                data-testid="touch-ctrl-weaponSwap"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSwitchWeapon(getNextWeaponSlot());
                }}
                style={getSlotStyle('weaponSwap')}
                className={`pointer-events-auto absolute z-40 flex h-13.5 w-15 flex-col items-center justify-center gap-0.5 clip-val-card border shadow-xl active:scale-95 transition cursor-pointer touch-none ${
                  activeSlot === 3
                    ? 'border-[#FF4655] bg-[#FF4655]/25 text-[#FF4655]'
                    : 'border-[#17E5B8]/60 bg-[#18232E]/94 text-[#17E5B8]'
                }`}
              >
                {activeSlot === 3 ? (
                  <Swords className="h-4.5 w-4.5 stroke-[2.2]" />
                ) : (
                  <Repeat className="h-4.5 w-4.5 stroke-[2.2]" />
                )}
                <span className="font-mono text-[8px] font-black uppercase tracking-wider leading-none">
                  {activeSlot === 1 ? 'SIDEARM' : activeSlot === 2 ? 'BLADE' : hasPrimaryWeapon ? 'PRIMARY' : 'PISTOL'}
                </span>
              </button>
            )}

            {/* Plant / Defuse */}
            {canPlantOrDefuse && layout.plantDefuse.visible && (
              <button
                type="button"
                aria-label="Plant or Defuse Spike"
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
                className={`pointer-events-auto absolute z-40 flex h-15 w-17 flex-col items-center justify-center gap-0.5 clip-val-card border-2 shadow-2xl active:scale-95 transition cursor-pointer touch-none ${
                  isPlantingOrDefusing
                    ? 'border-[#ECE8E1] bg-[#FF4655] text-[#ECE8E1]'
                    : 'border-[#fbbf24] bg-[#fbbf24] text-[#0F1923]'
                }`}
              >
                <Bomb className="h-5 w-5 stroke-[2.2]" />
                <span className="font-mono text-[8px] font-black uppercase tracking-wider leading-none">
                  {isPlantingOrDefusing ? 'HOLD...' : 'SPIKE'}
                </span>
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
                  aria-label={`Ability ${ab.keySlot} ${ab.name}`}
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
                  className={`pointer-events-auto absolute z-40 flex h-13 w-13 flex-col items-center justify-center clip-val-card border font-mono text-xs font-black shadow-xl active:scale-95 transition cursor-pointer touch-none ${
                    !hasCharge || onCd
                      ? 'border-[#ECE8E1]/10 bg-[#0F1923]/80 text-[#8B978F]'
                      : ab.isUltimate
                        ? 'border-[#FF4655] bg-[#FF4655] text-[#ECE8E1] shadow-[#FF4655]/30'
                        : 'bg-[#18232E]/94 text-[#ECE8E1]'
                  }`}
                >
                  <span>{ab.keySlot}</span>
                  {onCd ? (
                    <span className="text-[9px] text-[#fbbf24]">{Math.ceil(st!.cooldownRemaining)}s</span>
                  ) : ab.isUltimate ? (
                    <span className="text-[8px] font-bold">
                      {isUltReady ? 'READY' : `${st?.ultPoints ?? 0}/${st?.ultRequired ?? 5}`}
                    </span>
                  ) : (
                    <span className="text-[9px] text-[#ECE8E1]/75">×{st?.charges ?? ab.maxCharges}</span>
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
            className="flex min-h-11 items-center gap-1 border border-[#17E5B8]/60 bg-[#18232E]/95 px-2.5 py-1.5 font-mono text-[10px] font-black uppercase text-[#17E5B8] shadow-lg active:scale-95 transition cursor-pointer touch-none"
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">SET</span>
          </button>

          {!isSpectating && (
            <button
              type="button"
              aria-label="Open Shop"
              onPointerDown={(e) => {
                e.stopPropagation();
                onOpenBuyMenu();
              }}
              className="flex min-h-11 items-center gap-1 border border-[#fbbf24]/60 bg-[#18232E]/95 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase text-[#fbbf24] shadow-lg active:scale-95 transition cursor-pointer touch-none"
            >
              <ShoppingBag className="h-4 w-4 shrink-0" />
              <span>SHOP</span>
            </button>
          )}

          <button
            type="button"
            aria-label="Tactical Map"
            onPointerDown={(e) => {
              e.stopPropagation();
              onOpenMap();
            }}
            className="flex min-h-11 items-center gap-1 border border-[#ECE8E1]/20 bg-[#18232E]/95 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase text-[#ECE8E1] shadow-lg active:scale-95 transition cursor-pointer touch-none"
          >
            <MapIcon className="h-4 w-4 shrink-0" />
          </button>

          <button
            type="button"
            aria-label="Scoreboard"
            onPointerDown={(e) => {
              e.stopPropagation();
              onOpenScoreboard();
            }}
            className="flex min-h-11 items-center gap-1 border border-[#ECE8E1]/20 bg-[#18232E]/95 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase text-[#ECE8E1] shadow-lg active:scale-95 transition cursor-pointer touch-none"
          >
            <BarChart2 className="h-4 w-4 shrink-0" />
          </button>

          <button
            type="button"
            aria-label="Pause Match"
            onPointerDown={(e) => {
              e.stopPropagation();
              onOpenPause();
            }}
            className="flex min-h-11 items-center gap-1 border border-[#FF4655]/50 bg-[#18232E]/95 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase text-[#FF4655] shadow-lg active:scale-95 transition cursor-pointer touch-none"
          >
            <Pause className="h-4 w-4 shrink-0" />
          </button>
        </div>
      </div>
    </>
  );
};
