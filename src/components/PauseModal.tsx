/**
 * Hollow Strike - Pause Modal
 * Freezes gameplay simulation and provides Resume, Settings, and Title Return.
 */

import React from 'react';

interface PauseModalProps {
  attackerScore: number;
  defenderScore: number;
  currentRound: number;
  onResume: () => void;
  onOpenSettings: () => void;
  onReturnToTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  attackerScore,
  defenderScore,
  currentRound,
  onResume,
  onOpenSettings,
  onReturnToTitle,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
      <div className="relative w-full max-w-sm rounded-xl border border-slate-700 bg-slate-950/95 p-6 text-center shadow-2xl">
        <h2 className="text-xl font-black uppercase tracking-widest text-white">GAME PAUSED</h2>
        
        <div className="mt-3 flex items-center justify-center gap-3 font-mono text-sm border-y border-slate-800 py-2 text-slate-300">
          <span className="text-red-400 font-bold">ATT {attackerScore}</span>
          <span className="text-slate-600">—</span>
          <span className="text-blue-400 font-bold">{defenderScore} DEF</span>
          <span className="text-slate-500">|</span>
          <span className="text-xs text-slate-400">ROUND {currentRound}</span>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={onResume}
            className="w-full rounded-lg bg-cyan-600 py-3 font-mono text-xs font-black uppercase tracking-widest text-white hover:bg-cyan-500 shadow-lg shadow-cyan-600/20 transition cursor-pointer"
          >
            Resume Combat [Esc]
          </button>

          <button
            onClick={onOpenSettings}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
          >
            Tactical Settings
          </button>

          <button
            onClick={onReturnToTitle}
            className="w-full rounded-lg border border-red-500/30 bg-red-950/20 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-950/40 transition cursor-pointer"
          >
            Forfeit / Title Screen
          </button>
        </div>
      </div>
    </div>
  );
};
