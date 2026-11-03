/**
 * Hollow Strike - Landscape Orientation Guard
 * Ensures the game always runs in landscape on mobile devices.
 * Shows a full-screen "Rotate your device" overlay when in portrait.
 */

import React, { useEffect, useState } from 'react';
import { isTouchDevice } from '../utils/device';

export const OrientationGuard: React.FC = () => {
  const [isPortrait, setIsPortrait] = useState<boolean>(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = isTouchDevice();
      const portrait = isMobile && window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!isPortrait) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 p-6 text-center select-none">
      <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-cyan-500/30 bg-slate-900 shadow-2xl">
        {/* Animated Phone Rotation SVG */}
        <svg
          className="h-14 w-14 text-cyan-400 animate-bounce"
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
        Rotate Device to Landscape
      </h2>
      <p className="mt-2 max-w-xs text-sm text-slate-400">
        Hollow Strike is optimized for tactical widescreen combat. Please rotate your phone to continue.
      </p>

      <div className="mt-6 flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs font-mono text-cyan-400">
        <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
        AUTO-RESUMES ON ROTATION
      </div>
    </div>
  );
};
