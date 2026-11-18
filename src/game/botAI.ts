/**
 * Hollow Strike - Tactical Bot AI
 * Controls 4 bot teammates + 5 bot opponents with objective-driven navigation,
 * peeking, angle holding, cover taking, plant/defuse logic, and ability usage.
 */

import * as THREE from 'three';
import { BotDifficulty, TeamSide, WeaponDef } from './types';
import { NavNode, findClosestNavNode, findNavPath, checkCollision, BOMB_SITE_A, BOMB_SITE_B } from './mapData';
import { AgentMeshPackage } from './agentModels';
import { AbilityManager } from './abilities';
import { computeBotAimSolution } from './rules';

const _toEnemy = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _strafeDir = new THREE.Vector3();
const _sitePos = new THREE.Vector3();
const _aimDir = new THREE.Vector3();
const _losOrigin = new THREE.Vector3();
const _losTarget = new THREE.Vector3();
const _losDir = new THREE.Vector3();
const _losRaycaster = new THREE.Raycaster();

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-lambda * dt));
}

export type BotState =
  | 'SPAWN_WAIT'
  | 'ROAMING'
  | 'HOLDING_ANGLE'
  | 'ENGAGING'
  | 'PLANTING'
  | 'DEFUSING'
  | 'RETREATING';

export interface BotCombatant {
  id: string;
  name: string;
  team: TeamSide;
  agentId: string;
  isHuman: boolean;
  hp: number;
  armor: number;
  alive: boolean;
  deathTimer: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  pitch: number;
  hasSpike: boolean;
  weapon: WeaponDef;
  ammoInMag: number;
  reserveAmmo: number;
  primaryWeapon: WeaponDef | null;
  primaryAmmoInMag: number;
  primaryReserveAmmo: number;
  sidearmWeapon: WeaponDef;
  sidearmAmmoInMag: number;
  sidearmReserveAmmo: number;
  activeSlot: 1 | 2;
  reloadTimer: number;
  shootCooldown: number;
  isPlanting: boolean;
  isDefusing: boolean;
  isCrouching?: boolean;
  actionProgress: number; // 0 to 1
  modelPackage: AgentMeshPackage;
}

export class BotController {
  public combatant: BotCombatant;
  public difficulty: BotDifficulty;
  public state: BotState = 'ROAMING';

  private currentPath: NavNode[] = [];
  private currentPathIndex: number = 0;
  private reactionTimer: number = 0;
  private currentEnemyTarget: BotCombatant | null = null;
  private alertTarget: BotCombatant | null = null;
  private alertTimer: number = 0;
  private lastSeenPos: THREE.Vector3 | null = null;
  private memoryTimer: number = 0;

  private abilityCooldown: number = 4 + Math.random() * 8;
  private angleHoldTimer: number = 0;
  private crouchTimer: number = 0;

  private burstShotsFired: number = 0;
  private burstPauseTimer: number = 0;
  private strafeSign: number = Math.random() > 0.5 ? 1 : -1;
  private strafeSwapTimer: number = 0.7;

  private lastProgressPos: THREE.Vector3 = new THREE.Vector3();
  private progressInit: boolean = false;
  private stuckTimer: number = 0;
  private detourTimer: number = 0;
  private detourSign: number = Math.random() > 0.5 ? 1 : -1;

  constructor(combatant: BotCombatant, difficulty: BotDifficulty) {
    this.combatant = combatant;
    this.difficulty = difficulty;
  }

  public setDifficulty(diff: BotDifficulty): void {
    this.difficulty = diff;
  }

  /** Called when this bot takes damage so it reacts to flank/rear shots instead of ignoring attackers */
  public notifyDamaged(attacker: BotCombatant): void {
    if (!this.combatant.alive || attacker.team === this.combatant.team || !attacker.alive) return;
    this.alertTarget = attacker;
    this.alertTimer = 4.0;
    if (!this.lastSeenPos) this.lastSeenPos = new THREE.Vector3();
    this.lastSeenPos.copy(attacker.position);
    this.memoryTimer = 3.0;

    if (!this.currentEnemyTarget && this.state !== 'PLANTING' && this.state !== 'DEFUSING') {
      this.currentEnemyTarget = attacker;
      this.reactionTimer = this.difficulty === 'HARD' ? 0.16 : this.difficulty === 'MEDIUM' ? 0.28 : 0.45;
      this.state = 'ENGAGING';
    }
  }

  public planRound(spikePlanted: boolean, plantedSite: 'A' | 'B' | null): void {
    this.state = 'ROAMING';
    this.currentEnemyTarget = null;
    this.alertTarget = null;
    this.alertTimer = 0;
    this.memoryTimer = 0;
    this.burstShotsFired = 0;
    this.burstPauseTimer = 0;
    this.stuckTimer = 0;
    this.detourTimer = 0;
    this.progressInit = false;

    const isAttacker = this.combatant.team === 'ATTACKERS';
    let targetNodeId = 'mid_center';

    if (isAttacker) {
      if (!spikePlanted) {
        const roll = Math.random();
        if (roll < 0.4) targetNodeId = 'site_a_plant';
        else if (roll < 0.8) targetNodeId = 'site_b_plant';
        else targetNodeId = 'mid_north';
      } else {
        targetNodeId = plantedSite === 'A' ? 'site_a_back' : 'site_b_back';
      }
    } else {
      if (!spikePlanted) {
        const rand = Math.random();
        if (rand < 0.34) targetNodeId = 'site_a_plant';
        else if (rand < 0.68) targetNodeId = 'site_b_plant';
        else if (rand < 0.84) targetNodeId = 'a_connector';
        else targetNodeId = 'b_connector';
      } else {
        targetNodeId = plantedSite === 'A' ? 'site_a_plant' : 'site_b_plant';
      }
    }

    const startNode = findClosestNavNode(this.combatant.position.x, this.combatant.position.z);
    this.currentPath = findNavPath(startNode.id, targetNodeId);
    this.currentPathIndex = 0;
  }

  public update(
    dt: number,
    allCombatants: BotCombatant[],
    spikeState: 'not_planted' | 'planted' | 'defused' | 'detonated',
    spikePosition: THREE.Vector3 | null,
    plantedSite: 'A' | 'B' | null,
    abilityMgr: AbilityManager,
    worldColliders: THREE.Mesh[],
    fireBulletCallback: (shooter: BotCombatant, dir: THREE.Vector3) => void,
    onBotPlantComplete?: (bot: BotCombatant, site: 'A' | 'B') => void,
    onBotDefuseComplete?: (bot: BotCombatant) => void
  ): void {
    if (!this.combatant.alive) {
      this.combatant.isCrouching = false;
      if (this.combatant.deathTimer > 0) {
        this.combatant.deathTimer -= dt;
        this.combatant.modelPackage.updateAnimation(dt, false, 0, false, true);
        if (this.combatant.deathTimer <= 0) {
          this.combatant.modelPackage.root.visible = false;
        }
      }
      return;
    }

    // 1. Timers & reload completion
    if (this.combatant.reloadTimer > 0) {
      this.combatant.reloadTimer -= dt;
      if (this.combatant.reloadTimer <= 0) {
        this.combatant.reloadTimer = 0;
        const needed = this.combatant.weapon.magazineSize - this.combatant.ammoInMag;
        const take = Math.min(needed, this.combatant.reserveAmmo);
        this.combatant.ammoInMag += take;
        this.combatant.reserveAmmo -= take;
      }
    }
    if (this.combatant.shootCooldown > 0) this.combatant.shootCooldown -= dt;
    if (this.abilityCooldown > 0) this.abilityCooldown -= dt;
    if (this.crouchTimer > 0) this.crouchTimer -= dt;
    if (this.alertTimer > 0) {
      this.alertTimer -= dt;
      if (this.alertTimer <= 0) this.alertTarget = null;
    }
    if (this.memoryTimer > 0) {
      this.memoryTimer -= dt;
    }
    if (this.burstPauseTimer > 0) {
      this.burstPauseTimer -= dt;
      if (this.burstPauseTimer <= 0) {
        this.burstShotsFired = 0;
      }
    }

    const isBlinded = abilityMgr.blindedCombatantIds.has(this.combatant.id);
    const isSlowed = abilityMgr.slowedCombatantIds.has(this.combatant.id);

    // 2. Scan for visible unobstructed enemies (unless blinded)
    if (!isBlinded) {
      this.scanForEnemies(allCombatants, abilityMgr, worldColliders);
    } else {
      this.currentEnemyTarget = null;
      if (this.state === 'ENGAGING') {
        this.state = 'HOLDING_ANGLE';
        this.angleHoldTimer = 1.1;
      }
    }

    // 3. State execution
    switch (this.state) {
      case 'ENGAGING':
        this.executeEngage(dt, fireBulletCallback, abilityMgr, isSlowed ? 0.55 : 1.0);
        break;

      case 'PLANTING':
        this.executePlant(dt, onBotPlantComplete);
        break;

      case 'DEFUSING':
        this.executeDefuse(dt, onBotDefuseComplete);
        break;

      case 'HOLDING_ANGLE':
        this.executeHoldAngle(dt);
        break;

      case 'ROAMING':
      default:
        this.combatant.pitch = THREE.MathUtils.damp(this.combatant.pitch, 0, 8, dt);
        this.executeRoam(dt, spikeState, spikePosition, plantedSite, abilityMgr, isSlowed ? 0.55 : 1.0);
        break;
    }

    const isCrouchingNow = this.crouchTimer > 0;
    this.combatant.isCrouching = isCrouchingNow;

    // 4. Sync 3D model transforms & animations
    this.combatant.modelPackage.root.position.copy(this.combatant.position);
    this.combatant.modelPackage.root.rotation.y = this.combatant.yaw;

    const speed = Math.hypot(this.combatant.velocity.x, this.combatant.velocity.z);
    const isMoving = speed > 0.2;
    this.combatant.modelPackage.updateAnimation(
      dt,
      isMoving,
      speed,
      isCrouchingNow,
      false,
      this.combatant.pitch,
      this.combatant.reloadTimer > 0
    );
    this.combatant.modelPackage.root.updateMatrixWorld(true);
  }

  private hasLineOfSight(target: BotCombatant, worldColliders: THREE.Mesh[]): boolean {
    _losOrigin.set(this.combatant.position.x, this.combatant.position.y + 1.45, this.combatant.position.z);
    _losTarget.set(target.position.x, target.position.y + 1.25, target.position.z);
    _losDir.subVectors(_losTarget, _losOrigin);
    const dist = _losDir.length();
    if (dist < 0.3) return true;
    _losDir.divideScalar(dist);

    _losRaycaster.layers.enable(0);
    _losRaycaster.set(_losOrigin, _losDir);
    _losRaycaster.far = dist - 0.25;
    const wallHits = _losRaycaster.intersectObjects(worldColliders, false);
    return wallHits.length === 0;
  }

  private scanForEnemies(
    allCombatants: BotCombatant[],
    abilityMgr: AbilityManager,
    worldColliders: THREE.Mesh[]
  ): void {
    let closestEnemy: BotCombatant | null = null;
    let closestDist = Infinity;

    const maxSightRange = this.difficulty === 'HARD' ? 48 : this.difficulty === 'MEDIUM' ? 42 : 36;

    // Three.js local -Z is forward -> world forward = (-sin(yaw), 0, -cos(yaw))
    _forward.set(-Math.sin(this.combatant.yaw), 0, -Math.cos(this.combatant.yaw));

    for (const c of allCombatants) {
      if (!c.alive || c.team === this.combatant.team) continue;

      const dist = this.combatant.position.distanceTo(c.position);
      if (dist > maxSightRange) continue;

      _toEnemy.subVectors(c.position, this.combatant.position).setY(0).normalize();
      const dot = _forward.dot(_toEnemy);
      const isAlertAttacker = this.alertTarget?.id === c.id && this.alertTimer > 0;
      const isRevealed = abilityMgr.revealedEnemyIds.has(c.id);

      // 135 deg forward FOV, 11m close footstep awareness, or active alert when shot/revealed
      if (dot > 0.05 || dist < 11 || isAlertAttacker || isRevealed) {
        const smokeOccluded = abilityMgr.isRayOccludedBySmoke(this.combatant.position, c.position);
        if (!smokeOccluded && dist < closestDist && this.hasLineOfSight(c, worldColliders)) {
          closestDist = dist;
          closestEnemy = c;
        }
      }
    }

    if (closestEnemy) {
      if (this.currentEnemyTarget !== closestEnemy) {
        this.currentEnemyTarget = closestEnemy;
        this.burstShotsFired = 0;
        this.burstPauseTimer = 0;
        const baseDelay = this.difficulty === 'HARD' ? 0.22 : this.difficulty === 'MEDIUM' ? 0.36 : 0.6;
        const rangeDelay = Math.min(0.25, closestDist * 0.005);
        this.reactionTimer = baseDelay + rangeDelay;
      }
      if (!this.lastSeenPos) this.lastSeenPos = new THREE.Vector3();
      this.lastSeenPos.copy(closestEnemy.position);
      this.memoryTimer = 2.6;

      if (this.state !== 'PLANTING' && this.state !== 'DEFUSING') {
        this.state = 'ENGAGING';
      }
    } else if (this.state === 'ENGAGING') {
      // Target slipped into cover/smoke: hold angle toward last seen position briefly rather than blindly walking away
      this.currentEnemyTarget = null;
      if (this.memoryTimer > 0 && this.lastSeenPos) {
        this.state = 'HOLDING_ANGLE';
        this.angleHoldTimer = 1.6;
      } else {
        this.state = 'ROAMING';
      }
    }
  }

  private tryMoveWithSlide(dx: number, dz: number, abilityMgr: AbilityManager): boolean {
    const nextX = this.combatant.position.x + dx;
    const nextZ = this.combatant.position.z + dz;

    const blockedByBarrier = (tx: number, tz: number) => {
      for (const b of abilityMgr.barriers) {
        if (Math.abs(tx - b.position.x) < b.width * 0.55 && Math.abs(tz - b.position.z) < 0.8) {
          return true;
        }
      }
      return false;
    };

    const col = checkCollision(nextX, nextZ, 0.45);
    if (!col.collided && !blockedByBarrier(nextX, nextZ)) {
      this.combatant.position.x = nextX;
      this.combatant.position.z = nextZ;
      return true;
    }

    // Slide smoothly along wall X or Z axes individually
    let moved = false;
    if (!checkCollision(nextX, this.combatant.position.z, 0.45).collided && !blockedByBarrier(nextX, this.combatant.position.z)) {
      this.combatant.position.x = nextX;
      moved = true;
    } else if (!checkCollision(this.combatant.position.x, nextZ, 0.45).collided && !blockedByBarrier(this.combatant.position.x, nextZ)) {
      this.combatant.position.z = nextZ;
      moved = true;
    } else {
      this.combatant.position.x += col.normalX * 0.08;
      this.combatant.position.z += col.normalZ * 0.08;
    }
    return moved;
  }

  private executeEngage(
    dt: number,
    fireBulletCallback: (shooter: BotCombatant, dir: THREE.Vector3) => void,
    abilityMgr: AbilityManager,
    speedMultiplier: number
  ): void {
    if (!this.currentEnemyTarget || !this.currentEnemyTarget.alive) {
      this.currentEnemyTarget = null;
      this.state = 'ROAMING';
      return;
    }

    const target = this.currentEnemyTarget;
    const targetIsCrouching = Boolean(
      target.isCrouching || target.isPlanting || target.isDefusing
    );
    const flatDist = Math.max(
      0.1,
      Math.hypot(
        target.position.x - this.combatant.position.x,
        target.position.z - this.combatant.position.z
      )
    );
    const targetSpeed = Math.hypot(target.velocity.x, target.velocity.z);

    const aimSol = computeBotAimSolution({
      difficulty: this.difficulty,
      distance: flatDist,
      burstShotIndex: this.burstShotsFired,
      targetSpeed,
      isTargetCrouching: targetIsCrouching,
    });

    // Aim cleanly at torso/center-mass (below head height)
    const targetAimY = target.position.y + aimSol.targetAimYOffset;
    _toEnemy.set(
      target.position.x - this.combatant.position.x,
      targetAimY - (this.combatant.position.y + 1.38),
      target.position.z - this.combatant.position.z
    );

    const targetYaw = Math.atan2(-_toEnemy.x, -_toEnemy.z);
    const targetPitch = Math.atan2(_toEnemy.y, flatDist);

    // Human-like angular tracking speed (no instant snap)
    const turnRate = this.difficulty === 'HARD' ? 11 : this.difficulty === 'MEDIUM' ? 8 : 5.2;
    this.combatant.yaw = dampAngle(this.combatant.yaw, targetYaw, turnRate, dt);
    this.combatant.pitch = THREE.MathUtils.damp(this.combatant.pitch, targetPitch, turnRate, dt);

    // Dynamic strafe-step / retreat movement (no static turret standing!)
    this.strafeSwapTimer -= dt;
    if (this.strafeSwapTimer <= 0) {
      this.strafeSign *= -1;
      this.strafeSwapTimer = 0.65 + Math.random() * 0.65;
    }

    const lowHp = this.combatant.hp < 34;
    const needReposition = lowHp || this.burstPauseTimer > 0 || this.combatant.reloadTimer > 0;
    const strafeSpeed = (needReposition ? 3.2 : flatDist < 22 ? 1.65 : 0.7) * speedMultiplier;

    // Perpendicular lateral vector + slight backpedal when hurt/reloading
    const invLen = 1 / flatDist;
    const dirX = _toEnemy.x * invLen;
    const dirZ = _toEnemy.z * invLen;
    const backBias = lowHp || this.combatant.reloadTimer > 0 ? -0.65 : flatDist < 7 ? -0.35 : 0;
    _strafeDir.set(-dirZ * this.strafeSign + dirX * backBias, 0, dirX * this.strafeSign + dirZ * backBias);
    if (_strafeDir.lengthSq() > 0.001) _strafeDir.normalize();

    this.combatant.velocity.set(_strafeDir.x * strafeSpeed, 0, _strafeDir.z * strafeSpeed);
    this.tryMoveWithSlide(this.combatant.velocity.x * dt, this.combatant.velocity.z * dt, abilityMgr);

    if (this.reactionTimer > 0) {
      this.reactionTimer -= dt;
      return;
    }

    // Tactical abilities across all 4 agents
    if (this.abilityCooldown <= 0 && Math.random() < 0.22) {
      this.abilityCooldown = 14;
      if (this.combatant.agentId === 'ZEPHYR') {
        abilityMgr.deploySmoke(
          this.combatant.position.x + dirX * Math.min(flatDist * 0.5, 10),
          0,
          this.combatant.position.z + dirZ * Math.min(flatDist * 0.5, 10)
        );
      } else if (this.combatant.agentId === 'LUMEN' && this.combatant.hp < 72) {
        this.combatant.hp = Math.min(100, this.combatant.hp + 35);
      } else if (this.combatant.agentId === 'BASTION' && lowHp) {
        const bx = this.combatant.position.x + dirX * 2.2;
        const bz = this.combatant.position.z + dirZ * 2.2;
        abilityMgr.deployBarrier(bx, 0, bz, this.combatant.yaw);
      } else if (this.combatant.agentId === 'BLITZ' && flatDist < 22) {
        this.strafeSwapTimer = 0.2;
        this.tryMoveWithSlide(-dirZ * this.strafeSign * 2.2, dirX * this.strafeSign * 2.2, abilityMgr);
      }
    }

    // Smart sidearm fallback when primary mag is empty up close
    if (this.combatant.ammoInMag <= 0) {
      if (
        this.combatant.activeSlot === 1 &&
        flatDist < 16 &&
        this.combatant.sidearmAmmoInMag > 0
      ) {
        this.combatant.primaryAmmoInMag = 0;
        this.combatant.primaryReserveAmmo = this.combatant.reserveAmmo;
        this.combatant.activeSlot = 2;
        this.combatant.weapon = this.combatant.sidearmWeapon;
        this.combatant.ammoInMag = this.combatant.sidearmAmmoInMag;
        this.combatant.reserveAmmo = this.combatant.sidearmReserveAmmo;
        this.combatant.reloadTimer = 0;
        this.combatant.modelPackage.setWeapon(this.combatant.weapon.id);
        this.burstShotsFired = 0;
        return;
      }

      if (this.combatant.reloadTimer <= 0 && this.combatant.reserveAmmo > 0) {
        this.combatant.reloadTimer = this.combatant.weapon.reloadTime;
      }
      return;
    }

    if (this.burstPauseTimer > 0) {
      return;
    }

    if (this.combatant.shootCooldown <= 0 && this.combatant.reloadTimer <= 0) {
      this.combatant.shootCooldown = 1 / this.combatant.weapon.fireRate;
      this.combatant.ammoInMag--;
      this.burstShotsFired++;
      this.combatant.modelPackage.triggerMuzzleFlash();

      // Use actual facing vector blended with distance/burst-scaled human scatter (not pure laser _toEnemy!)
      _aimDir.copy(_toEnemy).normalize();

      const yawJitter = (Math.random() - 0.5) * 2 * aimSol.spreadYaw;
      // Downward-biased vertical jitter at range so bots hit torso/body or miss rather than beaming heads
      const pitchJitter =
        -Math.random() * aimSol.spreadPitchDown + Math.random() * aimSol.spreadPitchUp;

      const sinY = Math.sin(yawJitter);
      const cosY = Math.cos(yawJitter);
      const rx = _aimDir.x * cosY - _aimDir.z * sinY;
      const rz = _aimDir.x * sinY + _aimDir.z * cosY;
      _aimDir.x = rx;
      _aimDir.z = rz;
      _aimDir.y += pitchJitter;
      _aimDir.normalize();

      fireBulletCallback(this.combatant, _aimDir);

      if (this.burstShotsFired >= aimSol.maxBurstShots) {
        this.burstPauseTimer = aimSol.burstResetSeconds;
      }
    }
  }

  private executeRoam(
    dt: number,
    spikeState: 'not_planted' | 'planted' | 'defused' | 'detonated',
    spikePosition: THREE.Vector3 | null,
    plantedSite: 'A' | 'B' | null,
    abilityMgr: AbilityManager,
    speedMultiplier: number
  ): void {
    // Out-of-combat smart reload
    if (
      this.combatant.reloadTimer <= 0 &&
      this.combatant.reserveAmmo > 0 &&
      this.combatant.ammoInMag < Math.ceil(this.combatant.weapon.magazineSize * 0.45)
    ) {
      this.combatant.reloadTimer = this.combatant.weapon.reloadTime;
    }

    // Switch back to primary when out of duel and reloaded
    if (
      this.combatant.activeSlot === 2 &&
      this.combatant.primaryWeapon &&
      (this.combatant.primaryAmmoInMag > 0 || this.combatant.primaryReserveAmmo > 0)
    ) {
      this.combatant.sidearmAmmoInMag = this.combatant.ammoInMag;
      this.combatant.sidearmReserveAmmo = this.combatant.reserveAmmo;
      this.combatant.activeSlot = 1;
      this.combatant.weapon = this.combatant.primaryWeapon;
      this.combatant.ammoInMag = this.combatant.primaryAmmoInMag;
      this.combatant.reserveAmmo = this.combatant.primaryReserveAmmo;
      this.combatant.modelPackage.setWeapon(this.combatant.weapon.id);
    }

    const isAttacker = this.combatant.team === 'ATTACKERS';

    if (isAttacker && this.combatant.hasSpike && spikeState === 'not_planted') {
      const distA = this.combatant.position.distanceTo(_sitePos.set(BOMB_SITE_A.x, 0, BOMB_SITE_A.z));
      const distB = this.combatant.position.distanceTo(_sitePos.set(BOMB_SITE_B.x, 0, BOMB_SITE_B.z));

      if (distA < BOMB_SITE_A.radius || distB < BOMB_SITE_B.radius) {
        this.state = 'PLANTING';
        this.combatant.isPlanting = true;
        this.combatant.actionProgress = 0;
        return;
      }
    }

    if (!isAttacker && spikeState === 'planted' && spikePosition) {
      const distToSpike = this.combatant.position.distanceTo(spikePosition);
      if (distToSpike < 2.8) {
        this.state = 'DEFUSING';
        this.combatant.isDefusing = true;
        this.combatant.actionProgress = 0;
        return;
      }
    }

    if (this.currentPath.length === 0 || this.currentPathIndex >= this.currentPath.length) {
      this.planRound(spikeState === 'planted', plantedSite);
      return;
    }

    const nextNode = this.currentPath[this.currentPathIndex];
    _targetPos.set(nextNode.x, 0, nextNode.z);
    const distToNode = this.combatant.position.distanceTo(_targetPos);

    if (distToNode < 1.6) {
      this.currentPathIndex++;
      this.stuckTimer = 0;
      if (this.currentPathIndex >= this.currentPath.length) {
        this.state = 'HOLDING_ANGLE';
        this.angleHoldTimer = 1.8 + Math.random() * 2.5;
        return;
      }
    }

    // Stuck detection & automatic detour/repath
    if (!this.progressInit) {
      this.lastProgressPos.copy(this.combatant.position);
      this.progressInit = true;
      this.stuckTimer = 0;
    } else {
      const movedDist = this.combatant.position.distanceTo(this.lastProgressPos);
      if (movedDist > 0.45) {
        this.lastProgressPos.copy(this.combatant.position);
        this.stuckTimer = 0;
      } else {
        this.stuckTimer += dt;
        if (this.stuckTimer > 0.85) {
          this.stuckTimer = 0;
          this.detourTimer = 0.65;
          this.detourSign *= -1;
          // Advance or replan if wedged
          if (this.currentPathIndex + 1 < this.currentPath.length) {
            this.currentPathIndex++;
          } else {
            this.planRound(spikeState === 'planted', plantedSite);
          }
        }
      }
    }

    _moveDir.subVectors(_targetPos, this.combatant.position).setY(0);
    if (_moveDir.lengthSq() > 0.001) _moveDir.normalize();

    if (this.detourTimer > 0) {
      this.detourTimer -= dt;
      // Steer 55 degrees laterally to walk cleanly around obstacle
      const mx = _moveDir.x;
      const mz = _moveDir.z;
      _moveDir.set(mx * 0.55 - mz * 0.83 * this.detourSign, 0, mz * 0.55 + mx * 0.83 * this.detourSign).normalize();
    }

    const moveSpeed = 4.9 * speedMultiplier;
    this.combatant.velocity.set(_moveDir.x * moveSpeed, 0, _moveDir.z * moveSpeed);

    const desiredYaw = Math.atan2(-_moveDir.x, -_moveDir.z);
    this.combatant.yaw = dampAngle(this.combatant.yaw, desiredYaw, 10, dt);

    this.tryMoveWithSlide(this.combatant.velocity.x * dt, this.combatant.velocity.z * dt, abilityMgr);
  }

  private executePlant(dt: number, onBotPlantComplete?: (bot: BotCombatant, site: 'A' | 'B') => void): void {
    this.combatant.velocity.set(0, 0, 0);
    this.crouchTimer = 0.2;
    this.combatant.actionProgress += dt / 4.0;
    if (this.combatant.actionProgress >= 1.0) {
      this.combatant.isPlanting = false;
      this.combatant.actionProgress = 0;
      this.state = 'HOLDING_ANGLE';
      this.angleHoldTimer = 2.0;
      const distA = this.combatant.position.distanceTo(_sitePos.set(BOMB_SITE_A.x, 0, BOMB_SITE_A.z));
      onBotPlantComplete?.(this.combatant, distA < BOMB_SITE_A.radius + 2 ? 'A' : 'B');
    }
  }

  private executeDefuse(dt: number, onBotDefuseComplete?: (bot: BotCombatant) => void): void {
    this.combatant.velocity.set(0, 0, 0);
    this.crouchTimer = 0.2;
    this.combatant.actionProgress += dt / 5.0;
    if (this.combatant.actionProgress >= 1.0) {
      this.combatant.isDefusing = false;
      this.combatant.actionProgress = 0;
      this.state = 'HOLDING_ANGLE';
      this.angleHoldTimer = 1.5;
      onBotDefuseComplete?.(this.combatant);
    }
  }

  private executeHoldAngle(dt: number): void {
    this.combatant.velocity.set(0, 0, 0);
    // Keep pre-aiming toward last known enemy position if remembered
    if (this.lastSeenPos && this.memoryTimer > 0) {
      const dx = this.lastSeenPos.x - this.combatant.position.x;
      const dz = this.lastSeenPos.z - this.combatant.position.z;
      if (dx * dx + dz * dz > 0.25) {
        const aimYaw = Math.atan2(-dx, -dz);
        this.combatant.yaw = dampAngle(this.combatant.yaw, aimYaw, 8, dt);
      }
    }
    this.angleHoldTimer -= dt;
    if (this.angleHoldTimer <= 0) {
      this.state = 'ROAMING';
    }
  }
}

