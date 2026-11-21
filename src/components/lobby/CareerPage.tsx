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
        <div className="border border-[#ECE8E1]/15 bg-[#18232E]/90 p-4 clip-val-card">
          <div className="text-[10px] uppercase text-[#8B978F]">Rank Standing</div>
          <div className="mt-1 font-display text-xl font-extrabold text-[#17E5B8] uppercase">{rank.tier}</div>
          <div className="text-[11px] text-[#8B978F] tabular-nums">LVL {rank.level} · {rank.xp} XP</div>
        </div>

        <div className="border border-[#ECE8E1]/15 bg-[#18232E]/90 p-4 clip-val-card">
          <div className="text-[10px] uppercase text-[#8B978F]">Matches Played</div>
          <div className="mt-1 text-2xl font-bold text-[#ECE8E1] tabular-nums">{profile.totalMatches}</div>
          <div className="text-[11px] text-[#8B978F] tabular-nums">
            {profile.wins}W – {profile.losses}L
          </div>
        </div>

        <div className="border border-[#ECE8E1]/15 bg-[#18232E]/90 p-4 clip-val-card">
          <div className="text-[10px] uppercase text-[#8B978F]">Win Rate</div>
          <div className="mt-1 text-2xl font-bold text-[#17E5B8] tabular-nums">{winRate}%</div>
          <div className="text-[11px] text-[#8B978F] tabular-nums">
            {profile.roundsWon}R Won
          </div>
        </div>

        <div className="border border-[#ECE8E1]/15 bg-[#18232E]/90 p-4 clip-val-card">
          <div className="text-[10px] uppercase text-[#8B978F]">K / D Ratio</div>
          <div className="mt-1 text-2xl font-bold text-[#ECE8E1] tabular-nums">{kd}</div>
          <div className="text-[11px] text-[#8B978F] tabular-nums">
            {profile.kills}K / {profile.deaths}D
          </div>
        </div>

        <div className="border border-[#ECE8E1]/15 bg-[#18232E]/90 p-4 clip-val-card">
          <div className="text-[10px] uppercase text-[#8B978F]">Headshot %</div>
          <div className="mt-1 text-2xl font-bold text-[#fbbf24] tabular-nums">{hsRate}%</div>
          <div className="text-[11px] text-[#8B978F] tabular-nums">{profile.headshots} Headshots</div>
        </div>

        <div className="border border-[#ECE8E1]/15 bg-[#18232E]/90 p-4 clip-val-card">
          <div className="text-[10px] uppercase text-[#8B978F]">Damage Dealt</div>
          <div className="mt-1 text-2xl font-bold text-[#FF4655] tabular-nums">
            {profile.damageDealt.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#8B978F]">Lifetime Total</div>
        </div>
      </div>

      {profile.totalMatches === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center border border-dashed border-[#ECE8E1]/20 bg-[#18232E]/60 p-8 text-center clip-val-panel">
          <h3 className="font-display text-2xl font-extrabold uppercase tracking-wider text-[#ECE8E1]">
            No Combat Records Yet
          </h3>
          <p className="mt-2 max-w-md text-xs text-[#8B978F] leading-relaxed">
            Career telemetry records automatically upon completing matches. Play a Competitive or Skirmish match to log eliminations, accuracy, agent win rates, and match history.
          </p>
          <button
            onClick={onStartQuickMatch}
            className="mt-5 bg-[#FF4655] px-7 py-2.5 font-display text-sm font-extrabold uppercase tracking-widest text-[#ECE8E1] hover:bg-[#ff5e6b] transition cursor-pointer clip-val-btn"
          >
            Play First Match
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1">
          {/* Match History */}
          <div className="lg:col-span-2 border border-[#ECE8E1]/15 bg-[#18232E]/90 p-5 flex flex-col clip-val-panel">
            <h3 className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#8B978F] mb-3">
              Recent Matches ({profile.matchHistory.length})
            </h3>
            <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1 font-mono text-xs">
              {profile.matchHistory.map((m) => {
                const ag = AGENT_REGISTRY[m.agentId] || AGENT_REGISTRY.KAEL;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-wrap items-center justify-between gap-3 border-l-2 border px-4 py-3 clip-val-card ${
                      m.won
                        ? 'border-l-[#17E5B8] border-[#17E5B8]/30 bg-[#17E5B8]/10'
                        : 'border-l-[#FF4655] border-[#FF4655]/30 bg-[#FF4655]/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-black uppercase ${
                          m.won ? 'bg-[#17E5B8]/20 text-[#17E5B8]' : 'bg-[#FF4655]/20 text-[#FF4655]'
                        }`}
                      >
                        {m.won ? 'VICTORY' : 'DEFEAT'}
                      </span>
                      <div>
                        <div className="font-bold text-[#ECE8E1]">
                          {ag.name} · <span className="text-[#8B978F]">{m.mode}</span>
                        </div>
                        <div className="text-[10px] text-[#8B978F]">
                          {new Date(m.timestamp).toLocaleDateString()} · {m.difficulty} BOTS
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 tabular-nums">
                      <div className="text-right">
                        <div className="text-[10px] text-[#8B978F]">SCORE</div>
                        <div className="font-black text-[#ECE8E1]">
                          {m.attackerScore} – {m.defenderScore}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-[#8B978F]">K / D</div>
                        <div className="font-bold text-[#17E5B8]">
                          {m.kills} / {m.deaths}
                        </div>
                      </div>
                      <div className="text-right hidden sm:block">
                        <div className="text-[10px] text-[#8B978F]">DAMAGE</div>
                        <div className="font-bold text-[#ECE8E1]">{m.damageDealt}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agent & Weapon Telemetry */}
          <div className="space-y-4 font-mono">
            <div className="border border-[#ECE8E1]/15 bg-[#18232E]/90 p-5 clip-val-card">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#8B978F] mb-3">
                Operative Breakdown
              </h3>
              <div className="space-y-2.5 text-xs">
                {playedAgents.map(({ agent, stats }) => (
                  <div key={agent.id} className="flex items-center justify-between border-b border-[#ECE8E1]/10 pb-2">
                    <div>
                      <span className="font-bold text-[#ECE8E1]">{agent.name}</span>
                      <span className="ml-2 text-[10px] text-[#8B978F]">{stats.matches}M</span>
                    </div>
                    <div className="tabular-nums text-right">
                      <span className="text-[#17E5B8] font-bold">
                        {Math.round((stats.wins / stats.matches) * 100)}% W
                      </span>
                      <span className="ml-3 text-[#ECE8E1]">
                        {stats.kills}K/{stats.deaths}D
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {usedWeapons.length > 0 && (
              <div className="border border-[#ECE8E1]/15 bg-[#18232E]/90 p-5 clip-val-card">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#8B978F] mb-3">
                  Weapon Telemetry
                </h3>
                <div className="space-y-2.5 text-xs">
                  {usedWeapons.map(({ weapon, stats }) => {
                    const acc = Math.round((stats.shotsHit / Math.max(1, stats.shotsFired)) * 100);
                    return (
                      <div key={weapon.id} className="flex items-center justify-between border-b border-[#ECE8E1]/10 pb-2">
                        <div>
                          <div className="font-bold text-[#ECE8E1]">{weapon.name}</div>
                          <div className="text-[10px] text-[#8B978F]">{acc}% Accuracy</div>
                        </div>
                        <div className="tabular-nums text-right">
                          <div className="font-bold text-[#fbbf24]">{stats.kills} Kills</div>
                          <div className="text-[10px] text-[#8B978F]">{Math.round(stats.damageDealt)} DMG</div>
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
