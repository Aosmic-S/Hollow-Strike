/**
 * Hollow Strike - Match Scoreboard
 * Full 10-player tactical statistics breakdown for Attackers and Defenders.
 */

import React from 'react';
import { PlayerStats, TeamSide } from '../game/types';

interface ScoreboardModalProps {
  stats: PlayerStats[];
  attackerRoundsWon: number;
  defenderRoundsWon: number;
  onClose: () => void;
}

export const ScoreboardModal: React.FC<ScoreboardModalProps> = ({
  stats,
  attackerRoundsWon,
  defenderRoundsWon,
  onClose,
}) => {
  const attackers = stats.filter((s) => s.team === 'ATTACKERS');
  const defenders = stats.filter((s) => s.team === 'DEFENDERS');

  const renderTeamTable = (teamStats: PlayerStats[], team: TeamSide, score: number) => {
    const isAttacker = team === 'ATTACKERS';
    return (
      <div className="flex flex-col">
        <div
          className={`flex items-center justify-between border-b pb-2 ${
            isAttacker ? 'border-[#FF4655]/50 text-[#FF4655]' : 'border-[#17E5B8]/50 text-[#17E5B8]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="font-display text-lg font-extrabold uppercase tracking-widest">{team}</span>
            <span className="bg-[#0F1923] px-2.5 py-0.5 text-xs font-mono font-bold text-[#ECE8E1] border border-[#ECE8E1]/15">
              {score} ROUNDS
            </span>
          </div>
        </div>

        <table className="w-full text-left font-mono text-xs mt-2">
          <thead>
            <tr className="text-[#8B978F] border-b border-[#ECE8E1]/15 text-[10px]">
              <th className="py-1">OPERATIVE</th>
              <th className="text-right py-1">K</th>
              <th className="text-right py-1">D</th>
              <th className="text-right py-1">A</th>
              <th className="text-right py-1">SCORE</th>
              <th className="text-right py-1">CREDITS</th>
              <th className="text-right py-1">PING</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ECE8E1]/10">
            {teamStats.map((p) => (
              <tr key={p.id} className={p.isHuman ? 'bg-[#17E5B8]/10 text-[#17E5B8]' : 'text-[#ECE8E1]'}>
                <td className="py-2 flex items-center gap-2 font-bold">
                  <span className={`h-2 w-2 rotate-45 ${p.alive ? 'bg-[#17E5B8]' : 'bg-[#8B978F]/40'}`} />
                  <span>{p.name}</span>
                  {p.hasSpike && <span className="text-[#FF4655] font-bold" title="Carrying Spike">⚡</span>}
                </td>
                <td className="text-right tabular-nums">{p.kills}</td>
                <td className="text-right tabular-nums text-[#8B978F]">{p.deaths}</td>
                <td className="text-right tabular-nums text-[#8B978F]">{p.assists}</td>
                <td className="text-right tabular-nums font-bold text-[#ECE8E1]">{p.score}</td>
                <td className="text-right tabular-nums text-[#17E5B8]">${p.credits}</td>
                <td className="text-right tabular-nums text-[#8B978F]">{p.ping}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1923]/85 backdrop-blur-sm p-4 select-none">
      <div className="relative w-full max-w-4xl border border-[#ECE8E1]/20 bg-[#18232E] p-6 shadow-2xl clip-val-panel">
        <div className="flex items-center justify-between border-b border-[#ECE8E1]/15 pb-3 mb-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-[0.16em] text-[#ECE8E1]">
              MATCH SCOREBOARD
            </h2>
            <p className="font-mono text-xs text-[#8B978F]">
              First to 13 round wins · Tactical Plant / Defuse
            </p>
          </div>
          <button
            onClick={onClose}
            className="border border-[#ECE8E1]/20 bg-[#0F1923] px-3 py-1.5 font-mono text-xs font-bold uppercase text-[#ECE8E1] hover:border-[#FF4655] hover:text-[#FF4655] transition cursor-pointer clip-val-card"
          >
            Close [Tab / Esc]
          </button>
        </div>

        <div className="space-y-6">
          {renderTeamTable(attackers, 'ATTACKERS', attackerRoundsWon)}
          {renderTeamTable(defenders, 'DEFENDERS', defenderRoundsWon)}
        </div>
      </div>
    </div>
  );
};
