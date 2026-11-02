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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 select-none">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-950/95 p-8 text-center shadow-2xl">
        {/* Outcome Header */}
        <div className="mb-2 inline-block rounded-full px-4 py-1 text-xs font-mono font-bold uppercase tracking-widest text-slate-400 border border-slate-800">
          OPERATION CONCLUDED
        </div>

        <h1
          className={`text-5xl font-black uppercase tracking-widest ${
            isPlayerWinner ? 'text-cyan-400' : 'text-red-500'
          }`}
        >
          {isPlayerWinner ? 'VICTORY' : 'DEFEAT'}
        </h1>

        <div className="mt-2 font-mono text-xl font-bold text-white">
          <span className="text-red-400">ATT {attackerRounds}</span>
          <span className="mx-3 text-slate-600">—</span>
          <span className="text-blue-400">{defenderRounds} DEF</span>
        </div>

        {/* MVP Card */}
        {mvp && (
          <div className="mx-auto mt-6 max-w-md rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
              ★ MATCH MVP
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-base font-black text-white">{mvp.name}</span>
              <span className="font-mono text-sm font-bold text-amber-300">
                {mvp.kills}K / {mvp.deaths}D · {mvp.score} PTS
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={onReturnToTitle}
            className="rounded-lg border border-slate-700 bg-slate-800 px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
          >
            Title Screen
          </button>

          <button
            data-start="true"
            onClick={onPlayAgain}
            className="rounded-lg bg-cyan-600 px-8 py-3 font-mono text-xs font-black uppercase tracking-widest text-white hover:bg-cyan-500 shadow-xl shadow-cyan-600/30 transition cursor-pointer"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
};
