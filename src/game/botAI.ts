/**
 * Hollow Strike - Tactical Bot AI
 * Controls 4 bot teammates + 5 bot opponents with objective-driven navigation,
 * peeking, angle holding, cover taking, plant/defuse logic, and ability usage.
 */

import * as THREE from 'three';
import { BotDifficulty, TeamSide, WeaponDef, WEAPON_REGISTRY } from './types';
import { NavNode, findClosestNavNode, findNavPath, checkCollision, BOMB_SITE_A, BOMB_SITE_B } from './mapData';
import { AgentMeshPackage } from './agentModels';
import { AbilityManager } from './abilities';

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
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  pitch: number;
  hasSpike: boolean;
  weapon: WeaponDef;
  ammoInMag: number;
  reserveAmmo: number;
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
  private targetPosition: THREE.Vector3 = new THREE.Vector3();
  private reactionTimer: number = 0;
  private currentEnemyTarget: BotCombatant | null = null;
  private abilityCooldown: number = 5 + Math.random() * 10;
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
    const isAttacker = this.combatant.team === 'ATTACKERS';

    let targetNodeId = 'mid_center';

    if (isAttacker) {
      if (!spikePlanted) {
        // Attackers pick Site A or B to push
        const pickA = Math.random() > 0.45;
        targetNodeId = pickA ? 'site_a_plant' : 'site_b_plant';
      } else {
        // Post plant: hold site
        targetNodeId = plantedSite === 'A' ? 'site_a_back' : 'site_b_back';
      }
    } else {
      // Defenders
      if (!spikePlanted) {
        // Spread out to sites and mid
        const rand = Math.random();
        if (rand < 0.4) targetNodeId = 'site_a_plant';
        else if (rand < 0.8) targetNodeId = 'site_b_plant';
        else targetNodeId = 'mid_north';
      } else {
        // Rotate to planted site to defuse
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
    fireBulletCallback: (shooter: BotCombatant, dir: THREE.Vector3) => void
  ): void {
    if (!this.combatant.alive) return;

    // 1. Weapon reload & cooldown ticks
    if (this.combatant.reloadTimer > 0) {
      this.combatant.reloadTimer -= dt;
      if (this.combatant.reloadTimer <= 0) {
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

    // 2. Scan for visible enemies
    this.scanForEnemies(allCombatants, abilityMgr);

    // 3. State execution
    switch (this.state) {
      case 'ENGAGING':
        this.executeEngage(dt, fireBulletCallback, abilityMgr);
        break;

      case 'PLANTING':
        this.executePlant(dt);
        break;

      case 'DEFUSING':
        this.executeDefuse(dt);
        break;

      case 'HOLDING_ANGLE':
        this.executeHoldAngle(dt);
        break;

      case 'ROAMING':
      default:
        this.executeRoam(dt, spikeState, spikePosition, plantedSite);
        break;
    }

    // 4. Update 3D model transforms & animations
    this.combatant.modelPackage.root.position.copy(this.combatant.position);
    this.combatant.modelPackage.root.rotation.y = this.combatant.yaw;

    const speed = this.combatant.velocity.length();
    const isMoving = speed > 0.2;
    this.combatant.modelPackage.updateAnimation(isMoving, this.combatant.position.x + this.combatant.position.z, this.crouchTimer > 0);
  }

  private scanForEnemies(allCombatants: BotCombatant[], abilityMgr: AbilityManager): void {
    let closestEnemy: BotCombatant | null = null;
    let closestDist = Infinity;

    for (const c of allCombatants) {
      if (!c.alive || c.team === this.combatant.team) continue;

      const dist = this.combatant.position.distanceTo(c.position);
      if (dist > 50) continue;

      // Check field of view
      const toEnemy = new THREE.Vector3().subVectors(c.position, this.combatant.position).normalize();
      const forward = new THREE.Vector3(Math.sin(this.combatant.yaw), 0, Math.cos(this.combatant.yaw));
      const dot = forward.dot(toEnemy);

      // Bot FOV is ~120 degrees unless holding angle
      if (dot > 0.2 || dist < 6) {
        // Check smoke occlusion
        const occluded = abilityMgr.isRayOccludedBySmoke(this.combatant.position, c.position);
        if (!occluded && dist < closestDist) {
          closestDist = dist;
          closestEnemy = c;
        }
      }
    }

    if (closestEnemy) {
      if (this.currentEnemyTarget !== closestEnemy) {
        this.currentEnemyTarget = closestEnemy;
        // Reaction time based on difficulty
        const delay = this.difficulty === 'HARD' ? 0.18 : this.difficulty === 'MEDIUM' ? 0.32 : 0.55;
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

    // Stop to gain firing accuracy
    this.combatant.velocity.set(0, 0, 0);

    // Aim towards enemy
    const toTarget = new THREE.Vector3().subVectors(this.currentEnemyTarget.position, this.combatant.position);
    const targetYaw = Math.atan2(toTarget.x, toTarget.z);

    // Smooth turn
    const turnRate = this.difficulty === 'HARD' ? 14 : this.difficulty === 'MEDIUM' ? 9 : 5;
    this.combatant.yaw = THREE.MathUtils.damp(this.combatant.yaw, targetYaw, turnRate, dt);

    if (this.reactionTimer > 0) {
      this.reactionTimer -= dt;
      return;
    }

    // Ability usage in combat (smokes / flashes)
    if (this.abilityCooldown <= 0 && Math.random() < 0.2) {
      this.abilityCooldown = 18;
      if (this.combatant.agentId === 'ZEPHYR') {
        abilityMgr.deploySmoke(this.combatant.position.x + toTarget.x * 0.5, 0, this.combatant.position.z + toTarget.z * 0.5);
      }
    }

    // Fire weapon
    if (this.combatant.ammoInMag <= 0) {
      if (this.combatant.reloadTimer <= 0 && this.combatant.reserveAmmo > 0) {
        this.combatant.reloadTimer = this.combatant.weapon.reloadTime;
      }
      return;
    }

    if (this.combatant.shootCooldown <= 0) {
      this.combatant.shootCooldown = 1 / this.combatant.weapon.fireRate;
      this.combatant.ammoInMag--;

      // Add difficulty-based jitter
      const jitterFactor = this.difficulty === 'HARD' ? 0.02 : this.difficulty === 'MEDIUM' ? 0.05 : 0.12;
      const aimDir = toTarget.clone().normalize();
      aimDir.x += (Math.random() - 0.5) * jitterFactor;
      aimDir.y += (Math.random() - 0.5) * jitterFactor * 0.5;
      aimDir.z += (Math.random() - 0.5) * jitterFactor;
      aimDir.normalize();

      fireBulletCallback(this.combatant, aimDir);
    }
  }

  private executeRoam(
    dt: number,
    spikeState: 'not_planted' | 'planted' | 'defused' | 'detonated',
    spikePosition: THREE.Vector3 | null,
    plantedSite: 'A' | 'B' | null
  ): void {
    const isAttacker = this.combatant.team === 'ATTACKERS';

    // Check if attacker has spike and is at site -> begin plant
    if (isAttacker && this.combatant.hasSpike && spikeState === 'not_planted') {
      const distA = this.combatant.position.distanceTo(new THREE.Vector3(BOMB_SITE_A.x, 0, BOMB_SITE_A.z));
      const distB = this.combatant.position.distanceTo(new THREE.Vector3(BOMB_SITE_B.x, 0, BOMB_SITE_B.z));

      if (distA < BOMB_SITE_A.radius || distB < BOMB_SITE_B.radius) {
        this.state = 'PLANTING';
        this.combatant.isPlanting = true;
        this.combatant.actionProgress = 0;
        return;
      }
    }

    // Check if defender near planted spike -> begin defuse
    if (!isAttacker && spikeState === 'planted' && spikePosition) {
      const distToSpike = this.combatant.position.distanceTo(spikePosition);
      if (distToSpike < 2.5) {
        this.state = 'DEFUSING';
        this.combatant.isDefusing = true;
        this.combatant.actionProgress = 0;
        return;
      }
    }

    // Follow waypoint path
    if (this.currentPath.length === 0 || this.currentPathIndex >= this.currentPath.length) {
      this.planRound(spikeState === 'planted', plantedSite);
      return;
    }

    const nextNode = this.currentPath[this.currentPathIndex];
    const targetPos = new THREE.Vector3(nextNode.x, 0, nextNode.z);
    const distToNode = this.combatant.position.distanceTo(targetPos);

    if (distToNode < 1.4) {
      this.currentPathIndex++;
      if (this.currentPathIndex >= this.currentPath.length) {
        // Reached end of path, hold angle for a few seconds
        this.state = 'HOLDING_ANGLE';
        this.angleHoldTimer = 3 + Math.random() * 4;
        return;
      }
    }

    // Move towards node
    const moveDir = new THREE.Vector3().subVectors(targetPos, this.combatant.position).normalize();
    const moveSpeed = 4.8; // m/s
    this.combatant.velocity.copy(moveDir.clone().multiplyScalar(moveSpeed));

    // Turn towards direction
    const desiredYaw = Math.atan2(moveDir.x, moveDir.z);
    this.combatant.yaw = THREE.MathUtils.damp(this.combatant.yaw, desiredYaw, 10, dt);

    // Apply movement & collision
    const nextX = this.combatant.position.x + this.combatant.velocity.x * dt;
    const nextZ = this.combatant.position.z + this.combatant.velocity.z * dt;

    const col = checkCollision(nextX, nextZ, 0.45);
    if (!col.collided) {
      this.combatant.position.x = nextX;
      this.combatant.position.z = nextZ;
    } else {
      // Slide along collision normal
      this.combatant.position.x += col.normalX * 0.1;
      this.combatant.position.z += col.normalZ * 0.1;
    }
  }

  private executePlant(dt: number): void {
    this.combatant.velocity.set(0, 0, 0);
    this.combatant.actionProgress += dt / 4.0; // 4.0s to plant
  }

  private executeDefuse(dt: number): void {
    this.combatant.velocity.set(0, 0, 0);
    this.combatant.actionProgress += dt / 5.0; // 5.0s to defuse
  }

  private executeHoldAngle(dt: number): void {
    this.combatant.velocity.set(0, 0, 0);
    this.angleHoldTimer -= dt;
    if (this.angleHoldTimer <= 0) {
      this.state = 'ROAMING';
    }
  }
}
