/**
 * Hollow Strike - Tactical Abilities Simulation & Visual Effects
 * Manages active world effects: Smokes, Barriers, Flashes, Turrets, and Recon pulses.
 */

import * as THREE from 'three';
import { soundEngine } from './audio';

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
  hp: number;
  remainingTime: number;
  colliderIndex: number;
}

export interface ActivePulse {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  radius: number;
  maxRadius: number;
  remainingTime: number;
  team: string;
}

export interface ActiveTurret {
  mesh: THREE.Group;
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
  public turrets: ActiveTurret[] = [];
  private scene: THREE.Scene;

  // Shared Geometries & Materials
  private smokeGeo = new THREE.DodecahedronGeometry(3.6, 2);
  private smokeMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.9,
    metalness: 0.1,
    transparent: true,
    opacity: 0.88,
  });

  private barrierGeo = new THREE.BoxGeometry(5.2, 3.2, 0.4);
  private barrierMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.8,
    transparent: true,
    opacity: 0.75,
  });

  private pulseGeo = new THREE.RingGeometry(0.2, 0.5, 32);
  private pulseMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  });

  constructor(scene: THREE.Scene) {
    this.scene = scene;
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

  public deployBarrier(x: number, y: number, z: number, rotationY = 0, duration = 20): void {
    const mesh = new THREE.Mesh(this.barrierGeo, this.barrierMat);
    mesh.position.set(x, y + 1.6, z);
    mesh.rotation.y = rotationY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.barriers.push({
      mesh,
      position: new THREE.Vector3(x, y, z),
      width: 5.2,
      height: 3.2,
      hp: 400,
      remainingTime: duration,
      colliderIndex: -1,
    });

    soundEngine.playAbility('WALL');
  }

  public triggerReconPulse(x: number, y: number, z: number, team: string): void {
    const mesh = new THREE.Mesh(this.pulseGeo, this.pulseMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.05, z);
    this.scene.add(mesh);

    this.pulses.push({
      mesh,
      position: new THREE.Vector3(x, y, z),
      radius: 0.5,
      maxRadius: 22,
      remainingTime: 2.5,
      team,
    });

    soundEngine.playAbility('HEAL');
  }

  public isRayOccludedBySmoke(origin: THREE.Vector3, target: THREE.Vector3): boolean {
    const line = new THREE.Line3(origin, target);
    for (const s of this.smokes) {
      const closestPoint = new THREE.Vector3();
      line.closestPointToPoint(s.mesh.position, true, closestPoint);
      if (closestPoint.distanceTo(s.mesh.position) < s.radius * 0.95) {
        return true;
      }
    }
    return false;
  }

  public update(dt: number): void {
    // 1. Update Smokes
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.remainingTime -= dt;

      // Expand to full size in first 0.4s
      if (s.mesh.scale.x < 1.0) {
        const sc = Math.min(1.0, s.mesh.scale.x + dt * 2.5);
        s.mesh.scale.set(sc, sc, sc);
      }

      // Subtle rotation for volumetric feel
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
      p.radius += dt * 14;
      const progress = p.radius / p.maxRadius;
      p.mesh.scale.set(p.radius, p.radius, 1);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - progress);

      if (p.remainingTime <= 0 || p.radius >= p.maxRadius) {
        this.scene.remove(p.mesh);
        this.pulses.splice(i, 1);
      }
    }
  }

  public clearAll(): void {
    for (const s of this.smokes) this.scene.remove(s.mesh);
    for (const b of this.barriers) this.scene.remove(b.mesh);
    for (const p of this.pulses) this.scene.remove(p.mesh);
    this.smokes = [];
    this.barriers = [];
    this.pulses = [];
  }

  public dispose(): void {
    this.clearAll();
    this.smokeGeo.dispose();
    this.smokeMat.dispose();
    this.barrierGeo.dispose();
    this.barrierMat.dispose();
    this.pulseGeo.dispose();
    this.pulseMat.dispose();
  }
}
