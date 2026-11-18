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

const _toEnemy = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
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
  private abilityCooldown: number = 4 + Math.random() * 8;
  private angleHoldTimer: number = 0;
  private crouchTimer: number = 0;

  constructor(combatant: BotCombatant, difficulty: BotDifficulty) {
    this.combatant = combatant;
    this.difficulty = difficulty;
  }

  public setDifficulty(diff: BotDifficulty): void {
    this.difficulty = diff;
  }

  public planRound(spikePlanted: boolean, plantedSite: 'A' | 'B' | null): void {
    this.state = 'ROAMING';
    this.currentEnemyTarget = null;
    const isAttacker = this.combatant.team === 'ATTACKERS';

    let targetNodeId = 'mid_center';

    if (isAttacker) {
      if (!spikePlanted) {
        const pickA = Math.random() > 0.45;
        targetNodeId = pickA ? 'site_a_plant' : 'site_b_plant';
      } else {
        targetNodeId = plantedSite === 'A' ? 'site_a_back' : 'site_b_back';
      }
    } else {
      if (!spikePlanted) {
        const rand = Math.random();
        if (rand < 0.4) targetNodeId = 'site_a_plant';
        else if (rand < 0.8) targetNodeId = 'site_b_plant';
        else targetNodeId = 'mid_center';
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
      if (this.combatant.deathTimer > 0) {
        this.combatant.deathTimer -= dt;
        this.combatant.modelPackage.updateAnimation(dt, false, 0, false, true);
        if (this.combatant.deathTimer <= 0) {
          this.combatant.modelPackage.root.visible = false;
        }
      }
      return;
    }

    // 1. Weapon reload & cooldown ticks
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
    if (this.combatant.shootCooldown > 0) {
      this.combatant.shootCooldown -= dt;
    }
    if (this.abilityCooldown > 0) {
      this.abilityCooldown -= dt;
    }
    if (this.crouchTimer > 0) {
      this.crouchTimer -= dt;
    }

    const isBlinded = abilityMgr.blindedCombatantIds.has(this.combatant.id);
    const isSlowed = abilityMgr.slowedCombatantIds.has(this.combatant.id);

    // 2. Scan for visible unobstructed enemies (unless blinded)
    if (!isBlinded) {
      this.scanForEnemies(allCombatants, abilityMgr, worldColliders);
    } else {
      this.currentEnemyTarget = null;
      if (this.state === 'ENGAGING') this.state = 'HOLDING_ANGLE';
    }

    // 3. State execution
    switch (this.state) {
      case 'ENGAGING':
        this.executeEngage(dt, fireBulletCallback, abilityMgr);
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
        this.executeRoam(dt, spikeState, spikePosition, plantedSite, isSlowed ? 0.55 : 1.0);
        break;
    }

    // 4. Sync 3D model transforms & animations
    this.combatant.modelPackage.root.position.copy(this.combatant.position);
    this.combatant.modelPackage.root.rotation.y = this.combatant.yaw;

    const speed = Math.hypot(this.combatant.velocity.x, this.combatant.velocity.z);
    const isMoving = speed > 0.2;
    this.combatant.modelPackage.updateAnimation(
      dt,
      isMoving,
      speed,
      this.crouchTimer > 0,
      false,
      this.combatant.pitch,
      this.combatant.reloadTimer > 0
    );
    this.combatant.modelPackage.root.updateMatrixWorld(true);
  }

  private hasLineOfSight(target: BotCombatant, worldColliders: THREE.Mesh[]): boolean {
    _losOrigin.set(this.combatant.position.x, this.combatant.position.y + 1.45, this.combatant.position.z);
    _losTarget.set(target.position.x, target.position.y + 1.32, target.position.z);
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

    // Three.js local -Z is forward -> world forward = (-sin(yaw), 0, -cos(yaw))
    _forward.set(-Math.sin(this.combatant.yaw), 0, -Math.cos(this.combatant.yaw));

    for (const c of allCombatants) {
      if (!c.alive || c.team === this.combatant.team) continue;

      const dist = this.combatant.position.distanceTo(c.position);
      if (dist > 55) continue;

      _toEnemy.subVectors(c.position, this.combatant.position).setY(0).normalize();
      const dot = _forward.dot(_toEnemy);

      // 135 deg field of view, or close proximity awareness
      if (dot > 0.05 || dist < 10) {
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
        const delay = this.difficulty === 'HARD' ? 0.16 : this.difficulty === 'MEDIUM' ? 0.3 : 0.55;
        this.reactionTimer = delay;
      }
      if (this.state !== 'PLANTING' && this.state !== 'DEFUSING') {
        this.state = 'ENGAGING';
      }
    } else if (this.state === 'ENGAGING') {
      this.currentEnemyTarget = null;
      this.state = 'ROAMING';
    }
  }

  private executeEngage(
    dt: number,
    fireBulletCallback: (shooter: BotCombatant, dir: THREE.Vector3) => void,
    abilityMgr: AbilityManager
  ): void {
    if (!this.currentEnemyTarget || !this.currentEnemyTarget.alive) {
      this.currentEnemyTarget = null;
      this.state = 'ROAMING';
      return;
    }

    // Stop to shoot cleanly
    this.combatant.velocity.set(0, 0, 0);

    // Aim towards enemy (local -Z faces target => atan2(-dx, -dz))
    const targetChestY =
      this.currentEnemyTarget.position.y +
      (this.currentEnemyTarget.isPlanting || this.currentEnemyTarget.isDefusing ? 0.92 : 1.32);

    _toEnemy.set(
      this.currentEnemyTarget.position.x - this.combatant.position.x,
      targetChestY - (this.combatant.position.y + 1.4),
      this.currentEnemyTarget.position.z - this.combatant.position.z
    );
    const flatDist = Math.max(0.01, Math.hypot(_toEnemy.x, _toEnemy.z));
    const targetYaw = Math.atan2(-_toEnemy.x, -_toEnemy.z);
    const targetPitch = Math.atan2(_toEnemy.y, flatDist);

    const turnRate = this.difficulty === 'HARD' ? 15 : this.difficulty === 'MEDIUM' ? 10 : 6;
    this.combatant.yaw = dampAngle(this.combatant.yaw, targetYaw, turnRate, dt);
    this.combatant.pitch = THREE.MathUtils.damp(this.combatant.pitch, targetPitch, turnRate, dt);

    if (this.reactionTimer > 0) {
      this.reactionTimer -= dt;
      return;
    }

    // Tactical ability usage in combat
    if (this.abilityCooldown <= 0 && Math.random() < 0.25) {
      this.abilityCooldown = 16;
      if (this.combatant.agentId === 'ZEPHYR') {
        abilityMgr.deploySmoke(this.combatant.position.x + _toEnemy.x * 0.45, 0, this.combatant.position.z + _toEnemy.z * 0.45);
      } else if (this.combatant.agentId === 'LUMEN' && this.combatant.hp < 70) {
        this.combatant.hp = Math.min(100, this.combatant.hp + 35);
      }
    }

    if (this.combatant.ammoInMag <= 0) {
      if (this.combatant.reloadTimer <= 0 && this.combatant.reserveAmmo > 0) {
        this.combatant.reloadTimer = this.combatant.weapon.reloadTime;
      }
      return;
    }

    if (this.combatant.shootCooldown <= 0 && this.combatant.reloadTimer <= 0) {
      this.combatant.shootCooldown = 1 / this.combatant.weapon.fireRate;
      this.combatant.ammoInMag--;
      this.combatant.modelPackage.triggerMuzzleFlash();

      _aimDir.copy(_toEnemy).normalize();

      const jitterFactor = this.difficulty === 'HARD' ? 0.025 : this.difficulty === 'MEDIUM' ? 0.055 : 0.11;
      _aimDir.x += (Math.random() - 0.5) * jitterFactor;
      _aimDir.y += (Math.random() - 0.5) * jitterFactor * 0.45;
      _aimDir.z += (Math.random() - 0.5) * jitterFactor;
      _aimDir.normalize();

      fireBulletCallback(this.combatant, _aimDir);
    }
  }

  private executeRoam(
    dt: number,
    spikeState: 'not_planted' | 'planted' | 'defused' | 'detonated',
    spikePosition: THREE.Vector3 | null,
    plantedSite: 'A' | 'B' | null,
    speedMultiplier: number
  ): void {
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

    if (distToNode < 1.5) {
      this.currentPathIndex++;
      if (this.currentPathIndex >= this.currentPath.length) {
        this.state = 'HOLDING_ANGLE';
        this.angleHoldTimer = 2.0 + Math.random() * 3.0;
        return;
      }
    }

    _moveDir.subVectors(_targetPos, this.combatant.position).setY(0).normalize();
    const moveSpeed = 4.9 * speedMultiplier;
    this.combatant.velocity.set(_moveDir.x * moveSpeed, 0, _moveDir.z * moveSpeed);

    const desiredYaw = Math.atan2(-_moveDir.x, -_moveDir.z);
    this.combatant.yaw = dampAngle(this.combatant.yaw, desiredYaw, 10, dt);

    const nextX = this.combatant.position.x + this.combatant.velocity.x * dt;
    const nextZ = this.combatant.position.z + this.combatant.velocity.z * dt;

    const col = checkCollision(nextX, nextZ, 0.45);
    if (!col.collided) {
      this.combatant.position.x = nextX;
      this.combatant.position.z = nextZ;
    } else {
      this.combatant.position.x += col.normalX * 0.1;
      this.combatant.position.z += col.normalZ * 0.1;
    }
  }

  private executePlant(dt: number, onBotPlantComplete?: (bot: BotCombatant, site: 'A' | 'B') => void): void {
    this.combatant.velocity.set(0, 0, 0);
    this.crouchTimer = 0.2;
    this.combatant.actionProgress += dt / 4.0;
    if (this.combatant.actionProgress >= 1.0) {
      this.combatant.isPlanting = false;
      this.combatant.actionProgress = 0;
      this.state = 'HOLDING_ANGLE';
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
      onBotDefuseComplete?.(this.combatant);
    }
  }

  private executeHoldAngle(dt: number): void {
    this.combatant.velocity.set(0, 0, 0);
    this.angleHoldTimer -= dt;
    if (this.angleHoldTimer <= 0) {
      this.state = 'ROAMING';
    }
  }
}
