/**
 * Hollow Strike - PWA Install Component
 * Handles install prompts for Chromium/Android and step-by-step modal for iOS Safari.
 */

import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (isInstalled) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-2 border border-[#ECE8E1]/20 bg-[#18232E] px-3 py-1.5 font-mono text-xs font-bold text-[#ECE8E1] hover:border-[#FF4655] hover:text-white transition cursor-pointer clip-val-card"
        title="Install Hollow Strike app"
      >
        <svg className="h-4 w-4 text-[#17E5B8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>INSTALL</span>
      </button>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1923]/85 p-4">
          <div className="w-full max-w-sm border border-[#ECE8E1]/20 bg-[#18232E] p-6 shadow-2xl text-left clip-val-panel">
            <h3 className="font-display text-lg font-extrabold uppercase tracking-wider text-[#ECE8E1]">
              Install on iPhone / iPad
            </h3>
            <p className="mt-2 text-xs text-[#8B978F] leading-relaxed">
              1. Tap the <strong className="text-[#17E5B8]">Share</strong> button in Safari&apos;s toolbar.<br />
              2. Scroll down and tap <strong className="text-[#17E5B8]">Add to Home Screen</strong>.
            </p>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-4 w-full bg-[#FF4655] py-2 font-display text-sm font-bold uppercase tracking-wider text-[#ECE8E1] hover:bg-[#ff5e6b] transition cursor-pointer clip-val-btn"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
