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
  pickBotPurchase,
  extractGridWallAABBs,
  remapKeyBinding,
  formatKeyCode,
  clampCrosshairConfig,
  resolveCrosshairConfig,
  normalizeTouchLayout,
  updateTouchControlSlot,
  applyTouchLayoutPreset,
} from './rules';
import { DEFAULT_KEY_BINDINGS, WEAPON_REGISTRY } from './types';
import {
  BOMB_SITE_A,
  BOMB_SITE_B,
  SPAWN_ATTACKERS,
  SPAWN_DEFENDERS,
  isPointWalkable,
} from './mapData';

test('WEAPON_REGISTRY contains all 18 required weapons across all 7 categories', () => {
  const expectedNames = [
    'Kadence',
    'Thorn',
    'Fury',
    'Frenky',
    'Hangman',
    'Mantis',
    'Stingray',
    'Slug',
    'Jackal',
    'Reaper',
    'Eclipse',
    'Veil',
    'Tusk',
    'Bolt',
    'Oracle',
    'Storm',
    'Thor',
    'Hollow Blade',
  ];
  const all = Object.values(WEAPON_REGISTRY);
  assert.equal(all.length, 18);
  for (const name of expectedNames) {
    assert.ok(
      all.some((w) => w.name === name),
      `Missing expected weapon: ${name}`
    );
  }
  assert.equal(WEAPON_REGISTRY.HOLLOW_BLADE.isMelee, true);
  assert.equal(WEAPON_REGISTRY.SLUG.pellets, 8);
});

test('calculateDamage handles headshot, armor absorption, shotgun falloff, and melee immunity', () => {
  const eclipse = WEAPON_REGISTRY.ECLIPSE;

  // Headshot without armor: deals 156 damage, instant kill
  const res1 = calculateDamage(eclipse, 'head', 10, 100, 0);
  assert.equal(res1.isHeadshot, true);
  assert.equal(res1.rawDamage, 156);
  assert.equal(res1.remainingHp, 0);
  assert.equal(res1.isDead, true);

  // Body shot with 50 armor (reaper 40 body dmg -> 26 absorbed, 14 hp dmg)
  const reaper = WEAPON_REGISTRY.REAPER;
  const res2 = calculateDamage(reaper, 'body', 10, 100, 50);
  assert.equal(res2.isHeadshot, false);
  assert.equal(res2.rawDamage, 40);
  assert.equal(res2.armorDamage, 26);
  assert.equal(res2.remainingArmor, 24);
  assert.equal(res2.healthDamage, 14);
  assert.equal(res2.remainingHp, 86);
  assert.equal(res2.isDead, false);

  // Shotgun falls off sharply past 8m
  const slug = WEAPON_REGISTRY.SLUG;
  const sgClose = calculateDamage(slug, 'body', 4, 100, 0);
  const sgFar = calculateDamage(slug, 'body', 20, 100, 0);
  assert.ok(sgFar.rawDamage < sgClose.rawDamage, 'Shotgun must lose damage at range');

  // Melee does full body/head damage without falloff
  const blade = WEAPON_REGISTRY.HOLLOW_BLADE;
  const slash = calculateDamage(blade, 'head', 2, 100, 0);
  assert.equal(slash.rawDamage, 110);
  assert.equal(slash.isDead, true);
});

test('calculateEconomy awards win and loss streaks with cap', () => {
  const winResult = calculateEconomy(1000, true, 2, false, 2);
  assert.equal(winResult.creditsGained, 3000 + 400);
  assert.equal(winResult.newCredits, 4400);
  assert.equal(winResult.nextLossStreak, 0);

  const loss0 = calculateEconomy(800, false, 0, false, 0);
  assert.equal(loss0.creditsGained, 1900);
  assert.equal(loss0.nextLossStreak, 1);

  const loss2 = calculateEconomy(1000, false, 2, true, 1);
  assert.equal(loss2.creditsGained, 2900 + 300 + 200);
  assert.equal(loss2.newCredits, 4400);

  const maxCap = calculateEconomy(8500, true, 0, false, 5);
  assert.equal(maxCap.newCredits, 9000);
});

test('pickBotPurchase chooses affordable weapons from new 18-weapon arsenal', () => {
  const pistolBuy = pickBotPurchase(800, 1, 'HARD', 'ZEPHYR');
  if (pistolBuy) {
    assert.ok(WEAPON_REGISTRY[pistolBuy.weaponId], 'Pistol buy must exist in registry');
    assert.equal(pistolBuy.isSidearm, true);
    assert.ok(pistolBuy.cost <= 800);
  }

  const rifleBuy = pickBotPurchase(3400, 4, 'HARD', 'BLITZ');
  assert.ok(rifleBuy, 'Rich bot in round 4 must buy primary weapon');
  assert.ok(WEAPON_REGISTRY[rifleBuy!.weaponId]);
  assert.ok(rifleBuy!.cost <= 3400);
});

test('extractGridWallAABBs merges adjacent 2D occupancy cells cleanly into AABB solids', () => {
  const grid = [
    [true, true, false, false],
    [true, true, false, true],
    [false, false, false, true],
  ];
  const boxes = extractGridWallAABBs(grid, -10, -10, 2, 0, 4.5);
  assert.equal(boxes.length, 2, 'Two contiguous rectangular islands should merge into 2 AABBs');
  assert.deepEqual(boxes[0], {
    minX: -10,
    maxX: -6,
    minY: 0,
    maxY: 4.5,
    minZ: -10,
    maxZ: -6,
  });
  assert.deepEqual(boxes[1], {
    minX: -4,
    maxX: -2,
    minY: 0,
    maxY: 4.5,
    minZ: -8,
    maxZ: -4,
  });
});

test('checkRoundWin evaluates site plant, defusal, and eliminations', () => {
  const round1 = checkRoundWin(0, 3, 'not_planted', 40);
  assert.equal(round1.winner, 'DEFENDERS');
  assert.equal(round1.reason, 'ELIMINATION');
  assert.equal(round1.roundOver, true);

  const round2 = checkRoundWin(0, 3, 'planted', 0);
  assert.equal(round2.winner, null);
  assert.equal(round2.roundOver, false);

  const round3 = checkRoundWin(2, 1, 'defused', 0);
  assert.equal(round3.winner, 'DEFENDERS');
  assert.equal(round3.reason, 'SPIKE_DEFUSED');

  const round4 = checkRoundWin(0, 4, 'detonated', 0);
  assert.equal(round4.winner, 'ATTACKERS');
  assert.equal(round4.reason, 'SPIKE_DETONATED');

  const round5 = checkRoundWin(3, 3, 'not_planted', 0);
  assert.equal(round5.winner, 'DEFENDERS');
  assert.equal(round5.reason, 'TIME_EXPIRED');

  // Solo human waiting in human-only Custom room (0 defenders spawned) must not instant-end by elimination
  const soloCustom = checkRoundWin(1, 0, 'not_planted', 80, 1, 0);
  assert.equal(soloCustom.roundOver, false);
  assert.equal(soloCustom.winner, null);
});

test('new valorant_style_map_v2 spawns and bomb sites are symmetric and walkable', () => {
  assert.equal(BOMB_SITE_A.x, -24.7);
  assert.equal(BOMB_SITE_B.x, 24.7);
  assert.equal(BOMB_SITE_A.z, -16.3);
  assert.equal(BOMB_SITE_B.z, -16.3);
  assert.ok(SPAWN_ATTACKERS.z > 30, 'Attacker spawn should be in south plaza');
  assert.ok(SPAWN_DEFENDERS.z < 0, 'Defender spawn should be in north plaza near sites');
  assert.equal(isPointWalkable(SPAWN_ATTACKERS.x, SPAWN_ATTACKERS.z, 0.45), true);
  assert.equal(isPointWalkable(SPAWN_DEFENDERS.x, SPAWN_DEFENDERS.z, 0.45), true);
  assert.equal(isPointWalkable(BOMB_SITE_A.x, BOMB_SITE_A.z, 0.45), true);
  assert.equal(isPointWalkable(BOMB_SITE_B.x, BOMB_SITE_B.z, 0.45), true);
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
  const rifle = WEAPON_REGISTRY.REAPER;
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
  const away = computeGentleAimAssist({
    yawDiff: 0.12,
    pitchDiff: 0.08,
    userDeltaX: 0.01,
    userDeltaY: 0,
    swipeCooldownRemaining: 0,
    dt: 0.016,
  });
  assert.equal(away.yawStep, 0);

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

  const cooled = computeGentleAimAssist({
    yawDiff: 0.12,
    pitchDiff: 0.08,
    userDeltaX: 0,
    userDeltaY: 0,
    swipeCooldownRemaining: 0.1,
    dt: 0.016,
  });
  assert.equal(cooled.yawStep, 0);

  const gentle = computeGentleAimAssist({
    yawDiff: 0.1,
    pitchDiff: 0.03,
    userDeltaX: 0,
    userDeltaY: 0,
    swipeCooldownRemaining: 0,
    dt: 0.016,
  });
  assert.ok(gentle.yawStep > 0 && gentle.yawStep < 0.01);
  assert.equal(gentle.pitchStep, 0);
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

  assert.ok(standClose.targetAimYOffset < 1.25);
  assert.ok(crouchClose.targetAimYOffset < standClose.targetAimYOffset);
  assert.ok(standLong.spreadYaw > standClose.spreadYaw);
  assert.ok(standLong.spreadPitchUp <= 0.0065);
  assert.ok(standLong.maxBurstShots <= 3);
});

test('remapKeyBinding swaps conflicting actions cleanly and includes meleeWeapon Digit3', () => {
  assert.equal(DEFAULT_KEY_BINDINGS.meleeWeapon, 'Digit3');
  const custom = remapKeyBinding({ ...DEFAULT_KEY_BINDINGS }, 'crouch', 'KeyC');
  assert.equal(custom.crouch, 'KeyC');
  assert.equal(custom.abilityC, 'ControlLeft');

  assert.equal(formatKeyCode('KeyW'), 'W');
  assert.equal(formatKeyCode('ControlLeft'), 'L-CTRL');
  assert.equal(formatKeyCode('Space'), 'SPACE');
  assert.equal(formatKeyCode('Digit3'), '3');
});

test('clampCrosshairConfig & resolveCrosshairConfig sanitize custom styles and preserve legacy fallbacks', () => {
  const resolvedLegacy = resolveCrosshairConfig({ crosshairColor: 'amber', crosshairSize: 'large' });
  assert.equal(resolvedLegacy.color, '#fbbf24');
  assert.equal(resolvedLegacy.length, 12);
  assert.equal(resolvedLegacy.gap, 7);

  const clamped = clampCrosshairConfig({
    style: 'chevron',
    color: '#ff00aa',
    length: 99,
    thickness: 0,
    gap: -5,
    dotSize: 20,
    opacity: 0.1,
  });
  assert.equal(clamped.style, 'chevron');
  assert.equal(clamped.color, '#ff00aa');
  assert.equal(clamped.length, 22);
  assert.equal(clamped.thickness, 1);
  assert.equal(clamped.gap, 0);
  assert.equal(clamped.dotSize, 8);
  assert.equal(clamped.opacity, 0.25);
});

test('normalizeTouchLayout, updateTouchControlSlot, and applyTouchLayoutPreset clamp positions cleanly', () => {
  const lefty = applyTouchLayoutPreset('LEFT_HANDED');
  assert.ok(lefty.joystick.xPct > 50);
  assert.ok(lefty.fire.xPct < 50);

  const updated = updateTouchControlSlot(lefty, 'fire', { xPct: -10, yPct: 120, scale: 2.5, visible: true });
  assert.equal(updated.fire.xPct, 4);
  assert.equal(updated.fire.yPct, 94);
  assert.equal(updated.fire.scale, 1.5);

  const normalized = normalizeTouchLayout({ jump: { xPct: 50, yPct: 50 } });
  assert.equal(normalized.jump.xPct, 50);
  assert.equal(normalized.jump.yPct, 50);
  assert.equal(normalized.fire.scale, 1.0);
});
