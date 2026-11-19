/**
 * Hollow Strike - Procedural & GLB 3D Weapon Models & Viewmodel Profiles
 * All firearms are geometrically normalized via Box3 to real-world meter lengths,
 * oriented cleanly with barrel pointing along -Z and grip centered near (0,0,0).
 */

import * as THREE from 'three';
import { loadGLBModel, loadGLBSubNode, normalizeWeaponModel, NormalizeWeaponOptions } from './modelLoader';

const darkMetalMat = new THREE.MeshStandardMaterial({
  color: 0x1e2430,
  roughness: 0.35,
  metalness: 0.85,
});

const polymerMat = new THREE.MeshStandardMaterial({
  color: 0x0f172a,
  roughness: 0.8,
  metalness: 0.1,
});

export interface WeaponViewmodelProfile {
  hipPos: [number, number, number];
  adsPos: [number, number, number];
  flashPos: [number, number, number];
}

const WEAPON_VIEWMODEL_PROFILES: Record<string, WeaponViewmodelProfile> = {
  APEX_9: {
    hipPos: [0.22, -0.21, -0.40],
    adsPos: [0, -0.13, -0.32],
    flashPos: [0, 0.04, -0.15],
  },
  ION_PISTOL: {
    hipPos: [0.22, -0.21, -0.40],
    adsPos: [0, -0.13, -0.32],
    flashPos: [0, 0.04, -0.16],
  },
  VIPER_9: {
    hipPos: [0.24, -0.22, -0.42],
    adsPos: [0, -0.14, -0.30],
    flashPos: [0, 0.04, -0.27],
  },
  PHANTOM_V: {
    hipPos: [0.25, -0.23, -0.46],
    adsPos: [0, -0.15, -0.32],
    flashPos: [0, 0.045, -0.42],
  },
  VALKYRIE_RIFLE: {
    hipPos: [0.25, -0.22, -0.45],
    adsPos: [0, -0.145, -0.31],
    flashPos: [0, 0.04, -0.41],
  },
  HONEY_BADGER: {
    hipPos: [0.25, -0.23, -0.45],
    adsPos: [0, -0.145, -0.31],
    flashPos: [0, 0.04, -0.40],
  },
  VOID_LANCE: {
    hipPos: [0.26, -0.24, -0.48],
    adsPos: [0, -0.15, -0.30],
    flashPos: [0, 0.045, -0.48],
  },
};

export function getWeaponViewmodelProfile(weaponId: string): WeaponViewmodelProfile {
  return WEAPON_VIEWMODEL_PROFILES[weaponId] ?? WEAPON_VIEWMODEL_PROFILES.APEX_9;
}

function syncLayerMask(target: THREE.Object3D, mask: number) {
  target.traverse((child) => {
    child.layers.mask = mask;
  });
}

function attachNormalizedGLB(
  container: THREE.Group,
  loaderFn: () => Promise<THREE.Group | null>,
  options: NormalizeWeaponOptions
) {
  loaderFn().then((rawObj) => {
    if (!rawObj) return;
    const normalized = normalizeWeaponModel(rawObj, options);
    // Preserve Layer assignment if container was already isolated (e.g., Layer 1 for local player body)
    syncLayerMask(normalized, container.layers.mask);

    while (container.children.length > 0) {
      const child = container.children[0];
      // Never remove a mounted muzzle flash helper named 'vm_muzzle_flash'
      if (child.name === 'vm_muzzle_flash') break;
      container.remove(child);
    }

    // Remove all non-flash placeholders
    for (let i = container.children.length - 1; i >= 0; i--) {
      if (container.children[i].name !== 'vm_muzzle_flash') {
        container.remove(container.children[i]);
      }
    }

    container.add(normalized);
  });
}

function buildCompactFallback(length: number, height: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.045, height, length * 0.72), darkMetalMat);
  body.position.set(0, 0.02, -length * 0.08);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.10, 0.05), polymerMat);
  grip.rotation.x = -0.25;
  grip.position.set(0, -0.05, 0.03);
  g.add(body, grip);
  return g;
}

/**
 * Apex-9 Sidearm -> /models/sci-fi_gun.glb (Compact handgun: 0.24m)
 */
export function createApex9Model(): THREE.Group {
  const group = buildCompactFallback(0.24, 0.045);
  attachNormalizedGLB(group, () => loadGLBModel('/models/sci-fi_gun.glb'), {
    targetLength: 0.24,
    forwardAxis: '-z',
    pivotShift: [0, 0.01, -0.02],
  });
  return group;
}

/**
 * Ion-X Sidearm -> free_pack_-_sci_fi_weapon.glb / SM_Sci_FiWeapon_HandGun (0.25m)
 */
export function createIonPistolModel(): THREE.Group {
  const group = buildCompactFallback(0.25, 0.048);
  attachNormalizedGLB(
    group,
    () => loadGLBSubNode('/models/free_pack_-_sci_fi_weapon.glb', 'SM_Sci_FiWeapon_HandGun'),
    {
      targetLength: 0.25,
      forwardAxis: '+x',
      pivotShift: [0, 0.01, -0.02],
    }
  );
  return group;
}

/**
 * Viper-9 SMG -> /models/smg.glb (0.48m)
 */
export function createViper9Model(): THREE.Group {
  const group = buildCompactFallback(0.48, 0.065);
  attachNormalizedGLB(group, () => loadGLBModel('/models/smg.glb'), {
    targetLength: 0.48,
    forwardAxis: '-z',
    pivotShift: [0, 0.01, -0.04],
  });
  return group;
}

/**
 * Phantom-V Carbine -> /models/carbine_rifle.glb (Increased full rifle size: 0.78m)
 */
export function createPhantomVModel(): THREE.Group {
  const group = buildCompactFallback(0.78, 0.08);
  attachNormalizedGLB(group, () => loadGLBModel('/models/carbine_rifle.glb'), {
    targetLength: 0.78,
    forwardAxis: '-z',
    pivotShift: [0, 0.015, -0.06],
  });
  return group;
}

/**
 * Valkyrie-R Pulse Rifle -> free_pack_-_sci_fi_weapon.glb / SM_Sci_FiWeapon_RifleGun (0.76m)
 */
export function createValkyrieRifleModel(): THREE.Group {
  const group = buildCompactFallback(0.76, 0.08);
  attachNormalizedGLB(
    group,
    () => loadGLBSubNode('/models/free_pack_-_sci_fi_weapon.glb', 'SM_Sci_FiWeapon_RifleGun'),
    {
      targetLength: 0.76,
      forwardAxis: '+x',
      pivotShift: [0, 0.015, -0.05],
    }
  );
  return group;
}

/**
 * Badger-300 Suppressed Carbine -> /models/aac_honey_badger.glb (0.74m)
 */
export function createHoneyBadgerModel(): THREE.Group {
  const group = buildCompactFallback(0.74, 0.075);
  attachNormalizedGLB(group, () => loadGLBModel('/models/aac_honey_badger.glb'), {
    targetLength: 0.74,
    forwardAxis: '+x',
    pivotShift: [0, 0.01, -0.05],
  });
  return group;
}

/**
 * Void-Lance Heavy Cannon -> free_pack_-_sci_fi_weapon.glb / SM_Sci_FiWeapon_MachineGun (0.90m)
 */
export function createVoidLanceModel(): THREE.Group {
  const group = buildCompactFallback(0.90, 0.09);
  attachNormalizedGLB(
    group,
    () => loadGLBSubNode('/models/free_pack_-_sci_fi_weapon.glb', 'SM_Sci_FiWeapon_MachineGun'),
    {
      targetLength: 0.90,
      forwardAxis: '+x',
      pivotShift: [0, 0.015, -0.06],
    }
  );
  return group;
}

/**
 * Unified Weapon Model Factory by Weapon ID
 */
export function createWeaponModel(weaponId: string): THREE.Group {
  switch (weaponId) {
    case 'APEX_9':
      return createApex9Model();
    case 'ION_PISTOL':
      return createIonPistolModel();
    case 'VIPER_9':
      return createViper9Model();
    case 'PHANTOM_V':
      return createPhantomVModel();
    case 'VALKYRIE_RIFLE':
      return createValkyrieRifleModel();
    case 'HONEY_BADGER':
      return createHoneyBadgerModel();
    case 'VOID_LANCE':
      return createVoidLanceModel();
    default:
      return createApex9Model();
  }
}

/**
 * Creates 3D model for the Tactical Spike Core (uses SM_Sci_FiWeapon_Bomb from the sci-fi pack)
 */
export function createSpikeModel(): THREE.Group {
  const group = new THREE.Group();

  const baseGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.12, 16);
  const base = new THREE.Mesh(baseGeo, darkMetalMat);
  base.position.y = 0.06;
  group.add(base);

  const coreGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.30, 16);
  const core = new THREE.Mesh(coreGeo, polymerMat);
  core.position.y = 0.25;
  group.add(core);

  const lightGeo = new THREE.TorusGeometry(0.19, 0.028, 8, 24);
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 2.2,
  });
  const light = new THREE.Mesh(lightGeo, lightMat);
  light.rotation.x = Math.PI / 2;
  light.position.y = 0.42;
  light.name = 'spike_light';
  group.add(light);

  loadGLBSubNode('/models/free_pack_-_sci_fi_weapon.glb', 'SM_Sci_FiWeapon_Bomb').then((bomb) => {
    if (!bomb) return;
    const box = new THREE.Box3().setFromObject(bomb);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const targetH = 0.48;
    const scale = targetH / Math.max(0.01, size.y);

    const holder = new THREE.Group();
    bomb.position.set(-center.x, -box.min.y, -center.z);
    holder.add(bomb);
    holder.scale.setScalar(scale);

    group.remove(base, core);
    group.add(holder);
  });

  return group;
}
