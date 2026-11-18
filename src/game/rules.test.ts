import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDamage,
  calculateEconomy,
  checkRoundWin,
  checkMatchWin,
  shouldSwapSides,
  calculateSpread,
  selectNextSpectateTargetId,
  computeGentleAimAssist,
  computeBotAimSolution,
  remapKeyBinding,
  formatKeyCode,
} from './rules';
import { DEFAULT_KEY_BINDINGS, WEAPON_REGISTRY } from './types';

test('calculateDamage handles headshot multiplier and armor absorption correctly', () => {
  const phantom = WEAPON_REGISTRY.PHANTOM_V;
  
  // Headshot without armor: deals 156 damage, instant kill
  const res1 = calculateDamage(phantom, 'head', 10, 100, 0);
  assert.equal(res1.isHeadshot, true);
  assert.equal(res1.rawDamage, 156);
  assert.equal(res1.remainingHp, 0);
  assert.equal(res1.isDead, true);

  // Body shot with 50 armor
  const res2 = calculateDamage(phantom, 'body', 10, 100, 50);
  assert.equal(res2.isHeadshot, false);
  assert.equal(res2.rawDamage, 40);
  assert.equal(res2.armorDamage, 26); // 66% of 40 = 26.4 -> 26
  assert.equal(res2.remainingArmor, 24);
  assert.equal(res2.healthDamage, 14);
  assert.equal(res2.remainingHp, 86);
  assert.equal(res2.isDead, false);
});

test('calculateEconomy awards win and loss streaks with cap', () => {
  // Win awards 3000 credits
  const winResult = calculateEconomy(1000, true, 2, false, 2);
  assert.equal(winResult.creditsGained, 3000 + 400); // 3000 + 2*200
  assert.equal(winResult.newCredits, 4400);
  assert.equal(winResult.nextLossStreak, 0);

  // Loss with 0 streak: 1900 credits
  const loss0 = calculateEconomy(800, false, 0, false, 0);
  assert.equal(loss0.creditsGained, 1900);
  assert.equal(loss0.nextLossStreak, 1);

  // Loss with 2 streak: 1900 + 1000 = 2900 credits, plus plant bonus (300)
  const loss2 = calculateEconomy(1000, false, 2, true, 1);
  assert.equal(loss2.creditsGained, 2900 + 300 + 200); // 3400
  assert.equal(loss2.newCredits, 4400);

  // Credits cap at 9000
  const maxCap = calculateEconomy(8500, true, 0, false, 5);
  assert.equal(maxCap.newCredits, 9000);
});

test('checkRoundWin evaluates site plant, defusal, and eliminations', () => {
  // Attackers eliminated, spike not planted -> Defenders win
  const round1 = checkRoundWin(0, 3, 'not_planted', 40);
  assert.equal(round1.winner, 'DEFENDERS');
  assert.equal(round1.reason, 'ELIMINATION');
  assert.equal(round1.roundOver, true);

  // Attackers eliminated, but spike is PLANTED -> Round continues! Defenders must defuse
  const round2 = checkRoundWin(0, 3, 'planted', 0);
  assert.equal(round2.winner, null);
  assert.equal(round2.roundOver, false);

  // Spike defused -> Defenders win
  const round3 = checkRoundWin(2, 1, 'defused', 0);
  assert.equal(round3.winner, 'DEFENDERS');
  assert.equal(round3.reason, 'SPIKE_DEFUSED');

  // Spike detonated -> Attackers win
  const round4 = checkRoundWin(0, 4, 'detonated', 0);
  assert.equal(round4.winner, 'ATTACKERS');
  assert.equal(round4.reason, 'SPIKE_DETONATED');

  // Time expired without plant -> Defenders win
  const round5 = checkRoundWin(3, 3, 'not_planted', 0);
  assert.equal(round5.winner, 'DEFENDERS');
  assert.equal(round5.reason, 'TIME_EXPIRED');
});

test('checkMatchWin detects first to 13 rounds', () => {
  assert.equal(checkMatchWin(12, 10), null);
  assert.equal(checkMatchWin(13, 11), 'ATTACKERS');
  assert.equal(checkMatchWin(8, 13), 'DEFENDERS');
});

test('shouldSwapSides detects round 12 halftime', () => {
  assert.equal(shouldSwapSides(11), false);
  assert.equal(shouldSwapSides(12), true);
  assert.equal(shouldSwapSides(13), false);
});

test('calculateSpread penalizes running and jumping, rewards crouching and ADS', () => {
  const rifle = WEAPON_REGISTRY.PHANTOM_V;
  const stillSpread = calculateSpread(rifle, false, false, false, false);
  const runSpread = calculateSpread(rifle, true, false, false, false);
  const jumpSpread = calculateSpread(rifle, false, true, false, false);
  const crouchSpread = calculateSpread(rifle, false, false, true, false);
  const adsSpread = calculateSpread(rifle, false, false, false, true);

  assert.ok(runSpread > stillSpread, 'Running spread should exceed still spread');
  assert.ok(jumpSpread > runSpread, 'Jumping spread should exceed running spread');
  assert.ok(crouchSpread < stillSpread, 'Crouching spread should be tighter');
  assert.ok(adsSpread < stillSpread, 'ADS spread should be tighter');
});

test('selectNextSpectateTargetId cycles alive teammates and wraps cleanly', () => {
  const candidates = [
    { id: 'player_0', alive: false, team: 'ATTACKERS' as const, isHuman: true },
    { id: 'ally_1', alive: true, team: 'ATTACKERS' as const, isHuman: false },
    { id: 'ally_2', alive: false, team: 'ATTACKERS' as const, isHuman: false },
    { id: 'ally_3', alive: true, team: 'ATTACKERS' as const, isHuman: false },
    { id: 'opp_1', alive: true, team: 'DEFENDERS' as const, isHuman: false },
  ];

  assert.equal(selectNextSpectateTargetId(candidates, 'ATTACKERS', null, 1), 'ally_1');
  assert.equal(selectNextSpectateTargetId(candidates, 'ATTACKERS', 'ally_1', 1), 'ally_3');
  assert.equal(selectNextSpectateTargetId(candidates, 'ATTACKERS', 'ally_3', 1), 'ally_1');
  assert.equal(selectNextSpectateTargetId(candidates, 'ATTACKERS', 'ally_1', -1), 'ally_3');

  const noAllies = candidates.map((c) => (c.team === 'ATTACKERS' ? { ...c, alive: false } : c));
  assert.equal(selectNextSpectateTargetId(noAllies, 'ATTACKERS', 'ally_1', 1), null);
});

test('computeGentleAimAssist never fights opposing swipe or vertical headshot adjustments', () => {
  // Player swiping right (userDeltaX > 0 => userYawIntent < 0) away from target at +yawDiff
  const away = computeGentleAimAssist({
    yawDiff: 0.12,
    pitchDiff: 0.08,
    userDeltaX: 0.01,
    userDeltaY: 0,
    swipeCooldownRemaining: 0,
    dt: 0.016,
  });
  assert.equal(away.yawStep, 0, 'Should not resist player turning away from target');

  // Player fast-flicking
  const fast = computeGentleAimAssist({
    yawDiff: 0.12,
    pitchDiff: 0.08,
    userDeltaX: -0.04,
    userDeltaY: 0,
    swipeCooldownRemaining: 0,
    dt: 0.016,
  });
  assert.equal(fast.yawStep, 0);
  assert.equal(fast.pitchStep, 0);

  // Cooldown active after fast swipe
  const cooled = computeGentleAimAssist({
    yawDiff: 0.12,
    pitchDiff: 0.08,
    userDeltaX: 0,
    userDeltaY: 0,
    swipeCooldownRemaining: 0.1,
    dt: 0.016,
  });
  assert.equal(cooled.yawStep, 0);

  // Subtle nudge when stationary inside cone, zero vertical pull inside head/chest band
  const gentle = computeGentleAimAssist({
    yawDiff: 0.1,
    pitchDiff: 0.03,
    userDeltaX: 0,
    userDeltaY: 0,
    swipeCooldownRemaining: 0,
    dt: 0.016,
  });
  assert.ok(gentle.yawStep > 0 && gentle.yawStep < 0.01, 'Pull should be subtle and non-jerky');
  assert.equal(gentle.pitchStep, 0, 'Should leave vertical head/chest aim completely free');
});

test('computeBotAimSolution aims below head, lowers for crouch, and clamps long-range upward scatter', () => {
  const standClose = computeBotAimSolution({
    difficulty: 'MEDIUM',
    distance: 10,
    burstShotIndex: 0,
    targetSpeed: 0,
    isTargetCrouching: false,
  });
  const crouchClose = computeBotAimSolution({
    difficulty: 'MEDIUM',
    distance: 10,
    burstShotIndex: 0,
    targetSpeed: 0,
    isTargetCrouching: true,
  });
  const standLong = computeBotAimSolution({
    difficulty: 'HARD',
    distance: 36,
    burstShotIndex: 2,
    targetSpeed: 5.5,
    isTargetCrouching: false,
  });

  assert.ok(standClose.targetAimYOffset < 1.25, 'Standing aim should target mid-torso below head');
  assert.ok(crouchClose.targetAimYOffset < standClose.targetAimYOffset, 'Crouched aim must drop below crouched head height');
  assert.ok(standLong.spreadYaw > standClose.spreadYaw, 'Long-range moving targets must widen horizontal spread');
  assert.ok(standLong.spreadPitchUp <= 0.0055, 'Long-range upward pitch jitter must be tightly capped to avoid robotic laser headshots');
  assert.ok(standLong.maxBurstShots <= 3, 'Long-range engagement should fire controlled bursts');
});

test('remapKeyBinding swaps conflicting actions cleanly and formatKeyCode formats browser codes', () => {
  const custom = remapKeyBinding({ ...DEFAULT_KEY_BINDINGS }, 'crouch', 'KeyC');
  assert.equal(custom.crouch, 'KeyC');
  assert.equal(custom.abilityC, 'ControlLeft', 'Previous KeyC owner should swap cleanly with Crouch');

  assert.equal(formatKeyCode('KeyW'), 'W');
  assert.equal(formatKeyCode('ControlLeft'), 'L-CTRL');
  assert.equal(formatKeyCode('Space'), 'SPACE');
  assert.equal(formatKeyCode('Digit1'), '1');
});


