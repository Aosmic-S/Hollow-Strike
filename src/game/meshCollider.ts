/**
 * Hollow Strike - Spatial-Hashed 3D Mesh Triangle Collider & Elevation Sampler
 * Supports multi-level 3D GLB maps (ramps, stairs, bridges, terraces, docks, doorways, arches)
 * with zero invisible barriers and zero passing through solid walls or props.
 */

import * as THREE from 'three';
import { MapAABB } from './mapData';

export interface RaycastMeshHit {
  distance: number;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

export interface MeshColliderGrid {
  cellSize: number;
  triCount: number;
  ax: Float32Array;
  ay: Float32Array;
  az: Float32Array;
  bx: Float32Array;
  by: Float32Array;
  bz: Float32Array;
  cx: Float32Array;
  cy: Float32Array;
  cz: Float32Array;
  ny: Float32Array;
  minY: Float32Array;
  maxY: Float32Array;
  buckets: Map<number, Int32Array>;
  seenStamp: Int32Array;
  currentStamp: number;
}

const SKIP_NODE_NAMES = ['sea', 'sky', 'clouds'];
const SKIP_MATERIAL_NAMES = new Set([
  'foliage',
  'blossom',
  'grass',
  'foam',
  'water',
  'shadow',
  'sky',
]);

function hashCell(bx: number, bz: number): number {
  // Deterministic 32-bit safe integer key for coordinates within [-2048, 2048] cells
  return ((bx + 2048) << 12) | ((bz + 2048) & 0xfff);
}

function shouldSkipMesh(mesh: THREE.Mesh): boolean {
  const n = (mesh.name || '').toLowerCase();
  for (let i = 0; i < SKIP_NODE_NAMES.length; i++) {
    if (n === SKIP_NODE_NAMES[i] || n.includes(SKIP_NODE_NAMES[i])) {
      return true;
    }
  }
  return false;
}

function isPrimitiveMaterialSkipped(mat: THREE.Material | THREE.Material[] | undefined, groupMatIndex?: number): boolean {
  if (!mat) return false;
  const resolved = Array.isArray(mat) ? mat[groupMatIndex ?? 0] ?? mat[0] : mat;
  if (!resolved) return false;
  const mName = (resolved.name || '').toLowerCase();
  return SKIP_MATERIAL_NAMES.has(mName);
}

export function buildMeshColliderFromObject(
  root: THREE.Object3D,
  options: { cellSize?: number; minWorldY?: number } = {}
): MeshColliderGrid | null {
  const cellSize = options.cellSize ?? 2.5;
  const minWorldY = options.minWorldY ?? 0.4;

  root.updateMatrixWorld(true);

  const triVertices: number[] = [];
  const triNormalsY: number[] = [];
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const norm = new THREE.Vector3();

  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    if (!mesh.visible) return;
    if (shouldSkipMesh(mesh)) return;

    const geom = mesh.geometry;
    if (!geom) return;
    const pos = geom.getAttribute('position');
    if (!pos) return;

    const index = geom.getIndex();
    const groups = geom.groups && geom.groups.length > 0 ? geom.groups : null;
    const totalIndices = index ? index.count : pos.count;
    const mat = mesh.material;

    const processRange = (startIdx: number, count: number, matIndex: number) => {
      if (isPrimitiveMaterialSkipped(mat, matIndex)) return;
      const endIdx = Math.min(totalIndices, startIdx + count);
      for (let i = startIdx; i + 2 < endIdx; i += 3) {
        const i0 = index ? index.getX(i) : i;
        const i1 = index ? index.getX(i + 1) : i + 1;
        const i2 = index ? index.getX(i + 2) : i + 2;

        va.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld);
        vb.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld);
        vc.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);

        const maxTriY = Math.max(va.y, vb.y, vc.y);
        if (maxTriY < minWorldY) continue;

        e1.subVectors(vb, va);
        e2.subVectors(vc, va);
        norm.crossVectors(e1, e2);
        const len = norm.length();
        if (len < 1e-6) continue;

        const ny = norm.y / len;
        triVertices.push(va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z);
        triNormalsY.push(ny);
      }
    };

    if (groups && Array.isArray(mat)) {
      for (let g = 0; g < groups.length; g++) {
        processRange(groups[g].start, groups[g].count, groups[g].materialIndex ?? 0);
      }
    } else {
      processRange(0, totalIndices, 0);
    }
  });

  const triCount = triNormalsY.length;
  if (triCount === 0) return null;

  const ax = new Float32Array(triCount);
  const ay = new Float32Array(triCount);
  const az = new Float32Array(triCount);
  const bx = new Float32Array(triCount);
  const by = new Float32Array(triCount);
  const bz = new Float32Array(triCount);
  const cx = new Float32Array(triCount);
  const cy = new Float32Array(triCount);
  const cz = new Float32Array(triCount);
  const nyArr = new Float32Array(triCount);
  const minY = new Float32Array(triCount);
  const maxY = new Float32Array(triCount);

  const tempBuckets = new Map<number, number[]>();

  for (let t = 0; t < triCount; t++) {
    const o = t * 9;
    const x0 = triVertices[o], y0 = triVertices[o + 1], z0 = triVertices[o + 2];
    const x1 = triVertices[o + 3], y1 = triVertices[o + 4], z1 = triVertices[o + 5];
    const x2 = triVertices[o + 6], y2 = triVertices[o + 7], z2 = triVertices[o + 8];

    ax[t] = x0; ay[t] = y0; az[t] = z0;
    bx[t] = x1; by[t] = y1; bz[t] = z1;
    cx[t] = x2; cy[t] = y2; cz[t] = z2;
    nyArr[t] = triNormalsY[t];
    minY[t] = Math.min(y0, y1, y2);
    maxY[t] = Math.max(y0, y1, y2);

    const minBx = Math.floor(Math.min(x0, x1, x2) / cellSize);
    const maxBx = Math.floor(Math.max(x0, x1, x2) / cellSize);
    const minBz = Math.floor(Math.min(z0, z1, z2) / cellSize);
    const maxBz = Math.floor(Math.max(z0, z1, z2) / cellSize);

    for (let ix = minBx; ix <= maxBx; ix++) {
      for (let iz = minBz; iz <= maxBz; iz++) {
        const key = hashCell(ix, iz);
        let list = tempBuckets.get(key);
        if (!list) {
          list = [];
          tempBuckets.set(key, list);
        }
        list.push(t);
      }
    }
  }

  const buckets = new Map<number, Int32Array>();
  for (const [k, list] of tempBuckets.entries()) {
    buckets.set(k, Int32Array.from(list));
  }

  return {
    cellSize,
    triCount,
    ax, ay, az,
    bx, by, bz,
    cx, cy, cz,
    ny: nyArr,
    minY,
    maxY,
    buckets,
    seenStamp: new Int32Array(triCount),
    currentStamp: 1,
  };
}

/** Pure point-in-triangle XZ barycentric height sampler */
function sampleTriHeightXZ(
  px: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number
): number | null {
  const v0x = cx - ax;
  const v0z = cz - az;
  const v1x = bx - ax;
  const v1z = bz - az;
  const v2x = px - ax;
  const v2z = pz - az;

  const dot00 = v0x * v0x + v0z * v0z;
  const dot01 = v0x * v1x + v0z * v1z;
  const dot02 = v0x * v2x + v0z * v2z;
  const dot11 = v1x * v1x + v1z * v1z;
  const dot12 = v1x * v2x + v1z * v2z;

  const denom = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denom) < 1e-8) return null;
  const inv = 1 / denom;
  const u = (dot11 * dot02 - dot01 * dot12) * inv;
  const v = (dot00 * dot12 - dot01 * dot02) * inv;

  if (u >= -0.025 && v >= -0.025 && u + v <= 1.025) {
    return ay + u * (cy - ay) + v * (by - ay);
  }
  return null;
}

/**
 * Finds highest walkable surface under/near `(x, z)` at or below `feetY + maxStepUp`.
 * Probes center plus tiny seam-guard offsets so narrow floor joints never drop the player.
 */
export function sampleMeshFloorY(
  grid: MeshColliderGrid,
  x: number,
  z: number,
  feetY: number,
  maxStepUp = 0.65
): number | null {
  const stamp = ++grid.currentStamp;
  const cs = grid.cellSize;
  const minBx = Math.floor((x - 0.3) / cs);
  const maxBx = Math.floor((x + 0.3) / cs);
  const minBz = Math.floor((z - 0.3) / cs);
  const maxBz = Math.floor((z + 0.3) / cs);

  const ceilingCutoff = feetY + maxStepUp;
  let bestY = -Infinity;

  const probeOffsets: Array<[number, number]> = [
    [0, 0],
    [0.18, 0],
    [-0.18, 0],
    [0, 0.18],
    [0, -0.18],
  ];

  for (let bx = minBx; bx <= maxBx; bx++) {
    for (let bz = minBz; bz <= maxBz; bz++) {
      const bucket = grid.buckets.get(hashCell(bx, bz));
      if (!bucket) continue;

      for (let i = 0; i < bucket.length; i++) {
        const t = bucket[i];
        if (grid.seenStamp[t] === stamp) continue;
        grid.seenStamp[t] = stamp;

        if (grid.ny[t] < 0.52) continue;
        if (grid.minY[t] > ceilingCutoff) continue;

        const tax = grid.ax[t], tay = grid.ay[t], taz = grid.az[t];
        const tbx = grid.bx[t], tby = grid.by[t], tbz = grid.bz[t];
        const tcx = grid.cx[t], tcy = grid.cy[t], tcz = grid.cz[t];

        for (let p = 0; p < probeOffsets.length; p++) {
          const px = x + probeOffsets[p][0];
          const pz = z + probeOffsets[p][1];
          const hitY = sampleTriHeightXZ(px, pz, tax, tay, taz, tbx, tby, tbz, tcx, tcy, tcz);
          if (hitY !== null && hitY <= ceilingCutoff && hitY > bestY) {
            bestY = hitY;
            break;
          }
        }
      }
    }
  }

  return bestY > -Infinity ? bestY : null;
}

/**
 * Checks lowest solid ceiling triangle right above player head.
 */
export function checkMeshCeilingY(
  grid: MeshColliderGrid,
  x: number,
  z: number,
  feetY: number,
  headHeight = 1.78
): number | null {
  const stamp = ++grid.currentStamp;
  const cs = grid.cellSize;
  const bx = Math.floor(x / cs);
  const bz = Math.floor(z / cs);
  const bucket = grid.buckets.get(hashCell(bx, bz));
  if (!bucket) return null;

  let lowestCeil = Infinity;
  const minCheckY = feetY + 1.15;
  const maxCheckY = feetY + headHeight + 0.15;

  for (let i = 0; i < bucket.length; i++) {
    const t = bucket[i];
    if (grid.seenStamp[t] === stamp) continue;
    grid.seenStamp[t] = stamp;

    if (grid.maxY[t] < minCheckY || grid.minY[t] > maxCheckY) continue;
    if (Math.abs(grid.ny[t]) < 0.45) continue;

    const hitY = sampleTriHeightXZ(
      x,
      z,
      grid.ax[t], grid.ay[t], grid.az[t],
      grid.bx[t], grid.by[t], grid.bz[t],
      grid.cx[t], grid.cy[t], grid.cz[t]
    );
    if (hitY !== null && hitY >= minCheckY && hitY <= maxCheckY && hitY < lowestCeil) {
      lowestCeil = hitY;
    }
  }

  return lowestCeil < Infinity ? lowestCeil : null;
}

/** Closest point in 2D (X,Z) from point (px, pz) to triangle edge segment (x0,z0)-(x1,z1) */
function closestPointOnSegment2D(
  px: number,
  pz: number,
  x0: number,
  z0: number,
  x1: number,
  z1: number
): [number, number] {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-8) return [x0, z0];
  let t = ((px - x0) * dx + (pz - z0) * dz) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return [x0 + t * dx, z0 + t * dz];
}

/**
 * Resolves horizontal capsule/cylinder collision against solid structural triangles
 * inside the torso band `[feetY + 0.48, feetY + height - 0.08]`.
 * Steps lower than 0.48m are stepped onto cleanly; lintels/arches higher than head pass cleanly!
 */
export function resolveMeshHorizontalCylinder(
  grid: MeshColliderGrid,
  x: number,
  z: number,
  feetY: number,
  radius = 0.36,
  height = 1.72
): { x: number; z: number; collided: boolean; normalX: number; normalZ: number } {
  let rx = x;
  let rz = z;
  let anyCollided = false;
  let lastNx = 0;
  let lastNz = 0;

  const bandMinY = feetY + 0.48;
  const bandMaxY = feetY + height - 0.08;
  const cs = grid.cellSize;
  const rSq = radius * radius;

  // 3 solver passes handle inside corners smoothly
  for (let pass = 0; pass < 3; pass++) {
    const stamp = ++grid.currentStamp;
    const minBx = Math.floor((rx - radius) / cs);
    const maxBx = Math.floor((rx + radius) / cs);
    const minBz = Math.floor((rz - radius) / cs);
    const maxBz = Math.floor((rz + radius) / cs);
    let pushed = false;

    for (let bx = minBx; bx <= maxBx; bx++) {
      for (let bz = minBz; bz <= maxBz; bz++) {
        const bucket = grid.buckets.get(hashCell(bx, bz));
        if (!bucket) continue;

        for (let i = 0; i < bucket.length; i++) {
          const t = bucket[i];
          if (grid.seenStamp[t] === stamp) continue;
          grid.seenStamp[t] = stamp;

          // Ignore walkable floors / flat ceilings
          if (Math.abs(grid.ny[t]) >= 0.72) continue;
          if (grid.maxY[t] <= bandMinY || grid.minY[t] >= bandMaxY) continue;

          const x0 = grid.ax[t], y0 = grid.ay[t], z0 = grid.az[t];
          const x1 = grid.bx[t], y1 = grid.by[t], z1 = grid.bz[t];
          const x2 = grid.cx[t], y2 = grid.cy[t], z2 = grid.cz[t];

          // Quick XZ AABB reject
          const triMinX = Math.min(x0, x1, x2) - radius;
          const triMaxX = Math.max(x0, x1, x2) + radius;
          if (rx < triMinX || rx > triMaxX) continue;
          const triMinZ = Math.min(z0, z1, z2) - radius;
          const triMaxZ = Math.max(z0, z1, z2) + radius;
          if (rz < triMinZ || rz > triMaxZ) continue;

          // Clip triangle against 3 body-band horizontal slices [0.62, 1.12, 1.52] above feetY
          let bestDistSq = Infinity;
          let closestX = rx;
          let closestZ = rz;

          const sliceOffsets = [0.62, 1.12, 1.52];
          for (let s = 0; s < 3; s++) {
            const sy = feetY + sliceOffsets[s];
            if (sy < grid.minY[t] || sy > grid.maxY[t]) continue;

            // Intersect triangle (v0, v1, v2) with plane y = sy
            let hitCount = 0;
            let sx0 = 0, sz0 = 0, sx1 = 0, sz1 = 0;
            const verts: Array<[number, number, number]> = [
              [x0, y0, z0],
              [x1, y1, z1],
              [x2, y2, z2],
            ];
            for (let e = 0; e < 3; e++) {
              const p0 = verts[e];
              const p1 = verts[(e + 1) % 3];
              const d0 = p0[1] - sy;
              const d1 = p1[1] - sy;
              if ((d0 <= 0 && d1 >= 0) || (d0 >= 0 && d1 <= 0)) {
                const denom = p1[1] - p0[1];
                if (Math.abs(denom) > 1e-5) {
                  const frac = (sy - p0[1]) / denom;
                  if (frac >= -0.001 && frac <= 1.001) {
                    const ix = p0[0] + (p1[0] - p0[0]) * frac;
                    const iz = p0[2] + (p1[2] - p0[2]) * frac;
                    if (hitCount === 0) {
                      sx0 = ix;
                      sz0 = iz;
                      hitCount = 1;
                    } else if (hitCount === 1) {
                      sx1 = ix;
                      sz1 = iz;
                      hitCount = 2;
                      break;
                    }
                  }
                }
              }
            }
            if (hitCount >= 1) {
              const [qx, qz] = hitCount === 2
                ? closestPointOnSegment2D(rx, rz, sx0, sz0, sx1, sz1)
                : [sx0, sz0];
              const dx = rx - qx;
              const dz = rz - qz;
              const dSq = dx * dx + dz * dz;
              if (dSq < bestDistSq) {
                bestDistSq = dSq;
                closestX = qx;
                closestZ = qz;
              }
            }
          }

          if (bestDistSq < rSq) {
            const dist = Math.sqrt(bestDistSq);
            let nx: number;
            let nz: number;
            if (dist > 1e-5) {
              nx = (rx - closestX) / dist;
              nz = (rz - closestZ) / dist;
            } else {
              // Fallback horizontal triangle normal
              const ux = x1 - x0, uy = y1 - y0, uz = z1 - z0;
              const vx = x2 - x0, vy = y2 - y0, vz = z2 - z0;
              const fnx = uy * vz - uz * vy;
              const fnz = ux * vy - uy * vx;
              const flen = Math.hypot(fnx, fnz) || 1;
              nx = fnx / flen;
              nz = fnz / flen;
            }
            const push = radius - dist;
            rx += nx * push;
            rz += nz * push;
            anyCollided = true;
            pushed = true;
            lastNx = nx;
            lastNz = nz;
          }
        }
      }
    }
    if (!pushed) break;
  }

  return { x: rx, z: rz, collided: anyCollided, normalX: lastNx, normalZ: lastNz };
}

/**
 * Exact 3D Möller-Trumbore ray-triangle intersection across spatial-hashed XZ cells.
 */
export function raycastMeshGrid(
  grid: MeshColliderGrid,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDistance: number
): RaycastMeshHit | null {
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6 || maxDistance <= 0) return null;
  const ndx = dx / len;
  const ndy = dy / len;
  const ndz = dz / len;

  const cs = grid.cellSize;
  const endX = ox + ndx * maxDistance;
  const endZ = oz + ndz * maxDistance;

  const startBx = Math.floor(ox / cs);
  const startBz = Math.floor(oz / cs);
  const endBx = Math.floor(endX / cs);
  const endBz = Math.floor(endZ / cs);

  const stamp = ++grid.currentStamp;
  let bestDist = maxDistance;
  let bestTri = -1;

  const steps = Math.max(1, Math.min(96, Math.abs(endBx - startBx) + Math.abs(endBz - startBz) + 2));

  const testCell = (bx: number, bz: number) => {
    const bucket = grid.buckets.get(hashCell(bx, bz));
    if (!bucket) return;

    for (let i = 0; i < bucket.length; i++) {
      const t = bucket[i];
      if (grid.seenStamp[t] === stamp) continue;
      grid.seenStamp[t] = stamp;

      const x0 = grid.ax[t], y0 = grid.ay[t], z0 = grid.az[t];
      const e1x = grid.bx[t] - x0, e1y = grid.by[t] - y0, e1z = grid.bz[t] - z0;
      const e2x = grid.cx[t] - x0, e2y = grid.cy[t] - y0, e2z = grid.cz[t] - z0;

      // pvec = cross(dir, e2)
      const px = ndy * e2z - ndz * e2y;
      const py = ndz * e2x - ndx * e2z;
      const pz = ndx * e2y - ndy * e2x;

      const det = e1x * px + e1y * py + e1z * pz;
      if (det > -1e-7 && det < 1e-7) continue;

      const invDet = 1 / det;
      const tx = ox - x0;
      const ty = oy - y0;
      const tz = oz - z0;

      const u = (tx * px + ty * py + tz * pz) * invDet;
      if (u < 0 || u > 1) continue;

      // qvec = cross(tvec, e1)
      const qx = ty * e1z - tz * e1y;
      const qy = tz * e1x - tx * e1z;
      const qz = tx * e1y - ty * e1x;

      const v = (ndx * qx + ndy * qy + ndz * qz) * invDet;
      if (v < 0 || u + v > 1) continue;

      const dist = (e2x * qx + e2y * qy + e2z * qz) * invDet;
      if (dist > 0.01 && dist < bestDist) {
        bestDist = dist;
        bestTri = t;
      }
    }
  };

  // Supercover line walk in 2D grid cells
  let prevBx = startBx;
  let prevBz = startBz;
  testCell(prevBx, prevBz);
  testCell(prevBx + 1, prevBz);
  testCell(prevBx - 1, prevBz);
  testCell(prevBx, prevBz + 1);
  testCell(prevBx, prevBz - 1);

  for (let s = 1; s <= steps; s++) {
    const frac = s / steps;
    const cx = Math.floor((ox + (endX - ox) * frac) / cs);
    const cz = Math.floor((oz + (endZ - oz) * frac) / cs);
    if (cx !== prevBx || cz !== prevBz) {
      testCell(cx, cz);
      if (cx !== prevBx && cz !== prevBz) {
        testCell(cx, prevBz);
        testCell(prevBx, cz);
      }
      prevBx = cx;
      prevBz = cz;
    }
  }

  if (bestTri < 0) return null;

  const x0 = grid.ax[bestTri], y0 = grid.ay[bestTri], z0 = grid.az[bestTri];
  const e1x = grid.bx[bestTri] - x0, e1y = grid.by[bestTri] - y0, e1z = grid.bz[bestTri] - z0;
  const e2x = grid.cx[bestTri] - x0, e2y = grid.cy[bestTri] - y0, e2z = grid.cz[bestTri] - z0;
  let nx = e1y * e2z - e1z * e2y;
  let ny = e1z * e2x - e1x * e2z;
  let nz = e1x * e2y - e1y * e2x;
  const nLen = Math.hypot(nx, ny, nz) || 1;
  nx /= nLen;
  ny /= nLen;
  nz /= nLen;
  if (nx * ndx + ny * ndy + nz * ndz > 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }

  return {
    distance: bestDist,
    x: ox + ndx * bestDist,
    y: oy + ndy * bestDist,
    z: oz + ndz * bestDist,
    nx,
    ny,
    nz,
  };
}

/**
 * Generates compact 2D wall/cover AABBs for Minimap & TacticalMapModal from the 3D MeshColliderGrid.
 */
export function extractMinimapAABBsFromMesh(
  grid: MeshColliderGrid,
  halfExtent: number
): MapAABB[] {
  const cellSize = 1.5;
  const cols = Math.round((halfExtent * 2) / cellSize);
  const rows = Math.round((halfExtent * 2) / cellSize);
  const occupied = new Uint8Array(cols * rows);

  for (let t = 0; t < grid.triCount; t++) {
    // Only structural wall/cliff triangles above ground water line
    if (Math.abs(grid.ny[t]) >= 0.72) continue;
    if (grid.maxY[t] < 4.5 || grid.minY[t] > 21) continue;
    const mx = (grid.ax[t] + grid.bx[t] + grid.cx[t]) / 3;
    const mz = (grid.az[t] + grid.bz[t] + grid.cz[t]) / 3;
    const gx = Math.floor((mx + halfExtent) / cellSize);
    const gz = Math.floor((mz + halfExtent) / cellSize);
    if (gx >= 0 && gx < cols && gz >= 0 && gz < rows) {
      occupied[gz * cols + gx] = 1;
    }
  }

  const boxes: MapAABB[] = [];
  for (let gz = 0; gz < rows; gz++) {
    let runStart = -1;
    for (let gx = 0; gx <= cols; gx++) {
      const filled = gx < cols && occupied[gz * cols + gx] === 1;
      if (filled && runStart < 0) {
        runStart = gx;
      } else if (!filled && runStart >= 0) {
        boxes.push({
          minX: -halfExtent + runStart * cellSize,
          maxX: -halfExtent + gx * cellSize,
          minY: 0,
          maxY: 2.5,
          minZ: -halfExtent + gz * cellSize,
          maxZ: -halfExtent + (gz + 1) * cellSize,
        });
        runStart = -1;
      }
    }
  }
  return boxes;
}
