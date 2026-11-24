/**
 * Hollow Strike - 3D Tactical Warehouse Map Builder
 * Loads Warehouse.glb directly with zero deep cloning, hides ultra-dense decorative foliage on
 * software/low WebGL, disables expensive static shadow casting, and runs chunked async
 * wall-AABB extraction cached per map URL so the main thread never freezes or crashes.
 */

import * as THREE from 'three';
import {
  BOMB_SITE_A,
  BOMB_SITE_B,
  BUY_BARRIER_ATTACKERS_Z,
  BUY_BARRIER_DEFENDERS_Z,
  MAP_COLLIDERS,
  MAP_HALF_EXTENT,
  MAP_SCALE_XZ,
  MAP_SCALE_Y,
  MapAABB,
  SPAWN_ATTACKERS,
  SPAWN_DEFENDERS,
  getActiveMapDef,
  COURTYARD_FALLBACK_COLLIDERS,
  setActiveMeshCollider,
  setExtractedMapColliders,
} from './mapData';
import { loadGLBModel } from './modelLoader';
import { extractGridWallAABBs, isTdmMap } from './rules';
import { buildMeshColliderFromObject, extractMinimapAABBsFromMesh } from './meshCollider';

export interface BuiltMap {
  group: THREE.Group;
  barrierAttackers: THREE.Mesh;
  barrierDefenders: THREE.Mesh;
  siteAMarker: THREE.Mesh;
  siteBMarker: THREE.Mesh;
  collidableMeshes: THREE.Mesh[];
  dispose: () => void;
}

const extractedColliderCache = new Map<string, MapAABB[]>();

function isNonCollidableEnvMesh(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes('floor') ||
    n.includes('yard') ||
    n.includes('vines') ||
    n.includes('exterior') ||
    n.includes('roof') ||
    n.includes('tarp') ||
    n.includes('light') ||
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

function isPureFoliageOrBackdrop(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('vines');
}

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

/**
 * Slices structural Warehouse meshes (walls, frames, crates, props) at torso planes
 * in chunked async batches (yielding every 8,000 triangles) and caches results per map URL.
 */
const STORAGE_AABB_PREFIX = 'hs_map_aabbs_v2_';

async function extractWallCollidersAsync(
  root: THREE.Object3D,
  cacheKey: string,
  halfExtent: number,
  isCancelled: () => boolean
): Promise<void> {
  const fullCacheKey = `${cacheKey}_h${Math.round(halfExtent)}`;
  const cached = extractedColliderCache.get(fullCacheKey);
  if (cached) {
    if (!isCancelled()) {
      setExtractedMapColliders(cached);
    }
    return;
  }

  try {
    const rawStored = window.localStorage.getItem(`${STORAGE_AABB_PREFIX}${fullCacheKey}`);
    if (rawStored) {
      const parsed = JSON.parse(rawStored) as MapAABB[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        extractedColliderCache.set(fullCacheKey, parsed);
        if (!isCancelled()) {
          setExtractedMapColliders(parsed);
        }
        return;
      }
    }
  } catch {
    // Ignore invalid storage cache
  }

  root.updateMatrixWorld(true);

  const minWorldX = -halfExtent;
  const maxWorldX = halfExtent;
  const minWorldZ = -halfExtent;
  const maxWorldZ = halfExtent;
  const cellSize = halfExtent > 34 ? 0.65 : 0.5;
  const cols = Math.round((maxWorldX - minWorldX) / cellSize);
  const rows = Math.round((maxWorldZ - minWorldZ) / cellSize);

  // Separate waist-high cover (0.45..1.05m -> extruded 0..1.10m) from full eye-height walls (1.25..1.72m -> extruded 0..2.85m)
  // so players can walk under doorways/arches and shoot cleanly over waist-high cover & through gaps.
  const lowOccupied: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const tallOccupied: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const lowSliceHeights = [0.55, 0.95];
  const tallSliceHeights = [1.35, 1.72];

  const markCell = (grid: boolean[][], wx: number, wz: number) => {
    const gx = Math.floor((wx - minWorldX) / cellSize);
    const gz = Math.floor((wz - minWorldZ) / cellSize);
    if (gx >= 0 && gx < cols && gz >= 0 && gz < rows) {
      grid[gz][gx] = true;
    }
  };

  const rasterizeSegment = (grid: boolean[][], ax: number, az: number, bx: number, bz: number) => {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.min(48, Math.ceil(dist / 0.28)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      markCell(grid, ax + (bx - ax) * t, az + (bz - az) * t);
    }
  };

  const collidableMeshes: THREE.Mesh[] = [];
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    if (isNonCollidableEnvMesh(mesh.name)) return;
    if (mesh.geometry?.getAttribute('position')) {
      collidableMeshes.push(mesh);
    }
  });

  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const pts: Array<[number, number]> = [];
  let processedSinceYield = 0;

  const sliceAtPlanes = (
    heights: number[],
    targetGrid: boolean[][],
    triMinY: number,
    triMaxY: number
  ) => {
    for (let hIdx = 0; hIdx < heights.length; hIdx++) {
      const yPlane = heights[hIdx];
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
        rasterizeSegment(targetGrid, pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
      }
    }
  };

  for (const mesh of collidableMeshes) {
    if (isCancelled()) return;
    const geom = mesh.geometry;
    const posAttr = geom.getAttribute('position');
    if (!posAttr) continue;

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
      if (triMaxY < 0.4 || triMinY > 1.85) continue;

      sliceAtPlanes(lowSliceHeights, lowOccupied, triMinY, triMaxY);
      sliceAtPlanes(tallSliceHeights, tallOccupied, triMinY, triMaxY);

      processedSinceYield++;
      if (processedSinceYield >= 2500) {
        processedSinceYield = 0;
        await yieldFrame();
        if (isCancelled()) return;
      }
    }
  }

  // Clear compact safety discs around spawns & site centers so players never spawn clipped
  const clearDiscs = [
    { x: SPAWN_ATTACKERS.x, z: SPAWN_ATTACKERS.z, r: 3.0 },
    { x: SPAWN_DEFENDERS.x, z: SPAWN_DEFENDERS.z, r: 3.0 },
    { x: BOMB_SITE_A.x, z: BOMB_SITE_A.z, r: 2.5 },
    { x: BOMB_SITE_B.x, z: BOMB_SITE_B.z, r: 2.2 },
  ];

  for (let gz = 0; gz < rows; gz++) {
    const wz = minWorldZ + (gz + 0.5) * cellSize;
    for (let gx = 0; gx < cols; gx++) {
      // Remove low cell if a full tall wall already covers the same cell
      if (tallOccupied[gz][gx]) {
        lowOccupied[gz][gx] = false;
      }
      if (!lowOccupied[gz][gx] && !tallOccupied[gz][gx]) continue;
      const wx = minWorldX + (gx + 0.5) * cellSize;
      for (const disc of clearDiscs) {
        if ((wx - disc.x) * (wx - disc.x) + (wz - disc.z) * (wz - disc.z) < disc.r * disc.r) {
          lowOccupied[gz][gx] = false;
          tallOccupied[gz][gx] = false;
          break;
        }
      }
    }
  }

  const tallBoxes = extractGridWallAABBs(tallOccupied, minWorldX, minWorldZ, cellSize, 0, 2.85);
  const lowBoxes = extractGridWallAABBs(lowOccupied, minWorldX, minWorldZ, cellSize, 0, 1.10);
  const wallBoxes = [...tallBoxes, ...lowBoxes];
  extractedColliderCache.set(fullCacheKey, wallBoxes);
  try {
    if (wallBoxes.length <= 2400) {
      window.localStorage.setItem(`${STORAGE_AABB_PREFIX}${fullCacheKey}`, JSON.stringify(wallBoxes));
    }
  } catch {
    // Ignore storage quota overflow
  }
  if (!isCancelled()) {
    setExtractedMapColliders(wallBoxes);
  }
}

function createTacticalFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#263447';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(236, 232, 225, 0.16)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(23, 229, 184, 0.2)';
    ctx.lineWidth = 1.5;
    for (let i = 64; i < 256; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 28);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildTacticalMap(
  scene: THREE.Scene,
  options: { lowDetail?: boolean; isSoftwareGl?: boolean } = {}
): BuiltMap {
  const lowDetail = options.lowDetail === true;
  const softwareGl = options.isSoftwareGl === true;
  const activeDef = getActiveMapDef();
  const isProcedural = activeDef.modelUrl === 'procedural';
  const isTdm = isTdmMap(activeDef);
  const isTraining = Boolean(activeDef.isTrainingMap);

  const mapGroup = new THREE.Group();
  mapGroup.name = `TacticalMap_${activeDef.id}`;
  const collidableMeshes: THREE.Mesh[] = [];
  let loadedMapModel: THREE.Group | null = null;
  let disposed = false;

  setActiveMeshCollider(null);
  setExtractedMapColliders([]);

  // 1. Ground Floor Plane (patterned grid for Proving Grid / sub-grade floor under GLBs)
  const floorTex = isProcedural ? createTacticalFloorTexture() : null;
  const floorGeo = new THREE.PlaneGeometry(180, 180);
  const floorMat = new THREE.MeshStandardMaterial({
    color: floorTex ? 0xffffff : 0x151c24,
    map: floorTex,
    roughness: 0.88,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = isProcedural ? 0 : -0.05;
  floor.receiveShadow = !lowDetail;
  floor.matrixAutoUpdate = false;
  floor.updateMatrix();
  mapGroup.add(floor);

  // 2. Procedural Architectural Blocks (ONLY rendered on procedural maps or if GLB fails to load)
  const defaultWallMat = new THREE.MeshStandardMaterial({
    color: 0x33445c,
    roughness: 0.8,
    metalness: 0.12,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xff4655,
    emissive: 0x3f1018,
    roughness: 0.45,
    metalness: 0.35,
  });
  const coverMaterials: THREE.Material[] = [defaultWallMat, trimMat];
  const createdGeometries: THREE.BufferGeometry[] = [floorGeo];

  const appendColliderBlocks = (blocks: MapAABB[]) => {
    for (const c of blocks) {
      const width = c.maxX - c.minX;
      const height = c.maxY - c.minY;
      const depth = c.maxZ - c.minZ;
      const centerX = (c.minX + c.maxX) / 2;
      const centerY = (c.minY + c.maxY) / 2;
      const centerZ = (c.minZ + c.maxZ) / 2;

      let mat = defaultWallMat;
      if (c.color) {
        mat = new THREE.MeshStandardMaterial({
          color: c.color,
          roughness: 0.72,
          metalness: 0.18,
        });
        coverMaterials.push(mat);
      }

      const blockGeo = new THREE.BoxGeometry(width, height, depth);
      createdGeometries.push(blockGeo);
      const block = new THREE.Mesh(blockGeo, mat);
      block.position.set(centerX, centerY, centerZ);
      block.castShadow = false;
      block.receiveShadow = !lowDetail;
      block.matrixAutoUpdate = false;
      block.updateMatrix();
      mapGroup.add(block);
      collidableMeshes.push(block);

      if (c.color && height < 6) {
        const capGeo = new THREE.BoxGeometry(width + 0.08, 0.12, depth + 0.08);
        createdGeometries.push(capGeo);
        const cap = new THREE.Mesh(capGeo, trimMat);
        cap.position.set(centerX, c.maxY - 0.06, centerZ);
        cap.matrixAutoUpdate = false;
        cap.updateMatrix();
        mapGroup.add(cap);
      }
    }
  };

  if (isProcedural) {
    appendColliderBlocks(MAP_COLLIDERS);
  }

  // 3. Bomb Site Decal Rings (Site A Teal & Site B Crimson)
  const ringGeoA = new THREE.RingGeometry(BOMB_SITE_A.radius - 0.35, BOMB_SITE_A.radius, 32);
  createdGeometries.push(ringGeoA);
  const siteAMat = new THREE.MeshBasicMaterial({
    color: 0x17e5b8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.75,
  });
  const siteAMarker = new THREE.Mesh(ringGeoA, siteAMat);
  siteAMarker.rotation.x = -Math.PI / 2;
  siteAMarker.position.set(BOMB_SITE_A.x, (BOMB_SITE_A.y || 0) + 0.08, BOMB_SITE_A.z);
  siteAMarker.visible = !isTdm;
  mapGroup.add(siteAMarker);

  const ringGeoB = new THREE.RingGeometry(BOMB_SITE_B.radius - 0.35, BOMB_SITE_B.radius, 32);
  createdGeometries.push(ringGeoB);
  const siteBMat = new THREE.MeshBasicMaterial({
    color: 0xff4655,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.75,
  });
  const siteBMarker = new THREE.Mesh(ringGeoB, siteBMat);
  siteBMarker.rotation.x = -Math.PI / 2;
  siteBMarker.position.set(BOMB_SITE_B.x, (BOMB_SITE_B.y || 0) + 0.08, BOMB_SITE_B.z);
  siteBMarker.visible = !isTdm;
  mapGroup.add(siteBMarker);

  // 4. Buy Phase Energy Barriers sized to active map width (disabled in TDM & Training Range)
  const barrierWidth = Math.max(58, MAP_HALF_EXTENT * 2);
  const barrierGeo = new THREE.PlaneGeometry(barrierWidth, 2.5);
  const barrierRailGeo = new THREE.BoxGeometry(barrierWidth, 0.05, 0.05);
  createdGeometries.push(barrierGeo, barrierRailGeo);

  const barrierMatAtt = new THREE.MeshBasicMaterial({
    color: 0xff4655,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const barrierRailMatAtt = new THREE.MeshBasicMaterial({
    color: 0xff4655,
    transparent: true,
    opacity: 0.9,
  });
  const barrierAttackers = new THREE.Mesh(barrierGeo, barrierMatAtt);
  barrierAttackers.position.set(0, 1.25, BUY_BARRIER_ATTACKERS_Z);
  const attRail = new THREE.Mesh(barrierRailGeo, barrierRailMatAtt);
  attRail.position.set(0, 1.25, 0);
  barrierAttackers.add(attRail);
  barrierAttackers.visible = !isTdm && !isTraining;
  mapGroup.add(barrierAttackers);

  const barrierMatDef = new THREE.MeshBasicMaterial({
    color: 0x17e5b8,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const barrierRailMatDef = new THREE.MeshBasicMaterial({
    color: 0x17e5b8,
    transparent: true,
    opacity: 0.9,
  });
  const barrierDefenders = new THREE.Mesh(barrierGeo, barrierMatDef);
  barrierDefenders.position.set(0, 1.25, BUY_BARRIER_DEFENDERS_Z);
  const defRail = new THREE.Mesh(barrierRailGeo, barrierRailMatDef);
  defRail.position.set(0, 1.25, 0);
  barrierDefenders.add(defRail);
  barrierDefenders.visible = !isTdm && !isTraining;
  mapGroup.add(barrierDefenders);

  // 5. Async non-blocking GLB load when map uses a 3D GLB model
  if (!isProcedural && activeDef.modelUrl) {
    const url = activeDef.modelUrl;
    const isLightWeight = lowDetail || softwareGl;
    loadGLBModel(url, {
      clone: false,
      castShadow: false,
      maxTextureSize: isLightWeight ? 256 : 512,
      stripSecondaryMaps: isLightWeight,
    }).then((mapModel) => {
      if (disposed) return;
      if (!mapModel) {
        if (!isTraining) {
          appendColliderBlocks(activeDef.id === 'COURTYARD' ? COURTYARD_FALLBACK_COLLIDERS : MAP_COLLIDERS);
        }
        return;
      }

      mapModel.removeFromParent();
      loadedMapModel = mapModel;
      const seenMaterials = new Set<THREE.Material>();

      mapModel.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          const lowerName = mesh.name.toLowerCase();
          const isFoliage = isPureFoliageOrBackdrop(lowerName);
          const isExteriorBackdrop = lowerName.includes('exterior') || lowerName.includes('rubble') || lowerName.includes('background');
          const isPassThrough = isNonCollidableEnvMesh(lowerName);

          if (isTraining) {
            if (lowDetail && (lowerName.includes('clouds') || lowerName.includes('foliage'))) {
              mesh.visible = false;
              return;
            }
          } else if ((lowDetail && isFoliage) || (isLightWeight && isExteriorBackdrop)) {
            mesh.visible = false;
            return;
          }
          mesh.visible = true;

          mesh.castShadow = false;
          mesh.receiveShadow = !lowDetail && !isFoliage;
          mesh.matrixAutoUpdate = false;
          mesh.updateMatrix();

          const rawMat = mesh.material;
          const mats = Array.isArray(rawMat) ? rawMat : [rawMat];
          mats.forEach((m) => {
            if (!m || seenMaterials.has(m)) return;
            seenMaterials.add(m);

            const std = m as THREE.MeshStandardMaterial;
            if (std.map) {
              std.map.anisotropy = lowDetail ? 1 : 4;
            }

            if (lowDetail) {
              if (std.normalMap) {
                std.normalMap.dispose();
                std.normalMap = null;
              }
              if (std.bumpMap) {
                std.bumpMap.dispose();
                std.bumpMap = null;
              }
              if (std.roughnessMap) {
                std.roughnessMap.dispose();
                std.roughnessMap = null;
                std.roughness = 0.78;
              }
              if (std.metalnessMap) {
                std.metalnessMap.dispose();
                std.metalnessMap = null;
                std.metalness = 0.1;
              }
              if (std.aoMap) {
                std.aoMap.dispose();
                std.aoMap = null;
              }
            }

            const lowerMatName = (m.name || '').toLowerCase();
            const keepAlpha =
              isTraining &&
              ['foliage', 'blossom', 'grass', 'foam', 'water', 'shadow', 'glass', 'cloud', 'sky'].some((tag) =>
                lowerMatName.includes(tag)
              );

            const isDecalOrGlass = m.name === 'glass' || m.name === 'shadow';
            if (!isFoliage && !isDecalOrGlass && !keepAlpha) {
              if (m.transparent) {
                m.transparent = false;
                m.opacity = 1.0;
                m.alphaTest = 0.45;
              } else {
                m.alphaTest = 0;
              }
              m.depthWrite = true;
              m.depthTest = true;
            }
            m.needsUpdate = true;
          });

          if (!isPassThrough) {
            collidableMeshes.push(mesh);
          }
        }
      });

      const rotY = activeDef.rotationY ?? 0;
      mapModel.rotation.set(0, rotY, 0);
      mapModel.scale.set(MAP_SCALE_XZ, MAP_SCALE_Y, MAP_SCALE_XZ);
      mapModel.position.set(0, 0, 0);
      mapModel.updateMatrixWorld(true);

      mapGroup.add(mapModel);

      if (isTraining) {
        floor.visible = false;
        window.setTimeout(() => {
          if (disposed) return;
          const meshGrid = buildMeshColliderFromObject(mapModel, { cellSize: 2.4, minWorldY: 0.4 });
          if (!disposed && meshGrid) {
            setActiveMeshCollider(meshGrid);
            const miniAABBs = extractMinimapAABBsFromMesh(meshGrid, activeDef.halfExtent);
            setExtractedMapColliders(miniAABBs);
          }
        }, 60);
      } else {
        window.setTimeout(() => {
          if (!disposed) {
            extractWallCollidersAsync(mapModel, `${url}_r${rotY.toFixed(2)}`, activeDef.halfExtent, () => disposed);
          }
        }, 150);
      }
    });
  }

  scene.add(mapGroup);

  return {
    group: mapGroup,
    barrierAttackers,
    barrierDefenders,
    siteAMarker,
    siteBMarker,
    collidableMeshes,
    dispose: () => {
      disposed = true;
      setActiveMeshCollider(null);
      if (loadedMapModel) {
        loadedMapModel.removeFromParent();
        loadedMapModel = null;
      }
      mapGroup.clear();
      scene.remove(mapGroup);
      setExtractedMapColliders([]);
      floorTex?.dispose();
      floorMat.dispose();
      coverMaterials.forEach((m) => m.dispose());
      createdGeometries.forEach((g) => g.dispose());
      siteAMat.dispose();
      siteBMat.dispose();
      barrierMatAtt.dispose();
      barrierRailMatAtt.dispose();
      barrierMatDef.dispose();
      barrierRailMatDef.dispose();
    },
  };
}

