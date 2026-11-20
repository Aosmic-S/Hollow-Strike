/**
 * Hollow Strike - Core Rules & Mathematical Calculations
 * Pure deterministic functions decoupled from UI and WebGL rendering.
 */

import {
  WeaponDef,
  ROUNDS_TO_WIN,
  HALF_TIME_ROUND,
  TeamSide,
  CrosshairColor,
  CrosshairSize,
  CrosshairConfig,
  DEFAULT_CROSSHAIR_CONFIG,
  TouchControlId,
  TouchControlLayout,
  TouchControlSlot,
  DEFAULT_TOUCH_LAYOUT,
  TOUCH_LAYOUT_PRESETS,
  TouchLayoutPresetId,
  BotDifficulty,
  WEAPON_REGISTRY,
} from './types';

export interface GridWallBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface DamageResult {
  rawDamage: number;
  armorDamage: number;
  healthDamage: number;
  remainingArmor: number;
  remainingHp: number;
  isDead: boolean;
  isHeadshot: boolean;
}

export type SpikeState = 'not_planted' | 'planted' | 'defused' | 'detonated';

export interface RoundWinCheck {
  winner: TeamSide | null;
  reason: 'ELIMINATION' | 'SPIKE_DEFUSED' | 'SPIKE_DETONATED' | 'TIME_EXPIRED' | null;
  roundOver: boolean;
}

/**
 * Calculates damage dealt by a weapon to a target.
 * Armor absorbs 66% of incoming damage until broken; remaining damage flows to health.
 * Shotguns/short-range weapons apply steeper range falloff; Snipers & Melee do not.
 */
export function calculateDamage(
  weapon: WeaponDef,
  hitZone: 'head' | 'body' | 'leg',
  distance: number,
  targetHp: number,
  targetArmor: number
): DamageResult {
  let baseDmg = weapon.damageBody;
  const isHeadshot = hitZone === 'head';

  if (isHeadshot) {
    baseDmg = weapon.damageHead;
  } else if (hitZone === 'leg') {
    baseDmg = weapon.damageLeg;
  }

  if (weapon.isMelee) {
    // Melee ignores range falloff within strike reach
    baseDmg = Math.round(baseDmg);
  } else if (weapon.category === 'SHOTGUN' || (weapon.range && weapon.range <= 24)) {
    const effRange = weapon.range ?? 20;
    if (distance > 8) {
      const falloff = Math.max(0.2, 1 - (distance - 8) / Math.max(4, effRange - 4));
      baseDmg = Math.max(2, Math.round(baseDmg * falloff));
    }
  } else if (weapon.category !== 'SNIPER' && distance > 35) {
    const falloffFactor = Math.max(0.75, 1 - (distance - 35) * 0.008);
    baseDmg = Math.round(baseDmg * falloffFactor);
  }

  const rawDamage = baseDmg;
  let armorDmg = 0;
  let healthDmg = 0;

  if (targetArmor > 0) {
    const absorbPortion = rawDamage * 0.66;
    if (targetArmor >= absorbPortion) {
      armorDmg = Math.round(absorbPortion);
      healthDmg = Math.round(rawDamage - absorbPortion);
    } else {
      armorDmg = targetArmor;
      const unabsorbedDamage = rawDamage - targetArmor / 0.66;
      healthDmg = Math.round(unabsorbedDamage + rawDamage * 0.34);
    }
  } else {
    healthDmg = rawDamage;
  }

  const remainingArmor = Math.max(0, targetArmor - armorDmg);
  const remainingHp = Math.max(0, targetHp - healthDmg);
  const isDead = remainingHp <= 0;

  return {
    rawDamage,
    armorDamage: armorDmg,
    healthDamage: healthDmg,
    remainingArmor,
    remainingHp,
    isDead,
    isHeadshot,
  };
}

/**
 * Tactical Economy calculation per round.
 */
export function calculateEconomy(
  currentCredits: number,
  teamWon: boolean,
  lossStreak: number,
  isPlantBonus: boolean,
  roundKills: number
): { creditsGained: number; newCredits: number; nextLossStreak: number } {
  let base = 0;
  let nextLossStreak = 0;

  if (teamWon) {
    base = 3000;
    nextLossStreak = 0;
  } else {
    nextLossStreak = lossStreak + 1;
    const streakBonus = Math.min(lossStreak, 2) * 500;
    base = 1900 + streakBonus;
  }

  const plantBonus = isPlantBonus ? 300 : 0;
  const killBonus = roundKills * 200;
  const totalGained = base + plantBonus + killBonus;
  const newCredits = Math.min(9000, currentCredits + totalGained);

  return {
    creditsGained: totalGained,
    newCredits,
    nextLossStreak,
  };
}

/**
 * Picks optimal weapon upgrade for a bot based on remaining credits, round, and difficulty.
 */
export function pickBotPurchase(
  credits: number,
  roundNumber: number,
  difficulty: BotDifficulty,
  agentId: string
): { weaponId: string; cost: number; isSidearm: boolean } | null {
  if (roundNumber === 1) {
    if (credits >= 800 && difficulty === 'HARD' && Math.random() < 0.35) {
      return { weaponId: 'HANGMAN', cost: WEAPON_REGISTRY.HANGMAN.cost, isSidearm: true };
    }
    if (credits >= 450 && Math.random() < 0.55) {
      return { weaponId: 'FURY', cost: WEAPON_REGISTRY.FURY.cost, isSidearm: true };
    }
    if (credits >= 400 && Math.random() < 0.5) {
      return { weaponId: 'THORN', cost: WEAPON_REGISTRY.THORN.cost, isSidearm: true };
    }
    return null;
  }

  if (credits >= 4700 && (agentId === 'LUMEN' || difficulty === 'HARD') && Math.random() < 0.22) {
    return { weaponId: 'ORACLE', cost: WEAPON_REGISTRY.ORACLE.cost, isSidearm: false };
  }
  if (credits >= 3200 && agentId === 'BASTION' && Math.random() < 0.25) {
    return { weaponId: 'THOR', cost: WEAPON_REGISTRY.THOR.cost, isSidearm: false };
  }
  if (credits >= 2900) {
    const pick = Math.random() < 0.5 ? 'REAPER' : 'ECLIPSE';
    return { weaponId: pick, cost: WEAPON_REGISTRY[pick].cost, isSidearm: false };
  }
  if (credits >= 2250) {
    return { weaponId: 'TUSK', cost: WEAPON_REGISTRY.TUSK.cost, isSidearm: false };
  }
  if (credits >= 2050) {
    return { weaponId: 'VEIL', cost: WEAPON_REGISTRY.VEIL.cost, isSidearm: false };
  }
  if (credits >= 1850 && agentId === 'BLITZ' && Math.random() < 0.45) {
    return { weaponId: 'JACKAL', cost: WEAPON_REGISTRY.JACKAL.cost, isSidearm: false };
  }
  if (credits >= 1600) {
    const pick = Math.random() < 0.65 ? 'MANTIS' : 'STORM';
    return { weaponId: pick, cost: WEAPON_REGISTRY[pick].cost, isSidearm: false };
  }
  if (credits >= 1500 && Math.random() < 0.35) {
    return { weaponId: 'BOLT', cost: WEAPON_REGISTRY.BOLT.cost, isSidearm: false };
  }
  if (credits >= 1100) {
    return { weaponId: 'STINGRAY', cost: WEAPON_REGISTRY.STINGRAY.cost, isSidearm: false };
  }
  if (credits >= 850) {
    return { weaponId: 'SLUG', cost: WEAPON_REGISTRY.SLUG.cost, isSidearm: false };
  }
  if (credits >= 800) {
    return { weaponId: 'HANGMAN', cost: WEAPON_REGISTRY.HANGMAN.cost, isSidearm: true };
  }
  return null;
}

/**
 * Evaluates whether the round has ended and which team won.
 */
export function checkRoundWin(
  aliveAttackers: number,
  aliveDefenders: number,
  spikeState: SpikeState,
  roundTimeRemaining: number,
  totalAttackers = 5,
  totalDefenders = 5
): RoundWinCheck {
  if (spikeState === 'detonated') {
    return { winner: 'ATTACKERS', reason: 'SPIKE_DETONATED', roundOver: true };
  }
  if (spikeState === 'defused') {
    return { winner: 'DEFENDERS', reason: 'SPIKE_DEFUSED', roundOver: true };
  }

  const hasBothTeams = totalAttackers > 0 && totalDefenders > 0;

  if (spikeState === 'planted') {
    if (hasBothTeams && aliveDefenders <= 0) {
      return { winner: 'ATTACKERS', reason: 'ELIMINATION', roundOver: true };
    }
    return { winner: null, reason: null, roundOver: false };
  }

  if (hasBothTeams) {
    if (aliveAttackers <= 0) {
      return { winner: 'DEFENDERS', reason: 'ELIMINATION', roundOver: true };
    }
    if (aliveDefenders <= 0) {
      return { winner: 'ATTACKERS', reason: 'ELIMINATION', roundOver: true };
    }
  }
  if (roundTimeRemaining <= 0) {
    return { winner: 'DEFENDERS', reason: 'TIME_EXPIRED', roundOver: true };
  }

  return { winner: null, reason: null, roundOver: false };
}

export function checkMatchWin(attackerRounds: number, defenderRounds: number): TeamSide | null {
  if (attackerRounds >= ROUNDS_TO_WIN) return 'ATTACKERS';
  if (defenderRounds >= ROUNDS_TO_WIN) return 'DEFENDERS';
  return null;
}

export function shouldSwapSides(completedRounds: number): boolean {
  return completedRounds === HALF_TIME_ROUND;
}

/**
 * Computes bullet cone spread based on weapon profile and movement state.
 */
export function calculateSpread(
  weapon: WeaponDef,
  isMoving: boolean,
  isJumping: boolean,
  isCrouching: boolean,
  isADS: boolean
): number {
  if (weapon.isMelee) return 0;

  let spread = weapon.spreadBase;

  if (isJumping) {
    spread += weapon.spreadRun * 2.5;
  } else if (isMoving) {
    spread += weapon.spreadRun;
  }

  if (isCrouching) {
    spread *= 0.6;
  }

  if (isADS && weapon.canADS) {
    spread *= 0.65;
  }

  return Math.max(0.0004, spread);
}

/**
 * Merges a 2D boolean occupancy grid into minimal axis-aligned wall AABBs.
 * Used for real-time 3D-mesh-to-collision extraction and 2D Radar synchronization.
 */
export function extractGridWallAABBs(
  occupied: boolean[][], // indexed [zIdx][xIdx]
  originX: number,
  originZ: number,
  cellSize: number,
  minY = 0,
  maxY = 4.5
): GridWallBox[] {
  const rows = occupied.length;
  const cols = rows > 0 ? occupied[0].length : 0;
  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const boxes: GridWallBox[] = [];

  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      if (!occupied[z][x] || visited[z][x]) continue;

      // Expand maximally along +X
      let maxW = 1;
      while (x + maxW < cols && occupied[z][x + maxW] && !visited[z][x + maxW]) {
        maxW++;
      }

      // Expand downward along +Z while full row of width `maxW` is solid & unvisited
      let maxH = 1;
      outer: while (z + maxH < rows) {
        for (let dx = 0; dx < maxW; dx++) {
          if (!occupied[z + maxH][x + dx] || visited[z + maxH][x + dx]) {
            break outer;
          }
        }
        maxH++;
      }

      for (let dz = 0; dz < maxH; dz++) {
        for (let dx = 0; dx < maxW; dx++) {
          visited[z + dz][x + dx] = true;
        }
      }

      boxes.push({
        minX: originX + x * cellSize,
        maxX: originX + (x + maxW) * cellSize,
        minY,
        maxY,
        minZ: originZ + z * cellSize,
        maxZ: originZ + (z + maxH) * cellSize,
      });
    }
  }

  return boxes;
}

export interface SpectateCandidate {
  id: string;
  alive: boolean;
  team: TeamSide;
  isHuman: boolean;
}

export function selectNextSpectateTargetId(
  candidates: SpectateCandidate[],
  playerTeam: TeamSide,
  currentTargetId: string | null,
  direction: 1 | -1 = 1
): string | null {
  const aliveTeammates = candidates.filter(
    (c) => c.alive && c.team === playerTeam && !c.isHuman
  );
  if (aliveTeammates.length === 0) return null;

  const currentIdx = currentTargetId
    ? aliveTeammates.findIndex((c) => c.id === currentTargetId)
    : -1;

  if (currentIdx === -1) {
    return direction >= 0
      ? aliveTeammates[0].id
      : aliveTeammates[aliveTeammates.length - 1].id;
  }

  const nextIdx =
    (currentIdx + direction + aliveTeammates.length) % aliveTeammates.length;
  return aliveTeammates[nextIdx].id;
}

export interface AimAssistParams {
  yawDiff: number;
  pitchDiff: number;
  userDeltaX: number;
  userDeltaY: number;
  swipeCooldownRemaining: number;
  dt: number;
}

export function computeGentleAimAssist(params: AimAssistParams): {
  yawStep: number;
  pitchStep: number;
} {
  const { yawDiff, pitchDiff, userDeltaX, userDeltaY, swipeCooldownRemaining, dt } = params;

  if (swipeCooldownRemaining > 0 || Math.abs(userDeltaX) > 0.025) {
    return { yawStep: 0, pitchStep: 0 };
  }

  const userYawIntent = -userDeltaX;
  const userPitchIntent = -userDeltaY;

  let yawStep = 0;
  const opposingYaw =
    Math.abs(userYawIntent) > 0.0012 && userYawIntent * yawDiff < 0;
  if (!opposingYaw) {
    const rawYaw = yawDiff * Math.min(1, dt * 1.65);
    yawStep = Math.max(-0.018, Math.min(0.018, rawYaw));
  }

  let pitchStep = 0;
  const opposingPitch =
    Math.abs(userPitchIntent) > 0.001 && userPitchIntent * pitchDiff < 0;
  const insideHeadChestBand = Math.abs(pitchDiff) < 0.055;
  if (!opposingPitch && !insideHeadChestBand) {
    const rawPitch = pitchDiff * Math.min(1, dt * 1.25);
    pitchStep = Math.max(-0.012, Math.min(0.012, rawPitch));
  }

  return { yawStep, pitchStep };
}

export interface BotAimParams {
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  distance: number;
  burstShotIndex: number;
  targetSpeed: number;
  isTargetCrouching: boolean;
}

export interface BotAimSolution {
  targetAimYOffset: number;
  spreadYaw: number;
  spreadPitchDown: number;
  spreadPitchUp: number;
  maxBurstShots: number;
  burstResetSeconds: number;
}

/**
 * Sharper, smarter tactical Bot Aim model:
 * HARD bots hold tighter crisp precision and head/upper-chest focus up to 24m;
 * long-range bots discipline controlled bursts without unfair laser beams across 45m.
 */
export function computeBotAimSolution(params: BotAimParams): BotAimSolution {
  const { difficulty, distance, burstShotIndex, targetSpeed, isTargetCrouching } = params;

  // Standing chest/collar is ~1.22m (HARD creeps higher at mid-close for sharp head-clip threat); crouched ~0.82m
  const headBias = difficulty === 'HARD' && distance < 22 ? 0.14 : 0;
  const targetAimYOffset = (isTargetCrouching ? 0.80 : 1.18) + headBias;

  const baseSpread = difficulty === 'HARD' ? 0.014 : difficulty === 'MEDIUM' ? 0.032 : 0.068;
  const distSlope = difficulty === 'HARD' ? 0.00095 : difficulty === 'MEDIUM' ? 0.0017 : 0.0028;
  const distBeyondClose = Math.max(0, distance - 10);
  const burstBloom = Math.min(0.042, burstShotIndex * (difficulty === 'HARD' ? 0.008 : 0.011));
  const speedPenalty = targetSpeed > 1.5 ? (difficulty === 'HARD' ? 0.009 : 0.015) : 0;

  const spreadYaw = baseSpread + distBeyondClose * distSlope + burstBloom + speedPenalty;
  const spreadPitchDown = spreadYaw * 0.55;

  const maxUpFactor = distance > 24 ? 0.18 : 0.42;
  const spreadPitchUp = Math.min(distance > 24 ? 0.006 : 0.016, spreadYaw * maxUpFactor);

  const maxBurstShots =
    distance > 24
      ? difficulty === 'HARD'
        ? 3
        : 2
      : difficulty === 'HARD'
        ? 6
        : difficulty === 'MEDIUM'
          ? 4
          : 3;

  const burstResetSeconds =
    difficulty === 'HARD' ? 0.20 : difficulty === 'MEDIUM' ? 0.34 : 0.56;

  return {
    targetAimYOffset,
    spreadYaw,
    spreadPitchDown,
    spreadPitchUp,
    maxBurstShots,
    burstResetSeconds,
  };
}

export function remapKeyBinding<T extends { [K in keyof T]: string }>(
  bindings: T,
  action: keyof T,
  newCode: string
): T {
  const next = { ...bindings };
  const prevCode = next[action];
  for (const key of Object.keys(next) as (keyof T)[]) {
    if (key !== action && next[key] === newCode) {
      next[key] = prevCode;
    }
  }
  next[action] = newCode as T[keyof T];
  return next;
}

export function formatKeyCode(code: string): string {
  if (!code) return '?';
  if (code.startsWith('Key')) return code.slice(3).toUpperCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'SPACE';
  if (code === 'ControlLeft') return 'L-CTRL';
  if (code === 'ControlRight') return 'R-CTRL';
  if (code === 'ShiftLeft') return 'L-SHIFT';
  if (code === 'ShiftRight') return 'R-SHIFT';
  if (code === 'AltLeft') return 'L-ALT';
  if (code === 'AltRight') return 'R-ALT';
  if (code === 'Tab') return 'TAB';
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  if (code === 'ArrowLeft') return '←';
  if (code === 'ArrowRight') return '→';
  return code.toUpperCase();
}

const LEGACY_CROSSHAIR_HEX: Record<CrosshairColor, string> = {
  cyan: '#22d3ee',
  green: '#34d399',
  amber: '#fbbf24',
  white: '#f8fafc',
  rose: '#fb7185',
};

const VALID_CROSSHAIR_STYLES = new Set(['classic', 'cross', 'dot', 'circle', 'chevron', 't-shape']);

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, val));
}

export function clampCrosshairConfig(partial?: Partial<CrosshairConfig>): CrosshairConfig {
  const src = partial ?? {};
  const style =
    typeof src.style === 'string' && VALID_CROSSHAIR_STYLES.has(src.style)
      ? src.style
      : DEFAULT_CROSSHAIR_CONFIG.style;
  const color =
    typeof src.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(src.color.trim())
      ? src.color.trim()
      : DEFAULT_CROSSHAIR_CONFIG.color;

  return {
    style,
    color,
    length: Math.round(clampNum(src.length, 2, 22, DEFAULT_CROSSHAIR_CONFIG.length)),
    thickness: Math.round(clampNum(src.thickness, 1, 6, DEFAULT_CROSSHAIR_CONFIG.thickness)),
    gap: Math.round(clampNum(src.gap, 0, 16, DEFAULT_CROSSHAIR_CONFIG.gap)),
    showDot: typeof src.showDot === 'boolean' ? src.showDot : DEFAULT_CROSSHAIR_CONFIG.showDot,
    dotSize: Math.round(clampNum(src.dotSize, 2, 8, DEFAULT_CROSSHAIR_CONFIG.dotSize)),
    opacity: Number(clampNum(src.opacity, 0.25, 1.0, DEFAULT_CROSSHAIR_CONFIG.opacity).toFixed(2)),
    outline: typeof src.outline === 'boolean' ? src.outline : DEFAULT_CROSSHAIR_CONFIG.outline,
    dynamic: typeof src.dynamic === 'boolean' ? src.dynamic : DEFAULT_CROSSHAIR_CONFIG.dynamic,
  };
}

export function resolveCrosshairConfig(settings: {
  crosshairColor?: CrosshairColor;
  crosshairSize?: CrosshairSize;
  crosshairConfig?: Partial<CrosshairConfig>;
}): CrosshairConfig {
  if (settings.crosshairConfig) {
    return clampCrosshairConfig(settings.crosshairConfig);
  }
  const colorHex = LEGACY_CROSSHAIR_HEX[settings.crosshairColor ?? 'cyan'] ?? DEFAULT_CROSSHAIR_CONFIG.color;
  const length = settings.crosshairSize === 'small' ? 6 : settings.crosshairSize === 'large' ? 12 : 8;
  const gap = settings.crosshairSize === 'small' ? 4 : settings.crosshairSize === 'large' ? 7 : 5;
  return clampCrosshairConfig({
    ...DEFAULT_CROSSHAIR_CONFIG,
    color: colorHex,
    length,
    gap,
  });
}

const TOUCH_CONTROL_IDS: TouchControlId[] = [
  'joystick',
  'fire',
  'ads',
  'crouch',
  'jump',
  'reload',
  'weaponSwap',
  'plantDefuse',
  'abilityE',
  'abilityQ',
  'abilityC',
  'abilityX',
];

function clampTouchSlot(raw: Partial<TouchControlSlot> | undefined, fallback: TouchControlSlot): TouchControlSlot {
  return {
    xPct: Number(clampNum(raw?.xPct, 4, 96, fallback.xPct).toFixed(1)),
    yPct: Number(clampNum(raw?.yPct, 12, 94, fallback.yPct).toFixed(1)),
    scale: Number(clampNum(raw?.scale, 0.65, 1.5, fallback.scale).toFixed(2)),
    visible: typeof raw?.visible === 'boolean' ? raw.visible : fallback.visible,
  };
}

export function normalizeTouchLayout(
  partial?: Partial<Record<TouchControlId, Partial<TouchControlSlot>>>
): TouchControlLayout {
  const result = {} as TouchControlLayout;
  for (const id of TOUCH_CONTROL_IDS) {
    result[id] = clampTouchSlot(partial?.[id], DEFAULT_TOUCH_LAYOUT[id]);
  }
  return result;
}

export function updateTouchControlSlot(
  layout: TouchControlLayout,
  id: TouchControlId,
  patch: Partial<TouchControlSlot>
): TouchControlLayout {
  const current = layout[id] ?? DEFAULT_TOUCH_LAYOUT[id];
  return {
    ...layout,
    [id]: clampTouchSlot({ ...current, ...patch }, DEFAULT_TOUCH_LAYOUT[id]),
  };
}

export function applyTouchLayoutPreset(presetId: TouchLayoutPresetId): TouchControlLayout {
  const preset = TOUCH_LAYOUT_PRESETS[presetId] ?? TOUCH_LAYOUT_PRESETS.DEFAULT;
  return normalizeTouchLayout(preset.layout);
}
