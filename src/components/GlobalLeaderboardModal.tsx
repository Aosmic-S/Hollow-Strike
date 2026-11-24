/**
 * Hollow Strike - Global Leaderboard Modal
 * Fetches top player stats from Firestore 'users' collection with sorting by Wins, Kills, and Combat Score.
 * Features top 3 podium cards, full ranking table, and a sticky "Your Standing" row with Google Sign-In.
 */

import React, { useEffect, useState } from 'react';
import {
  Trophy,
  Flame,
  Award,
  RefreshCw,
  X,
  Search,
  LogIn,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import {
  CloudUserProfile,
  fetchGlobalLeaderboard,
  auth,
  googleProvider,
  signInWithPopup,
  User,
} from '../firebase';
import { AGENT_REGISTRY, PlayerProfile } from '../game/types';
import { computeRankProgress } from '../game/profileStore';
import { AgentEmblemMark } from './AgentAvatar';

type SortCategory = 'wins' | 'kills' | 'score';

interface GlobalLeaderboardModalProps {
  currentUser: User | null;
  profile: PlayerProfile;
  onClose: () => void;
  onUserAuthChange?: (user: User | null) => void;
}

// Tactical default vanguard operatives displayed if database is brand new
const FALLBACK_VANGUARDS: CloudUserProfile[] = [
  {
    uid: 'vg_phantom',
    callsign: 'ApexViper',
    wins: 48,
    losses: 12,
    kills: 620,
    deaths: 210,
    headshots: 195,
    damageDealt: 72000,
    totalMatches: 60,
    score: 86000,
    level: 18,
    tier: 'APEX COMMANDER',
    favoriteAgentId: 'KAEL',
    updatedAt: Date.now() - 3600000,
  },
  {
    uid: 'vg_ghost',
    callsign: 'Spectre_99',
    wins: 42,
    losses: 15,
    kills: 540,
    deaths: 230,
    headshots: 162,
    damageDealt: 61000,
    totalMatches: 57,
    score: 75000,
    level: 15,
    tier: 'PHANTOM',
    favoriteAgentId: 'ZED',
    updatedAt: Date.now() - 7200000,
  },
  {
    uid: 'vg_cipher',
    callsign: 'NovaBlade',
    wins: 36,
    losses: 18,
    kills: 490,
    deaths: 245,
    headshots: 140,
    damageDealt: 54000,
    totalMatches: 54,
    score: 67000,
    level: 13,
    tier: 'PHANTOM',
    favoriteAgentId: 'KORA',
    updatedAt: Date.now() - 10800000,
  },
  {
    uid: 'vg_zenith',
    callsign: 'SolarPulse',
    wins: 29,
    losses: 14,
    kills: 380,
    deaths: 195,
    headshots: 112,
    damageDealt: 43000,
    totalMatches: 43,
    score: 52500,
    level: 10,
    tier: 'VANGUARD',
    favoriteAgentId: 'SOREN',
    updatedAt: Date.now() - 14400000,
  },
  {
    uid: 'vg_bastion',
    callsign: 'IronAegis',
    wins: 25,
    losses: 16,
    kills: 310,
    deaths: 180,
    headshots: 88,
    damageDealt: 37000,
    totalMatches: 41,
    score: 43500,
    level: 8,
    tier: 'VANGUARD',
    favoriteAgentId: 'AEGIS',
    updatedAt: Date.now() - 18000000,
  },
];

export const GlobalLeaderboardModal: React.FC<GlobalLeaderboardModalProps> = ({
  currentUser,
  profile,
  onClose,
  onUserAuthChange,
}) => {
  const [sortBy, setSortBy] = useState<SortCategory>('wins');
  const [players, setPlayers] = useState<CloudUserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const rank = computeRankProgress(profile);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const cloudPlayers = await fetchGlobalLeaderboard(sortBy, 50);

      // Merge real cloud records with fallback if cloud is sparse
      const existingUids = new Set(cloudPlayers.map((p) => p.uid));
      const combined = [...cloudPlayers];

      // If current user is authenticated and in the list, ensure their latest stats
      if (currentUser && !existingUids.has(currentUser.uid)) {
        combined.push({
          uid: currentUser.uid,
          callsign: profile.callsign || currentUser.displayName || 'Operative',
          email: currentUser.email || '',
          photoURL: currentUser.photoURL || '',
          wins: profile.wins,
          losses: profile.losses,
          kills: profile.kills,
          deaths: profile.deaths,
          headshots: profile.headshots,
          damageDealt: profile.damageDealt,
          totalMatches: profile.totalMatches,
          score: profile.kills * 100 + profile.wins * 500,
          level: rank.level,
          tier: rank.tier,
          favoriteAgentId: profile.favoriteAgentId || 'KAEL',
          updatedAt: Date.now(),
        });
        existingUids.add(currentUser.uid);
      }

      // Add fallback vanguards if total is low so the leaderboard is always complete
      if (combined.length < 5) {
        for (const fb of FALLBACK_VANGUARDS) {
          if (!existingUids.has(fb.uid)) {
            combined.push(fb);
            existingUids.add(fb.uid);
          }
        }
      }

      // Sort by the chosen metric
      combined.sort((a, b) => {
        if (sortBy === 'wins') return (b.wins || 0) - (a.wins || 0);
        if (sortBy === 'kills') return (b.kills || 0) - (a.kills || 0);
        return (b.score || 0) - (a.score || 0);
      });

      setPlayers(combined);
      setLastRefreshed(new Date());
    } catch (err) {
      console.warn('[Leaderboard] Cloud fetch warning, using local/cached standing:', err);
      // Construct fallback list with current user
      const localFallback = [...FALLBACK_VANGUARDS];
      if (currentUser) {
        localFallback.push({
          uid: currentUser.uid,
          callsign: profile.callsign || currentUser.displayName || 'Operative',
          email: currentUser.email || '',
          photoURL: currentUser.photoURL || '',
          wins: profile.wins,
          losses: profile.losses,
          kills: profile.kills,
          deaths: profile.deaths,
          headshots: profile.headshots,
          damageDealt: profile.damageDealt,
          totalMatches: profile.totalMatches,
          score: profile.kills * 100 + profile.wins * 500,
          level: rank.level,
          tier: rank.tier,
          favoriteAgentId: profile.favoriteAgentId || 'KAEL',
          updatedAt: Date.now(),
        });
      }
      localFallback.sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));
      setPlayers(localFallback);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, [sortBy, currentUser]);

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      onUserAuthChange?.(res.user);
      loadLeaderboard();
    } catch (err) {
      console.warn('[Leaderboard] Google sign in popup closed or cancelled:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const filteredPlayers = players.filter((p) =>
    p.callsign.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  // Compute user's personal rank position
  const currentUserId = currentUser?.uid;
  const userRankIndex = players.findIndex(
    (p) => (currentUserId && p.uid === currentUserId) || p.callsign === profile.callsign
  );
  const userRankNumber = userRankIndex >= 0 ? userRankIndex + 1 : '—';

  const topThree = players.slice(0, 3);
  const remainingPlayers = filteredPlayers.length > 3 ? filteredPlayers.slice(3) : filteredPlayers;

  return (
    <div
      data-testid="global-leaderboard-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#070B10]/92 p-2 sm:p-5 backdrop-blur-md select-none"
    >
      <div className="relative flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-[#ECE8E1]/20 bg-[#0C121A] text-[#ECE8E1] shadow-2xl clip-val-panel">
        {/* HEADER BAR */}
        <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-[#ECE8E1]/15 bg-[#090F16] px-4 sm:px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center border border-[#F59E0B]/60 bg-[#F59E0B]/15 text-[#F59E0B]">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg sm:text-xl font-extrabold uppercase tracking-[0.16em] text-[#ECE8E1]">
                  GLOBAL LEADERBOARD
                </h2>
                <span className="border border-[#17E5B8]/40 bg-[#17E5B8]/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#17E5B8]">
                  FIRESTORE CLOUD
                </span>
              </div>
              <p className="font-mono text-[10px] text-[#8B978F] uppercase tracking-wider">
                Refreshed {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Top operatives worldwide
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={loadLeaderboard}
              disabled={loading}
              className="flex items-center gap-1.5 border border-[#ECE8E1]/20 bg-[#141E28] px-2.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-[#ECE8E1] hover:border-[#17E5B8] hover:text-[#17E5B8] transition cursor-pointer disabled:opacity-50"
              title="Refresh Leaderboard"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#17E5B8]' : ''}`} />
              <span className="hidden sm:inline">REFRESH</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center border border-[#ECE8E1]/20 bg-[#141E28] text-[#8B978F] hover:border-[#FF4655] hover:text-[#FF4655] transition cursor-pointer"
              title="Close Leaderboard"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* SUB-HEADER: SORT CATEGORIES & CALLSIGN SEARCH */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[#ECE8E1]/10 bg-[#0A1017] px-4 sm:px-6 py-2.5 shrink-0">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 bg-[#070D14] p-1 border border-[#ECE8E1]/10">
            <button
              type="button"
              onClick={() => setSortBy('wins')}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                sortBy === 'wins'
                  ? 'bg-[#FF4655] text-white shadow-md'
                  : 'text-[#8B978F] hover:text-[#ECE8E1]'
              }`}
            >
              <Trophy className="h-3.5 w-3.5" />
              <span>WINS</span>
            </button>
            <button
              type="button"
              onClick={() => setSortBy('kills')}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                sortBy === 'kills'
                  ? 'bg-[#FF4655] text-white shadow-md'
                  : 'text-[#8B978F] hover:text-[#ECE8E1]'
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              <span>ELIMINATIONS</span>
            </button>
            <button
              type="button"
              onClick={() => setSortBy('score')}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                sortBy === 'score'
                  ? 'bg-[#FF4655] text-white shadow-md'
                  : 'text-[#8B978F] hover:text-[#ECE8E1]'
              }`}
            >
              <Award className="h-3.5 w-3.5" />
              <span>COMBAT SCORE</span>
            </button>
          </div>

          {/* Search Callsign */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8B978F]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by operative name..."
              className="w-full border border-[#ECE8E1]/15 bg-[#0C131C] py-1.5 pl-8 pr-3 font-mono text-xs text-[#ECE8E1] placeholder-[#8B978F]/60 focus:border-[#17E5B8] focus:outline-none"
            />
          </div>
        </div>

        {/* MAIN BODY: PODIUM + RANK TABLE */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
          {/* TOP 3 PODIUM CARDS (Only show when not filtering by text) */}
          {!searchQuery && topThree.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* #2 SILVER (Left) */}
              <div className="order-2 md:order-1 flex flex-col justify-between border border-[#94A3B8]/40 bg-[#0F1622]/90 p-4 clip-val-card shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="flex h-6 w-6 items-center justify-center font-display text-sm font-extrabold text-[#94A3B8] border border-[#94A3B8]/60 bg-[#94A3B8]/15">
                    #2
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#8B978F]">
                    {topThree[1].tier}
                  </span>
                </div>
                <div className="my-3 flex items-center gap-3">
                  <div className="h-12 w-12 border border-[#94A3B8]/40 bg-[#162230] flex items-center justify-center shrink-0">
                    <AgentEmblemMark agentId={topThree[1].favoriteAgentId || 'ZED'} accentColor="#94A3B8" className="h-8 w-8" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-extrabold uppercase tracking-wide text-[#ECE8E1] truncate">
                      {topThree[1].callsign}
                    </h3>
                    <div className="font-mono text-xs text-[#94A3B8] font-bold">
                      LVL {topThree[1].level} · {AGENT_REGISTRY[topThree[1].favoriteAgentId]?.name || 'Operative'}
                    </div>
                  </div>
                </div>
                <div className="border-t border-[#ECE8E1]/10 pt-2 flex justify-between font-mono text-xs">
                  <div>
                    <span className="text-[9px] text-[#8B978F] uppercase block">WINS</span>
                    <span className="font-bold text-[#17E5B8]">{topThree[1].wins}W</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#8B978F] uppercase block">KILLS</span>
                    <span className="font-bold text-[#ECE8E1]">{topThree[1].kills}K</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#8B978F] uppercase block">SCORE</span>
                    <span className="font-bold text-[#F59E0B]">{topThree[1].score?.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* #1 GOLD (Center, Highlighted) */}
              <div className="order-1 md:order-2 flex flex-col justify-between border-2 border-[#F59E0B] bg-gradient-to-b from-[#1C1810]/95 via-[#141A24]/95 to-[#0F1622]/95 p-4 clip-val-card shadow-[0_0_30px_rgba(245,158,11,0.22)] -mt-1 md:-mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-7 w-7 items-center justify-center font-display text-base font-black text-[#0B0F15] bg-[#F59E0B] shadow-md">
                      #1
                    </span>
                    <span className="font-mono text-[9px] font-black uppercase tracking-widest text-[#F59E0B]">
                      SUPREME LEADER
                    </span>
                  </div>
                  <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#F59E0B]">
                    {topThree[0].tier}
                  </span>
                </div>
                <div className="my-3 flex items-center gap-3.5">
                  <div className="h-14 w-14 border border-[#F59E0B] bg-[#221B10] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.35)]">
                    <AgentEmblemMark agentId={topThree[0].favoriteAgentId || 'KAEL'} accentColor="#F59E0B" className="h-9 w-9" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-black uppercase tracking-wide text-[#FDE68A] truncate">
                      {topThree[0].callsign}
                    </h3>
                    <div className="font-mono text-xs text-[#F59E0B] font-bold">
                      LVL {topThree[0].level} · {AGENT_REGISTRY[topThree[0].favoriteAgentId]?.name || 'Operative'}
                    </div>
                  </div>
                </div>
                <div className="border-t border-[#F59E0B]/30 pt-2 flex justify-between font-mono text-xs">
                  <div>
                    <span className="text-[9px] text-[#8B978F] uppercase block">WINS</span>
                    <span className="font-black text-[#17E5B8]">{topThree[0].wins}W</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#8B978F] uppercase block">KILLS</span>
                    <span className="font-black text-[#ECE8E1]">{topThree[0].kills}K</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#8B978F] uppercase block">SCORE</span>
                    <span className="font-black text-[#F59E0B]">{topThree[0].score?.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* #3 BRONZE (Right) */}
              <div className="order-3 flex flex-col justify-between border border-[#D97706]/40 bg-[#0F1622]/90 p-4 clip-val-card shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="flex h-6 w-6 items-center justify-center font-display text-sm font-extrabold text-[#D97706] border border-[#D97706]/60 bg-[#D97706]/15">
                    #3
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#8B978F]">
                    {topThree[2].tier}
                  </span>
                </div>
                <div className="my-3 flex items-center gap-3">
                  <div className="h-12 w-12 border border-[#D97706]/40 bg-[#1A1612] flex items-center justify-center shrink-0">
                    <AgentEmblemMark agentId={topThree[2].favoriteAgentId || 'KORA'} accentColor="#D97706" className="h-8 w-8" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-extrabold uppercase tracking-wide text-[#ECE8E1] truncate">
                      {topThree[2].callsign}
                    </h3>
                    <div className="font-mono text-xs text-[#D97706] font-bold">
                      LVL {topThree[2].level} · {AGENT_REGISTRY[topThree[2].favoriteAgentId]?.name || 'Operative'}
                    </div>
                  </div>
                </div>
                <div className="border-t border-[#ECE8E1]/10 pt-2 flex justify-between font-mono text-xs">
                  <div>
                    <span className="text-[9px] text-[#8B978F] uppercase block">WINS</span>
                    <span className="font-bold text-[#17E5B8]">{topThree[2].wins}W</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#8B978F] uppercase block">KILLS</span>
                    <span className="font-bold text-[#ECE8E1]">{topThree[2].kills}K</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#8B978F] uppercase block">SCORE</span>
                    <span className="font-bold text-[#F59E0B]">{topThree[2].score?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TABLE OF OPERATIVES */}
          <div className="border border-[#ECE8E1]/15 bg-[#0A1017] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="border-b border-[#ECE8E1]/15 bg-[#070D14] text-[10px] uppercase tracking-[0.2em] text-[#8B978F]">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-14">RANK</th>
                    <th className="py-2.5 px-4">OPERATIVE</th>
                    <th className="py-2.5 px-3">TIER / LEVEL</th>
                    <th className="py-2.5 px-3 text-right">WINS (WR%)</th>
                    <th className="py-2.5 px-3 text-right">K / D</th>
                    <th className="py-2.5 px-4 text-right">SCORE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECE8E1]/8">
                  {remainingPlayers.map((player, idx) => {
                    const rankNum = searchQuery ? idx + 1 : idx + 4;
                    const isMe =
                      (currentUserId && player.uid === currentUserId) ||
                      player.callsign.toLowerCase() === profile.callsign.toLowerCase();
                    const winPct =
                      player.totalMatches > 0
                        ? Math.round((player.wins / player.totalMatches) * 100)
                        : 0;
                    const kd =
                      player.deaths > 0
                        ? (player.kills / player.deaths).toFixed(2)
                        : player.kills.toFixed(2);
                    const agent = AGENT_REGISTRY[player.favoriteAgentId] || AGENT_REGISTRY.KAEL;

                    return (
                      <tr
                        key={player.uid || idx}
                        className={`transition hover:bg-[#131E2A] ${
                          isMe ? 'bg-[#FF4655]/15 border-l-2 border-l-[#FF4655]' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center font-bold text-[#8B978F]">
                          #{rankNum}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="h-7 w-7 border flex items-center justify-center shrink-0 text-[10px] font-bold"
                              style={{
                                borderColor: agent.primaryColor,
                                backgroundColor: `${agent.primaryColor}18`,
                                color: agent.primaryColor,
                              }}
                            >
                              {player.callsign.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span
                                className={`font-display text-sm font-extrabold uppercase tracking-wide truncate block ${
                                  isMe ? 'text-[#FF4655]' : 'text-[#ECE8E1]'
                                }`}
                              >
                                {player.callsign}
                                {isMe && (
                                  <span className="ml-1.5 font-mono text-[9px] font-bold text-[#17E5B8] uppercase">
                                    [YOU]
                                  </span>
                                )}
                              </span>
                              <span className="font-mono text-[10px] text-[#8B978F]">
                                {agent.name} · {agent.role}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#ECE8E1]/90">
                          <div>LVL {player.level || 1}</div>
                          <div className="text-[10px] text-[#8B978F] font-normal">{player.tier}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="font-bold text-[#17E5B8]">{player.wins}W</span>
                          <span className="text-[#8B978F] text-[10px] ml-1">({winPct}%)</span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="font-bold text-[#ECE8E1]">{player.kills}K</span>
                          <span className="text-[#8B978F] text-[10px] ml-1">({kd})</span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-display text-sm font-extrabold text-[#F59E0B]">
                          {player.score?.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredPlayers.length === 0 && (
              <div className="py-8 text-center text-[#8B978F] font-mono text-xs">
                No operatives found matching "{searchQuery}".
              </div>
            )}
          </div>
        </div>

        {/* STICKY BOTTOM BAR: "YOUR STANDING" + GOOGLE AUTH CTA */}
        <footer className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-[#ECE8E1]/15 bg-[#080E15] px-4 sm:px-6 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#17E5B8]/60 bg-[#17E5B8]/15 font-display text-base font-black text-[#17E5B8]">
              #{userRankNumber}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-extrabold uppercase tracking-wider text-[#ECE8E1]">
                  YOUR STANDING: {profile.callsign}
                </span>
                <span className="font-mono text-[10px] font-bold text-[#17E5B8]">
                  LVL {rank.level} · {rank.tier}
                </span>
              </div>
              <div className="font-mono text-xs text-[#8B978F]">
                {profile.wins} Wins · {profile.kills} Kills · {profile.totalMatches} Matches ·{' '}
                <span className="text-[#F59E0B]">
                  {(profile.kills * 100 + profile.wins * 500).toLocaleString()} PTS
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2 font-mono text-xs text-[#17E5B8]">
                <CheckCircle2 className="h-4 w-4" />
                <span className="hidden sm:inline text-[#ECE8E1]/80">Connected:</span>
                <span className="font-bold truncate max-w-[150px]">{currentUser.displayName || currentUser.email}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={authLoading}
                className="flex items-center gap-2 border border-[#FF4655] bg-[#FF4655]/20 hover:bg-[#FF4655] px-4 py-2 font-display text-xs font-extrabold uppercase tracking-wider text-white transition cursor-pointer clip-val-card"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>{authLoading ? 'CONNECTING...' : 'SIGN IN WITH GOOGLE'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="border border-[#ECE8E1]/20 bg-[#141E28] px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-[#ECE8E1] hover:border-[#FF4655] transition cursor-pointer clip-val-card"
            >
              CLOSE
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
