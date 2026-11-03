/**
 * Hollow Strike - Mobile Virtual Controls
 * Thumbs-friendly layout: analog joystick on bottom-left, swipe-look on right,
 * large tactical fire button, reload, ADS, jump, and ability triggers.
 * Built with Pointer Events & pointer capture for high responsiveness and passive compatibility.
 */

import React, { useRef, useState, useEffect } from 'react';
import { InputManager } from '../game/inputManager';
import { AgentDef } from '../game/types';

interface MobileControlsProps {
  input: InputManager;
  agent: AgentDef;
  onOpenBuyMenu: () => void;
  canPlantOrDefuse: boolean;
  isPlantingOrDefusing: boolean;
  touchScale?: number;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  input,
  agent,
  onOpenBuyMenu,
  canPlantOrDefuse,
  isPlantingOrDefusing,
  touchScale = 1.0,
}) => {
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const lookAreaRef = useRef<HTMLDivElement | null>(null);

  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState<boolean>(false);
  const joystickPointerId = useRef<number | null>(null);

  const lookPointerId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Joystick pointer handlers
  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joystickPointerId.current !== null) return;
    joystickPointerId.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignored if capture not allowed
    }
    setIsJoystickActive(true);
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === joystickPointerId.current) {
      updateJoystick(e.clientX, e.clientY);
    }
  };

  const handleJoystickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === joystickPointerId.current) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignored
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

    const stickX = Math.cos(angle) * distance;
    const stickY = Math.sin(angle) * distance;

    setJoystickPos({ x: stickX, y: stickY });

    // dy < 0 = forward (+1.0), dy > 0 = backward (-1.0)
    const forward = -dy / maxRadius;
    const right = dx / maxRadius;
    input.setMobileMove(forward, right);
  };

  // Look area swipe handlers
  const handleLookPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== null) return;
    lookPointerId.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
    lastLookPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleLookPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === lookPointerId.current) {
      const dx = e.clientX - lastLookPos.current.x;
      const dy = e.clientY - lastLookPos.current.y;
      lastLookPos.current = { x: e.clientX, y: e.clientY };

      input.addMobileLook(dx, dy);
    }
  };

  const handleLookPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === lookPointerId.current) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignored
      }
      lookPointerId.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      input.setMobileMove(0, 0);
      input.setMobileFire(false);
      input.setMobilePlantDefuse(false);
    };
  }, [input]);

  const scaleStyle = {
    zoom: touchScale !== 1.0 ? touchScale : undefined,
  };

  return (
    <div className="fixed inset-0 z-30 pointer-events-none select-none h-[100dvh] w-screen overflow-hidden">
      {/* Right-Side Touch Look Surface */}
      <div
        ref={lookAreaRef}
        onPointerDown={handleLookPointerDown}
        onPointerMove={handleLookPointerMove}
        onPointerUp={handleLookPointerUp}
        onPointerCancel={handleLookPointerUp}
        className="pointer-events-auto absolute right-0 top-0 h-full w-[60%] touch-none"
      />

      {/* Virtual Joystick (Bottom Left) - At least 140px size */}
      <div
        className="pointer-events-auto absolute bottom-8 left-8"
        style={{
          paddingBottom: 'max(0px, env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'max(0px, env(safe-area-inset-left, 0px))',
          ...scaleStyle,
        }}
      >
        <div
          ref={joystickRef}
          onPointerDown={handleJoystickPointerDown}
          onPointerMove={handleJoystickPointerMove}
          onPointerUp={handleJoystickPointerUp}
          onPointerCancel={handleJoystickPointerUp}
          className="relative flex h-[140px] w-[140px] items-center justify-center rounded-full border-2 border-slate-700/60 bg-slate-950/40 backdrop-blur-none touch-none shadow-2xl"
        >
          {/* Outer Ring Markers */}
          <div className="absolute h-full w-full rounded-full border border-cyan-500/20" />
          <div className="absolute top-2 h-2.5 w-0.5 bg-cyan-400/40" />
          <div className="absolute bottom-2 h-2.5 w-0.5 bg-cyan-400/40" />
          <div className="absolute left-2 h-0.5 w-2.5 bg-cyan-400/40" />
          <div className="absolute right-2 h-0.5 w-2.5 bg-cyan-400/40" />

          {/* Thumb Stick */}
          <div
            className={`h-14 w-14 rounded-full border border-cyan-400 bg-cyan-500/50 shadow-lg transition-transform duration-75 ${
              isJoystickActive ? 'scale-110' : 'scale-100'
            }`}
            style={{
              transform: `translate3d(${joystickPos.x}px, ${joystickPos.y}px, 0)`,
            }}
          />
        </div>
      </div>

      {/* Action Buttons (Bottom Right Cluster) - Touch targets at least 56px */}
      <div
        className="pointer-events-auto absolute bottom-6 right-6 flex items-end gap-3"
        style={{
          paddingBottom: 'max(0px, env(safe-area-inset-bottom, 0px))',
          paddingRight: 'max(0px, env(safe-area-inset-right, 0px))',
          ...scaleStyle,
        }}
      >
        {/* Ability Column */}
        <div className="flex flex-col gap-2 mb-2">
          {agent.abilities.map((ab) => (
            <button
              key={ab.id}
              onPointerDown={(e) => {
                e.stopPropagation();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
                input.triggerMobileAbility(ab.keySlot);
              }}
              onPointerUp={(e) => {
                try {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                } catch {}
              }}
              onPointerCancel={(e) => {
                try {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                } catch {}
              }}
              className={`flex min-h-[56px] min-w-[56px] h-14 w-14 items-center justify-center rounded-full border font-mono text-sm font-black shadow-lg active:scale-95 transition touch-none cursor-pointer ${
                ab.isUltimate
                  ? 'border-amber-400 bg-amber-600/60 text-white'
                  : 'border-cyan-500/60 bg-slate-900/80 text-cyan-300'
              }`}
            >
              {ab.keySlot}
            </button>
          ))}
        </div>

        {/* Secondary Column: Jump, Reload, ADS */}
        <div className="flex flex-col gap-2 mb-2">
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {}
              input.setMobileADS(!input.state.adsHeld);
            }}
            onPointerUp={(e) => {
              try {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              } catch {}
            }}
            onPointerCancel={(e) => {
              try {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              } catch {}
            }}
            className={`flex min-h-[56px] min-w-[56px] h-14 w-14 items-center justify-center rounded-full border text-xs font-bold uppercase shadow-lg active:scale-95 transition touch-none cursor-pointer ${
              input.state.adsHeld
                ? 'border-cyan-400 bg-cyan-500 text-slate-950 font-black'
                : 'border-slate-700 bg-slate-900/80 text-slate-200'
            }`}
          >
            ADS
          </button>

          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {}
              input.triggerMobileReload();
            }}
            onPointerUp={(e) => {
              try {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              } catch {}
            }}
            onPointerCancel={(e) => {
              try {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              } catch {}
            }}
            className="flex min-h-[56px] min-w-[56px] h-14 w-14 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-xs font-bold uppercase text-slate-200 shadow-lg active:scale-95 transition touch-none cursor-pointer"
          >
            RELOAD
          </button>

          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {}
              input.triggerMobileJump();
            }}
            onPointerUp={(e) => {
              try {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              } catch {}
            }}
            onPointerCancel={(e) => {
              try {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              } catch {}
            }}
            className="flex min-h-[56px] min-w-[56px] h-14 w-14 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-xs font-bold uppercase text-slate-200 shadow-lg active:scale-95 transition touch-none cursor-pointer"
          >
            JUMP
          </button>
        </div>

        {/* Primary Action Column: Fire & Plant/Defuse */}
        <div className="flex flex-col gap-3">
          {canPlantOrDefuse && (
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
                input.setMobilePlantDefuse(true);
              }}
              onPointerUp={(e) => {
                try {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                } catch {}
                input.setMobilePlantDefuse(false);
              }}
              onPointerCancel={(e) => {
                try {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                } catch {}
                input.setMobilePlantDefuse(false);
              }}
              className={`min-h-[56px] min-w-[56px] h-16 w-16 rounded-full border-2 text-[10px] font-black uppercase tracking-wider shadow-2xl active:scale-95 transition touch-none cursor-pointer ${
                isPlantingOrDefusing
                  ? 'border-red-400 bg-red-600 text-white animate-pulse'
                  : 'border-amber-400 bg-amber-600/80 text-white'
              }`}
            >
              PLANT / DEFUSE
            </button>
          )}

          {/* Large Primary Fire Button */}
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {}
              input.setMobileFire(true);
            }}
            onPointerUp={(e) => {
              try {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              } catch {}
              input.setMobileFire(false);
            }}
            onPointerCancel={(e) => {
              try {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              } catch {}
              input.setMobileFire(false);
            }}
            className="flex min-h-[64px] min-w-[64px] h-20 w-20 items-center justify-center rounded-full border-2 border-red-500 bg-red-600/70 text-sm font-black uppercase tracking-wider text-white shadow-2xl active:bg-red-500 active:scale-95 transition touch-none cursor-pointer"
          >
            FIRE
          </button>
        </div>
      </div>

      {/* Top Mobile Buy Button */}
      <button
        onPointerDown={(e) => {
          e.stopPropagation();
          onOpenBuyMenu();
        }}
        className="pointer-events-auto absolute top-3 left-40 min-h-[36px] rounded-lg border border-cyan-500/50 bg-slate-900/90 px-4 py-2 font-mono text-xs font-bold uppercase text-cyan-300 shadow-lg active:scale-95 transition touch-none cursor-pointer"
        style={{
          top: 'max(0.75rem, env(safe-area-inset-top, 0px))',
        }}
      >
        BUY ARMORY
      </button>
    </div>
  );
};
