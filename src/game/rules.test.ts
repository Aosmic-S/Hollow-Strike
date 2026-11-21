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
  raycastAABBs,
  worldToRadarCoord,
  sanitizeChatText,
} from './rules';
import { AGENT_REGISTRY, DEFAULT_KEY_BINDINGS, WEAPON_REGISTRY, getAvailableMaps } from './types';
import {
  BOMB_SITE_A,
  BOMB_SITE_B,
  NAV_GRAPH,
  SPAWN_ATTACKERS,
  SPAWN_DEFENDERS,
  findNavPath,
  isPointWalkable,
  setActiveMap,
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

test('AGENT_REGISTRY includes all 7 launch operatives across all 4 tactical roles', () => {
  const expected: Array<[string, string, string]> = [
    ['KAEL', 'Kael', 'DUELIST'],
    ['ZED', 'Zed', 'DUELIST'],
    ['KORA', 'Kora', 'CONTROLLER'],
    ['SOREN', 'Soren', 'INITIATOR'],
    ['PULSE', 'Pulse', 'INITIATOR'],
    ['AEGIS', 'Aegis', 'SENTINEL'],
    ['ROOK', 'Rook', 'SENTINEL'],
  ];
  assert.equal(Object.keys(AGENT_REGISTRY).length, 7);
  for (const [id, name, role] of expected) {
    const ag = AGENT_REGISTRY[id];
    assert.ok(ag, `Missing agent ${id}`);
    assert.equal(ag.name, name);
    assert.equal(ag.role, role);
    assert.equal(ag.abilities.length, 4);
  }
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
  const pistolBuy = pickBotPurchase(800, 1, 'HARD', 'KAEL');
  if (pistolBuy) {
    assert.ok(WEAPON_REGISTRY[pistolBuy.weaponId], 'Pistol buy must exist in registry');
    assert.equal(pistolBuy.isSidearm, true);
    assert.ok(pistolBuy.cost <= 800);
  }

  const rifleBuy = pickBotPurchase(3400, 4, 'HARD', 'AEGIS');
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

test('Warehouse map spawns, bomb sites, and navigation graph are walkable and connected', () => {
  assert.ok(SPAWN_ATTACKERS.z < 0, 'Attacker spawn should be in north bay');
  assert.ok(SPAWN_DEFENDERS.z > 0, 'Defender spawn should be in south central bay');
  assert.equal(isPointWalkable(SPAWN_ATTACKERS.x, SPAWN_ATTACKERS.z, 0.45), true);
  assert.equal(isPointWalkable(SPAWN_DEFENDERS.x, SPAWN_DEFENDERS.z, 0.45), true);
  assert.equal(isPointWalkable(BOMB_SITE_A.x, BOMB_SITE_A.z, 0.45), true);
  assert.equal(isPointWalkable(BOMB_SITE_B.x, BOMB_SITE_B.z, 0.45), true);

  for (const node of Object.values(NAV_GRAPH)) {
    assert.equal(isPointWalkable(node.x, node.z, 0.35), true, `NAV_GRAPH node ${node.id} must be walkable`);
  }

  const attToA = findNavPath('att_spawn', 'site_a_plant');
  const attToB = findNavPath('att_spawn', 'site_b_plant');
  const defToA = findNavPath('def_spawn', 'site_a_plant');
  const defToB = findNavPath('def_spawn', 'site_b_plant');
  assert.equal(attToA[attToA.length - 1]?.id, 'site_a_plant');
  assert.equal(attToB[attToB.length - 1]?.id, 'site_b_plant');
  assert.equal(defToA[defToA.length - 1]?.id, 'site_a_plant');
  assert.equal(defToB[defToB.length - 1]?.id, 'site_b_plant');
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

test('getAvailableMaps lists built-in maps, deduplicates Warehouse.glb, and exposes custom GLBs', () => {
  const maps = getAvailableMaps(['Warehouse.glb', 'Neon_Docks.glb', 'sector-7.gltf']);
  const ids = maps.map((m) => m.id);
  assert.ok(ids.includes('WAREHOUSE'));
  assert.ok(ids.includes('COURTYARD'));
  assert.ok(ids.includes('PROVING_GRID'));
  assert.equal(ids.filter((id) => id === 'WAREHOUSE').length, 1);
  assert.equal(
    maps.filter((m) => m.modelUrl === '/models/Map/Warehouse.glb').length,
    1,
    'Warehouse.glb should not duplicate the built-in WAREHOUSE entry'
  );
  const customNeon = maps.find((m) => m.modelUrl === '/models/Map/Neon_Docks.glb');
  assert.ok(customNeon, 'Custom Neon_Docks.glb should be discovered');
  assert.equal(customNeon!.name, 'NEON DOCKS');
  assert.ok(ids.includes('CUSTOM_SECTOR_7_GLTF'));
});

test('setActiveMap hot-swaps spawns, bomb sites, colliders, and connected nav graphs for all built-in maps', () => {
  try {
    for (const mapId of ['COURTYARD', 'PROVING_GRID', 'WAREHOUSE']) {
      const def = setActiveMap(mapId);
      assert.equal(def.id, mapId);
      assert.equal(isPointWalkable(SPAWN_ATTACKERS.x, SPAWN_ATTACKERS.z, 0.45), true, `${mapId} att spawn walkable`);
      assert.equal(isPointWalkable(SPAWN_DEFENDERS.x, SPAWN_DEFENDERS.z, 0.45), true, `${mapId} def spawn walkable`);
      assert.equal(isPointWalkable(BOMB_SITE_A.x, BOMB_SITE_A.z, 0.45), true, `${mapId} site A walkable`);
      assert.equal(isPointWalkable(BOMB_SITE_B.x, BOMB_SITE_B.z, 0.45), true, `${mapId} site B walkable`);

      for (const node of Object.values(NAV_GRAPH)) {
        assert.equal(
          isPointWalkable(node.x, node.z, 0.35),
          true,
          `${mapId} nav node ${node.id} must not overlap any collider`
        );
      }

      const attToA = findNavPath('att_spawn', 'site_a_plant');
      const attToB = findNavPath('att_spawn', 'site_b_plant');
      const defToA = findNavPath('def_spawn', 'site_a_plant');
      const defToB = findNavPath('def_spawn', 'site_b_plant');
      assert.equal(attToA[attToA.length - 1]?.id, 'site_a_plant', `${mapId} att->A reachable`);
      assert.equal(attToB[attToB.length - 1]?.id, 'site_b_plant', `${mapId} att->B reachable`);
      assert.equal(defToA[defToA.length - 1]?.id, 'site_a_plant', `${mapId} def->A reachable`);
      assert.equal(defToB[defToB.length - 1]?.id, 'site_b_plant', `${mapId} def->B reachable`);
    }
  } finally {
    setActiveMap('WAREHOUSE');
  }
});

test('raycastAABBs finds closest wall hit, respects maxDistance, and handles floor hits', () => {
  const boxes = [
    { minX: -2, maxX: 2, minY: 0, maxY: 4, minZ: -12, maxZ: -10 },
    { minX: -2, maxX: 2, minY: 0, maxY: 4, minZ: -20, maxZ: -18 },
  ];

  // Shoot from (0, 1.5, 0) along -Z -> hits near face of first box at z = -10 -> distance 10
  const hit = raycastAABBs(0, 1.5, 0, 0, 0, -1, 50, boxes);
  assert.ok(hit);
  assert.ok(Math.abs(hit!.distance - 10) < 1e-5);
  assert.equal(hit!.nz, 1);

  // Too short maxDistance returns null
  assert.equal(raycastAABBs(0, 1.5, 0, 0, 0, -1, 8, boxes), null);

  // Diagonal downward ray with includeFloor hits y=0
  const invLen = 1 / Math.SQRT2;
  const floorHit = raycastAABBs(0, 2, 0, 0, -invLen, invLen, 10, [], true);
  assert.ok(floorHit);
  assert.ok(Math.abs(floorHit!.y) < 1e-5);
  assert.equal(floorHit!.ny, 1);
});

test('worldToRadarCoord rotates target ahead of player to straight UP regardless of yaw and clamps rim', () => {
  // Player at origin facing -Z (yaw = 0); target ahead at (0, -12) -> cy < center
  const ahead0 = worldToRadarCoord(0, -12, 0, 0, 0, 120, 24, 52);
  assert.ok(Math.abs(ahead0.cx - 60) < 1e-5);
  assert.equal(ahead0.cy, 30);
  assert.equal(ahead0.clamped, false);

  // Player rotated 90 deg CCW (yaw = PI/2, facing -X); target ahead at (-12, 0) -> straight UP (60, 30)
  const ahead90 = worldToRadarCoord(-12, 0, 0, 0, Math.PI / 2, 120, 24, 52);
  assert.ok(Math.abs(ahead90.cx - 60) < 1e-4);
  assert.ok(Math.abs(ahead90.cy - 30) < 1e-4);

  // Far enemy clamped to perimeter ring radius
  const farTarget = worldToRadarCoord(80, -80, 0, 0, 0, 120, 24, 52);
  assert.equal(farTarget.clamped, true);
  assert.ok(Math.abs(Math.hypot(farTarget.cx - 60, farTarget.cy - 60) - 52) < 1e-4);
});

test('sanitizeChatText normalizes whitespace, strips newlines, and caps length', () => {
  assert.equal(sanitizeChatText('  hold   B\nsite\tnow  '), 'hold B site now');
  assert.equal(sanitizeChatText('a'.repeat(300), 220).length, 220);
});

