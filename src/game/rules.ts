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
} from './types';

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

  // Slight falloff beyond 35 meters (except sniper)
  if (weapon.category !== 'SNIPER' && distance > 35) {
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
      const unabsorbedDamage = rawDamage - (targetArmor / 0.66);
      healthDmg = Math.round(unabsorbedDamage + (rawDamage * 0.34));
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
 * Win: +3000
 * Loss: 1900 + min(streak, 3) * 500 (1900, 2400, 2900 max)
 * Plant bonus for attackers: +300
 * Kill reward: +200 per kill
 * Max bank: 9000
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
 * Evaluates whether the round has ended and which team won.
 */
export function checkRoundWin(
  aliveAttackers: number,
  aliveDefenders: number,
  spikeState: SpikeState,
  roundTimeRemaining: number
): RoundWinCheck {
  // 1. Spike detonated -> Attackers win unconditionally
  if (spikeState === 'detonated') {
    return { winner: 'ATTACKERS', reason: 'SPIKE_DETONATED', roundOver: true };
  }

  // 2. Spike defused -> Defenders win unconditionally
  if (spikeState === 'defused') {
    return { winner: 'DEFENDERS', reason: 'SPIKE_DEFUSED', roundOver: true };
  }

  // 3. Spike is currently planted -> timer pauses for round and 45s bomb ticking starts.
  // Even if all attackers die, defenders MUST defuse the spike before it blows!
  if (spikeState === 'planted') {
    if (aliveDefenders <= 0) {
      // All defenders eliminated while bomb is active -> Attackers win
      return { winner: 'ATTACKERS', reason: 'ELIMINATION', roundOver: true };
    }
    // Still defusable, round continues
    return { winner: null, reason: null, roundOver: false };
  }

  // 4. Spike is NOT planted
  if (aliveAttackers <= 0) {
    return { winner: 'DEFENDERS', reason: 'ELIMINATION', roundOver: true };
  }

  if (aliveDefenders <= 0) {
    return { winner: 'ATTACKERS', reason: 'ELIMINATION', roundOver: true };
  }

  if (roundTimeRemaining <= 0) {
    // Time expired without spike planted -> Defenders hold successfully
    return { winner: 'DEFENDERS', reason: 'TIME_EXPIRED', roundOver: true };
  }

  return { winner: null, reason: null, roundOver: false };
}

/**
 * Checks if a team has reached the match target (13 rounds).
 */
export function checkMatchWin(attackerRounds: number, defenderRounds: number): TeamSide | null {
  if (attackerRounds >= ROUNDS_TO_WIN) return 'ATTACKERS';
  if (defenderRounds >= ROUNDS_TO_WIN) return 'DEFENDERS';
  return null;
}

/**
 * Checks if sides should swap (Half time is after round 12).
 */
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

  return Math.max(0.0005, spread);
}

export interface SpectateCandidate {
  id: string;
  alive: boolean;
  team: TeamSide;
  isHuman: boolean;
}

/**
 * Selects the next or previous alive teammate to spectate.
 */
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

/**
 * Computes non-resistive mobile aim assist nudges.
 * Suppresses pull when player swipes away, fast-flicks, or already aims inside head/chest band.
 */
export function computeGentleAimAssist(params: AimAssistParams): {
  yawStep: number;
  pitchStep: number;
} {
  const { yawDiff, pitchDiff, userDeltaX, userDeltaY, swipeCooldownRemaining, dt } = params;

  if (swipeCooldownRemaining > 0 || Math.abs(userDeltaX) > 0.025) {
    return { yawStep: 0, pitchStep: 0 };
  }

  // Note: yaw -= userDeltaX, pitch -= userDeltaY
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
 * Computes human-like bot aim parameters:
 * - Aims naturally at center-mass/torso (adjusted down when target crouches/plants)
 * - Scales angular spread with distance, burst count, and moving target speed
 * - Caps upward vertical scatter beyond close range so bots never laser-headshot across the map
 */
export function computeBotAimSolution(params: BotAimParams): BotAimSolution {
  const { difficulty, distance, burstShotIndex, targetSpeed, isTargetCrouching } = params;

  // Standing torso center is ~1.12m (head is 1.54..1.90m); crouched torso is ~0.78m (head is 1.19..1.55m)
  const targetAimYOffset = isTargetCrouching ? 0.78 : 1.12;

  const baseSpread = difficulty === 'HARD' ? 0.026 : difficulty === 'MEDIUM' ? 0.048 : 0.082;
  const distSlope = difficulty === 'HARD' ? 0.0014 : difficulty === 'MEDIUM' ? 0.0022 : 0.0032;
  const distBeyondClose = Math.max(0, distance - 10);
  const burstBloom = Math.min(0.05, burstShotIndex * 0.011);
  const speedPenalty = targetSpeed > 1.5 ? 0.018 : 0;

  const spreadYaw = baseSpread + distBeyondClose * distSlope + burstBloom + speedPenalty;
  const spreadPitchDown = spreadYaw * 0.65;

  // Beyond 18m, cap upward vertical jitter tightly so shots hit body/legs or miss rather than headshotting at long range
  const maxUpFactor = distance > 18 ? 0.14 : 0.38;
  const spreadPitchUp = Math.min(distance > 18 ? 0.0055 : 0.016, spreadYaw * maxUpFactor);

  const maxBurstShots =
    distance > 22
      ? difficulty === 'HARD'
        ? 3
        : 2
      : difficulty === 'HARD'
        ? 5
        : difficulty === 'MEDIUM'
          ? 4
          : 3;

  const burstResetSeconds =
    difficulty === 'HARD' ? 0.28 : difficulty === 'MEDIUM' ? 0.42 : 0.62;

  return {
    targetAimYOffset,
    spreadYaw,
    spreadPitchDown,
    spreadPitchUp,
    maxBurstShots,
    burstResetSeconds,
  };
}

/**
 * Remaps a single action to `newCode` cleanly, swapping with any conflicting action so keys stay unique.
 */
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

/**
 * Formats a browser KeyboardEvent.code into a clean short HUD/Settings label.
 */
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
