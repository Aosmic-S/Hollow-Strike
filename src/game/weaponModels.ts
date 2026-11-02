/**
 * Hollow Strike - Procedural 3D Weapon Models & Viewmodel Rig
 * 100% procedural low-poly geometry composed of 3-8 distinct parts per weapon.
 */

import * as THREE from 'three';

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

/**
 * Creates 3D model for the Apex-9 Sidearm
 */
export function createApex9Model(): THREE.Group {
  const group = new THREE.Group();

  // Slide
  const slideGeo = new THREE.BoxGeometry(0.045, 0.05, 0.22);
  const slide = new THREE.Mesh(slideGeo, darkMetalMat);
  slide.position.set(0, 0.04, -0.04);
  group.add(slide);

  // Frame & Barrel
  const frameGeo = new THREE.BoxGeometry(0.04, 0.04, 0.2);
  const frame = new THREE.Mesh(frameGeo, polymerMat);
  frame.position.set(0, 0.015, -0.04);
  group.add(frame);

  // Grip
  const gripGeo = new THREE.BoxGeometry(0.038, 0.11, 0.055);
  const grip = new THREE.Mesh(gripGeo, polymerMat);
  grip.rotation.x = -0.25;
  grip.position.set(0, -0.05, 0.02);
  group.add(grip);

  // Sights
  const sightGeo = new THREE.BoxGeometry(0.01, 0.012, 0.015);
  const frontSight = new THREE.Mesh(sightGeo, accentCyanMat);
  frontSight.position.set(0, 0.07, -0.14);
  group.add(frontSight);

  return group;
}

/**
 * Creates 3D model for the Viper-9 SMG
 */
export function createViper9Model(): THREE.Group {
  const group = new THREE.Group();

  // Receiver
  const receiverGeo = new THREE.BoxGeometry(0.06, 0.07, 0.32);
  const receiver = new THREE.Mesh(receiverGeo, darkMetalMat);
  receiver.position.set(0, 0.04, -0.08);
  group.add(receiver);

  // Suppressor Barrel
  const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.14, 12);
  const barrel = new THREE.Mesh(barrelGeo, darkMetalMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.04, -0.3);
  group.add(barrel);

  // Grip
  const gripGeo = new THREE.BoxGeometry(0.04, 0.13, 0.06);
  const grip = new THREE.Mesh(gripGeo, polymerMat);
  grip.rotation.x = -0.2;
  grip.position.set(0, -0.06, 0.02);
  group.add(grip);

  // Extended Curved Magazine
  const magGeo = new THREE.BoxGeometry(0.035, 0.16, 0.05);
  const mag = new THREE.Mesh(magGeo, polymerMat);
  mag.rotation.x = 0.15;
  mag.position.set(0, -0.08, -0.1);
  group.add(mag);

  // Compact Stock
  const stockGeo = new THREE.BoxGeometry(0.045, 0.06, 0.15);
  const stock = new THREE.Mesh(stockGeo, polymerMat);
  stock.position.set(0, 0.02, 0.14);
  group.add(stock);

  // Holographic Optic
  const opticGeo = new THREE.BoxGeometry(0.04, 0.035, 0.06);
  const optic = new THREE.Mesh(opticGeo, darkMetalMat);
  optic.position.set(0, 0.09, -0.08);
  group.add(optic);

  const lensGeo = new THREE.PlaneGeometry(0.025, 0.02);
  const lens = new THREE.Mesh(lensGeo, opticLensMat);
  lens.position.set(0, 0.09, -0.05);
  group.add(lens);

  return group;
}

/**
 * Creates 3D model for the Phantom-V Rifle
 */
export function createPhantomVModel(): THREE.Group {
  const group = new THREE.Group();

  // Main Receiver
  const receiverGeo = new THREE.BoxGeometry(0.065, 0.085, 0.42);
  const receiver = new THREE.Mesh(receiverGeo, darkMetalMat);
  receiver.position.set(0, 0.04, -0.1);
  group.add(receiver);

  // Long Shrouded Barrel
  const barrelGeo = new THREE.CylinderGeometry(0.016, 0.018, 0.28, 12);
  const barrel = new THREE.Mesh(barrelGeo, darkMetalMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.045, -0.42);
  group.add(barrel);

  // Muzzle Brake
  const muzzleGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.06, 8);
  const muzzle = new THREE.Mesh(muzzleGeo, polymerMat);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0.045, -0.58);
  group.add(muzzle);

  // Pistol Grip
  const gripGeo = new THREE.BoxGeometry(0.042, 0.14, 0.065);
  const grip = new THREE.Mesh(gripGeo, polymerMat);
  grip.rotation.x = -0.28;
  grip.position.set(0, -0.065, 0.04);
  group.add(grip);

  // Curved 30-round Magazine
  const magGeo = new THREE.BoxGeometry(0.04, 0.2, 0.065);
  const mag = new THREE.Mesh(magGeo, polymerMat);
  mag.rotation.x = 0.22;
  mag.position.set(0, -0.09, -0.12);
  group.add(mag);

  // Tactical Polymer Stock
  const stockGeo = new THREE.BoxGeometry(0.05, 0.09, 0.22);
  const stock = new THREE.Mesh(stockGeo, polymerMat);
  stock.position.set(0, 0.02, 0.18);
  group.add(stock);

  // Red Dot Reflex Optic
  const sightBase = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 0.07), darkMetalMat);
  sightBase.position.set(0, 0.1, -0.08);
  group.add(sightBase);

  const reflexLens = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.025), opticLensMat);
  reflexLens.position.set(0, 0.1, -0.045);
  group.add(reflexLens);

  // Cyan Accent Trim
  const trimGeo = new THREE.BoxGeometry(0.068, 0.015, 0.25);
  const trim = new THREE.Mesh(trimGeo, accentCyanMat);
  trim.position.set(0, 0.05, -0.15);
  group.add(trim);

  return group;
}

/**
 * Creates 3D model for the Void-Lance Sniper
 */
export function createVoidLanceModel(): THREE.Group {
  const group = new THREE.Group();

  // Heavy Receiver
  const receiverGeo = new THREE.BoxGeometry(0.075, 0.09, 0.52);
  const receiver = new THREE.Mesh(receiverGeo, darkMetalMat);
  receiver.position.set(0, 0.04, -0.12);
  group.add(receiver);

  // Massive Fluted Barrel
  const barrelGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.55, 12);
  const barrel = new THREE.Mesh(barrelGeo, darkMetalMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.045, -0.62);
  group.add(barrel);

  // High Caliber Muzzle Compensator
  const brakeGeo = new THREE.BoxGeometry(0.05, 0.04, 0.08);
  const brake = new THREE.Mesh(brakeGeo, polymerMat);
  brake.position.set(0, 0.045, -0.92);
  group.add(brake);

  // Heavy Thumbhole Stock
  const stockGeo = new THREE.BoxGeometry(0.06, 0.11, 0.3);
  const stock = new THREE.Mesh(stockGeo, polymerMat);
  stock.position.set(0, 0.01, 0.24);
  group.add(stock);

  // Large Telescopic Sniper Scope
  const scopeTubeGeo = new THREE.CylinderGeometry(0.028, 0.032, 0.26, 16);
  const scopeTube = new THREE.Mesh(scopeTubeGeo, darkMetalMat);
  scopeTube.rotation.x = Math.PI / 2;
  scopeTube.position.set(0, 0.12, -0.12);
  group.add(scopeTube);

  const scopeEyeLens = new THREE.Mesh(new THREE.CircleGeometry(0.026, 16), opticLensMat);
  scopeEyeLens.position.set(0, 0.12, 0.01);
  group.add(scopeEyeLens);

  // Bipod Accent (folded forward)
  const bipodGeo = new THREE.BoxGeometry(0.08, 0.03, 0.12);
  const bipod = new THREE.Mesh(bipodGeo, darkMetalMat);
  bipod.position.set(0, -0.01, -0.42);
  group.add(bipod);

  return group;
}

/**
 * Creates 3D model for the Tactical Spike Core
 */
export function createSpikeModel(): THREE.Group {
  const group = new THREE.Group();

  // Cylindrical base
  const baseGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.15, 16);
  const base = new THREE.Mesh(baseGeo, darkMetalMat);
  base.position.y = 0.075;
  group.add(base);

  // Core housing
  const coreGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.35, 16);
  const core = new THREE.Mesh(coreGeo, polymerMat);
  core.position.y = 0.3;
  group.add(core);

  // Glowing status reactor ring
  const lightGeo = new THREE.TorusGeometry(0.2, 0.03, 8, 24);
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444, // Red armed
    emissive: 0xef4444,
    emissiveIntensity: 2.0,
  });
  const light = new THREE.Mesh(lightGeo, lightMat);
  light.rotation.x = Math.PI / 2;
  light.position.y = 0.35;
  light.name = 'spike_light';
  group.add(light);

  // Top antennae spike
  const pinGeo = new THREE.CylinderGeometry(0.02, 0.04, 0.2, 8);
  const pin = new THREE.Mesh(pinGeo, darkMetalMat);
  pin.position.y = 0.55;
  group.add(pin);

  return group;
}
