/**
 * Hollow Strike - Mobile Virtual Controls
 * Thumbs-friendly layout: analog joystick on bottom-left, swipe-look on right,
 * large tactical fire button, reload, ADS, jump, and ability triggers.
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
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  input,
  agent,
  onOpenBuyMenu,
  canPlantOrDefuse,
  isPlantingOrDefusing,
}) => {
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const lookAreaRef = useRef<HTMLDivElement | null>(null);

  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState<boolean>(false);
  const joystickTouchId = useRef<number | null>(null);

  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Joystick touch handlers
  const handleJoystickStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (joystickTouchId.current !== null) return;

    const touch = e.changedTouches[0];
    joystickTouchId.current = touch.identifier;
    setIsJoystickActive(true);
    updateJoystick(touch.clientX, touch.clientY);
  };

  const handleJoystickMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (joystickTouchId.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchId.current) {
        updateJoystick(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleJoystickEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId.current) {
        joystickTouchId.current = null;
        setIsJoystickActive(false);
        setJoystickPos({ x: 0, y: 0 });
        input.setMobileMove(0, 0);
        break;
      }
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

    // Pushing joystick UP towards top of screen (dy < 0) = FORWARD (+1.0)
    // Pushing joystick DOWN towards bottom of screen (dy > 0) = BACKWARD (-1.0)
    // Pushing joystick RIGHT (dx > 0) = STRAFE RIGHT (+1.0)
    // Pushing joystick LEFT (dx < 0) = STRAFE LEFT (-1.0)
    const forward = -dy / maxRadius;
    const right = dx / maxRadius;
    input.setMobileMove(forward, right);
  };

  // Look area swipe handlers
  const handleLookStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    lookTouchId.current = touch.identifier;
    lastLookPos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchId.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchId.current) {
        const dx = touch.clientX - lastLookPos.current.x;
        const dy = touch.clientY - lastLookPos.current.y;
        lastLookPos.current = { x: touch.clientX, y: touch.clientY };

        input.addMobileLook(dx, dy);
        break;
      }
    }
  };

  const handleLookEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
        break;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-30 pointer-events-none select-none">
      {/* Right-Side Touch Look Surface */}
      <div
        ref={lookAreaRef}
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={handleLookEnd}
        className="pointer-events-auto absolute right-0 top-0 h-full w-[60%] touch-none"
      />

      {/* Virtual Joystick (Bottom Left) */}
      <div
        className="pointer-events-auto absolute bottom-8 left-8"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
        }}
      >
        <div
          ref={joystickRef}
          onTouchStart={handleJoystickStart}
          onTouchMove={handleJoystickMove}
          onTouchEnd={handleJoystickEnd}
          onTouchCancel={handleJoystickEnd}
          className="relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-slate-700/60 bg-slate-950/40 backdrop-blur-none touch-none shadow-2xl"
        >
          {/* Outer Ring Markers */}
          <div className="absolute h-full w-full rounded-full border border-cyan-500/20" />
          <div className="absolute top-2 h-2 w-0.5 bg-cyan-400/40" />
          <div className="absolute bottom-2 h-2 w-0.5 bg-cyan-400/40" />
          <div className="absolute left-2 h-0.5 w-2 bg-cyan-400/40" />
          <div className="absolute right-2 h-0.5 w-2 bg-cyan-400/40" />

          {/* Thumb Stick */}
          <div
            className={`h-12 w-12 rounded-full border border-cyan-400 bg-cyan-500/50 shadow-lg transition-transform duration-75 ${
              isJoystickActive ? 'scale-110' : 'scale-100'
            }`}
            style={{
              transform: `translate3d(${joystickPos.x}px, ${joystickPos.y}px, 0)`,
            }}
          />
        </div>
      </div>

      {/* Action Buttons (Bottom Right Cluster) */}
      <div
        className="pointer-events-auto absolute bottom-6 right-6 flex items-end gap-3"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
        }}
      >
        {/* Ability Column */}
        <div className="flex flex-col gap-2 mb-2">
          {agent.abilities.map((ab) => (
            <button
              key={ab.id}
              onTouchStart={(e) => {
                e.stopPropagation();
                input.triggerMobileAbility(ab.keySlot);
              }}
              className={`flex h-12 w-12 items-center justify-center rounded-full border font-mono text-xs font-black shadow-lg active:scale-95 transition ${
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
            onTouchStart={(e) => {
              e.stopPropagation();
              input.setMobileADS(!input.state.adsHeld);
            }}
            className={`flex h-12 w-12 items-center justify-center rounded-full border text-xs font-bold uppercase shadow-lg active:scale-95 transition ${
              input.state.adsHeld
                ? 'border-cyan-400 bg-cyan-500 text-slate-950 font-black'
                : 'border-slate-700 bg-slate-900/80 text-slate-200'
            }`}
          >
            ADS
          </button>

          <button
            onTouchStart={(e) => {
              e.stopPropagation();
              input.triggerMobileReload();
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-xs font-bold uppercase text-slate-200 shadow-lg active:scale-95 transition"
          >
            RELOAD
          </button>

          <button
            onTouchStart={(e) => {
              e.stopPropagation();
              input.triggerMobileJump();
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-xs font-bold uppercase text-slate-200 shadow-lg active:scale-95 transition"
          >
            JUMP
          </button>
        </div>

        {/* Primary Action Column: Fire & Plant/Defuse */}
        <div className="flex flex-col gap-3">
          {canPlantOrDefuse && (
            <button
              onTouchStart={(e) => {
                e.stopPropagation();
                input.setMobilePlantDefuse(true);
              }}
              onTouchEnd={() => input.setMobilePlantDefuse(false)}
              className={`h-16 w-16 rounded-full border-2 text-xs font-black uppercase tracking-wider shadow-2xl active:scale-95 transition ${
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
            onTouchStart={(e) => {
              e.stopPropagation();
              input.setMobileFire(true);
            }}
            onTouchEnd={() => input.setMobileFire(false)}
            className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-500 bg-red-600/70 text-sm font-black uppercase tracking-wider text-white shadow-2xl active:bg-red-500 active:scale-95 transition"
          >
            FIRE
          </button>
        </div>
      </div>

      {/* Top Mobile Buy Button */}
      <button
        onTouchStart={(e) => {
          e.stopPropagation();
          onOpenBuyMenu();
        }}
        className="pointer-events-auto absolute top-3 left-40 rounded-lg border border-cyan-500/50 bg-slate-900/90 px-3 py-1 font-mono text-[11px] font-bold uppercase text-cyan-300 shadow-lg active:scale-95 transition"
      >
        BUY ARMORY
      </button>
    </div>
  );
};
