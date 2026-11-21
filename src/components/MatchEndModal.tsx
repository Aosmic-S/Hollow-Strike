/**
 * Hollow Strike - Match End Modal
 * Displays match outcome (VICTORY / DEFEAT), Match MVP, statistics, and Play Again CTA.
 */

import React from 'react';
import { PlayerStats, TeamSide } from '../game/types';

interface MatchEndModalProps {
  winner: TeamSide;
  playerTeam: TeamSide;
  attackerRounds: number;
  defenderRounds: number;
  stats: PlayerStats[];
  onPlayAgain: () => void;
  onReturnToTitle: () => void;
}

export const MatchEndModal: React.FC<MatchEndModalProps> = ({
  winner,
  playerTeam,
  attackerRounds,
  defenderRounds,
  stats,
  onPlayAgain,
  onReturnToTitle,
}) => {
  const isPlayerWinner = winner === playerTeam;
  const sortedStats = [...stats].sort((a, b) => b.score - a.score);
  const mvp = sortedStats[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1923]/94 p-4 select-none">
      <div className="relative w-full max-w-2xl border border-[#ECE8E1]/20 bg-[#18232E] p-8 text-center shadow-2xl clip-val-panel">
        <div className="mx-auto mb-3 inline-block border border-[#ECE8E1]/15 bg-[#0F1923] px-3 py-1.5 clip-val-card">
          <img
            src="/assets/aistudio/350024580_1795088286721343_bce24b44.jpg"
            alt="Hollow Strike"
            className="h-10 w-auto object-contain"
          />
        </div>

        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#8B978F]">
          OPERATION CONCLUDED
        </div>

        <h1
          className={`mt-1 font-display text-6xl font-extrabold uppercase tracking-[0.18em] ${
            isPlayerWinner ? 'text-[#17E5B8]' : 'text-[#FF4655]'
          }`}
        >
          {isPlayerWinner ? 'VICTORY' : 'DEFEAT'}
        </h1>

        <div className="mt-2 font-mono text-xl font-bold text-[#ECE8E1]">
          <span className="text-[#FF4655]">ATT {attackerRounds}</span>
          <span className="mx-3 text-[#8B978F]">—</span>
          <span className="text-[#17E5B8]">{defenderRounds} DEF</span>
        </div>

        {/* MVP Card */}
        {mvp && (
          <div className="mx-auto mt-6 max-w-md border border-[#fbbf24]/35 bg-[#0F1923] p-4 clip-val-card">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#fbbf24] font-bold">
              MATCH MVP
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-display text-lg font-extrabold uppercase tracking-wide text-[#ECE8E1]">
                {mvp.name}
              </span>
              <span className="font-mono text-sm font-bold text-[#fbbf24] tabular-nums">
                {mvp.kills}K / {mvp.deaths}D · {mvp.score} PTS
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={onReturnToTitle}
            className="border border-[#ECE8E1]/20 bg-[#0F1923] px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-[#ECE8E1] hover:border-[#17E5B8] hover:text-[#17E5B8] transition cursor-pointer clip-val-card"
          >
            Title Screen
          </button>

          <button
            data-start="true"
            onClick={onPlayAgain}
            className="bg-[#FF4655] px-8 py-3 font-display text-base font-extrabold uppercase tracking-[0.18em] text-[#ECE8E1] hover:bg-[#ff5e6b] shadow-xl shadow-[#FF4655]/30 transition cursor-pointer clip-val-btn"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
};
