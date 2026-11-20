/**
 * Hollow Strike - Map Data, Dynamic Wall Colliders & Waypoint Navigation Graph
 * Coordinates calibrated for open courtyards around House1 (SE) & House2 (NW) in japan_map.glb
 * plus real-time extracted 3D mesh wall colliders so no player or bot can walk through walls.
 */

export interface MapAABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface NavNode {
  id: string;
  x: number;
  y: number;
  z: number;
  type: 'spawn_att' | 'spawn_def' | 'lane_a' | 'lane_b' | 'lane_mid' | 'site_a' | 'site_b' | 'cover';
  neighbors: string[];
}

// Calibrated directly to Site_A_1 / Site_B_1 pads and Markers_1 / Markers_2 in valorant_style_map_v2
export const BOMB_SITE_A = { x: -24.7, y: 0, z: -16.3, radius: 6.2, name: 'Site A' };
export const BOMB_SITE_B = { x: 24.7, y: 0, z: -16.3, radius: 6.2, name: 'Site B' };

export const SPAWN_ATTACKERS = { x: 0, y: 0, z: 41 };
export const SPAWN_DEFENDERS = { x: 0, y: 0, z: -20 };

// Safety outer boundary perimeter walls (-62..+62) + dynamic mode flag
export const MAP_COLLIDERS: MapAABB[] = [
  { minX: -63, maxX: 63, minY: 0, maxY: 8, minZ: 61.5, maxZ: 63.5 },   // South outer safety bound
  { minX: -63, maxX: 63, minY: 0, maxY: 8, minZ: -63.5, maxZ: -61.5 }, // North outer safety bound
  { minX: -63.5, maxX: -61.5, minY: 0, maxY: 8, minZ: -63, maxZ: 63 }, // West outer safety bound
  { minX: 61.5, maxX: 63.5, minY: 0, maxY: 8, minZ: -63, maxZ: 63 },   // East outer safety bound
];

let extractedWallColliders: MapAABB[] = [];
const colliderListeners = new Set<() => void>();

export function setExtractedMapColliders(boxes: MapAABB[]): void {
  extractedWallColliders = boxes;
  colliderListeners.forEach((cb) => cb());
}

export function getExtractedWallColliders(): MapAABB[] {
  return extractedWallColliders;
}

export function getActiveMapColliders(): MapAABB[] {
  if (extractedWallColliders.length === 0) return MAP_COLLIDERS;
  return [...MAP_COLLIDERS, ...extractedWallColliders];
}

export function subscribeMapColliders(listener: () => void): () => void {
  colliderListeners.add(listener);
  return () => {
    colliderListeners.delete(listener);
  };
}

// Check collision against both base tactical cover and dynamically extracted 3D building walls
export function checkCollision(x: number, z: number, radius = 0.5): { collided: boolean; normalX: number; normalZ: number } {
  const all = getActiveMapColliders();
  for (let i = 0; i < all.length; i++) {
    const c = all[i];
    if (c.maxY <= 0.85 && c.minY === 0) continue;

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
  return { collided: false, normalX: 0, normalZ: 0 };
}

export function isPointWalkable(x: number, z: number, radius = 0.45): boolean {
  return !checkCollision(x, z, radius).collided;
}

// Full Nav Graph calibrated to verified walkable corridors of valorant_style_map_v2 -> Site A (-24.7,-16.3) & Site B (24.7,-16.3)
export const NAV_GRAPH: Record<string, NavNode> = {
  // Attacker Spawn Area (South Plaza z=41)
  att_spawn: { id: 'att_spawn', x: 0, y: 0, z: 41, type: 'spawn_att', neighbors: ['att_left', 'att_mid', 'att_right'] },
  att_left: { id: 'att_left', x: -10, y: 0, z: 26, type: 'lane_a', neighbors: ['att_spawn', 'a_long_entry'] },
  att_mid: { id: 'att_mid', x: -2, y: 0, z: 20, type: 'lane_mid', neighbors: ['att_spawn', 'mid_south'] },
  att_right: { id: 'att_right', x: 10, y: 0, z: 25, type: 'lane_b', neighbors: ['att_spawn', 'b_long_entry'] },

  // A Lane (West Corridor)
  a_long_entry: { id: 'a_long_entry', x: -14, y: 0, z: 12, type: 'lane_a', neighbors: ['att_left', 'a_long_mid'] },
  a_long_mid: { id: 'a_long_mid', x: -19, y: 0, z: 2, type: 'lane_a', neighbors: ['a_long_entry', 'a_long_corner', 'a_connector'] },
  a_long_corner: { id: 'a_long_corner', x: -22, y: 0, z: -8, type: 'lane_a', neighbors: ['a_long_mid', 'site_a_plant'] },

  // B Lane (East Corridor)
  b_long_entry: { id: 'b_long_entry', x: 15, y: 0, z: 9, type: 'lane_b', neighbors: ['att_right', 'b_long_mid', 'mid_south'] },
  b_long_mid: { id: 'b_long_mid', x: 22, y: 0, z: 2, type: 'lane_b', neighbors: ['b_long_entry', 'b_long_corner'] },
  b_long_corner: { id: 'b_long_corner', x: 28, y: 0, z: -7, type: 'lane_b', neighbors: ['b_long_mid', 'site_b_plant', 'b_connector'] },

  // Mid Lane (Center Courtyard & Bridge)
  mid_south: { id: 'mid_south', x: -2, y: 0, z: 10, type: 'lane_mid', neighbors: ['att_mid', 'b_long_entry', 'mid_center'] },
  mid_center: { id: 'mid_center', x: -5, y: 0, z: 1, type: 'lane_mid', neighbors: ['mid_south', 'mid_north', 'a_connector', 'b_connector'] },
  mid_north: { id: 'mid_north', x: -6, y: 0, z: -12, type: 'lane_mid', neighbors: ['mid_center', 'def_mid', 'a_connector'] },

  // Connectors
  a_connector: { id: 'a_connector', x: -15, y: 0, z: -6, type: 'cover', neighbors: ['mid_center', 'mid_north', 'a_long_mid', 'site_a_plant'] },
  b_connector: { id: 'b_connector', x: 16, y: 0, z: 4, type: 'cover', neighbors: ['mid_center', 'b_long_corner', 'def_b'] },

  // Bomb Site A (West Courtyard)
  site_a_plant: { id: 'site_a_plant', x: -24.7, y: 0, z: -16.3, type: 'site_a', neighbors: ['a_long_corner', 'a_connector', 'site_a_back'] },
  site_a_back: { id: 'site_a_back', x: -16, y: 0, z: -22, type: 'cover', neighbors: ['site_a_plant', 'def_a'] },

  // Bomb Site B (East Courtyard)
  site_b_plant: { id: 'site_b_plant', x: 24.7, y: 0, z: -16.3, type: 'site_b', neighbors: ['b_long_corner', 'b_connector', 'site_b_back'] },
  site_b_back: { id: 'site_b_back', x: 18, y: 0, z: -20, type: 'cover', neighbors: ['site_b_plant', 'def_b'] },

  // Defender Spawn (North Plaza z=-20) & Rotations
  def_spawn: { id: 'def_spawn', x: 0, y: 0, z: -20, type: 'spawn_def', neighbors: ['def_a', 'def_mid', 'def_b'] },
  def_a: { id: 'def_a', x: -8, y: 0, z: -20, type: 'cover', neighbors: ['def_spawn', 'site_a_back'] },
  def_mid: { id: 'def_mid', x: 0, y: 0, z: -12, type: 'cover', neighbors: ['def_spawn', 'mid_north', 'b_connector'] },
  def_b: { id: 'def_b', x: 10, y: 0, z: -18, type: 'cover', neighbors: ['def_spawn', 'site_b_back', 'b_connector'] },
};

/**
 * Finds shortest path between two nodes using Breadth-First Search (BFS)
 */
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

/**
 * Finds the closest nav node to given (x, z) coordinates
 */
export function findClosestNavNode(x: number, z: number): NavNode {
  let closest: NavNode = NAV_GRAPH['mid_center'];
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
