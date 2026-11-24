/**
 * Hollow Strike - Map Data, Spatial-Hashed Wall Colliders & Waypoint Navigation Graph
 * Supports hot-swappable active map definitions (Warehouse, Courtyard, Proving Grid, & Custom GLBs)
 * so spawns, bomb sites, buy barriers, colliders, minimap extent, and bot nav graphs match cleanly.
 */

import { DEFAULT_MAP_ID, MAP_REGISTRY, MapDef, getAvailableMaps } from './types';
import { raycastAABBs, RaycastAABBHit } from './rules';
import {
  MeshColliderGrid,
  sampleMeshFloorY,
  checkMeshCeilingY,
  resolveMeshHorizontalCylinder,
  raycastMeshGrid,
} from './meshCollider';

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
  // Outer Perimeter Safety Bounds (invisible for GLB; interior geometry comes from courtyard.glb)
  { minX: -46, maxX: 46, minY: 0, maxY: 8, minZ: 44.5, maxZ: 46.5 },
  { minX: -46, maxX: 46, minY: 0, maxY: 8, minZ: -46.5, maxZ: -44.5 },
  { minX: -46.5, maxX: -44.5, minY: 0, maxY: 8, minZ: -46, maxZ: 46 },
  { minX: 44.5, maxX: 46.5, minY: 0, maxY: 8, minZ: -46, maxZ: 46 },
];

export const COURTYARD_FALLBACK_COLLIDERS: MapAABB[] = [
  ...COURTYARD_COLLIDERS,
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
  att_spawn: { id: 'att_spawn', x: 0, y: 0, z: -26, type: 'spawn_att', neighbors: ['att_west', 'mid_north', 'att_east'] },
  att_west: { id: 'att_west', x: -18, y: 0, z: -20, type: 'lane_a', neighbors: ['att_spawn', 'a_main'] },
  a_main: { id: 'a_main', x: -18, y: 0, z: -4, type: 'lane_a', neighbors: ['att_west', 'site_a_plant'] },
  site_a_plant: { id: 'site_a_plant', x: -18, y: 0, z: 11.5, type: 'site_a', neighbors: ['a_main', 'def_west', 'mid_west'] },
  mid_north: { id: 'mid_north', x: 0, y: 0, z: -12, type: 'lane_mid', neighbors: ['att_spawn', 'mid_west', 'mid_east'] },
  mid_west: { id: 'mid_west', x: -6, y: 0, z: 2, type: 'lane_mid', neighbors: ['mid_north', 'mid_center', 'site_a_plant'] },
  mid_center: { id: 'mid_center', x: 0, y: 0, z: 8, type: 'lane_mid', neighbors: ['mid_west', 'mid_east', 'def_spawn'] },
  mid_east: { id: 'mid_east', x: 6, y: 0, z: 2, type: 'lane_mid', neighbors: ['mid_north', 'mid_center', 'site_b_plant'] },
  att_east: { id: 'att_east', x: 18, y: 0, z: -20, type: 'lane_b', neighbors: ['att_spawn', 'b_main'] },
  b_main: { id: 'b_main', x: 18, y: 0, z: -4, type: 'lane_b', neighbors: ['att_east', 'site_b_plant'] },
  site_b_plant: { id: 'site_b_plant', x: 18, y: 0, z: 11.5, type: 'site_b', neighbors: ['b_main', 'def_east', 'mid_east'] },
  def_west: { id: 'def_west', x: -18, y: 0, z: 21, type: 'cover', neighbors: ['site_a_plant', 'def_spawn'] },
  def_east: { id: 'def_east', x: 18, y: 0, z: 21, type: 'cover', neighbors: ['site_b_plant', 'def_spawn'] },
  def_spawn: { id: 'def_spawn', x: 0, y: 0, z: 26, type: 'spawn_def', neighbors: ['def_west', 'mid_center', 'def_east'] },
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

const TRAINING_GROUND_COLLIDERS: MapAABB[] = [
  // Outer island boundary safety walls only; interior floors, ramps, doorways & buildings use 3D MeshColliderGrid
  { minX: -59, maxX: 59, minY: -2, maxY: 60, minZ: 57.5, maxZ: 59.5 },
  { minX: -59, maxX: 59, minY: -2, maxY: 60, minZ: -59.5, maxZ: -57.5 },
  { minX: -59.5, maxX: -57.5, minY: -2, maxY: 60, minZ: -59, maxZ: 59 },
  { minX: 57.5, maxX: 59.5, minY: -2, maxY: 60, minZ: -59, maxZ: 59 },
];

const TRAINING_GROUND_NAV: Record<string, NavNode> = {
  att_spawn: { id: 'att_spawn', x: -2, y: 8.05, z: 2, type: 'spawn_att', neighbors: ['mid_center', 'pit_west', 'terrace_east', 'village_south'] },
  mid_center: { id: 'mid_center', x: -2, y: 8.05, z: 0, type: 'lane_mid', neighbors: ['att_spawn', 'pit_west', 'terrace_east', 'village_south'] },
  pit_west: { id: 'pit_west', x: 14, y: 8.3, z: 0, type: 'lane_mid', neighbors: ['att_spawn', 'mid_center', 'pit_center', 'range_south'] },
  pit_center: { id: 'pit_center', x: 22, y: 8.6, z: 1, type: 'cover', neighbors: ['pit_west', 'range_south', 'dock_north'] },
  range_south: { id: 'range_south', x: 24, y: 12.05, z: -6, type: 'lane_b', neighbors: ['pit_west', 'pit_center', 'def_spawn'] },
  def_spawn: { id: 'def_spawn', x: 24, y: 12.05, z: -12, type: 'spawn_def', neighbors: ['range_south', 'village_east'] },
  terrace_east: { id: 'terrace_east', x: -16, y: 6.2, z: 10, type: 'lane_a', neighbors: ['att_spawn', 'mid_center', 'bridge_west', 'site_a_plant'] },
  bridge_west: { id: 'bridge_west', x: -4, y: 5.2, z: 15, type: 'lane_mid', neighbors: ['terrace_east', 'bridge_east'] },
  bridge_east: { id: 'bridge_east', x: 10, y: 5.2, z: 16, type: 'lane_b', neighbors: ['bridge_west', 'site_b_plant'] },
  site_b_plant: { id: 'site_b_plant', x: 24, y: 5.05, z: 20, type: 'site_b', neighbors: ['bridge_east', 'dock_north'] },
  dock_north: { id: 'dock_north', x: 24, y: 6.5, z: 10, type: 'cover', neighbors: ['site_b_plant', 'pit_center'] },
  site_a_plant: { id: 'site_a_plant', x: -26, y: 12.3, z: -13, type: 'site_a', neighbors: ['terrace_east', 'village_west'] },
  village_west: { id: 'village_west', x: -12, y: 12.0, z: -18, type: 'cover', neighbors: ['site_a_plant', 'village_south', 'bunker_entry'] },
  village_south: { id: 'village_south', x: 0, y: 12.5, z: -24, type: 'cover', neighbors: ['att_spawn', 'mid_center', 'village_west', 'village_east'] },
  village_east: { id: 'village_east', x: 14, y: 12.0, z: -18, type: 'cover', neighbors: ['village_south', 'def_spawn'] },
  bunker_entry: { id: 'bunker_entry', x: -16, y: 17.05, z: -28, type: 'cover', neighbors: ['village_west'] },
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
let activeMeshCollider: MeshColliderGrid | null = null;
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
    def.id === 'TRAINING_GROUND' || def.isTrainingMap
      ? TRAINING_GROUND_COLLIDERS
      : def.id === 'PROVING_GRID'
        ? PROVING_GRID_COLLIDERS
        : def.id === 'COURTYARD'
          ? COURTYARD_COLLIDERS
          : WAREHOUSE_COLLIDERS;
  MAP_COLLIDERS.length = 0;
  MAP_COLLIDERS.push(...nextColliders);

  const nextNav =
    def.id === 'TRAINING_GROUND' || def.isTrainingMap
      ? TRAINING_GROUND_NAV
      : def.id === 'PROVING_GRID'
        ? PROVING_GRID_NAV
        : def.id === 'COURTYARD'
          ? COURTYARD_NAV
          : WAREHOUSE_NAV;
  for (const key of Object.keys(NAV_GRAPH)) {
    delete NAV_GRAPH[key];
  }
  Object.assign(NAV_GRAPH, nextNav);

  activeMeshCollider = null;
  extractedWallColliders = [];
  combinedColliders = [...MAP_COLLIDERS];
  rebuildSpatialBuckets(combinedColliders);
  colliderListeners.forEach((cb) => cb());

  return def;
}

export function setActiveMeshCollider(grid: MeshColliderGrid | null): void {
  activeMeshCollider = grid;
}

export function getActiveMeshCollider(): MeshColliderGrid | null {
  return activeMeshCollider;
}

export function sampleWorldFloorY(x: number, z: number, feetY = 0, maxStepUp = 0.72): number {
  if (!activeMeshCollider) return activeMapDef.isTrainingMap ? feetY : 0;
  const hitY = sampleMeshFloorY(activeMeshCollider, x, z, feetY, maxStepUp);
  if (hitY !== null) return hitY;
  return activeMapDef.isTrainingMap ? -5 : 0;
}

export function checkWorldCeilingY(x: number, z: number, feetY = 0, headHeight = 1.78): number | null {
  if (!activeMeshCollider) return null;
  return checkMeshCeilingY(activeMeshCollider, x, z, feetY, headHeight);
}

export function setExtractedMapColliders(boxes: MapAABB[]): void {
  extractedWallColliders = boxes;
  if (activeMeshCollider && activeMapDef.isTrainingMap) {
    // Training map uses exact 3D triangle collision for player movement & raycasts;
    // keep only the perimeter bounds in combinedColliders while notifying minimap listeners cleanly.
    combinedColliders = [...MAP_COLLIDERS];
  } else {
    combinedColliders = boxes.length === 0 ? [...MAP_COLLIDERS] : [...MAP_COLLIDERS, ...boxes];
  }
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
  const aabbHit = raycastAABBs(
    ox,
    oy,
    oz,
    dx,
    dy,
    dz,
    maxDistance,
    combinedColliders,
    activeMeshCollider ? false : includeFloor
  );
  if (!activeMeshCollider) return aabbHit;

  const limit = aabbHit ? aabbHit.distance : maxDistance;
  const meshHit = raycastMeshGrid(activeMeshCollider, ox, oy, oz, dx, dy, dz, limit);
  if (meshHit) return meshHit;
  return aabbHit;
}

export function subscribeMapColliders(listener: () => void): () => void {
  colliderListeners.add(listener);
  return () => {
    colliderListeners.delete(listener);
  };
}

const _checkedScratch = new Set<MapAABB>();

function checkBucketCollision(x: number, z: number, radius = 0.5): { collided: boolean; normalX: number; normalZ: number } {
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

export function resolveWorldMovement(
  x: number,
  z: number,
  feetY = 0,
  radius = 0.36
): { x: number; z: number; collided: boolean; normalX: number; normalZ: number } {
  const half = Math.max(4, MAP_HALF_EXTENT - radius - 0.15);
  let rx = Math.max(-half, Math.min(half, x));
  let rz = Math.max(-half, Math.min(half, z));
  let collided = rx !== x || rz !== z;
  let nx = rx !== x ? (x > 0 ? -1 : 1) : 0;
  let nz = rz !== z ? (z > 0 ? -1 : 1) : 0;

  if (activeMeshCollider) {
    const res = resolveMeshHorizontalCylinder(activeMeshCollider, rx, rz, feetY, radius, 1.72);
    if (res.collided) {
      rx = res.x;
      rz = res.z;
      collided = true;
      nx = res.normalX;
      nz = res.normalZ;
    }
    return { x: rx, z: rz, collided, normalX: nx, normalZ: nz };
  }

  const bucketHit = checkBucketCollision(rx, rz, radius);
  if (bucketHit.collided) {
    return {
      x: rx + bucketHit.normalX * 0.04,
      z: rz + bucketHit.normalZ * 0.04,
      collided: true,
      normalX: bucketHit.normalX,
      normalZ: bucketHit.normalZ,
    };
  }
  return { x: rx, z: rz, collided, normalX: nx, normalZ: nz };
}

export function checkCollision(
  x: number,
  z: number,
  radius = 0.5,
  feetY = 0
): { collided: boolean; normalX: number; normalZ: number } {
  const bucketHit = checkBucketCollision(x, z, radius);
  if (bucketHit.collided) return bucketHit;

  if (activeMeshCollider) {
    const res = resolveMeshHorizontalCylinder(activeMeshCollider, x, z, feetY, radius, 1.72);
    if (res.collided) {
      return { collided: true, normalX: res.normalX, normalZ: res.normalZ };
    }
  }
  return { collided: false, normalX: 0, normalZ: 0 };
}

export function isPointWalkable(x: number, z: number, radius = 0.45, feetY = 0): boolean {
  if (checkCollision(x, z, radius, feetY).collided) return false;
  if (activeMeshCollider && activeMapDef.isTrainingMap) {
    const floor = sampleMeshFloorY(activeMeshCollider, x, z, feetY, 0.9);
    if (floor === null || floor < 1.5) return false;
  }
  return true;
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

export function findClosestNavNode(x: number, z: number, y = 0): NavNode {
  let closest: NavNode = NAV_GRAPH['mid_center'] ?? Object.values(NAV_GRAPH)[0];
  let minDistanceSq = Infinity;

  for (const key in NAV_GRAPH) {
    const node = NAV_GRAPH[key];
    const dx = node.x - x;
    const dy = (node.y - y) * 1.6;
    const dz = node.z - z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closest = node;
    }
  }

  return closest;
}
