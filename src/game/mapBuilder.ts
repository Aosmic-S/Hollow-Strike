/**
 * Hollow Strike - 3D Tactical Map Builder
 * Renders opaque 3D map geometry (custom /models/Map/*.glb or /models/japan_map.glb),
 * extracts solid wall AABBs via triangle-plane slicing so players/bots cannot walk through walls,
 * and pushes extracted walls to mapData so 2D Minimap & Tactical Map stay synced in real time.
 */

import * as THREE from 'three';
import {
  BOMB_SITE_A,
  BOMB_SITE_B,
  MAP_COLLIDERS,
  SPAWN_ATTACKERS,
  SPAWN_DEFENDERS,
  setExtractedMapColliders,
} from './mapData';
import { loadGLBModel, loadGLBSubNode } from './modelLoader';
import { extractGridWallAABBs } from './rules';

export interface BuiltMap {
  group: THREE.Group;
  barrierAttackers: THREE.Mesh;
  barrierDefenders: THREE.Mesh;
  siteAMarker: THREE.Mesh;
  siteBMarker: THREE.Mesh;
  collidableMeshes: THREE.Mesh[];
  dispose: () => void;
}

function isGroundOrBackdropMesh(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes('floor') ||
    n.includes('terrain') ||
    n.includes('marker') ||
    n.includes('ground') ||
    n.includes('concrete') ||
    n.includes('border') ||
    n.includes('rubble') ||
    n.includes('background') ||
    n.includes('sky') ||
    n.includes('plane')
  );
}

/**
 * Slices structural meshes at horizontal player torso planes (y = 0.85, 1.35, 1.85)
 * and marks a 1.0m occupancy grid to extract tight, exact solid wall colliders.
 */
function extractWallCollidersFromObject(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);

  const minWorldX = -62;
  const maxWorldX = 62;
  const minWorldZ = -62;
  const maxWorldZ = 62;
  const cellSize = 1.0;
  const cols = Math.round((maxWorldX - minWorldX) / cellSize);
  const rows = Math.round((maxWorldZ - minWorldZ) / cellSize);

  const occupied: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const sliceHeights = [0.85, 1.35, 1.85];

  const markCell = (wx: number, wz: number) => {
    const gx = Math.floor((wx - minWorldX) / cellSize);
    const gz = Math.floor((wz - minWorldZ) / cellSize);
    if (gx >= 0 && gx < cols && gz >= 0 && gz < rows) {
      occupied[gz][gx] = true;
    }
  };

  const rasterizeSegment = (ax: number, az: number, bx: number, bz: number) => {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.min(80, Math.ceil(dist / 0.4)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      markCell(ax + (bx - ax) * t, az + (bz - az) * t);
    }
  };

  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const pts: Array<[number, number]> = [];

  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    if (isGroundOrBackdropMesh(mesh.name)) return;

    const geom = mesh.geometry;
    if (!geom) return;
    const posAttr = geom.getAttribute('position');
    if (!posAttr) return;

    const mat = mesh.matrixWorld;
    const index = geom.getIndex();
    const triCount = index ? Math.floor(index.count / 3) : Math.floor(posAttr.count / 3);

    for (let t = 0; t < triCount; t++) {
      const i0 = index ? index.getX(t * 3) : t * 3;
      const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;

      va.fromBufferAttribute(posAttr, i0).applyMatrix4(mat);
      vb.fromBufferAttribute(posAttr, i1).applyMatrix4(mat);
      vc.fromBufferAttribute(posAttr, i2).applyMatrix4(mat);

      const triMinY = Math.min(va.y, vb.y, vc.y);
      const triMaxY = Math.max(va.y, vb.y, vc.y);
      if (triMaxY < 0.75 || triMinY > 2.3) continue;

      for (let hIdx = 0; hIdx < sliceHeights.length; hIdx++) {
        const yPlane = sliceHeights[hIdx];
        if (yPlane < triMinY || yPlane > triMaxY) continue;

        pts.length = 0;
        const pairs: Array<[THREE.Vector3, THREE.Vector3]> = [
          [va, vb],
          [vb, vc],
          [vc, va],
        ];
        for (let p = 0; p < 3; p++) {
          const p0 = pairs[p][0];
          const p1 = pairs[p][1];
          const dy0 = p0.y - yPlane;
          const dy1 = p1.y - yPlane;
          if ((dy0 <= 0 && dy1 >= 0) || (dy0 >= 0 && dy1 <= 0)) {
            const denom = p1.y - p0.y;
            if (Math.abs(denom) > 1e-5) {
              const frac = (yPlane - p0.y) / denom;
              if (frac >= -0.001 && frac <= 1.001) {
                pts.push([p0.x + (p1.x - p0.x) * frac, p0.z + (p1.z - p0.z) * frac]);
              }
            }
          }
        }

        if (pts.length >= 2) {
          rasterizeSegment(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
        }
      }
    }
  });

  // Clear safety discs around Attacker/Defender Spawns and Bomb Sites so players never spawn inside geometry
  const clearDiscs = [
    { x: SPAWN_ATTACKERS.x, z: SPAWN_ATTACKERS.z, r: 5.2 },
    { x: SPAWN_DEFENDERS.x, z: SPAWN_DEFENDERS.z, r: 5.2 },
    { x: BOMB_SITE_A.x, z: BOMB_SITE_A.z, r: 4.5 },
    { x: BOMB_SITE_B.x, z: BOMB_SITE_B.z, r: 4.5 },
  ];

  for (let gz = 0; gz < rows; gz++) {
    const wz = minWorldZ + (gz + 0.5) * cellSize;
    for (let gx = 0; gx < cols; gx++) {
      if (!occupied[gz][gx]) continue;
      const wx = minWorldX + (gx + 0.5) * cellSize;
      for (const disc of clearDiscs) {
        if ((wx - disc.x) * (wx - disc.x) + (wz - disc.z) * (wz - disc.z) < disc.r * disc.r) {
          occupied[gz][gx] = false;
          break;
        }
      }
    }
  }

  const wallBoxes = extractGridWallAABBs(occupied, minWorldX, minWorldZ, cellSize, 0, 4.5);
  setExtractedMapColliders(wallBoxes);
}

async function resolveActiveMapUrl(): Promise<{ url: string; isCustom: boolean }> {
  try {
    const res = await fetch('/api/maps');
    if (res.ok) {
      const data = (await res.json()) as { activeMap?: string; customMaps?: string[]; isCustom?: boolean };
      if (data.activeMap) {
        return {
          url: data.activeMap,
          isCustom: Boolean(
            data.isCustom ||
              (data.customMaps && data.customMaps.length > 0) ||
              data.activeMap.includes('/models/Map/') ||
              data.activeMap.includes('/api/maps/')
          ),
        };
      }
      if (data.customMaps && data.customMaps.length > 0) {
        return { url: `/models/Map/${data.customMaps[0]}`, isCustom: true };
      }
    }
  } catch {
    // Fallback to server active map route or local asset
  }
  return { url: '/api/maps/active.glb', isCustom: true };
}

export function buildTacticalMap(scene: THREE.Scene): BuiltMap {
  const mapGroup = new THREE.Group();
  mapGroup.name = 'TacticalMap';
  const collidableMeshes: THREE.Mesh[] = [];
  setExtractedMapColliders([]);

  // 1. Sub-grade courtyard asphalt floor at y = -0.04 hides open undersides below Y = 0
  const floorGeo = new THREE.PlaneGeometry(260, 260);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x16202c,
    roughness: 0.9,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.04;
  floor.receiveShadow = true;
  mapGroup.add(floor);

  // 2. Safety Outer Perimeter Walls
  const perimeterWallMat = new THREE.MeshStandardMaterial({
    color: 0x162230,
    roughness: 0.8,
    metalness: 0.25,
  });

  for (const c of MAP_COLLIDERS) {
    const width = c.maxX - c.minX;
    const height = c.maxY - c.minY;
    const depth = c.maxZ - c.minZ;
    const centerX = (c.minX + c.maxX) / 2;
    const centerY = (c.minY + c.maxY) / 2;
    const centerZ = (c.minZ + c.maxZ) / 2;

    const blockGeo = new THREE.BoxGeometry(width, height, depth);
    const block = new THREE.Mesh(blockGeo, perimeterWallMat);
    block.position.set(centerX, centerY, centerZ);
    block.castShadow = true;
    block.receiveShadow = true;
    mapGroup.add(block);
    collidableMeshes.push(block);
  }

  // 3. Bomb Site Decal Rings seated accurately on Site A & Site B pads
  const ringDecalGeo = new THREE.RingGeometry(BOMB_SITE_A.radius - 0.35, BOMB_SITE_A.radius, 36);
  const siteAMat = new THREE.MeshBasicMaterial({
    color: 0x17e5b8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.72,
  });
  const siteAMarker = new THREE.Mesh(ringDecalGeo, siteAMat);
  siteAMarker.rotation.x = -Math.PI / 2;
  siteAMarker.position.set(BOMB_SITE_A.x, 0.09, BOMB_SITE_A.z);
  mapGroup.add(siteAMarker);

  const siteBMat = new THREE.MeshBasicMaterial({
    color: 0xff4655,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.72,
  });
  const siteBMarker = new THREE.Mesh(ringDecalGeo.clone(), siteBMat);
  siteBMarker.rotation.x = -Math.PI / 2;
  siteBMarker.position.set(BOMB_SITE_B.x, 0.09, BOMB_SITE_B.z);
  mapGroup.add(siteBMarker);

  // 4. Buy Phase Energy Barriers positioned in front of Attacker Spawn (z=25.5) & Defender Mid/Site setup (z=-10.5)
  const barrierGeo = new THREE.PlaneGeometry(76, 2.4);
  const barrierRailGeo = new THREE.BoxGeometry(76, 0.05, 0.05);
  const barrierMatAtt = new THREE.MeshBasicMaterial({
    color: 0xff4655,
    transparent: true,
    opacity: 0.11,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const barrierRailMatAtt = new THREE.MeshBasicMaterial({
    color: 0xff4655,
    transparent: true,
    opacity: 0.65,
  });
  const barrierAttackers = new THREE.Mesh(barrierGeo, barrierMatAtt);
  barrierAttackers.position.set(0, 1.2, 25.5);
  const attRail = new THREE.Mesh(barrierRailGeo, barrierRailMatAtt);
  attRail.position.set(0, 1.2, 0);
  barrierAttackers.add(attRail);
  mapGroup.add(barrierAttackers);

  const barrierMatDef = new THREE.MeshBasicMaterial({
    color: 0x17e5b8,
    transparent: true,
    opacity: 0.11,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const barrierRailMatDef = new THREE.MeshBasicMaterial({
    color: 0x17e5b8,
    transparent: true,
    opacity: 0.65,
  });
  const barrierDefenders = new THREE.Mesh(barrierGeo.clone(), barrierMatDef);
  barrierDefenders.position.set(0, 1.2, -10.5);
  const defRail = new THREE.Mesh(barrierRailGeo.clone(), barrierRailMatDef);
  defRail.position.set(0, 1.2, 0);
  barrierDefenders.add(defRail);
  mapGroup.add(barrierDefenders);

  // 5. Load active GLB arena (auto-discovers /models/Map/*.glb or /api/maps/active.glb)
  // Forces opaque architectural materials & runs triangle-plane wall extraction for solid wall collisions.
  resolveActiveMapUrl().then(({ url, isCustom }) => {
    loadGLBModel(url).then((mapModel) => {
      if (!mapModel) return;

      const toRemove: THREE.Object3D[] = [];
      mapModel.traverse((obj) => {
        if (obj.name === 'Camera' || obj.name === 'Object_21' || obj.name === 'Plane.023') {
          toRemove.push(obj);
          return;
        }
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          const isPassThrough = isGroundOrBackdropMesh(mesh.name);
          const isMarker = mesh.name.toLowerCase().includes('marker');
          mesh.castShadow = !isPassThrough;
          mesh.receiveShadow = !isMarker;

          const rawMat = mesh.material;
          const mats = Array.isArray(rawMat) ? rawMat : [rawMat];
          mats.forEach((m) => {
            if (!m) return;
            if (isMarker) {
              m.transparent = true;
              m.opacity = 0.85;
              m.depthWrite = false;
            } else {
              m.transparent = false;
              m.opacity = 1.0;
              m.alphaTest = 0.45;
              m.depthWrite = true;
              m.depthTest = true;
            }
            m.side = THREE.DoubleSide;
            m.needsUpdate = true;
          });

          if (!isPassThrough) {
            collidableMeshes.push(mesh);
          }
        }
      });
      toRemove.forEach((o) => o.parent?.remove(o));

      if (isCustom) {
        // Check native scale: metric Valorant maps (25m..220m) stay 1:1 seated at origin (0,0,0)
        const box = new THREE.Box3().setFromObject(mapModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxHorizontal = Math.max(1, size.x, size.z);
        if (maxHorizontal >= 25 && maxHorizontal <= 220 && Math.abs(center.x) < 12 && Math.abs(center.z) < 12) {
          mapModel.scale.setScalar(1.0);
          mapModel.position.set(0, 0, 0);
        } else {
          const scale = 120 / maxHorizontal;
          mapModel.scale.setScalar(scale);
          mapModel.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
        }
      } else {
        const mapScale = 0.016;
        mapModel.scale.setScalar(mapScale);
        mapModel.position.set(-8250 * mapScale, -0.8, -(-900) * mapScale);
      }

      mapGroup.add(mapModel);
      extractWallCollidersFromObject(mapModel);
    });
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
      setExtractedMapColliders([]);
      floorGeo.dispose();
      floorMat.dispose();
      perimeterWallMat.dispose();
      ringDecalGeo.dispose();
      siteAMat.dispose();
      siteBMat.dispose();
      barrierGeo.dispose();
      barrierRailGeo.dispose();
      barrierMatAtt.dispose();
      barrierRailMatAtt.dispose();
      barrierMatDef.dispose();
      barrierRailMatDef.dispose();
    },
  };
}
