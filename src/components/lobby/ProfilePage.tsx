/**
 * Hollow Strike - Dedicated Operative Profile Page
 * Manage persistent callsign, preferred default agent, rank XP progress, and career reset.
 */

import React, { useState } from 'react';
import { AGENT_REGISTRY, PlayerProfile } from '../../game/types';
import { computeRankProgress } from '../../game/profileStore';

interface ProfilePageProps {
  profile: PlayerProfile;
  onUpdateProfile: (next: PlayerProfile) => void;
  onResetProfile: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  profile,
  onUpdateProfile,
  onResetProfile,
}) => {
  const [callsignDraft, setCallsignDraft] = useState<string>(profile.callsign);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  const rank = computeRankProgress(profile);
  const favAgent = AGENT_REGISTRY[profile.favoriteAgentId] || AGENT_REGISTRY.ZEPHYR;

  const handleSaveCallsign = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = callsignDraft.trim().slice(0, 18) || 'Operative';
    setCallsignDraft(cleaned);
    onUpdateProfile({ ...profile, callsign: cleaned });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  return (
    <div className="relative z-10 flex flex-1 flex-col lg:flex-row overflow-y-auto px-4 sm:px-6 py-4 gap-5">
      {/* Left: Identity & Rank Progress */}
      <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-slate-800 pb-5">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 font-mono text-2xl font-black"
            style={{
              borderColor: favAgent.primaryColor,
              backgroundColor: `${favAgent.primaryColor}20`,
              color: favAgent.primaryColor,
            }}
          >
            {profile.callsign.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-widest text-cyan-400">
              {rank.tier} · LEVEL {rank.level}
            </div>
            <h2 className="font-mono text-2xl font-black text-white">{profile.callsign}</h2>
            <p className="font-mono text-xs text-slate-400 mt-0.5 tabular-nums">
              {rank.xp.toLocaleString()} XP earned across {profile.totalMatches} completed matches
            </p>
          </div>
        </div>

        {/* XP Progression */}
        <div>
          <div className="flex justify-between font-mono text-xs mb-1.5">
            <span className="text-slate-400 uppercase font-bold">Level Progression</span>
            <span className="text-cyan-300 font-bold tabular-nums">
              {rank.xp.toLocaleString()} / {rank.nextLevelXp.toLocaleString()} XP ({rank.progressPct}%)
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-cyan-400 transition-all duration-300"
              style={{ width: `${rank.progressPct}%` }}
            />
          </div>
        </div>

        {/* Progression Unlockables */}
        <div className="border-t border-slate-800 pt-5">
          <div className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
            Operative Unlockables & Rewards
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            {[
              { level: 1, title: 'Recruit Starter Kit', desc: 'Default agents & standard loadout', unlocked: rank.level >= 1 },
              { level: 3, title: 'Tactical Operator Skin', desc: 'Custom combat fatigues & insignia', unlocked: rank.level >= 3 },
              { level: 6, title: 'Vanguard Weapon Finish', desc: 'Cyan cobalt finish for Apex-9 & Viper-9', unlocked: rank.level >= 6 },
              { level: 10, title: 'Phantom Elite Badge', desc: 'Exclusive operator emblem & title', unlocked: rank.level >= 10 },
            ].map((item) => (
              <div
                key={item.level}
                className={`rounded-xl border p-3.5 flex items-center justify-between ${
                  rank.level >= item.level
                    ? 'border-cyan-500/40 bg-cyan-950/10 text-white'
                    : 'border-slate-800 bg-slate-900/40 text-slate-500'
                }`}
              >
                <div>
                  <div className="font-bold flex items-center gap-2">
                    <span className={rank.level >= item.level ? 'text-cyan-400' : 'text-slate-600'}>
                      LVL {item.level}
                    </span>
                    <span>{item.title}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                </div>
                <div className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
                  rank.level >= item.level ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-500'
                }`}>
                  {rank.level >= item.level ? 'Unlocked' : `Locked (${item.level})`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Edit Callsign */}
        <form onSubmit={handleSaveCallsign} className="space-y-2 border-t border-slate-800 pt-5">
          <label className="block font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
            In-Game Callsign
          </label>
          <div className="flex gap-2.5">
            <input
              type="text"
              maxLength={18}
              value={callsignDraft}
              onChange={(e) => setCallsignDraft(e.target.value)}
              placeholder="Enter callsign"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-mono text-sm font-bold text-white focus:border-cyan-400 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-cyan-600 px-5 py-2.5 font-mono text-xs font-black uppercase tracking-wider text-white hover:bg-cyan-500 transition cursor-pointer"
            >
              {savedNotice ? 'Saved' : 'Save Name'}
            </button>
          </div>
        </form>

        {/* Preferred Default Agent */}
        <div className="border-t border-slate-800 pt-5">
          <div className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5">
            Default Lobby Operative
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {Object.values(AGENT_REGISTRY).map((ag) => {
              const selected = profile.favoriteAgentId === ag.id;
              return (
                <button
                  key={ag.id}
                  onClick={() => onUpdateProfile({ ...profile, favoriteAgentId: ag.id })}
                  className={`rounded-xl border p-3 text-left font-mono transition cursor-pointer ${
                    selected
                      ? 'bg-slate-900 text-white'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                  }`}
                  style={selected ? { borderColor: ag.primaryColor } : undefined}
                >
                  <div className="text-xs font-black text-white">{ag.name}</div>
                  <div className="text-[10px] uppercase font-bold mt-0.5" style={{ color: ag.primaryColor }}>
                    {ag.role}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Storage & Reset */}
      <div className="lg:w-80 shrink-0 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 sm:p-6 flex flex-col justify-between">
        <div>
          <h3 className="font-mono text-sm font-black uppercase tracking-wider text-white">
            Local Save Storage
          </h3>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            Your callsign, settings, agent breakdown, weapon accuracy, and match history are saved locally in your browser without external servers.
          </p>

          <div className="mt-5 space-y-2.5 rounded-xl border border-slate-800 bg-slate-900/50 p-4 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Matches Recorded</span>
              <span className="font-bold text-white tabular-nums">{profile.totalMatches}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Eliminations</span>
              <span className="font-bold text-white tabular-nums">{profile.kills}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Deaths</span>
              <span className="font-bold text-white tabular-nums">{profile.deaths}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-800 pt-4">
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="w-full rounded-xl border border-rose-500/40 bg-rose-950/20 py-2.5 font-mono text-xs font-bold uppercase text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
            >
              Reset Career Data
            </button>
          ) : (
            <div className="space-y-2">
              <div className="font-mono text-[11px] text-rose-300 text-center">
                Erase all local match history and stats?
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfirmReset(false)}
                  className="rounded-lg border border-slate-700 bg-slate-900 py-2 font-mono text-xs font-bold uppercase text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onResetProfile();
                    setCallsignDraft('Operative');
                    setConfirmReset(false);
                  }}
                  className="rounded-lg bg-rose-600 py-2 font-mono text-xs font-black uppercase text-white cursor-pointer"
                >
                  Confirm
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
