/**
 * Hollow Strike - Landscape Orientation Guard
 * Ensures the game always runs in landscape on mobile devices.
 * Shows a full-screen "Rotate your device" overlay when in portrait.
 */

import React, { useEffect, useState } from 'react';
import { isMobileDevice } from '../game/device';

interface OrientationGuardProps {
  onOrientationChange?: (isPortrait: boolean) => void;
}

export const OrientationGuard: React.FC<OrientationGuardProps> = ({ onOrientationChange }) => {
  const [isPortrait, setIsPortrait] = useState<boolean>(false);

  useEffect(() => {
    const checkOrientation = () => {
      const mobile = isMobileDevice();
      const portrait = mobile && window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);
      onOrientationChange?.(portrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [onOrientationChange]);

  if (!isPortrait) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#070b14] p-6 text-center select-none font-sans">
      <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-cyan-500/40 bg-slate-900 shadow-2xl shadow-cyan-500/20">
        <svg
          className="h-12 w-12 text-cyan-400 animate-bounce"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      </div>

      <h2 className="text-xl font-black uppercase tracking-widest text-white">
        ROTATE DEVICE TO LANDSCAPE
      </h2>
      <p className="mt-2 max-w-xs text-xs text-slate-400 leading-relaxed font-mono">
        Hollow Strike is optimized for tactical widescreen combat. Please turn your device sideways to resume play.
      </p>

      <div className="mt-6 flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/90 px-4 py-2 text-xs font-mono text-cyan-400">
        <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
        AUTO-RESUMES ON LANDSCAPE
      </div>
    </div>
  );
};
