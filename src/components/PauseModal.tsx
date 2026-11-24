/**
 * Hollow Strike - Pause Modal
 * Freezes gameplay simulation and provides Resume, Settings, and Title Return.
 */

import React from 'react';

interface PauseModalProps {
  attackerScore: number;
  defenderScore: number;
  currentRound: number;
  isTdmMatch?: boolean;
  teamSize?: number;
  onResume: () => void;
  onOpenSettings: () => void;
  onReturnToTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  attackerScore,
  defenderScore,
  currentRound,
  isTdmMatch = false,
  teamSize = 2,
  onResume,
  onOpenSettings,
  onReturnToTitle,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1923]/92 p-4 select-none">
      <div className="relative w-full max-w-sm border border-[#ECE8E1]/20 bg-[#18232E] p-6 text-center shadow-2xl clip-val-panel">
        <div className="mx-auto mb-3 h-12 w-12 overflow-hidden border border-[#FF4655]/60 bg-[#0F1923] clip-val-card">
          <img
            src="/assets/aistudio/592741050_1795088378575204_98fcd619.jpg"
            alt="Hollow Strike"
            className="h-full w-full object-cover"
          />
        </div>

        <h2 className="font-display text-2xl font-extrabold uppercase tracking-[0.18em] text-[#ECE8E1]">
          MATCH PAUSED
        </h2>

        <div className="mt-3 flex items-center justify-center gap-3 font-mono text-sm border-y border-[#ECE8E1]/15 py-2 text-[#ECE8E1]">
          <span className="text-[#FF4655] font-bold">ATT {attackerScore}</span>
          <span className="text-[#8B978F]">—</span>
          <span className="text-[#17E5B8] font-bold">{defenderScore} DEF</span>
          <span className="text-[#8B978F]">|</span>
          <span className="text-xs text-[#8B978F]">
            {isTdmMatch ? `${teamSize}V${teamSize} TDM` : `ROUND ${currentRound}`}
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={onResume}
            className="w-full bg-[#FF4655] py-3 font-display text-sm font-extrabold uppercase tracking-[0.18em] text-[#ECE8E1] hover:bg-[#ff5e6b] shadow-lg shadow-[#FF4655]/25 transition cursor-pointer clip-val-btn"
          >
            Resume Combat [Esc]
          </button>

          <button
            onClick={onOpenSettings}
            className="w-full border border-[#ECE8E1]/20 bg-[#0F1923] py-2.5 font-display text-sm font-bold uppercase tracking-wider text-[#ECE8E1] hover:border-[#17E5B8] hover:text-[#17E5B8] transition cursor-pointer clip-val-card"
          >
            Tactical Settings
          </button>

          <button
            onClick={onReturnToTitle}
            className="w-full border border-[#FF4655]/40 bg-[#FF4655]/10 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-[#FF4655] hover:bg-[#FF4655]/20 transition cursor-pointer clip-val-card"
          >
            Forfeit / Title Screen
          </button>
        </div>
      </div>
    </div>
  );
};
