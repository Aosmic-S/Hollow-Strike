/**
 * Hollow Strike - Map Data, Spatial-Hashed Wall Colliders & Waypoint Navigation Graph
 * Supports hot-swappable active map definitions (Warehouse, Courtyard, Proving Grid, & Custom GLBs)
 * so spawns, bomb sites, buy barriers, colliders, minimap extent, and bot nav graphs match cleanly.
 */

import { DEFAULT_MAP_ID, MAP_REGISTRY, MapDef, getAvailableMaps } from './types';
import { raycastAABBs, RaycastAABBHit } from './rules';

export interface MapAABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  color?: number;
}

export interface NavNode {
  id: string;
  x: number;
  y: number;
  z: number;
  type: 'spawn_att' | 'spawn_def' | 'lane_a' | 'lane_b' | 'lane_mid' | 'site_a' | 'site_b' | 'cover';
  neighbors: string[];
}

const WAREHOUSE_COLLIDERS: MapAABB[] = [
  { minX: -32, maxX: 32, minY: 0, maxY: 8, minZ: 20.5, maxZ: 22.5 },
  { minX: -32, maxX: 32, minY: 0, maxY: 8, minZ: -22.5, maxZ: -20.5 },
  { minX: -30.5, maxX: -28.5, minY: 0, maxY: 8, minZ: -22, maxZ: 22 },
  { minX: 28.5, maxX: 30.5, minY: 0, maxY: 8, minZ: -22, maxZ: 22 },
];

const COURTYARD_COLLIDERS: MapAABB[] = [
  // Outer Perimeter Walls
  { minX: -38, maxX: 38, minY: 0, maxY: 8, minZ: 35, maxZ: 37 },
  { minX: -38, maxX: 38, minY: 0, maxY: 8, minZ: -37, maxZ: -35 },
  { minX: -37, maxX: -35, minY: 0, maxY: 8, minZ: -36, maxZ: 36 },
  { minX: 35, maxX: 37, minY: 0, maxY: 8, minZ: -36, maxZ: 36 },
  // Architectural lane dividers & tactical cover (active in both GLB fallback & base arena)
  { minX: -12.5, maxX: -9.5, minY: 0, maxY: 4.5, minZ: -16, maxZ: 14, color: 0x3b4d63 },
  { minX: 9.5, maxX: 12.5, minY: 0, maxY: 4.5, minZ: -16, maxZ: 14, color: 0x3b4d63 },
  { minX: -3.2, maxX: 3.2, minY: 0, maxY: 3.4, minZ: -4, maxZ: 2, color: 0x475d78 },
  { minX: -22, maxX: -18, minY: 0, maxY: 2.5, minZ: -2, maxZ: 0.5, color: 0x52657d },
  { minX: 18, maxX: 22, minY: 0, maxY: 2.5, minZ: -2, maxZ: 0.5, color: 0x52657d },
];

const PROVING_GRID_COLLIDERS: MapAABB[] = [
  // Outer Perimeter Arena Walls
  { minX: -34, maxX: 34, minY: 0, maxY: 7.5, minZ: 32, maxZ: 34 },
  { minX: -34, maxX: 34, minY: 0, maxY: 7.5, minZ: -34, maxZ: -32 },
  { minX: -34, maxX: -32, minY: 0, maxY: 7.5, minZ: -33, maxZ: 33 },
  { minX: 32, maxX: 34, minY: 0, maxY: 7.5, minZ: -33, maxZ: 33 },
  // Inner Structural Baffles separating A / Mid / B
  { minX: -11.5, maxX: -8.5, minY: 0, maxY: 5.2, minZ: -15, maxZ: 13, color: 0x3b4f69 },
  { minX: 8.5, maxX: 11.5, minY: 0, maxY: 5.2, minZ: -15, maxZ: 13, color: 0x3b4f69 },
  // Center Mid Sniper Bastion + Flank Pillars
  { minX: -3.0, maxX: 3.0, minY: 0, maxY: 3.2, minZ: -3, maxZ: 3, color: 0x4c627d },
  { minX: -7.0, maxX: -5.0, minY: 0, maxY: 3.8, minZ: -11, maxZ: -8.5, color: 0x556b87 },
  { minX: 5.0, maxX: 7.0, minY: 0, maxY: 3.8, minZ: -11, maxZ: -8.5, color: 0x556b87 },
  // Site A Crate Stack Cover (just outside plant center -18, 2)
  { minX: -23.5, maxX: -20.5, minY: 0, maxY: 2.6, minZ: 5.5, maxZ: 8.5, color: 0x64748b },
  { minX: -22.0, maxX: -19.5, minY: 0, maxY: 2.2, minZ: -6.5, maxZ: -4.0, color: 0x64748b },
  // Site B Bunker Cover (just outside plant center 18, 2)
  { minX: 20.5, maxX: 23.5, minY: 0, maxY: 2.6, minZ: 5.5, maxZ: 8.5, color: 0x64748b },
  { minX: 19.5, maxX: 22.0, minY: 0, maxY: 2.2, minZ: -6.5, maxZ: -4.0, color: 0x64748b },
  // Attacker & Defender Mid Choke Screen Walls
  { minX: -15.5, maxX: -12.5, minY: 0, maxY: 3.2, minZ: -21, maxZ: -19, color: 0x435872 },
  { minX: 12.5, maxX: 15.5, minY: 0, maxY: 3.2, minZ: -21, maxZ: -19, color: 0x435872 },
  { minX: -15.5, maxX: -12.5, minY: 0, maxY: 3.2, minZ: 18, maxZ: 20, color: 0x435872 },
  { minX: 12.5, maxX: 15.5, minY: 0, maxY: 3.2, minZ: 18, maxZ: 20, color: 0x435872 },
];

const WAREHOUSE_NAV: Record<string, NavNode> = {
  att_spawn: { id: 'att_spawn', x: -13, y: 0, z: -18, type: 'spawn_att', neighbors: ['a_lane_north', 'b_north_corridor'] },
  a_lane_north: { id: 'a_lane_north', x: -7, y: 0, z: -14, type: 'lane_a', neighbors: ['att_spawn', 'a_lane_mid'] },
  a_lane_mid: { id: 'a_lane_mid', x: -7, y: 0, z: -10, type: 'lane_a', neighbors: ['a_lane_north', 'a_lane_entry'] },
  a_lane_entry: { id: 'a_lane_entry', x: -9, y: 0, z: -6, type: 'lane_a', neighbors: ['a_lane_mid', 'site_a_plant'] },
  site_a_plant: { id: 'site_a_plant', x: -19, y: 0, z: 1.5, type: 'site_a', neighbors: ['a_lane_entry', 'a_south_link'] },
  a_south_link: { id: 'a_south_link', x: -14, y: 0, z: 3, type: 'cover', neighbors: ['site_a_plant', 'mid_west', 'mid_center'] },
  mid_west: { id: 'mid_west', x: -1, y: 0, z: 4, type: 'lane_mid', neighbors: ['a_south_link', 'mid_center', 'def_north_link'] },
  mid_center: { id: 'mid_center', x: 0, y: 0, z: 4, type: 'lane_mid', neighbors: ['a_south_link', 'mid_west', 'mid_south'] },
  mid_south: { id: 'mid_south', x: 0, y: 0, z: 6, type: 'lane_mid', neighbors: ['mid_center', 'b_south_entry'] },
  b_south_entry: { id: 'b_south_entry', x: 9, y: 0, z: 5, type: 'cover', neighbors: ['mid_south', 'site_b_plant', 'def_east_link'] },
  b_north_corridor: { id: 'b_north_corridor', x: 19, y: 0, z: -18, type: 'lane_b', neighbors: ['att_spawn', 'b_east_bend'] },
  b_east_bend: { id: 'b_east_bend', x: 19, y: 0, z: -11, type: 'lane_b', neighbors: ['b_north_corridor', 'site_b_plant'] },
  site_b_plant: { id: 'site_b_plant', x: 11, y: 0, z: -4.0, type: 'site_b', neighbors: ['b_east_bend', 'b_south_entry', 'def_east_link'] },
  def_north_link: { id: 'def_north_link', x: -1, y: 0, z: 6, type: 'cover', neighbors: ['mid_west', 'def_spawn'] },
  def_east_link: { id: 'def_east_link', x: 5, y: 0, z: 7, type: 'cover', neighbors: ['b_south_entry', 'site_b_plant', 'def_spawn'] },
  def_spawn: { id: 'def_spawn', x: 2, y: 0, z: 16.5, type: 'spawn_def', neighbors: ['def_north_link', 'def_east_link'] },
};

const COURTYARD_NAV: Record<string, NavNode> = {
  att_spawn: { id: 'att_spawn', x: 0, y: 0, z: -30, type: 'spawn_att', neighbors: ['att_west', 'mid_north', 'att_east'] },
  att_west: { id: 'att_west', x: -20, y: 0, z: -24, type: 'lane_a', neighbors: ['att_spawn', 'a_main'] },
  a_main: { id: 'a_main', x: -20, y: 0, z: -10, type: 'lane_a', neighbors: ['att_west', 'site_a_plant'] },
  site_a_plant: { id: 'site_a_plant', x: -20, y: 0, z: 4, type: 'site_a', neighbors: ['a_main', 'def_west', 'mid_west'] },
  mid_north: { id: 'mid_north', x: 0, y: 0, z: -14, type: 'lane_mid', neighbors: ['att_spawn', 'mid_west', 'mid_east'] },
  mid_west: { id: 'mid_west', x: -6, y: 0, z: -1, type: 'lane_mid', neighbors: ['mid_north', 'mid_center', 'site_a_plant'] },
  mid_center: { id: 'mid_center', x: 0, y: 0, z: 8, type: 'lane_mid', neighbors: ['mid_west', 'mid_east', 'def_spawn'] },
  mid_east: { id: 'mid_east', x: 6, y: 0, z: -1, type: 'lane_mid', neighbors: ['mid_north', 'mid_center', 'site_b_plant'] },
  att_east: { id: 'att_east', x: 20, y: 0, z: -24, type: 'lane_b', neighbors: ['att_spawn', 'b_main'] },
  b_main: { id: 'b_main', x: 20, y: 0, z: -10, type: 'lane_b', neighbors: ['att_east', 'site_b_plant'] },
  site_b_plant: { id: 'site_b_plant', x: 20, y: 0, z: 4, type: 'site_b', neighbors: ['b_main', 'def_east', 'mid_east'] },
  def_west: { id: 'def_west', x: -20, y: 0, z: 22, type: 'cover', neighbors: ['site_a_plant', 'def_spawn'] },
  def_east: { id: 'def_east', x: 20, y: 0, z: 22, type: 'cover', neighbors: ['site_b_plant', 'def_spawn'] },
  def_spawn: { id: 'def_spawn', x: 0, y: 0, z: 30, type: 'spawn_def', neighbors: ['def_west', 'mid_center', 'def_east'] },
};

const PROVING_GRID_NAV: Record<string, NavNode> = {
  att_spawn: { id: 'att_spawn', x: 0, y: 0, z: -28, type: 'spawn_att', neighbors: ['att_west', 'mid_north', 'att_east'] },
  att_west: { id: 'att_west', x: -18, y: 0, z: -24, type: 'lane_a', neighbors: ['att_spawn', 'a_main'] },
  a_main: { id: 'a_main', x: -17, y: 0, z: -12, type: 'lane_a', neighbors: ['att_west', 'site_a_plant'] },
  site_a_plant: { id: 'site_a_plant', x: -18, y: 0, z: 2, type: 'site_a', neighbors: ['a_main', 'def_west', 'mid_west'] },
  mid_north: { id: 'mid_north', x: 0, y: 0, z: -14, type: 'lane_mid', neighbors: ['att_spawn', 'mid_west', 'mid_east'] },
  mid_west: { id: 'mid_west', x: -5.5, y: 0, z: 0, type: 'lane_mid', neighbors: ['mid_north', 'mid_center', 'site_a_plant'] },
  mid_center: { id: 'mid_center', x: 0, y: 0, z: 8, type: 'lane_mid', neighbors: ['mid_west', 'mid_east', 'def_spawn'] },
  mid_east: { id: 'mid_east', x: 5.5, y: 0, z: 0, type: 'lane_mid', neighbors: ['mid_north', 'mid_center', 'site_b_plant'] },
  att_east: { id: 'att_east', x: 18, y: 0, z: -24, type: 'lane_b', neighbors: ['att_spawn', 'b_main'] },
  b_main: { id: 'b_main', x: 17, y: 0, z: -12, type: 'lane_b', neighbors: ['att_east', 'site_b_plant'] },
  site_b_plant: { id: 'site_b_plant', x: 18, y: 0, z: 2, type: 'site_b', neighbors: ['b_main', 'def_east', 'mid_east'] },
  def_west: { id: 'def_west', x: -18, y: 0, z: 22, type: 'cover', neighbors: ['site_a_plant', 'def_spawn'] },
  def_east: { id: 'def_east', x: 18, y: 0, z: 22, type: 'cover', neighbors: ['site_b_plant', 'def_spawn'] },
  def_spawn: { id: 'def_spawn', x: 0, y: 0, z: 28, type: 'spawn_def', neighbors: ['def_west', 'mid_center', 'def_east'] },
};

let activeMapDef: MapDef = MAP_REGISTRY[DEFAULT_MAP_ID];
let dynamicCustomMaps: MapDef[] = [];

export let MAP_SCALE_XZ = activeMapDef.scaleXZ;
export let MAP_SCALE_Y = activeMapDef.scaleY;
export let MAP_HALF_EXTENT = activeMapDef.halfExtent;

export const BOMB_SITE_A = { ...activeMapDef.siteA };
export const BOMB_SITE_B = { ...activeMapDef.siteB };
export const SPAWN_ATTACKERS = { ...activeMapDef.spawnAttackers };
export const SPAWN_DEFENDERS = { ...activeMapDef.spawnDefenders };

export let BUY_BARRIER_ATTACKERS_Z = activeMapDef.barrierAttZ;
export let BUY_BARRIER_DEFENDERS_Z = activeMapDef.barrierDefZ;

export const MAP_COLLIDERS: MapAABB[] = [...WAREHOUSE_COLLIDERS];
export const NAV_GRAPH: Record<string, NavNode> = { ...WAREHOUSE_NAV };

const HASH_CELL_SIZE = 2.0;
let extractedWallColliders: MapAABB[] = [];
let combinedColliders: MapAABB[] = [...MAP_COLLIDERS];
let spatialBuckets = new Map<string, MapAABB[]>();
const colliderListeners = new Set<() => void>();

function bucketKey(bx: number, bz: number): string {
  return `${bx},${bz}`;
}

function rebuildSpatialBuckets(list: MapAABB[]): void {
  const nextBuckets = new Map<string, MapAABB[]>();
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c.maxY <= 0.35 && c.minY === 0) continue;
    const minBx = Math.floor(c.minX / HASH_CELL_SIZE);
    const maxBx = Math.floor(c.maxX / HASH_CELL_SIZE);
    const minBz = Math.floor(c.minZ / HASH_CELL_SIZE);
    const maxBz = Math.floor(c.maxZ / HASH_CELL_SIZE);
    for (let bx = minBx; bx <= maxBx; bx++) {
      for (let bz = minBz; bz <= maxBz; bz++) {
        const k = bucketKey(bx, bz);
        let arr = nextBuckets.get(k);
        if (!arr) {
          arr = [];
          nextBuckets.set(k, arr);
        }
        arr.push(c);
      }
    }
  }
  spatialBuckets = nextBuckets;
}

rebuildSpatialBuckets(combinedColliders);

export function registerCustomMaps(filenames: string[]): void {
  dynamicCustomMaps = getAvailableMaps(filenames);
}

export function resolveMapDef(mapId?: string): MapDef {
  const id = (mapId || DEFAULT_MAP_ID).trim();
  const fromDynamic = dynamicCustomMaps.find((m) => m.id === id);
  if (fromDynamic) return fromDynamic;
  return MAP_REGISTRY[id] ?? MAP_REGISTRY[DEFAULT_MAP_ID];
}

export function getActiveMapDef(): MapDef {
  return activeMapDef;
}

export function setActiveMap(mapId: string): MapDef {
  const def = resolveMapDef(mapId);
  activeMapDef = def;

  MAP_SCALE_XZ = def.scaleXZ;
  MAP_SCALE_Y = def.scaleY;
  MAP_HALF_EXTENT = def.halfExtent;
  BUY_BARRIER_ATTACKERS_Z = def.barrierAttZ;
  BUY_BARRIER_DEFENDERS_Z = def.barrierDefZ;

  Object.assign(SPAWN_ATTACKERS, def.spawnAttackers);
  Object.assign(SPAWN_DEFENDERS, def.spawnDefenders);
  Object.assign(BOMB_SITE_A, def.siteA);
  Object.assign(BOMB_SITE_B, def.siteB);

  const nextColliders =
    def.id === 'PROVING_GRID'
      ? PROVING_GRID_COLLIDERS
      : def.id === 'COURTYARD'
        ? COURTYARD_COLLIDERS
        : WAREHOUSE_COLLIDERS;
  MAP_COLLIDERS.length = 0;
  MAP_COLLIDERS.push(...nextColliders);

  const nextNav =
    def.id === 'PROVING_GRID'
      ? PROVING_GRID_NAV
      : def.id === 'COURTYARD'
        ? COURTYARD_NAV
        : WAREHOUSE_NAV;
  for (const key of Object.keys(NAV_GRAPH)) {
    delete NAV_GRAPH[key];
  }
  Object.assign(NAV_GRAPH, nextNav);

  extractedWallColliders = [];
  combinedColliders = [...MAP_COLLIDERS];
  rebuildSpatialBuckets(combinedColliders);
  colliderListeners.forEach((cb) => cb());

  return def;
}

export function setExtractedMapColliders(boxes: MapAABB[]): void {
  extractedWallColliders = boxes;
  combinedColliders = boxes.length === 0 ? [...MAP_COLLIDERS] : [...MAP_COLLIDERS, ...boxes];
  rebuildSpatialBuckets(combinedColliders);
  colliderListeners.forEach((cb) => cb());
}

export function getExtractedWallColliders(): MapAABB[] {
  return extractedWallColliders;
}

export function getActiveMapColliders(): MapAABB[] {
  return combinedColliders;
}

export function raycastMapAABBs(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDistance: number,
  includeFloor = false
): RaycastAABBHit | null {
  return raycastAABBs(ox, oy, oz, dx, dy, dz, maxDistance, combinedColliders, includeFloor);
}

export function subscribeMapColliders(listener: () => void): () => void {
  colliderListeners.add(listener);
  return () => {
    colliderListeners.delete(listener);
  };
}

const _checkedScratch = new Set<MapAABB>();

export function checkCollision(x: number, z: number, radius = 0.5): { collided: boolean; normalX: number; normalZ: number } {
  const minBx = Math.floor((x - radius) / HASH_CELL_SIZE);
  const maxBx = Math.floor((x + radius) / HASH_CELL_SIZE);
  const minBz = Math.floor((z - radius) / HASH_CELL_SIZE);
  const maxBz = Math.floor((z + radius) / HASH_CELL_SIZE);

  _checkedScratch.clear();

  for (let bx = minBx; bx <= maxBx; bx++) {
    for (let bz = minBz; bz <= maxBz; bz++) {
      const bucket = spatialBuckets.get(bucketKey(bx, bz));
      if (!bucket) continue;

      for (let i = 0; i < bucket.length; i++) {
        const c = bucket[i];
        if (_checkedScratch.has(c)) continue;
        _checkedScratch.add(c);

        const closestX = Math.max(c.minX, Math.min(x, c.maxX));
        const closestZ = Math.max(c.minZ, Math.min(z, c.maxZ));

        const distX = x - closestX;
        const distZ = z - closestZ;
        const distSq = distX * distX + distZ * distZ;

        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq) || 0.001;
          return {
            collided: true,
            normalX: distX / dist,
            normalZ: distZ / dist,
          };
        }
      }
    }
  }
  return { collided: false, normalX: 0, normalZ: 0 };
}

export function isPointWalkable(x: number, z: number, radius = 0.45): boolean {
  return !checkCollision(x, z, radius).collided;
}

export function findNavPath(startNodeId: string, targetNodeId: string): NavNode[] {
  if (startNodeId === targetNodeId) {
    return [NAV_GRAPH[startNodeId]].filter(Boolean);
  }

  const queue: string[] = [startNodeId];
  const visited: Set<string> = new Set([startNodeId]);
  const parentMap: Map<string, string> = new Map();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === targetNodeId) break;

    const node = NAV_GRAPH[current];
    if (!node) continue;

    for (const neighborId of node.neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        parentMap.set(neighborId, current);
        queue.push(neighborId);
      }
    }
  }

  if (!parentMap.has(targetNodeId)) {
    return [NAV_GRAPH[startNodeId]].filter(Boolean);
  }

  const path: NavNode[] = [];
  let curr = targetNodeId;
  while (curr !== startNodeId) {
    path.unshift(NAV_GRAPH[curr]);
    curr = parentMap.get(curr)!;
  }
  path.unshift(NAV_GRAPH[startNodeId]);

  return path;
}

export function findClosestNavNode(x: number, z: number): NavNode {
  let closest: NavNode = NAV_GRAPH['mid_center'] ?? Object.values(NAV_GRAPH)[0];
  let minDistanceSq = Infinity;

  for (const key in NAV_GRAPH) {
    const node = NAV_GRAPH[key];
    const dx = node.x - x;
    const dz = node.z - z;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closest = node;
    }
  }

  return closest;
}
