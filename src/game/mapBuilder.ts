/**
 * Hollow Strike - 3D Tactical Map Builder
 * Procedurally generates the arena with PBR materials, composite models, and site markers.
 */

import * as THREE from 'three';
import { BOMB_SITE_A, BOMB_SITE_B, MAP_COLLIDERS } from './mapData';

export interface BuiltMap {
  group: THREE.Group;
  barrierAttackers: THREE.Mesh;
  barrierDefenders: THREE.Mesh;
  siteAMarker: THREE.Mesh;
  siteBMarker: THREE.Mesh;
  collidableMeshes: THREE.Mesh[];
  dispose: () => void;
}

export function buildTacticalMap(scene: THREE.Scene): BuiltMap {
  const mapGroup = new THREE.Group();
  mapGroup.name = 'TacticalMap';
  const collidableMeshes: THREE.Mesh[] = [];

  // 1. Procedural Floor Texture (High-tech tactical grid concrete)
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 512;
  floorCanvas.height = 512;
  const ctx = floorCanvas.getContext('2d')!;
  ctx.fillStyle = '#1e2430';
  ctx.fillRect(0, 0, 512, 512);

  // Concrete speckles
  for (let i = 0; i < 4000; i++) {
    const shade = Math.floor(25 + Math.random() * 20);
    ctx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade + 10})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }

  // Tactical grid lines
  ctx.strokeStyle = 'rgba(75, 95, 125, 0.25)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= 512; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  const floorTexture = new THREE.CanvasTexture(floorCanvas);
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(16, 16);
  floorTexture.colorSpace = THREE.SRGBColorSpace;

  // Primary Floor
  const floorGeo = new THREE.PlaneGeometry(110, 110);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTexture,
    roughness: 0.85,
    metalness: 0.15,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  mapGroup.add(floor);

  // Exterior natural mountain cliffs beyond boundaries so arena never floats in void
  const cliffMat = new THREE.MeshStandardMaterial({
    color: 0x111622,
    roughness: 0.95,
    metalness: 0.05,
    flatShading: true,
  });
  const cliffGeo = new THREE.BoxGeometry(130, 24, 8);

  const cliffNorth = new THREE.Mesh(cliffGeo, cliffMat);
  cliffNorth.position.set(0, 10, -56);
  mapGroup.add(cliffNorth);

  const cliffSouth = new THREE.Mesh(cliffGeo, cliffMat);
  cliffSouth.position.set(0, 10, 56);
  mapGroup.add(cliffSouth);

  const cliffWest = new THREE.Mesh(new THREE.BoxGeometry(8, 24, 130), cliffMat);
  cliffWest.position.set(-56, 10, 0);
  mapGroup.add(cliffWest);

  const cliffEast = new THREE.Mesh(new THREE.BoxGeometry(8, 24, 130), cliffMat);
  cliffEast.position.set(56, 10, 0);
  mapGroup.add(cliffEast);

  // 2. Concrete & Metal Materials for Structures
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x242d3d,
    roughness: 0.7,
    metalness: 0.2,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9, // Cyan trim
    roughness: 0.35,
    metalness: 0.6,
  });

  const crateDarkMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.6,
    metalness: 0.4,
  });

  const crateAccentMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, // Amber hazard crate
    roughness: 0.5,
    metalness: 0.3,
  });

  // Build architectural structures from colliders
  for (const c of MAP_COLLIDERS) {
    const width = c.maxX - c.minX;
    const height = c.maxY - c.minY;
    const depth = c.maxZ - c.minZ;
    const centerX = (c.minX + c.maxX) / 2;
    const centerY = (c.minY + c.maxY) / 2;
    const centerZ = (c.minZ + c.maxZ) / 2;

    const blockGeo = new THREE.BoxGeometry(width, height, depth);
    const block = new THREE.Mesh(blockGeo, wallMat);
    block.position.set(centerX, centerY, centerZ);
    block.castShadow = true;
    block.receiveShadow = true;
    mapGroup.add(block);
    collidableMeshes.push(block);

    // Decorative top trim on taller walls
    if (height >= 5) {
      const trimGeo = new THREE.BoxGeometry(width + 0.1, 0.3, depth + 0.1);
      const trim = new THREE.Mesh(trimGeo, trimMat);
      trim.position.set(centerX, c.maxY + 0.15, centerZ);
      mapGroup.add(trim);
    }
  }

  // 3. Composite Site A: Reactor Core on Platform
  const corePlatformGeo = new THREE.BoxGeometry(8.2, 1.2, 8.2);
  const corePlatform = new THREE.Mesh(corePlatformGeo, crateDarkMat);
  corePlatform.position.set(BOMB_SITE_A.x, 0.6, BOMB_SITE_A.z);
  corePlatform.receiveShadow = true;
  mapGroup.add(corePlatform);

  // Reactor Cylinder (3-part assembly)
  const coreCylinderGeo = new THREE.CylinderGeometry(1.6, 1.8, 3.2, 16);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.2,
    metalness: 0.8,
  });
  const coreMesh = new THREE.Mesh(coreCylinderGeo, coreMat);
  coreMesh.position.set(BOMB_SITE_A.x, 2.8, BOMB_SITE_A.z);
  coreMesh.castShadow = true;
  mapGroup.add(coreMesh);

  // Glowing reactor ring
  const ringGeo = new THREE.TorusGeometry(1.9, 0.15, 8, 24);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.5,
    roughness: 0.1,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(BOMB_SITE_A.x, 2.8, BOMB_SITE_A.z);
  mapGroup.add(ring);

  // 4. Composite Site B: Tech Monoliths & Courtyard
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.4,
    metalness: 0.5,
  });
  const pillarGeo = new THREE.BoxGeometry(3, 7, 3);
  const pillar1 = new THREE.Mesh(pillarGeo, pillarMat);
  pillar1.position.set(19.5, 3.5, -20.5);
  pillar1.castShadow = true;
  mapGroup.add(pillar1);

  const pillar2 = new THREE.Mesh(pillarGeo, pillarMat);
  pillar2.position.set(26.5, 3.5, -16.5);
  pillar2.castShadow = true;
  mapGroup.add(pillar2);

  // Accent crates around Site B
  const bCrate = new THREE.Mesh(new THREE.BoxGeometry(2, 2.2, 2), crateAccentMat);
  bCrate.position.set(21, 1.1, -13);
  bCrate.castShadow = true;
  mapGroup.add(bCrate);

  // 5. Bomb Site Decal Rings on Floor
  const ringDecalGeo = new THREE.RingGeometry(BOMB_SITE_A.radius - 0.4, BOMB_SITE_A.radius, 32);
  const siteAMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6,
  });
  const siteAMarker = new THREE.Mesh(ringDecalGeo, siteAMat);
  siteAMarker.rotation.x = -Math.PI / 2;
  siteAMarker.position.set(BOMB_SITE_A.x, 0.03, BOMB_SITE_A.z);
  mapGroup.add(siteAMarker);

  const siteBMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6,
  });
  const siteBMarker = new THREE.Mesh(ringDecalGeo.clone(), siteBMat);
  siteBMarker.rotation.x = -Math.PI / 2;
  siteBMarker.position.set(BOMB_SITE_B.x, 0.03, BOMB_SITE_B.z);
  mapGroup.add(siteBMarker);

  // 6. Buy Phase Barriers (Translucent Energy Shields)
  const barrierGeo = new THREE.BoxGeometry(84, 8, 0.4);
  const barrierMatAtt = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.35,
    wireframe: true,
  });
  const barrierAttackers = new THREE.Mesh(barrierGeo, barrierMatAtt);
  barrierAttackers.position.set(0, 4, 18);
  mapGroup.add(barrierAttackers);

  const barrierMatDef = new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.35,
    wireframe: true,
  });
  const barrierDefenders = new THREE.Mesh(barrierGeo.clone(), barrierMatDef);
  barrierDefenders.position.set(0, 4, -26);
  mapGroup.add(barrierDefenders);

  scene.add(mapGroup);

  return {
    group: mapGroup,
    barrierAttackers,
    barrierDefenders,
    siteAMarker,
    siteBMarker,
    collidableMeshes,
    dispose: () => {
      scene.remove(mapGroup);
      floorTexture.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      cliffGeo.dispose();
      cliffMat.dispose();
      wallMat.dispose();
      trimMat.dispose();
      crateDarkMat.dispose();
      crateAccentMat.dispose();
      barrierGeo.dispose();
      barrierMatAtt.dispose();
      barrierMatDef.dispose();
    },
  };
}
