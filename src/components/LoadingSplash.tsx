/**
 * Hollow Strike - Valorant-Inspired Fullscreen Tactical Loading Splash
 * Features bespoke tactical arena illustration, authentic left/right HUD geometry rails,
 * official Hollow Strike wordmark lockup, and genuine parallel GLB asset preloading.
 */

import React, { useEffect, useState } from 'react';
import splashArtImg from '../assets/images/loading_splash_art_1795091195232.jpg';
import { loadGLBModel } from '../game/modelLoader';

interface LoadingSplashProps {
  onComplete: () => void;
}

const PRELOAD_STEPS: { path: string; label: string }[] = [
  { path: '/models/japan_map.glb', label: 'LOADING JAPANESE COURTYARD ARENA' },
  { path: '/models/sci-fi_gun.glb', label: 'CALIBRATING APEX-9 SIDEARM' },
  { path: '/models/carbine_rifle.glb', label: 'CALIBRATING PHANTOM-V CARBINE' },
  { path: '/models/smg.glb', label: 'CALIBRATING VIPER-9 SMG' },
  { path: '/models/aac_honey_badger.glb', label: 'CALIBRATING HONEY BADGER' },
  { path: '/models/free_pack_-_sci_fi_weapon.glb', label: 'PRELOADING SCI-FI WEAPON PACK' },
];

export const LoadingSplash: React.FC<LoadingSplashProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState<number>(8);
  const [statusLabel, setStatusLabel] = useState<string>('INITIALIZING TACTICAL SYSTEMS');
  const [readyToEnter, setReadyToEnter] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const minDisplayMs = 1700;
    const startedAt = performance.now();
    let completedCount = 0;

    // Kick off real parallel GLB warm-up so weapons & map render immediately on match deploy
    PRELOAD_STEPS.forEach((step) => {
      loadGLBModel(step.path)
        .catch(() => null)
        .finally(() => {
          if (cancelled) return;
          completedCount += 1;
          const rawPct = Math.round(12 + (completedCount / PRELOAD_STEPS.length) * 80);
          setProgress((prev) => Math.max(prev, rawPct));
          if (completedCount < PRELOAD_STEPS.length) {
            setStatusLabel(PRELOAD_STEPS[completedCount].label);
          } else {
            setStatusLabel('ARENA TELEMETRY READY');
          }
        });
    });

    // Smooth visual progress ticker + bounded transition so cached loads still feel polished
    const interval = window.setInterval(() => {
      if (cancelled) return;
      const elapsed = performance.now() - startedAt;
      const timeFraction = Math.min(1, elapsed / minDisplayMs);
      const assetFraction = completedCount / PRELOAD_STEPS.length;
      const targetPct = Math.round(Math.min(100, (timeFraction * 0.45 + assetFraction * 0.55) * 100));

      setProgress((prev) => Math.max(prev, targetPct));

      if (elapsed >= minDisplayMs && completedCount >= PRELOAD_STEPS.length) {
        setProgress(100);
        setStatusLabel('READY FOR DEPLOYMENT');
        setReadyToEnter(true);
        window.clearInterval(interval);
        window.setTimeout(() => {
          if (!cancelled) onComplete();
        }, 280);
      }
    }, 60);

    // Safety fallback cap at 5.5s even on throttled network connections
    const fallbackTimer = window.setTimeout(() => {
      if (cancelled) return;
      setProgress(100);
      setReadyToEnter(true);
      onComplete();
    }, 5500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearTimeout(fallbackTimer);
    };
  }, [onComplete]);

  return (
    <div
      data-testid="loading-splash"
      className="fixed inset-0 z-50 overflow-hidden bg-[#0F1923] text-[#ECE8E1] select-none"
    >
      {/* Fullscreen Tactical Arena Key Art */}
      <img
        src={splashArtImg}
        alt="Hollow Strike Tactical Courtyard Splash Art"
        className="absolute inset-0 h-full w-full object-cover object-center scale-[1.01]"
      />

      {/* Directional Vignette & Scrims matching Valorant reference composition */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#0F1923] via-[#0F1923]/65 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0F1923]/55 via-transparent to-[#0F1923]/85" />

      {/* Left Architectural Vertical Frame & Diamond Track Rail (Reference geometry) */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-7 sm:w-10 border-r border-[#ECE8E1]/15 bg-[#0F1923]/75 flex flex-col items-center justify-between py-8">
        <div className="h-2.5 w-2.5 rotate-45 border border-[#17E5B8]" />
        <div className="h-28 w-px bg-gradient-to-b from-transparent via-[#ECE8E1]/35 to-transparent" />
        <div className="h-2 w-2 rotate-45 bg-[#FF4655]" />
      </div>

      {/* Top-Center Geometric Crest Accent (Reference detail) */}
      <div className="pointer-events-none absolute top-0 left-24 sm:left-40 hidden sm:flex flex-col items-center">
        <div className="h-8 w-28 border-x border-b border-[#17E5B8]/35 bg-[#0F1923]/70 flex items-center justify-center">
          <div className="h-2 w-2 rotate-45 bg-[#17E5B8]" />
        </div>
        <div className="mt-4 h-16 w-px bg-[#ECE8E1]/30" />
        <div className="mt-2 h-3 w-3 rounded-full border border-[#ECE8E1]/40 flex items-center justify-center">
          <div className="h-1 w-1 bg-[#FF4655]" />
        </div>
      </div>

      {/* Right Edge Tactical Rail Bracket */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-7 sm:w-10 border-l border-[#17E5B8]/35 bg-[#0F1923]/80 flex flex-col items-center justify-between py-8">
        <div className="flex flex-col items-center gap-2">
          <span className="h-10 w-0.5 bg-[#17E5B8]" />
          <span className="h-2 w-2 rotate-45 border border-[#ECE8E1]/60" />
        </div>
        <div className="h-20 w-px bg-[#ECE8E1]/20" />
        <div className="h-2.5 w-2.5 rotate-45 border border-[#FF4655]" />
      </div>

      {/* Bottom-Left Wordmark Lockup + Loading Progress Bar (Matches Reference Placement) */}
      <div className="relative z-10 flex h-full w-full flex-col justify-end pl-12 pr-12 pb-10 sm:pl-20 sm:pb-14">
        <div className="max-w-md space-y-4">
          {/* Official Hollow Strike Wordmark Card */}
          <div className="inline-block border border-[#ECE8E1]/20 bg-[#0F1923]/92 p-2.5 shadow-2xl clip-val-card">
            <img
              src="/assets/aistudio/350024580_1795088286721343_bce24b44.jpg"
              alt="Hollow Strike"
              className="h-24 sm:h-28 w-auto object-contain"
            />
          </div>

          {/* Flat Valorant Progress Track */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-mono text-[11px] font-bold tracking-wider uppercase">
              <span className="text-[#ECE8E1]">{statusLabel}</span>
              <span className="text-[#17E5B8] tabular-nums">{progress}%</span>
            </div>

            <div className="h-2 w-full bg-[#ECE8E1]/15 overflow-hidden border border-[#ECE8E1]/15">
              <div
                className="h-full bg-gradient-to-r from-[#17E5B8] via-[#17E5B8] to-[#FF4655] transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] font-medium text-[#8B978F] tracking-wide">
                5v5 Tactical Plant / Defuse Arena · Japan Courtyard Map
              </p>
              <button
                type="button"
                data-testid="skip-splash-btn"
                onClick={onComplete}
                className="ml-4 shrink-0 border border-[#ECE8E1]/25 bg-[#18232E]/90 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ECE8E1] hover:border-[#FF4655] hover:text-[#FF4655] transition cursor-pointer clip-val-card"
              >
                {readyToEnter ? 'ENTER' : 'SKIP >>'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
