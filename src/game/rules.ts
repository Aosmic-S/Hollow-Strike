/**
 * Hollow Strike - Core Rules & Mathematical Calculations
 * Pure deterministic functions decoupled from UI and WebGL rendering.
 */

import { WeaponDef, ROUNDS_TO_WIN, HALF_TIME_ROUND, TeamSide } from './types';

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
