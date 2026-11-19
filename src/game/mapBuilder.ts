/**
 * Hollow Strike - 3D Tactical Map Builder
 * Renders opaque japan_map.glb architecture (disabling accidental GLB BLEND transparency),
 * solid Valorant-styled tactical cover crates with coral trim, and zero invisible interior barriers.
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

  // 1. Sub-grade courtyard asphalt floor at y = -0.02 cleanly hides open undersides below Y = 0
  const floorGeo = new THREE.PlaneGeometry(240, 240);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1c2633,
    roughness: 0.9,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  floor.receiveShadow = true;
  mapGroup.add(floor);

  // 2. Materials for Visible Perimeter Bounds & Tactical Cover
  const perimeterWallMat = new THREE.MeshStandardMaterial({
    color: 0x162230,
    roughness: 0.8,
    metalness: 0.25,
  });

  const crateDarkMat = new THREE.MeshStandardMaterial({
    color: 0x1f2b38,
    roughness: 0.65,
    metalness: 0.3,
  });

  const crateTrimMat = new THREE.MeshStandardMaterial({
    color: 0xff4655,
    roughness: 0.4,
    metalness: 0.35,
  });

  const crateAccentMat = new THREE.MeshStandardMaterial({
    color: 0x17e5b8,
    roughness: 0.45,
    metalness: 0.3,
  });

  // Build visible solids for every collider in MAP_COLLIDERS (zero invisible interior barriers!)
  const trimGeos: THREE.BufferGeometry[] = [];
  for (const c of MAP_COLLIDERS) {
    const width = c.maxX - c.minX;
    const height = c.maxY - c.minY;
    const depth = c.maxZ - c.minZ;
    const centerX = (c.minX + c.maxX) / 2;
    const centerY = (c.minY + c.maxY) / 2;
    const centerZ = (c.minZ + c.maxZ) / 2;

    const isOuterPerimeter = Math.abs(centerX) >= 42 || Math.abs(centerZ) >= 44;

    const blockGeo = new THREE.BoxGeometry(width, height, depth);
    const block = new THREE.Mesh(blockGeo, isOuterPerimeter ? perimeterWallMat : crateDarkMat);
    block.position.set(centerX, centerY, centerZ);
    block.castShadow = true;
    block.receiveShadow = true;
    mapGroup.add(block);
    collidableMeshes.push(block);

    // Add sleek coral Valorant tactical top trim to interior cover blocks (except ground platform)
    if (!isOuterPerimeter && height >= 1.2) {
      const capGeo = new THREE.BoxGeometry(width + 0.04, 0.08, depth + 0.04);
      trimGeos.push(capGeo);
      const cap = new THREE.Mesh(capGeo, crateTrimMat);
      cap.position.set(centerX, c.maxY - 0.04, centerZ);
      mapGroup.add(cap);
    }
  }

  // 3. Site A & Site B Tactical Anchors + Sci-Fi Supply Chests
  const coreCylinderGeo = new THREE.CylinderGeometry(1.3, 1.5, 2.6, 16);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x0f1923,
    roughness: 0.25,
    metalness: 0.8,
  });
  const coreMesh = new THREE.Mesh(coreCylinderGeo, coreMat);
  coreMesh.position.set(BOMB_SITE_A.x, 2.4, BOMB_SITE_A.z);
  coreMesh.castShadow = true;
  mapGroup.add(coreMesh);

  const ringGeo = new THREE.TorusGeometry(1.6, 0.12, 8, 24);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x17e5b8,
    emissive: 0x17e5b8,
    emissiveIntensity: 1.4,
    roughness: 0.1,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(BOMB_SITE_A.x, 2.4, BOMB_SITE_A.z);
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

    placeChest(BOMB_SITE_A.x + 2.8, 1.1, BOMB_SITE_A.z + 2.2, 0.4);
    placeChest(BOMB_SITE_B.x - 2.6, 0, BOMB_SITE_B.z - 2.4, -0.5);
  });

  // 4. Bomb Site Decal Rings on Floor
  const ringDecalGeo = new THREE.RingGeometry(BOMB_SITE_A.radius - 0.35, BOMB_SITE_A.radius, 32);
  const siteAMat = new THREE.MeshBasicMaterial({
    color: 0x17e5b8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.72,
  });
  const siteAMarker = new THREE.Mesh(ringDecalGeo, siteAMat);
  siteAMarker.rotation.x = -Math.PI / 2;
  siteAMarker.position.set(BOMB_SITE_A.x, 0.04, BOMB_SITE_A.z);
  mapGroup.add(siteAMarker);

  const siteBMat = new THREE.MeshBasicMaterial({
    color: 0xff4655,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.72,
  });
  const siteBMarker = new THREE.Mesh(ringDecalGeo.clone(), siteBMat);
  siteBMarker.rotation.x = -Math.PI / 2;
  siteBMarker.position.set(BOMB_SITE_B.x, 0.04, BOMB_SITE_B.z);
  mapGroup.add(siteBMarker);

  // 5. Buy Phase Energy Barriers (hidden immediately once Buy Phase ends / Practice starts)
  const barrierGeo = new THREE.BoxGeometry(84, 5.5, 0.25);
  const barrierMatAtt = new THREE.MeshBasicMaterial({
    color: 0xff4655,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const barrierAttackers = new THREE.Mesh(barrierGeo, barrierMatAtt);
  barrierAttackers.position.set(0, 2.75, 18);
  mapGroup.add(barrierAttackers);

  const barrierMatDef = new THREE.MeshBasicMaterial({
    color: 0x17e5b8,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const barrierDefenders = new THREE.Mesh(barrierGeo.clone(), barrierMatDef);
  barrierDefenders.position.set(0, 2.75, -26);
  mapGroup.add(barrierDefenders);

  // 6. Load Japan City Street Map GLB centered flush at street ground Y = 0
  // IMPORTANT: Fix exported BLEND transparency on 'japan_map' material so walls/buildings render 100% solid
  // while foliage alpha cutouts clip cleanly with alphaTest = 0.45 and depthWrite = true.
  loadGLBModel('/models/japan_map.glb').then((mapModel) => {
    if (!mapModel) return;

    const toRemove: THREE.Object3D[] = [];
    mapModel.traverse((obj) => {
      if (obj.name === 'Camera' || obj.name === 'Object_21' || obj.name === 'Plane.023') {
        toRemove.push(obj);
        return;
      }
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        const isGroundSurface =
          mesh.name.includes('Ground') ||
          mesh.name.includes('concrete') ||
          mesh.name.includes('border') ||
          mesh.name.includes('rubble');
        mesh.castShadow = !isGroundSurface;
        mesh.receiveShadow = true;

        const rawMat = mesh.material;
        const mats = Array.isArray(rawMat) ? rawMat : [rawMat];
        mats.forEach((m) => {
          if (!m) return;
          m.transparent = false;
          m.opacity = 1.0;
          m.alphaTest = 0.45;
          m.depthWrite = true;
          m.depthTest = true;
          m.side = THREE.DoubleSide;
          m.needsUpdate = true;
        });

        // Allow weapon fire & target queries to collide against Japanese architectural structures
        if (!mesh.name.includes('Ground') && !mesh.name.includes('Plane') && !mesh.name.includes('concrete')) {
          collidableMeshes.push(mesh);
        }
      }
    });
    toRemove.forEach((o) => o.parent?.remove(o));

    const mapScale = 0.016;
    mapModel.scale.setScalar(mapScale);
    // Shift Y by -0.80 so raised courtyard pavement (0.80m in model) aligns flush at Y = 0.00 with bots, feet & site markers
    mapModel.position.set(-8250 * mapScale, -0.8, -(-900) * mapScale);
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
      perimeterWallMat.dispose();
      crateDarkMat.dispose();
      crateTrimMat.dispose();
      crateAccentMat.dispose();
      trimGeos.forEach((g) => g.dispose());
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
