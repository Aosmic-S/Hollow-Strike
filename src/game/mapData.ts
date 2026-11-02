/**
 * Hollow Strike - Map Data & Waypoint Navigation Graph
 * Defines geometric bounds, bomb site radii, collision boxes, and bot waypoints.
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

export const BOMB_SITE_A = { x: -22, y: 0, z: -18, radius: 5.5, name: 'Site A' };
export const BOMB_SITE_B = { x: 22, y: 0, z: -18, radius: 5.5, name: 'Site B' };

export const SPAWN_ATTACKERS = { x: 0, y: 0, z: 36 };
export const SPAWN_DEFENDERS = { x: 0, y: 0, z: -38 };

// Static Collision Boxes (AABBs) for player/bot physical obstruction
export const MAP_COLLIDERS: MapAABB[] = [
  // Outer perimeter boundary walls
  { minX: -42, maxX: 42, minY: 0, maxY: 12, minZ: 44, maxZ: 46 }, // South outer
  { minX: -42, maxX: 42, minY: 0, maxY: 12, minZ: -46, maxZ: -44 }, // North outer
  { minX: -44, maxX: -42, minY: 0, maxY: 12, minZ: -46, maxZ: 46 }, // West outer
  { minX: 42, maxX: 44, minY: 0, maxY: 12, minZ: -46, maxZ: 46 }, // East outer

  // Lane partition blocks (separating A Long from Mid)
  { minX: -16, maxX: -12, minY: 0, maxY: 8, minZ: 6, maxZ: 32 },
  { minX: -16, maxX: -12, minY: 0, maxY: 8, minZ: -12, maxZ: -2 },

  // Lane partition blocks (separating B Long from Mid)
  { minX: 12, maxX: 16, minY: 0, maxY: 8, minZ: 6, maxZ: 32 },
  { minX: 12, maxX: 16, minY: 0, maxY: 8, minZ: -12, maxZ: -2 },

  // Mid central courtyard monument & sniper arch
  { minX: -3.5, maxX: 3.5, minY: 0, maxY: 2.8, minZ: -2, maxZ: 2 },
  { minX: -8, maxX: -6, minY: 0, maxY: 7, minZ: -5, maxZ: 5 },
  { minX: 6, maxX: 8, minY: 0, maxY: 7, minZ: -5, maxZ: 5 },

  // Site A: Elevated reactor structure & tactical crates
  { minX: -26, maxX: -18, minY: 0, maxY: 1.2, minZ: -22, maxZ: -14 }, // A Platform
  { minX: -24, maxX: -21, minY: 1.2, maxY: 3.6, minZ: -20, maxZ: -17 }, // Reactor core
  { minX: -30, maxX: -28, minY: 0, maxY: 2.5, minZ: -14, maxZ: -10 }, // A Long Corner crate
  { minX: -14, maxX: -12, minY: 0, maxY: 2.5, minZ: -22, maxZ: -18 }, // A Connector crate
  { minX: -34, maxX: -31, minY: 0, maxY: 5, minZ: 2, maxZ: 10 }, // A Long choke wall

  // Site B: Dual tech pillars & defensive barriers
  { minX: 18, maxX: 21, minY: 0, maxY: 7, minZ: -22, maxZ: -19 }, // Pillar 1
  { minX: 25, maxX: 28, minY: 0, maxY: 7, minZ: -18, maxZ: -15 }, // Pillar 2
  { minX: 19, maxX: 24, minY: 0, maxY: 2.2, minZ: -14, maxZ: -12 }, // B Front Barrier
  { minX: 29, maxX: 32, minY: 0, maxY: 3.0, minZ: -22, maxZ: -18 }, // B Back Corner
  { minX: 31, maxX: 34, minY: 0, maxY: 5, minZ: 2, maxZ: 10 }, // B Long choke wall

  // Mid-to-site connectors and doors
  { minX: -8, maxX: -3, minY: 0, maxY: 7, minZ: -26, maxZ: -24 }, // Def Mid-A wall
  { minX: 3, maxX: 8, minY: 0, maxY: 7, minZ: -26, maxZ: -24 }, // Def Mid-B wall

  // Attacker spawn forward divider
  { minX: -6, maxX: 6, minY: 0, maxY: 3.5, minZ: 24, maxZ: 26 },
];

// Check collision against static map colliders
export function checkCollision(x: number, z: number, radius = 0.5): { collided: boolean; normalX: number; normalZ: number } {
  for (const c of MAP_COLLIDERS) {
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

// Full Nav Graph for Bot AI
export const NAV_GRAPH: Record<string, NavNode> = {
  // Attacker Spawn Area
  att_spawn: { id: 'att_spawn', x: 0, y: 0, z: 36, type: 'spawn_att', neighbors: ['att_left', 'att_mid', 'att_right'] },
  att_left: { id: 'att_left', x: -20, y: 0, z: 32, type: 'lane_a', neighbors: ['att_spawn', 'a_long_entry'] },
  att_mid: { id: 'att_mid', x: 0, y: 0, z: 20, type: 'lane_mid', neighbors: ['att_spawn', 'mid_south'] },
  att_right: { id: 'att_right', x: 20, y: 0, z: 32, type: 'lane_b', neighbors: ['att_spawn', 'b_long_entry'] },

  // A Lane (West)
  a_long_entry: { id: 'a_long_entry', x: -26, y: 0, z: 22, type: 'lane_a', neighbors: ['att_left', 'a_long_mid'] },
  a_long_mid: { id: 'a_long_mid', x: -26, y: 0, z: 4, type: 'lane_a', neighbors: ['a_long_entry', 'a_long_corner'] },
  a_long_corner: { id: 'a_long_corner', x: -24, y: 0, z: -8, type: 'lane_a', neighbors: ['a_long_mid', 'site_a_plant', 'a_connector'] },

  // B Lane (East)
  b_long_entry: { id: 'b_long_entry', x: 26, y: 0, z: 22, type: 'lane_b', neighbors: ['att_right', 'b_long_mid'] },
  b_long_mid: { id: 'b_long_mid', x: 26, y: 0, z: 4, type: 'lane_b', neighbors: ['b_long_entry', 'b_long_corner'] },
  b_long_corner: { id: 'b_long_corner', x: 24, y: 0, z: -8, type: 'lane_b', neighbors: ['b_long_mid', 'site_b_plant', 'b_connector'] },

  // Mid Lane (Center)
  mid_south: { id: 'mid_south', x: 0, y: 0, z: 12, type: 'lane_mid', neighbors: ['att_mid', 'mid_center'] },
  mid_center: { id: 'mid_center', x: 0, y: 0, z: 0, type: 'lane_mid', neighbors: ['mid_south', 'mid_north', 'a_connector', 'b_connector'] },
  mid_north: { id: 'mid_north', x: 0, y: 0, z: -14, type: 'lane_mid', neighbors: ['mid_center', 'def_mid', 'a_connector', 'b_connector'] },

  // Connectors
  a_connector: { id: 'a_connector', x: -10, y: 0, z: -8, type: 'cover', neighbors: ['mid_center', 'mid_north', 'site_a_plant', 'a_long_corner'] },
  b_connector: { id: 'b_connector', x: 10, y: 0, z: -8, type: 'cover', neighbors: ['mid_center', 'mid_north', 'site_b_plant', 'b_long_corner'] },

  // Bomb Site A
  site_a_plant: { id: 'site_a_plant', x: -22, y: 0, z: -18, type: 'site_a', neighbors: ['a_long_corner', 'a_connector', 'site_a_back', 'def_a'] },
  site_a_back: { id: 'site_a_back', x: -28, y: 0, z: -28, type: 'cover', neighbors: ['site_a_plant', 'def_a'] },

  // Bomb Site B
  site_b_plant: { id: 'site_b_plant', x: 22, y: 0, z: -18, type: 'site_b', neighbors: ['b_long_corner', 'b_connector', 'site_b_back', 'def_b'] },
  site_b_back: { id: 'site_b_back', x: 28, y: 0, z: -28, type: 'cover', neighbors: ['site_b_plant', 'def_b'] },

  // Defender Spawn & Rotations
  def_spawn: { id: 'def_spawn', x: 0, y: 0, z: -38, type: 'spawn_def', neighbors: ['def_a', 'def_mid', 'def_b'] },
  def_a: { id: 'def_a', x: -16, y: 0, z: -32, type: 'cover', neighbors: ['def_spawn', 'site_a_plant', 'site_a_back'] },
  def_mid: { id: 'def_mid', x: 0, y: 0, z: -24, type: 'cover', neighbors: ['def_spawn', 'mid_north'] },
  def_b: { id: 'def_b', x: 16, y: 0, z: -32, type: 'cover', neighbors: ['def_spawn', 'site_b_plant', 'site_b_back'] },
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
