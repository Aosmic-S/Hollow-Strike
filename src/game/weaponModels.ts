/**
 * Hollow Strike - Procedural & GLB 3D Weapon Models & Viewmodel Rig
 */

import * as THREE from 'three';
import { loadGLBModel } from './modelLoader';

const darkMetalMat = new THREE.MeshStandardMaterial({
  color: 0x1e2430,
  roughness: 0.35,
  metalness: 0.85,
});

const polymerMat = new THREE.MeshStandardMaterial({
  color: 0x0f172a,
  roughness: 0.8,
  metalness: 0.1,
});

const accentCyanMat = new THREE.MeshStandardMaterial({
  color: 0x06b6d4,
  emissive: 0x06b6d4,
  emissiveIntensity: 0.6,
  roughness: 0.2,
  metalness: 0.6,
});

const opticLensMat = new THREE.MeshStandardMaterial({
  color: 0x38bdf8,
  emissive: 0x0284c7,
  emissiveIntensity: 0.8,
  roughness: 0.1,
  transparent: true,
  opacity: 0.7,
});

function applyGLBOrFallback(group: THREE.Group, glbPath: string, scale: number = 0.08, rotY: number = 0) {
  loadGLBModel(glbPath).then((glbGroup) => {
    if (glbGroup) {
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
      glbGroup.scale.set(scale, scale, scale);
      glbGroup.rotation.y = rotY;
      group.add(glbGroup);
    }
  });
}

/**
 * Apex-9 Sidearm -> Uses /models/sci-fi_gun.glb
 */
export function createApex9Model(): THREE.Group {
  const group = new THREE.Group();

  const slideGeo = new THREE.BoxGeometry(0.045, 0.05, 0.22);
  const slide = new THREE.Mesh(slideGeo, darkMetalMat);
  slide.position.set(0, 0.04, -0.04);
  group.add(slide);

  const frameGeo = new THREE.BoxGeometry(0.04, 0.04, 0.2);
  const frame = new THREE.Mesh(frameGeo, polymerMat);
  frame.position.set(0, 0.015, -0.04);
  group.add(frame);

  const gripGeo = new THREE.BoxGeometry(0.038, 0.11, 0.055);
  const grip = new THREE.Mesh(gripGeo, polymerMat);
  grip.rotation.x = -0.25;
  grip.position.set(0, -0.05, 0.02);
  group.add(grip);

  applyGLBOrFallback(group, '/models/sci-fi_gun.glb', 0.045, 0);

  return group;
}

/**
 * Viper-9 SMG -> Uses /models/smg.glb
 */
export function createViper9Model(): THREE.Group {
  const group = new THREE.Group();

  const receiverGeo = new THREE.BoxGeometry(0.06, 0.07, 0.32);
  const receiver = new THREE.Mesh(receiverGeo, darkMetalMat);
  receiver.position.set(0, 0.04, -0.08);
  group.add(receiver);

  const gripGeo = new THREE.BoxGeometry(0.04, 0.13, 0.06);
  const grip = new THREE.Mesh(gripGeo, polymerMat);
  grip.rotation.x = -0.2;
  grip.position.set(0, -0.06, 0.02);
  group.add(grip);

  applyGLBOrFallback(group, '/models/smg.glb', 0.08, 0);

  return group;
}

/**
 * Phantom-V Rifle -> Uses /models/carbine_rifle.glb (Increased size)
 */
export function createPhantomVModel(): THREE.Group {
  const group = new THREE.Group();

  const receiverGeo = new THREE.BoxGeometry(0.065, 0.085, 0.42);
  const receiver = new THREE.Mesh(receiverGeo, darkMetalMat);
  receiver.position.set(0, 0.04, -0.1);
  group.add(receiver);

  const gripGeo = new THREE.BoxGeometry(0.042, 0.14, 0.065);
  const grip = new THREE.Mesh(gripGeo, polymerMat);
  grip.rotation.x = -0.28;
  grip.position.set(0, -0.065, 0.04);
  group.add(grip);

  applyGLBOrFallback(group, '/models/carbine_rifle.glb', 0.13, 0);

  return group;
}

/**
 * Void-Lance Sniper -> Uses /models/free_pack_-_sci_fi_weapon.glb
 */
export function createVoidLanceModel(): THREE.Group {
  const group = new THREE.Group();

  const receiverGeo = new THREE.BoxGeometry(0.075, 0.09, 0.52);
  const receiver = new THREE.Mesh(receiverGeo, darkMetalMat);
  receiver.position.set(0, 0.04, -0.12);
  group.add(receiver);

  const stockGeo = new THREE.BoxGeometry(0.06, 0.11, 0.3);
  const stock = new THREE.Mesh(stockGeo, polymerMat);
  stock.position.set(0, 0.01, 0.24);
  group.add(stock);

  applyGLBOrFallback(group, '/models/free_pack_-_sci_fi_weapon.glb', 0.09, 0);

  return group;
}

/**
 * Creates 3D model for the Tactical Spike Core
 */
export function createSpikeModel(): THREE.Group {
  const group = new THREE.Group();

  const baseGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.15, 16);
  const base = new THREE.Mesh(baseGeo, darkMetalMat);
  base.position.y = 0.075;
  group.add(base);

  const coreGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.35, 16);
  const core = new THREE.Mesh(coreGeo, polymerMat);
  core.position.y = 0.3;
  group.add(core);

  const lightGeo = new THREE.TorusGeometry(0.2, 0.03, 8, 24);
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 2.0,
  });
  const light = new THREE.Mesh(lightGeo, lightMat);
  light.rotation.x = Math.PI / 2;
  light.position.y = 0.35;
  light.name = 'spike_light';
  group.add(light);

  return group;
}
