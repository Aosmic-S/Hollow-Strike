/**
 * Hollow Strike - Dedicated Career & Match History Page
 * Strictly backed by persistent PlayerProfile records (zero simulated demo stats).
 */

import React from 'react';
import { AGENT_REGISTRY, PlayerProfile, WEAPON_REGISTRY } from '../../game/types';
import { computeRankProgress } from '../../game/profileStore';

interface CareerPageProps {
  profile: PlayerProfile;
  onStartQuickMatch: () => void;
}

export const CareerPage: React.FC<CareerPageProps> = ({ profile, onStartQuickMatch }) => {
  const rank = computeRankProgress(profile);
  const kd = profile.deaths > 0 ? (profile.kills / profile.deaths).toFixed(2) : profile.kills.toFixed(2);
  const winRate = profile.totalMatches > 0 ? Math.round((profile.wins / profile.totalMatches) * 100) : 0;
  const hsRate = profile.kills > 0 ? Math.round((profile.headshots / profile.kills) * 100) : 0;

  const playedAgents = Object.entries(profile.agentStats)
    .map(([id, st]) => ({ agent: AGENT_REGISTRY[id], stats: st }))
    .filter((entry) => Boolean(entry.agent))
    .sort((a, b) => b.stats.matches - a.stats.matches);

  const usedWeapons = Object.entries(profile.weaponStats)
    .map(([id, st]) => ({ weapon: WEAPON_REGISTRY[id], stats: st }))
    .filter((entry) => Boolean(entry.weapon) && entry.stats.shotsFired > 0)
    .sort((a, b) => b.stats.damageDealt - a.stats.damageDealt);

  return (
    <div className="relative z-10 flex flex-1 flex-col overflow-y-auto px-4 sm:px-6 py-4 gap-5">
      {/* Top KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
          <div className="text-[10px] uppercase text-slate-400">Rank Standing</div>
          <div className="mt-1 text-lg font-black text-cyan-300">{rank.tier}</div>
          <div className="text-[11px] text-slate-400 tabular-nums">LVL {rank.level} · {rank.xp} XP</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
          <div className="text-[10px] uppercase text-slate-400">Matches Played</div>
          <div className="mt-1 text-2xl font-black text-white tabular-nums">{profile.totalMatches}</div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            {profile.wins}W – {profile.losses}L
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
          <div className="text-[10px] uppercase text-slate-400">Win Rate</div>
          <div className="mt-1 text-2xl font-black text-emerald-400 tabular-nums">{winRate}%</div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            {profile.roundsWon}R Won
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
          <div className="text-[10px] uppercase text-slate-400">K / D Ratio</div>
          <div className="mt-1 text-2xl font-black text-white tabular-nums">{kd}</div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            {profile.kills}K / {profile.deaths}D
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
          <div className="text-[10px] uppercase text-slate-400">Headshot %</div>
          <div className="mt-1 text-2xl font-black text-amber-300 tabular-nums">{hsRate}%</div>
          <div className="text-[11px] text-slate-400 tabular-nums">{profile.headshots} Headshots</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
          <div className="text-[10px] uppercase text-slate-400">Damage Dealt</div>
          <div className="mt-1 text-2xl font-black text-rose-400 tabular-nums">
            {profile.damageDealt.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400">Lifetime Total</div>
        </div>
      </div>

      {profile.totalMatches === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-8 text-center">
          <h3 className="font-mono text-lg font-black uppercase text-white">
            No Combat Records Yet
          </h3>
          <p className="mt-2 max-w-md text-xs text-slate-400 leading-relaxed">
            Career telemetry records automatically upon completing matches. Play a Competitive or Skirmish match to log eliminations, accuracy, agent win rates, and match history.
          </p>
          <button
            onClick={onStartQuickMatch}
            className="mt-5 rounded-xl bg-rose-600 px-6 py-2.5 font-mono text-xs font-black uppercase tracking-wider text-white hover:bg-rose-500 transition cursor-pointer"
          >
            Play First Match
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1">
          {/* Match History (2 columns) */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 flex flex-col">
            <h3 className="font-mono text-xs font-black uppercase tracking-widest text-slate-300 mb-3">
              Recent Matches ({profile.matchHistory.length})
            </h3>
            <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1 font-mono text-xs">
              {profile.matchHistory.map((m) => {
                const ag = AGENT_REGISTRY[m.agentId] || AGENT_REGISTRY.ZEPHYR;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                      m.won
                        ? 'border-emerald-500/30 bg-emerald-950/15'
                        : 'border-rose-500/30 bg-rose-950/15'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                          m.won ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {m.won ? 'VICTORY' : 'DEFEAT'}
                      </span>
                      <div>
                        <div className="font-bold text-white">
                          {ag.name} · <span className="text-slate-400">{m.mode}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(m.timestamp).toLocaleDateString()} · {m.difficulty} BOTS
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 tabular-nums">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">SCORE</div>
                        <div className="font-black text-white">
                          {m.attackerScore} – {m.defenderScore}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">K / D</div>
                        <div className="font-bold text-cyan-300">
                          {m.kills} / {m.deaths}
                        </div>
                      </div>
                      <div className="text-right hidden sm:block">
                        <div className="text-[10px] text-slate-400">DAMAGE</div>
                        <div className="font-bold text-slate-200">{m.damageDealt}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agent & Weapon Telemetry */}
          <div className="space-y-4 font-mono">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-3">
                Operative Breakdown
              </h3>
              <div className="space-y-2.5 text-xs">
                {playedAgents.map(({ agent, stats }) => (
                  <div key={agent.id} className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div>
                      <span className="font-bold text-white">{agent.name}</span>
                      <span className="ml-2 text-[10px] text-slate-400">{stats.matches}M</span>
                    </div>
                    <div className="tabular-nums text-right">
                      <span className="text-emerald-400 font-bold">
                        {Math.round((stats.wins / stats.matches) * 100)}% W
                      </span>
                      <span className="ml-3 text-slate-300">
                        {stats.kills}K/{stats.deaths}D
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {usedWeapons.length > 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-3">
                  Weapon Telemetry
                </h3>
                <div className="space-y-2.5 text-xs">
                  {usedWeapons.map(({ weapon, stats }) => {
                    const acc = Math.round((stats.shotsHit / Math.max(1, stats.shotsFired)) * 100);
                    return (
                      <div key={weapon.id} className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <div>
                          <div className="font-bold text-white">{weapon.name}</div>
                          <div className="text-[10px] text-slate-400">{acc}% Accuracy</div>
                        </div>
                        <div className="tabular-nums text-right">
                          <div className="font-bold text-amber-300">{stats.kills} Kills</div>
                          <div className="text-[10px] text-slate-400">{Math.round(stats.damageDealt)} DMG</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
