/**
 * Hollow Strike - 3D Tactical Map Builder
 * Integrates japan_map.glb environment, sci-fi pack supply props, solid low cover,
 * and invisible tactical boundary raycast colliders without obstructing the Japanese architecture.
 */

import * as THREE from 'three';
import { BOMB_SITE_A, BOMB_SITE_B, MAP_COLLIDERS } from './mapData';
import { loadGLBModel, loadGLBSubNode } from './modelLoader';

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

  // 1. Subtle Fallback Ground Plate below japan_map street level (y = -0.18 prevents Z-fighting)
  const floorGeo = new THREE.PlaneGeometry(240, 240);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x18202c,
    roughness: 0.9,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.18;
  floor.receiveShadow = true;
  mapGroup.add(floor);

  // 2. Materials for Colliders & Tactical Cover
  // Invisible solid bullet/camera blocker for perimeter/high colliders (never hides real Japan architecture!)
  const invisibleColliderMat = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  });

  const crateDarkMat = new THREE.MeshStandardMaterial({
    color: 0x263040,
    roughness: 0.65,
    metalness: 0.35,
  });

  const crateAccentMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.5,
    metalness: 0.25,
  });

  // Build collidable volumes: outer/tall walls stay invisible so Japan buildings dominate the view,
  // while waist-high cover & site platforms render as clean solid tactical crates/structures.
  for (const c of MAP_COLLIDERS) {
    const width = c.maxX - c.minX;
    const height = c.maxY - c.minY;
    const depth = c.maxZ - c.minZ;
    const centerX = (c.minX + c.maxX) / 2;
    const centerY = (c.minY + c.maxY) / 2;
    const centerZ = (c.minZ + c.maxZ) / 2;

    const isInvisibleBoundary =
      height >= 4.2 || Math.abs(centerX) >= 41 || Math.abs(centerZ) >= 43;

    const blockGeo = new THREE.BoxGeometry(width, height, depth);
    const mat = isInvisibleBoundary ? invisibleColliderMat : crateDarkMat;
    const block = new THREE.Mesh(blockGeo, mat);
    block.position.set(centerX, centerY, centerZ);
    if (!isInvisibleBoundary) {
      block.castShadow = true;
      block.receiveShadow = true;
    }
    mapGroup.add(block);
    collidableMeshes.push(block);
  }

  // 3. Site A & Site B Tactical Anchors + Sci-Fi Supply Chests
  const coreCylinderGeo = new THREE.CylinderGeometry(1.3, 1.5, 2.8, 16);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.25,
    metalness: 0.8,
  });
  const coreMesh = new THREE.Mesh(coreCylinderGeo, coreMat);
  coreMesh.position.set(BOMB_SITE_A.x, 2.6, BOMB_SITE_A.z);
  coreMesh.castShadow = true;
  mapGroup.add(coreMesh);

  const ringGeo = new THREE.TorusGeometry(1.6, 0.12, 8, 24);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.4,
    roughness: 0.1,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(BOMB_SITE_A.x, 2.6, BOMB_SITE_A.z);
  mapGroup.add(ring);

  const bCrate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), crateAccentMat);
  bCrate.position.set(21, 0.9, -13);
  bCrate.castShadow = true;
  bCrate.receiveShadow = true;
  mapGroup.add(bCrate);

  // Add Sci-Fi Supply Chests from free_pack_-_sci_fi_weapon.glb onto Site A & Site B
  loadGLBSubNode('/models/free_pack_-_sci_fi_weapon.glb', 'SM_Sci_FiWeapon_Chest').then((chestTemplate) => {
    if (!chestTemplate) return;
    const box = new THREE.Box3().setFromObject(chestTemplate);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 1.6 / Math.max(0.01, size.x);

    const placeChest = (x: number, y: number, z: number, rotY: number) => {
      const wrapper = new THREE.Group();
      const clone = chestTemplate.clone(true);
      clone.position.set(-center.x, -box.min.y, -center.z);
      wrapper.add(clone);
      wrapper.scale.setScalar(scale);
      wrapper.position.set(x, y, z);
      wrapper.rotation.y = rotY;
      mapGroup.add(wrapper);
    };

    placeChest(BOMB_SITE_A.x + 2.8, 1.2, BOMB_SITE_A.z + 2.2, 0.4);
    placeChest(BOMB_SITE_B.x - 2.6, 0, BOMB_SITE_B.z - 2.4, -0.5);
  });

  // 4. Bomb Site Decal Rings on Floor
  const ringDecalGeo = new THREE.RingGeometry(BOMB_SITE_A.radius - 0.35, BOMB_SITE_A.radius, 32);
  const siteAMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.65,
  });
  const siteAMarker = new THREE.Mesh(ringDecalGeo, siteAMat);
  siteAMarker.rotation.x = -Math.PI / 2;
  siteAMarker.position.set(BOMB_SITE_A.x, 0.04, BOMB_SITE_A.z);
  mapGroup.add(siteAMarker);

  const siteBMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.65,
  });
  const siteBMarker = new THREE.Mesh(ringDecalGeo.clone(), siteBMat);
  siteBMarker.rotation.x = -Math.PI / 2;
  siteBMarker.position.set(BOMB_SITE_B.x, 0.04, BOMB_SITE_B.z);
  mapGroup.add(siteBMarker);

  // 5. Buy Phase Energy Barriers
  const barrierGeo = new THREE.BoxGeometry(84, 5.5, 0.25);
  const barrierMatAtt = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const barrierAttackers = new THREE.Mesh(barrierGeo, barrierMatAtt);
  barrierAttackers.position.set(0, 2.75, 18);
  mapGroup.add(barrierAttackers);

  const barrierMatDef = new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const barrierDefenders = new THREE.Mesh(barrierGeo.clone(), barrierMatDef);
  barrierDefenders.position.set(0, 2.75, -26);
  mapGroup.add(barrierDefenders);

  // 6. Load Japan City Street Map GLB centered onto tactical arena
  // Raw japan_map coordinates place House1/House2 plaza around X=8250, Y=50, Z=-900.
  // Scaling by 0.016 puts street floor cleanly at Y=0 and Japanese buildings tightly framing the 88m arena!
  loadGLBModel('/models/japan_map.glb').then((mapModel) => {
    if (!mapModel) return;

    const toRemove: THREE.Object3D[] = [];
    mapModel.traverse((obj) => {
      // Strip exported Blender camera and tilted sky plane card
      if (obj.name === 'Camera' || obj.name === 'Object_21' || obj.name === 'Plane.023') {
        toRemove.push(obj);
        return;
      }
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.name.includes('House')) {
          collidableMeshes.push(mesh);
        }
      }
    });
    toRemove.forEach((o) => o.parent?.remove(o));

    const mapScale = 0.016;
    mapModel.scale.setScalar(mapScale);
    mapModel.position.set(-8250 * mapScale, -50 * mapScale, -(-900) * mapScale);
    mapGroup.add(mapModel);
  });

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
      floorGeo.dispose();
      floorMat.dispose();
      invisibleColliderMat.dispose();
      crateDarkMat.dispose();
      crateAccentMat.dispose();
      coreCylinderGeo.dispose();
      coreMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      ringDecalGeo.dispose();
      siteAMat.dispose();
      siteBMat.dispose();
      barrierGeo.dispose();
      barrierMatAtt.dispose();
      barrierMatDef.dispose();
    },
  };
}
