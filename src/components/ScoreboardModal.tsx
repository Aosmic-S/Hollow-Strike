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
        <div className={`flex items-center justify-between border-b pb-2 ${isAttacker ? 'border-red-500/40 text-red-400' : 'border-blue-500/40 text-blue-400'}`}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-black uppercase tracking-wider">{team}</span>
            <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-mono font-bold text-white">
              {score} ROUNDS
            </span>
          </div>
        </div>

        <table className="w-full text-left font-mono text-xs mt-2">
          <thead>
            <tr className="text-slate-400 border-b border-slate-800 text-[10px]">
              <th className="py-1">OPERATIVE</th>
              <th className="text-right py-1">K</th>
              <th className="text-right py-1">D</th>
              <th className="text-right py-1">A</th>
              <th className="text-right py-1">SCORE</th>
              <th className="text-right py-1">CREDITS</th>
              <th className="text-right py-1">PING</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {teamStats.map((p) => (
              <tr key={p.id} className={`${p.isHuman ? 'bg-cyan-950/20 text-cyan-300' : 'text-slate-200'}`}>
                <td className="py-2 flex items-center gap-2 font-bold">
                  <span className={`h-2 w-2 rounded-full ${p.alive ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <span>{p.name}</span>
                  {p.hasSpike && <span className="text-amber-400 font-bold" title="Carrying Spike">⚡</span>}
                </td>
                <td className="text-right tabular-nums">{p.kills}</td>
                <td className="text-right tabular-nums text-slate-400">{p.deaths}</td>
                <td className="text-right tabular-nums text-slate-400">{p.assists}</td>
                <td className="text-right tabular-nums font-bold text-white">{p.score}</td>
                <td className="text-right tabular-nums text-emerald-400">${p.credits}</td>
                <td className="text-right tabular-nums text-slate-500">{p.ping}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
      <div className="relative w-full max-w-4xl rounded-xl border border-slate-700 bg-slate-950/95 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <h2 className="text-lg font-black uppercase tracking-widest text-white">MATCH TELEMETRY</h2>
            <p className="text-xs text-slate-400">First to 13 round wins · Tactical Plant / Defuse</p>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold uppercase text-slate-300 hover:text-white transition cursor-pointer"
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
