/**
 * Hollow Strike - Tactical Abilities Simulation & Visual Effects
 * Manages active world effects: Smokes, Barriers, Flashes, Zones (Toxin, Stim, Gravity, Lockdown, Blackout, Heal), Turrets & Recon Pulses.
 */

import * as THREE from 'three';
import { soundEngine } from './audio';
import type { BotCombatant } from './botAI';

const _line = new THREE.Line3();
const _closest = new THREE.Vector3();
const _turretDir = new THREE.Vector3();

export interface ActiveSmoke {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  radius: number;
  remainingTime: number;
}

export interface ActiveBarrier {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  width: number;
  height: number;
  rotationY: number;
  hp: number;
  remainingTime: number;
}

export interface ActivePulse {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  radius: number;
  maxRadius: number;
  remainingTime: number;
  team: string;
}

export interface ActiveZone {
  type: 'TOXIN' | 'STIM' | 'GRAVITY' | 'LOCKDOWN' | 'BLACKOUT' | 'HEAL';
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  radius: number;
  remainingTime: number;
  ownerTeam: string;
  tickTimer: number;
}

export interface ActiveFlash {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  fuseTimer: number;
  ownerTeam: string;
}

export interface ActiveTurret {
  mesh: THREE.Group;
  headGroup: THREE.Group;
  position: THREE.Vector3;
  team: string;
  yaw: number;
  fireCooldown: number;
  hp: number;
  remainingTime: number;
}

export class AbilityManager {
  public smokes: ActiveSmoke[] = [];
  public barriers: ActiveBarrier[] = [];
  public pulses: ActivePulse[] = [];
  public zones: ActiveZone[] = [];
  public flashes: ActiveFlash[] = [];
  public turrets: ActiveTurret[] = [];
  public revealedEnemyIds: Map<string, number> = new Map();
  public blindedCombatantIds: Map<string, number> = new Map();
  public slowedCombatantIds: Map<string, number> = new Map();
  private scene: THREE.Scene;
  private lowDetail: boolean;

  private smokeGeo = new THREE.DodecahedronGeometry(3.6, 1);
  private smokeMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.9,
    metalness: 0.1,
    transparent: true,
    opacity: 0.88,
  });

  private barrierGeo = new THREE.BoxGeometry(5.2, 3.2, 0.45);
  private barrierMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.8,
    roughness: 0.25,
    metalness: 0.4,
    transparent: true,
    opacity: 0.82,
  });

  private pulseGeo = new THREE.RingGeometry(0.2, 0.55, 28);
  private pulseMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });

  private zoneDiskGeo = new THREE.CircleGeometry(1, 24);
  private orbGeo = new THREE.SphereGeometry(0.22, 10, 10);

  constructor(scene: THREE.Scene, lowDetail = false) {
    this.scene = scene;
    this.lowDetail = lowDetail;
  }

  public deploySmoke(x: number, y: number, z: number, duration = 14): void {
    const mesh = new THREE.Mesh(this.smokeGeo, this.smokeMat);
    mesh.position.set(x, Math.max(1.8, y), z);
    mesh.scale.set(0.1, 0.1, 0.1);
    this.scene.add(mesh);

    this.smokes.push({
      mesh,
      position: new THREE.Vector3(x, y, z),
      radius: 3.6,
      remainingTime: duration,
    });

    soundEngine.playAbility('SMOKE');
  }

  public deployBarrier(x: number, y: number, z: number, rotationY = 0, duration = 20, width = 5.2): void {
    const mesh = new THREE.Mesh(this.barrierGeo, this.barrierMat);
    mesh.position.set(x, y + 1.6, z);
    mesh.rotation.y = rotationY;
    mesh.scale.x = width / 5.2;
    mesh.castShadow = !this.lowDetail;
    mesh.receiveShadow = !this.lowDetail;
    this.scene.add(mesh);

    this.barriers.push({
      mesh,
      position: new THREE.Vector3(x, y, z),
      width,
      height: 3.2,
      rotationY,
      hp: 420,
      remainingTime: duration,
    });

    soundEngine.playAbility('WALL');
  }

  public isBlockedByBarrier(x: number, z: number, pad = 0.55): boolean {
    for (let i = 0; i < this.barriers.length; i++) {
      const b = this.barriers[i];
      const dx = x - b.position.x;
      const dz = z - b.position.z;
      const cos = Math.cos(-b.rotationY);
      const sin = Math.sin(-b.rotationY);
      const localX = dx * cos - dz * sin;
      const localZ = dx * sin + dz * cos;
      if (Math.abs(localX) < b.width * 0.5 + pad * 0.4 && Math.abs(localZ) < 0.3 + pad) {
        return true;
      }
    }
    return false;
  }

  public triggerReconPulse(
    x: number,
    y: number,
    z: number,
    team: string,
    combatants?: BotCombatant[],
    maxRadius = 26
  ): void {
    const mat = this.pulseMat.clone();
    const mesh = new THREE.Mesh(this.pulseGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.08, z);
    this.scene.add(mesh);

    this.pulses.push({
      mesh,
      position: new THREE.Vector3(x, y, z),
      radius: 0.5,
      maxRadius,
      remainingTime: 2.0,
      team,
    });

    if (combatants) {
      const pulseOrigin = this.pulses[this.pulses.length - 1].position;
      for (const c of combatants) {
        if (c.alive && c.team !== team && c.position.distanceTo(pulseOrigin) <= maxRadius + 2) {
          this.revealedEnemyIds.set(c.id, 5.5);
        }
      }
    }

    soundEngine.playAbility('HEAL');
  }

  public deployZone(
    type: ActiveZone['type'],
    x: number,
    z: number,
    radius: number,
    duration: number,
    ownerTeam: string
  ): void {
    const colorMap: Record<ActiveZone['type'], number> = {
      TOXIN: 0x22c55e,
      STIM: 0x06b6d4,
      GRAVITY: 0xa855f7,
      LOCKDOWN: 0x3b82f6,
      BLACKOUT: 0x6366f1,
      HEAL: 0x10b981,
    };

    const mat = new THREE.MeshBasicMaterial({
      color: colorMap[type],
      transparent: true,
      opacity: type === 'BLACKOUT' ? 0.35 : 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(this.zoneDiskGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.06, z);
    mesh.scale.set(radius, radius, 1);
    this.scene.add(mesh);

    this.zones.push({
      type,
      mesh,
      position: new THREE.Vector3(x, 0, z),
      radius,
      remainingTime: duration,
      ownerTeam,
      tickTimer: 0.2,
    });

    if (type === 'STIM' || type === 'HEAL') soundEngine.playAbility('HEAL');
    else if (type === 'LOCKDOWN' || type === 'BLACKOUT') soundEngine.playAbility('ULT');
    else soundEngine.playAbility('SMOKE');
  }

  public throwFlashOrb(
    startX: number,
    startY: number,
    startZ: number,
    dir: THREE.Vector3,
    ownerTeam: string
  ): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const mesh = new THREE.Mesh(this.orbGeo, mat);
    mesh.position.set(startX, startY, startZ);
    this.scene.add(mesh);

    this.flashes.push({
      mesh,
      position: mesh.position,
      velocity: dir.clone().multiplyScalar(18),
      fuseTimer: 0.42,
      ownerTeam,
    });

    soundEngine.playAbility('FLASH');
  }

  public deployTurret(x: number, z: number, yaw: number, team: string): void {
    const root = new THREE.Group();
    root.position.set(x, 0, z);

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.35, roughness: 0.4 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 1.5 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.75, 8), baseMat);
    base.position.y = 0.38;
    root.add(base);

    const headGroup = new THREE.Group();
    headGroup.position.y = 0.85;
    headGroup.rotation.y = yaw;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.48), baseMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 8), baseMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -0.35);
    const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.1), eyeMat);
    sensor.position.set(0, 0.06, -0.22);
    headGroup.add(head, barrel, sensor);
    root.add(headGroup);

    this.scene.add(root);

    this.turrets.push({
      mesh: root,
      headGroup,
      position: new THREE.Vector3(x, 0, z),
      team,
      yaw,
      fireCooldown: 0.5,
      hp: 150,
      remainingTime: 25,
    });

    soundEngine.playAbility('WALL');
  }

  public isRayOccludedBySmoke(origin: THREE.Vector3, target: THREE.Vector3): boolean {
    _line.set(origin, target);
    for (const s of this.smokes) {
      _line.closestPointToPoint(s.mesh.position, true, _closest);
      if (_closest.distanceTo(s.mesh.position) < s.radius * 0.95) {
        return true;
      }
    }
    return false;
  }

  public getBarrierMeshes(): THREE.Mesh[] {
    return this.barriers.map((b) => b.mesh);
  }

  public hasActiveStimNear(pos: THREE.Vector3, team: string): boolean {
    for (const z of this.zones) {
      if (z.type === 'STIM' && z.ownerTeam === team && pos.distanceTo(z.position) <= z.radius) {
        return true;
      }
    }
    return false;
  }

  public update(
    dt: number,
    combatants?: BotCombatant[],
    onAbilityDamage?: (target: BotCombatant, dmg: number, label: string) => void,
    onTurretFire?: (origin: THREE.Vector3, dir: THREE.Vector3, team: string) => void,
    onAllyHeal?: (target: BotCombatant, hpGain: number, armorGain: number) => void
  ): void {
    for (const [id, t] of this.revealedEnemyIds.entries()) {
      if (t - dt <= 0) this.revealedEnemyIds.delete(id);
      else this.revealedEnemyIds.set(id, t - dt);
    }
    for (const [id, t] of this.blindedCombatantIds.entries()) {
      if (t - dt <= 0) this.blindedCombatantIds.delete(id);
      else this.blindedCombatantIds.set(id, t - dt);
    }
    for (const [id, t] of this.slowedCombatantIds.entries()) {
      if (t - dt <= 0) this.slowedCombatantIds.delete(id);
      else this.slowedCombatantIds.set(id, t - dt);
    }

    // 1. Update Smokes
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.remainingTime -= dt;
      if (s.mesh.scale.x < 1.0) {
        const sc = Math.min(1.0, s.mesh.scale.x + dt * 2.5);
        s.mesh.scale.set(sc, sc, sc);
      }
      s.mesh.rotation.y += dt * 0.15;
      s.mesh.rotation.x += dt * 0.08;
      if (s.remainingTime <= 0) {
        this.scene.remove(s.mesh);
        this.smokes.splice(i, 1);
      }
    }

    // 2. Update Barriers
    for (let i = this.barriers.length - 1; i >= 0; i--) {
      const b = this.barriers[i];
      b.remainingTime -= dt;
      if (b.remainingTime <= 0 || b.hp <= 0) {
        this.scene.remove(b.mesh);
        this.barriers.splice(i, 1);
      }
    }

    // 3. Update Pulses
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      p.remainingTime -= dt;
      p.radius += dt * 16;
      const progress = p.radius / p.maxRadius;
      p.mesh.scale.set(p.radius, p.radius, 1);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - progress);
      if (p.remainingTime <= 0 || p.radius >= p.maxRadius) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.pulses.splice(i, 1);
      }
    }

    // 4. Update Flash Orbs
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.fuseTimer -= dt;
      f.position.addScaledVector(f.velocity, dt);
      f.velocity.y -= 9.8 * dt;
      if (f.fuseTimer <= 0) {
        if (combatants) {
          for (const c of combatants) {
            if (c.alive && c.team !== f.ownerTeam && c.position.distanceTo(f.position) < 12.5) {
              this.blindedCombatantIds.set(c.id, 2.8);
              this.slowedCombatantIds.set(c.id, 2.2);
            }
          }
        }
        soundEngine.playAbility('FLASH');
        this.scene.remove(f.mesh);
        (f.mesh.material as THREE.Material).dispose();
        this.flashes.splice(i, 1);
      }
    }

    // 5. Update Ground Tactical Zones
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.remainingTime -= dt;
      z.tickTimer -= dt;

      if (z.tickTimer <= 0 && combatants) {
        z.tickTimer = 0.45;
        for (const c of combatants) {
          if (!c.alive) continue;
          if (c.position.distanceTo(z.position) > z.radius) continue;

          if (z.type === 'HEAL') {
            if (c.team === z.ownerTeam) {
              onAllyHeal?.(c, 8, 5);
            }
            continue;
          }

          if (c.team === z.ownerTeam) continue;

          if (z.type === 'TOXIN') {
            onAbilityDamage?.(c, 12, 'Toxin Field');
            this.slowedCombatantIds.set(c.id, 0.7);
          } else if (z.type === 'GRAVITY') {
            onAbilityDamage?.(c, 9, 'Gravity Well');
            this.slowedCombatantIds.set(c.id, 1.0);
            _turretDir.subVectors(z.position, c.position).setY(0).normalize();
            c.position.addScaledVector(_turretDir, 0.5);
          } else if (z.type === 'LOCKDOWN') {
            this.slowedCombatantIds.set(c.id, 1.4);
          } else if (z.type === 'BLACKOUT') {
            onAbilityDamage?.(c, 7, 'Solar / Void Surge');
            this.blindedCombatantIds.set(c.id, 1.2);
            this.slowedCombatantIds.set(c.id, 1.1);
          }
        }
      }

      if (z.remainingTime <= 0) {
        this.scene.remove(z.mesh);
        (z.mesh.material as THREE.Material).dispose();
        this.zones.splice(i, 1);
      }
    }

    // 6. Update Automated Sentry Turrets
    for (let i = this.turrets.length - 1; i >= 0; i--) {
      const t = this.turrets[i];
      t.remainingTime -= dt;
      t.fireCooldown -= dt;

      if (combatants && t.fireCooldown <= 0) {
        let bestTarget: BotCombatant | null = null;
        let bestDist = 26;
        for (const c of combatants) {
          if (!c.alive || c.team === t.team) continue;
          const d = t.position.distanceTo(c.position);
          if (d < bestDist && !this.isRayOccludedBySmoke(t.position, c.position)) {
            bestDist = d;
            bestTarget = c;
          }
        }

        if (bestTarget) {
          _turretDir.set(
            bestTarget.position.x - t.position.x,
            1.15 - 0.85,
            bestTarget.position.z - t.position.z
          ).normalize();
          t.headGroup.rotation.y = Math.atan2(-_turretDir.x, -_turretDir.z);
          t.fireCooldown = 0.55;
          onTurretFire?.(_closest.set(t.position.x, 0.85, t.position.z), _turretDir, t.team);
        }
      }

      if (t.remainingTime <= 0 || t.hp <= 0) {
        this.scene.remove(t.mesh);
        this.turrets.splice(i, 1);
      }
    }
  }

  public clearAll(): void {
    for (const s of this.smokes) this.scene.remove(s.mesh);
    for (const b of this.barriers) this.scene.remove(b.mesh);
    for (const p of this.pulses) this.scene.remove(p.mesh);
    for (const z of this.zones) this.scene.remove(z.mesh);
    for (const f of this.flashes) this.scene.remove(f.mesh);
    for (const t of this.turrets) this.scene.remove(t.mesh);
    this.smokes = [];
    this.barriers = [];
    this.pulses = [];
    this.zones = [];
    this.flashes = [];
    this.turrets = [];
    this.revealedEnemyIds.clear();
    this.blindedCombatantIds.clear();
    this.slowedCombatantIds.clear();
  }

  public dispose(): void {
    this.clearAll();
    this.smokeGeo.dispose();
    this.smokeMat.dispose();
    this.barrierGeo.dispose();
    this.barrierMat.dispose();
    this.pulseGeo.dispose();
    this.pulseMat.dispose();
    this.zoneDiskGeo.dispose();
    this.orbGeo.dispose();
  }
}
