/**
 * Hollow Strike - In-Game Tactical Settings Modal
 * Wraps the unified SettingsPanel for live adjustment while paused in a match.
 */

import React from 'react';
import { GameSettings } from '../game/types';
import { SettingsPanel } from './SettingsPanel';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/85 p-2 sm:p-4 select-none">
      <div className="relative my-auto max-h-[94dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-3 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 sm:pb-3 mb-3 sm:mb-5">
          <div>
            <h2 className="font-mono text-base sm:text-lg font-black uppercase tracking-widest text-white">
              Tactical Settings
            </h2>
            <p className="font-mono text-[10px] sm:text-[11px] text-slate-400">
              Changes apply immediately and save automatically.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 sm:px-4 py-1.5 font-mono text-xs font-bold uppercase text-slate-200 hover:bg-slate-700 hover:text-white transition cursor-pointer"
          >
            Done
          </button>
        </div>

        <SettingsPanel settings={settings} onUpdateSettings={onUpdateSettings} />
      </div>
    </div>
  );
};
