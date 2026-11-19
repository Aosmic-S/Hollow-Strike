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
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-[#0F1923]/88 backdrop-blur-sm p-2 sm:p-4 select-none">
      <div className="relative my-auto max-h-[94dvh] w-full max-w-4xl overflow-y-auto border border-[#ECE8E1]/20 bg-[#18232E] p-3 sm:p-6 shadow-2xl clip-val-panel">
        <div className="flex items-center justify-between border-b border-[#ECE8E1]/15 pb-2 sm:pb-3 mb-3 sm:mb-5">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold uppercase tracking-[0.16em] text-[#ECE8E1]">
              Tactical Settings
            </h2>
            <p className="font-mono text-[10px] sm:text-[11px] text-[#8B978F]">
              Changes apply immediately and save automatically.
            </p>
          </div>
          <button
            onClick={onClose}
            className="bg-[#FF4655] px-4 sm:px-5 py-1.5 font-display text-xs font-extrabold uppercase tracking-wider text-[#ECE8E1] hover:bg-[#ff5e6b] transition cursor-pointer clip-val-btn"
          >
            Done
          </button>
        </div>

        <SettingsPanel settings={settings} onUpdateSettings={onUpdateSettings} />
      </div>
    </div>
  );
};
