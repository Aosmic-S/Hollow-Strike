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
  const favAgent = AGENT_REGISTRY[profile.favoriteAgentId] || AGENT_REGISTRY.KAEL;

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
      <div className="flex-1 border border-[#ECE8E1]/15 bg-[#18232E]/90 p-5 sm:p-6 space-y-6 clip-val-panel">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-[#ECE8E1]/15 pb-5">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center border-2 font-display text-2xl font-extrabold clip-val-card"
            style={{
              borderColor: favAgent.primaryColor,
              backgroundColor: `${favAgent.primaryColor}20`,
              color: favAgent.primaryColor,
            }}
          >
            {profile.callsign.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#17E5B8]">
              {rank.tier} · LEVEL {rank.level}
            </div>
            <h2 className="font-display text-3xl font-extrabold uppercase tracking-wide text-[#ECE8E1]">
              {profile.callsign}
            </h2>
            <p className="font-mono text-xs text-[#8B978F] mt-0.5 tabular-nums">
              {rank.xp.toLocaleString()} XP earned across {profile.totalMatches} completed matches
            </p>
          </div>
        </div>

        {/* XP Progression */}
        <div>
          <div className="flex justify-between font-mono text-xs mb-1.5">
            <span className="text-[#8B978F] uppercase font-bold">Level Progression</span>
            <span className="text-[#17E5B8] font-bold tabular-nums">
              {rank.xp.toLocaleString()} / {rank.nextLevelXp.toLocaleString()} XP ({rank.progressPct}%)
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden bg-[#0F1923] border border-[#ECE8E1]/15">
            <div
              className="h-full bg-gradient-to-r from-[#17E5B8] to-[#FF4655] transition-all duration-300"
              style={{ width: `${rank.progressPct}%` }}
            />
          </div>
        </div>

        {/* Progression Unlockables */}
        <div className="border-t border-[#ECE8E1]/15 pt-5">
          <div className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#ECE8E1] mb-3">
            Operative Unlockables & Rewards
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            {[
              { level: 1, title: 'Recruit Starter Kit', desc: 'Default agents & standard loadout' },
              { level: 3, title: 'Tactical Operator Skin', desc: 'Custom combat fatigues & insignia' },
              { level: 6, title: 'Vanguard Weapon Finish', desc: 'Ion cobalt finish for Kadence & Reaper' },
              { level: 10, title: 'Phantom Elite Badge', desc: 'Exclusive operator emblem & title' },
            ].map((item) => {
              const unlocked = rank.level >= item.level;
              return (
                <div
                  key={item.level}
                  className={`border p-3.5 flex items-center justify-between clip-val-card ${
                    unlocked
                      ? 'border-[#17E5B8]/45 bg-[#17E5B8]/10 text-[#ECE8E1]'
                      : 'border-[#ECE8E1]/10 bg-[#0F1923]/60 text-[#8B978F]'
                  }`}
                >
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      <span className={unlocked ? 'text-[#17E5B8]' : 'text-[#8B978F]'}>
                        LVL {item.level}
                      </span>
                      <span>{item.title}</span>
                    </div>
                    <div className="text-[11px] text-[#8B978F] mt-0.5">{item.desc}</div>
                  </div>
                  <div
                    className={`text-[10px] font-black uppercase px-2 py-1 ${
                      unlocked ? 'bg-[#17E5B8]/20 text-[#17E5B8]' : 'bg-[#0F1923] text-[#8B978F]'
                    }`}
                  >
                    {unlocked ? 'Unlocked' : `Locked (${item.level})`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Edit Callsign */}
        <form onSubmit={handleSaveCallsign} className="space-y-2 border-t border-[#ECE8E1]/15 pt-5">
          <label className="block font-mono text-xs font-bold uppercase tracking-wider text-[#ECE8E1]">
            In-Game Callsign
          </label>
          <div className="flex gap-2.5">
            <input
              type="text"
              maxLength={18}
              value={callsignDraft}
              onChange={(e) => setCallsignDraft(e.target.value)}
              placeholder="Enter callsign"
              className="flex-1 border border-[#ECE8E1]/20 bg-[#0F1923] px-3.5 py-2.5 font-mono text-sm font-bold text-[#ECE8E1] focus:border-[#17E5B8] focus:outline-none"
            />
            <button
              type="submit"
              className="bg-[#FF4655] px-5 py-2.5 font-display text-sm font-extrabold uppercase tracking-wider text-[#ECE8E1] hover:bg-[#ff5e6b] transition cursor-pointer clip-val-btn"
            >
              {savedNotice ? 'Saved' : 'Save Name'}
            </button>
          </div>
        </form>

        {/* Preferred Default Agent */}
        <div className="border-t border-[#ECE8E1]/15 pt-5">
          <div className="font-mono text-xs font-bold uppercase tracking-wider text-[#ECE8E1] mb-2.5">
            Default Lobby Operative
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {Object.values(AGENT_REGISTRY).map((ag) => {
              const selected = profile.favoriteAgentId === ag.id;
              return (
                <button
                  key={ag.id}
                  onClick={() => onUpdateProfile({ ...profile, favoriteAgentId: ag.id })}
                  className={`border p-3 text-left font-mono transition cursor-pointer clip-val-card ${
                    selected
                      ? 'bg-[#0F1923] text-[#ECE8E1]'
                      : 'border-[#ECE8E1]/15 bg-[#0F1923]/55 text-[#8B978F] hover:border-[#ECE8E1]/35'
                  }`}
                  style={selected ? { borderColor: ag.primaryColor } : undefined}
                >
                  <div className="font-display text-sm font-extrabold uppercase text-[#ECE8E1]">{ag.name}</div>
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
      <div className="lg:w-80 shrink-0 border border-[#ECE8E1]/15 bg-[#18232E]/90 p-5 sm:p-6 flex flex-col justify-between clip-val-panel">
        <div>
          <h3 className="font-display text-xl font-extrabold uppercase tracking-wider text-[#ECE8E1]">
            Local Save Storage
          </h3>
          <p className="mt-2 text-xs text-[#8B978F] leading-relaxed">
            Your callsign, settings, agent breakdown, weapon accuracy, and match history persist locally in browser storage.
          </p>

          <div className="mt-5 space-y-2.5 border border-[#ECE8E1]/15 bg-[#0F1923]/80 p-4 font-mono text-xs clip-val-card">
            <div className="flex justify-between">
              <span className="text-[#8B978F]">Matches Recorded</span>
              <span className="font-bold text-[#ECE8E1] tabular-nums">{profile.totalMatches}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8B978F]">Total Eliminations</span>
              <span className="font-bold text-[#ECE8E1] tabular-nums">{profile.kills}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8B978F]">Total Deaths</span>
              <span className="font-bold text-[#ECE8E1] tabular-nums">{profile.deaths}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-[#ECE8E1]/15 pt-4">
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="w-full border border-[#FF4655]/45 bg-[#FF4655]/10 py-2.5 font-mono text-xs font-bold uppercase text-[#FF4655] hover:bg-[#FF4655]/20 transition cursor-pointer clip-val-card"
            >
              Reset Career Data
            </button>
          ) : (
            <div className="space-y-2">
              <div className="font-mono text-[11px] text-[#FF4655] text-center">
                Erase all local match history and stats?
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfirmReset(false)}
                  className="border border-[#ECE8E1]/20 bg-[#0F1923] py-2 font-mono text-xs font-bold uppercase text-[#ECE8E1] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onResetProfile();
                    setCallsignDraft('Operative');
                    setConfirmReset(false);
                  }}
                  className="bg-[#FF4655] py-2 font-mono text-xs font-black uppercase text-[#ECE8E1] cursor-pointer"
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
