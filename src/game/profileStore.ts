/**
 * Hollow Strike - Persistent Player Profile, Career Telemetry & Settings Store
 * Zero fake/demo data: all metrics start at zero and update strictly from real matches played.
 */

import {
  AGENT_REGISTRY,
  DEFAULT_KEY_BINDINGS,
  GameSettings,
  MatchRecord,
  PlayerProfile,
  WeaponCareerStats,
} from './types';
import { clampCrosshairConfig, normalizeTouchLayout, resolveCrosshairConfig } from './rules';

const PROFILE_STORAGE_KEY = 'hollow_strike_profile_v1';
const SETTINGS_STORAGE_KEY = 'hollow_strike_settings_v1';

const LEGACY_AGENT_MIGRATION: Record<string, string> = {
  BLITZ: 'KAEL',
  ZEPHYR: 'KORA',
  BASTION: 'AEGIS',
  LUMEN: 'SOREN',
};

export function createEmptyProfile(): PlayerProfile {
  return {
    callsign: 'Operative',
    favoriteAgentId: 'KAEL',
    totalMatches: 0,
    wins: 0,
    losses: 0,
    kills: 0,
    deaths: 0,
    headshots: 0,
    damageDealt: 0,
    roundsWon: 0,
    roundsLost: 0,
    agentStats: {},
    weaponStats: {},
    matchHistory: [],
  };
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return createEmptyProfile();
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const rawAgent = parsed.favoriteAgentId ?? 'KAEL';
    const migrated = LEGACY_AGENT_MIGRATION[rawAgent] ?? rawAgent;
    const favoriteAgentId = AGENT_REGISTRY[migrated] ? migrated : 'KAEL';
    return {
      ...createEmptyProfile(),
      ...parsed,
      favoriteAgentId,
      agentStats: parsed.agentStats ?? {},
      weaponStats: parsed.weaponStats ?? {},
      matchHistory: Array.isArray(parsed.matchHistory) ? parsed.matchHistory : [],
    };
  } catch {
    return createEmptyProfile();
  }
}

export function saveProfile(profile: PlayerProfile): void {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function resetProfileData(): PlayerProfile {
  const fresh = createEmptyProfile();
  saveProfile(fresh);
  return fresh;
}

export interface MatchSummaryPayload {
  mode: MatchRecord['mode'];
  difficulty: MatchRecord['difficulty'];
  agentId: string;
  won: boolean;
  playerTeam: MatchRecord['playerTeam'];
  attackerScore: number;
  defenderScore: number;
  kills: number;
  deaths: number;
  headshots: number;
  damageDealt: number;
  weaponBreakdown: Record<string, WeaponCareerStats>;
}

export function recordMatchToProfile(profile: PlayerProfile, summary: MatchSummaryPayload): PlayerProfile {
  const playerRoundsWon = summary.playerTeam === 'ATTACKERS' ? summary.attackerScore : summary.defenderScore;
  const playerRoundsLost = summary.playerTeam === 'ATTACKERS' ? summary.defenderScore : summary.attackerScore;

  const prevAgent = profile.agentStats[summary.agentId] ?? {
    matches: 0,
    wins: 0,
    kills: 0,
    deaths: 0,
  };

  const nextAgentStats = {
    ...profile.agentStats,
    [summary.agentId]: {
      matches: prevAgent.matches + 1,
      wins: prevAgent.wins + (summary.won ? 1 : 0),
      kills: prevAgent.kills + summary.kills,
      deaths: prevAgent.deaths + summary.deaths,
    },
  };

  const nextWeaponStats = { ...profile.weaponStats };
  for (const [weaponId, w] of Object.entries(summary.weaponBreakdown)) {
    const prevW = nextWeaponStats[weaponId] ?? {
      kills: 0,
      headshots: 0,
      shotsFired: 0,
      shotsHit: 0,
      damageDealt: 0,
    };
    nextWeaponStats[weaponId] = {
      kills: prevW.kills + w.kills,
      headshots: prevW.headshots + w.headshots,
      shotsFired: prevW.shotsFired + w.shotsFired,
      shotsHit: prevW.shotsHit + w.shotsHit,
      damageDealt: prevW.damageDealt + w.damageDealt,
    };
  }

  const record: MatchRecord = {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    mode: summary.mode,
    difficulty: summary.difficulty,
    agentId: summary.agentId,
    won: summary.won,
    playerTeam: summary.playerTeam,
    attackerScore: summary.attackerScore,
    defenderScore: summary.defenderScore,
    kills: summary.kills,
    deaths: summary.deaths,
    headshots: summary.headshots,
    damageDealt: Math.round(summary.damageDealt),
  };

  const nextProfile: PlayerProfile = {
    ...profile,
    totalMatches: profile.totalMatches + 1,
    wins: profile.wins + (summary.won ? 1 : 0),
    losses: profile.losses + (summary.won ? 0 : 1),
    kills: profile.kills + summary.kills,
    deaths: profile.deaths + summary.deaths,
    headshots: profile.headshots + summary.headshots,
    damageDealt: Math.round(profile.damageDealt + summary.damageDealt),
    roundsWon: profile.roundsWon + playerRoundsWon,
    roundsLost: profile.roundsLost + playerRoundsLost,
    agentStats: nextAgentStats,
    weaponStats: nextWeaponStats,
    matchHistory: [record, ...profile.matchHistory].slice(0, 20),
  };

  saveProfile(nextProfile);
  return nextProfile;
}

export function computeRankProgress(profile: PlayerProfile): {
  xp: number;
  level: number;
  tier: string;
  nextLevelXp: number;
  progressPct: number;
} {
  const xp = profile.kills * 100 + profile.wins * 500 + profile.totalMatches * 150;
  const level = Math.floor(xp / 1000) + 1;
  const nextLevelXp = level * 1000;
  const currentLevelXp = (level - 1) * 1000;
  const progressPct = Math.min(100, Math.round(((xp - currentLevelXp) / 1000) * 100));

  let tier = 'UNRANKED';
  if (profile.totalMatches > 0) {
    if (level >= 15) tier = 'APEX COMMANDER';
    else if (level >= 10) tier = 'PHANTOM';
    else if (level >= 6) tier = 'VANGUARD';
    else if (level >= 3) tier = 'TACTICIAN';
    else tier = 'RECRUIT';
  }

  return { xp, level, tier, nextLevelXp, progressPct };
}

export const DEFAULT_SETTINGS: GameSettings = {
  graphics: 'HIGH',
  fpsCap: 60,
  showFps: true,
  mouseSensitivity: 0.0022,
  touchSensitivity: 0.0035,
  adsSensitivityMultiplier: 0.7,
  invertY: false,
  fov: 90,
  crosshairColor: 'cyan',
  crosshairSize: 'medium',
  volume: 0.7,
  soundEnabled: true,
  autoFireMobile: false,
  aimAssistMobile: true,
  touchScale: 1.0,
  touchOpacity: 0.85,
  controlMode: 'AUTO',
  keyBindings: { ...DEFAULT_KEY_BINDINGS },
};

export function loadSettings(): GameSettings {
  return loadSavedSettings(DEFAULT_SETTINGS);
}

export function loadSavedSettings(defaults: GameSettings = DEFAULT_SETTINGS): GameSettings {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(SETTINGS_STORAGE_KEY) : null;
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    const merged: GameSettings = { ...defaults, ...parsed };
    if (!Number.isFinite(merged.mouseSensitivity) || merged.mouseSensitivity <= 0) {
      merged.mouseSensitivity = defaults.mouseSensitivity;
    }
    if (!Number.isFinite(merged.touchSensitivity) || merged.touchSensitivity <= 0) {
      merged.touchSensitivity = defaults.touchSensitivity;
    }
    if (!Number.isFinite(merged.adsSensitivityMultiplier) || merged.adsSensitivityMultiplier <= 0) {
      merged.adsSensitivityMultiplier = defaults.adsSensitivityMultiplier;
    }
    if (!Number.isFinite(merged.fov) || merged.fov < 60 || merged.fov > 130) {
      merged.fov = defaults.fov;
    }
    if (!Number.isFinite(merged.touchScale) || merged.touchScale < 0.5 || merged.touchScale > 2.0) {
      merged.touchScale = defaults.touchScale;
    }
    if (!Number.isFinite(merged.touchOpacity) || merged.touchOpacity < 0.2 || merged.touchOpacity > 1.0) {
      merged.touchOpacity = defaults.touchOpacity;
    }
    merged.keyBindings = {
      ...DEFAULT_KEY_BINDINGS,
      ...(defaults.keyBindings ?? {}),
      ...(parsed.keyBindings ?? {}),
    };
    merged.crosshairConfig = resolveCrosshairConfig({
      crosshairColor: merged.crosshairColor,
      crosshairSize: merged.crosshairSize,
      crosshairConfig: parsed.crosshairConfig ?? defaults.crosshairConfig,
    });
    merged.touchLayout = normalizeTouchLayout(parsed.touchLayout ?? defaults.touchLayout);
    return merged;
  } catch {
    return {
      ...defaults,
      crosshairConfig: clampCrosshairConfig(defaults.crosshairConfig),
      touchLayout: normalizeTouchLayout(defaults.touchLayout),
    };
  }
}

export function saveSettingsToStorage(settings: GameSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

const SELECTED_MAP_STORAGE_KEY = 'hollow_strike_selected_map_v1';

export function loadSavedMapId(): string {
  try {
    if (typeof window === 'undefined') return 'WAREHOUSE';
    const raw = window.localStorage.getItem(SELECTED_MAP_STORAGE_KEY);
    return raw && raw.trim().length > 0 ? raw.trim() : 'WAREHOUSE';
  } catch {
    return 'WAREHOUSE';
  }
}

export function saveSelectedMapId(mapId: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SELECTED_MAP_STORAGE_KEY, mapId);
  } catch {
    // Ignore storage quota
  }
}

