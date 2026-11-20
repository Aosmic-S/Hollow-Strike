/**
 * Hollow Strike - Procedural & GLB 3D Weapon Models & Viewmodel Profiles
 * Full 18-weapon arsenal with Valorant-inspired tactical silhouettes, optics, suppressors,
 * and normalized Box3 scale/orientation (-Z barrel forward, grip anchored near origin).
 */

import * as THREE from 'three';
import { loadGLBModel, loadGLBSubNode, normalizeWeaponModel, NormalizeWeaponOptions } from './modelLoader';

const darkMetalMat = new THREE.MeshStandardMaterial({
  color: 0x161f29,
  roughness: 0.34,
  metalness: 0.86,
});

const gunmetalMat = new THREE.MeshStandardMaterial({
  color: 0x263342,
  roughness: 0.38,
  metalness: 0.78,
});

const polymerMat = new THREE.MeshStandardMaterial({
  color: 0x0f1923,
  roughness: 0.78,
  metalness: 0.14,
});

const crimsonAccentMat = new THREE.MeshStandardMaterial({
  color: 0xff4655,
  emissive: 0xff4655,
  emissiveIntensity: 0.75,
  roughness: 0.25,
  metalness: 0.4,
});

const tealAccentMat = new THREE.MeshStandardMaterial({
  color: 0x17e5b8,
  emissive: 0x17e5b8,
  emissiveIntensity: 0.85,
  roughness: 0.2,
  metalness: 0.45,
});

const lensMat = new THREE.MeshStandardMaterial({
  color: 0x0ea5e9,
  emissive: 0x17e5b8,
  emissiveIntensity: 0.65,
  roughness: 0.08,
  metalness: 0.9,
});

export interface WeaponViewmodelProfile {
  hipPos: [number, number, number];
  adsPos: [number, number, number];
  flashPos: [number, number, number];
}

const WEAPON_VIEWMODEL_PROFILES: Record<string, WeaponViewmodelProfile> = {
  // === SIDEARMS ===
  KADENCE: { hipPos: [0.22, -0.21, -0.40], adsPos: [0, -0.13, -0.32], flashPos: [0, 0.04, -0.16] },
  THORN: { hipPos: [0.22, -0.20, -0.39], adsPos: [0, -0.13, -0.32], flashPos: [0, 0.04, -0.18] },
  FURY: { hipPos: [0.23, -0.21, -0.40], adsPos: [0, -0.13, -0.31], flashPos: [0, 0.04, -0.21] },
  FRENKY: { hipPos: [0.23, -0.22, -0.41], adsPos: [0, -0.14, -0.32], flashPos: [0, 0.045, -0.23] },
  HANGMAN: { hipPos: [0.23, -0.21, -0.42], adsPos: [0, -0.135, -0.32], flashPos: [0, 0.045, -0.24] },

  // === SMGs ===
  MANTIS: { hipPos: [0.24, -0.22, -0.43], adsPos: [0, -0.14, -0.31], flashPos: [0, 0.04, -0.34] },
  STINGRAY: { hipPos: [0.24, -0.22, -0.42], adsPos: [0, -0.14, -0.30], flashPos: [0, 0.04, -0.29] },

  // === SHOTGUNS ===
  SLUG: { hipPos: [0.25, -0.23, -0.46], adsPos: [0, -0.15, -0.33], flashPos: [0, 0.04, -0.42] },
  JACKAL: { hipPos: [0.25, -0.23, -0.46], adsPos: [0, -0.15, -0.33], flashPos: [0, 0.045, -0.41] },

  // === RIFLES ===
  REAPER: { hipPos: [0.25, -0.23, -0.46], adsPos: [0, -0.148, -0.31], flashPos: [0, 0.045, -0.43] },
  ECLIPSE: { hipPos: [0.25, -0.23, -0.46], adsPos: [0, -0.148, -0.31], flashPos: [0, 0.045, -0.48] },
  VEIL: { hipPos: [0.25, -0.22, -0.45], adsPos: [0, -0.152, -0.30], flashPos: [0, 0.04, -0.42] },
  TUSK: { hipPos: [0.25, -0.22, -0.45], adsPos: [0, -0.148, -0.31], flashPos: [0, 0.042, -0.41] },

  // === SNIPERS ===
  BOLT: { hipPos: [0.26, -0.23, -0.48], adsPos: [0, -0.155, -0.30], flashPos: [0, 0.045, -0.52] },
  ORACLE: { hipPos: [0.27, -0.24, -0.50], adsPos: [0, -0.158, -0.29], flashPos: [0, 0.048, -0.60] },

  // === MACHINE GUNS ===
  STORM: { hipPos: [0.26, -0.24, -0.47], adsPos: [0, -0.15, -0.32], flashPos: [0, 0.045, -0.45] },
  THOR: { hipPos: [0.27, -0.25, -0.49], adsPos: [0, -0.155, -0.32], flashPos: [0, 0.05, -0.50] },

  // === MELEE ===
  HOLLOW_BLADE: { hipPos: [0.28, -0.26, -0.38], adsPos: [0.28, -0.26, -0.38], flashPos: [0, 0.04, -0.22] },
};

export function getWeaponViewmodelProfile(weaponId: string): WeaponViewmodelProfile {
  return WEAPON_VIEWMODEL_PROFILES[weaponId] ?? WEAPON_VIEWMODEL_PROFILES.KADENCE;
}

function syncLayerMask(target: THREE.Object3D, mask: number) {
  target.traverse((child) => {
    child.layers.mask = mask;
  });
}

type TacticalAttachmentSpec = {
  suppressor?: boolean;
  suppressorZ?: number;
  holoSight?: boolean;
  sniperScope?: boolean;
  drumMag?: boolean;
  extendedMag?: boolean;
  accentColor?: 'crimson' | 'teal';
};

function buildTacticalAttachments(spec: TacticalAttachmentSpec): THREE.Group {
  const mods = new THREE.Group();
  mods.name = 'tactical_mods';
  const accentMat = spec.accentColor === 'teal' ? tealAccentMat : crimsonAccentMat;

  // Sleek side rail energy strip
  const railStrip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.008, 0.14), accentMat);
  railStrip.position.set(0, 0.042, -0.06);
  mods.add(railStrip);

  if (spec.suppressor) {
    const canGeo = new THREE.CylinderGeometry(0.017, 0.018, 0.15, 12);
    canGeo.rotateX(Math.PI / 2);
    const can = new THREE.Mesh(canGeo, polymerMat);
    can.position.set(0, 0.036, spec.suppressorZ ?? -0.34);
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.038, 0.02), accentMat);
    collar.position.set(0, 0.036, (spec.suppressorZ ?? -0.34) + 0.068);
    mods.add(can, collar);
  }

  if (spec.holoSight) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.016, 0.065), darkMetalMat);
    base.position.set(0, 0.072, -0.02);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.026, 0.04), gunmetalMat);
    hood.position.set(0, 0.092, -0.02);
    const reticle = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, 0.004), accentMat);
    reticle.position.set(0, 0.092, -0.022);
    mods.add(base, hood, reticle);
  }

  if (spec.sniperScope) {
    const tubeGeo = new THREE.CylinderGeometry(0.019, 0.019, 0.24, 12);
    tubeGeo.rotateX(Math.PI / 2);
    const tube = new THREE.Mesh(tubeGeo, darkMetalMat);
    tube.position.set(0, 0.088, -0.05);

    const bellGeo = new THREE.CylinderGeometry(0.027, 0.019, 0.06, 12);
    bellGeo.rotateX(Math.PI / 2);
    const bell = new THREE.Mesh(bellGeo, gunmetalMat);
    bell.position.set(0, 0.088, -0.17);

    const lensGeo = new THREE.CylinderGeometry(0.023, 0.023, 0.008, 12);
    lensGeo.rotateX(Math.PI / 2);
    const lensFront = new THREE.Mesh(lensGeo, lensMat);
    lensFront.position.set(0, 0.088, -0.198);
    const lensRear = new THREE.Mesh(lensGeo, lensMat);
    lensRear.position.set(0, 0.088, 0.068);

    const ringStrip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.01, 0.02), accentMat);
    ringStrip.position.set(0, 0.088, -0.05);
    mods.add(tube, bell, lensFront, lensRear, ringStrip);
  }

  if (spec.drumMag) {
    const drumGeo = new THREE.CylinderGeometry(0.058, 0.058, 0.055, 14);
    drumGeo.rotateZ(Math.PI / 2);
    const drum = new THREE.Mesh(drumGeo, polymerMat);
    drum.position.set(0, -0.06, -0.11);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.05), accentMat);
    cap.position.set(0, -0.06, -0.11);
    mods.add(drum, cap);
  } else if (spec.extendedMag) {
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.14, 0.042), polymerMat);
    mag.rotation.x = 0.18;
    mag.position.set(0, -0.08, -0.08);
    mods.add(mag);
  }

  return mods;
}

function attachNormalizedGLB(
  container: THREE.Group,
  loaderFn: () => Promise<THREE.Group | null>,
  options: NormalizeWeaponOptions
) {
  loaderFn().then((rawObj) => {
    if (!rawObj) return;
    const normalized = normalizeWeaponModel(rawObj, options);
    syncLayerMask(normalized, container.layers.mask);

    for (let i = container.children.length - 1; i >= 0; i--) {
      const child = container.children[i];
      if (child.name !== 'vm_muzzle_flash' && child.name !== 'tactical_mods') {
        container.remove(child);
      }
    }

    container.add(normalized);
  });
}

function buildCompactFallback(length: number, height: number, accent: 'crimson' | 'teal' = 'crimson'): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.042, height, length * 0.72), darkMetalMat);
  body.position.set(0, 0.02, -length * 0.12);
  const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.046, height * 0.35, length * 0.55), gunmetalMat);
  shroud.position.set(0, 0.036, -length * 0.15);
  const accentBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.048, 0.008, length * 0.25),
    accent === 'teal' ? tealAccentMat : crimsonAccentMat
  );
  accentBar.position.set(0, 0.028, -length * 0.08);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.10, 0.046), polymerMat);
  grip.rotation.x = -0.25;
  grip.position.set(0, -0.05, 0.02);
  g.add(body, shroud, accentBar, grip);
  return g;
}

function buildHollowBladeModel(): THREE.Group {
  const group = new THREE.Group();
  // Immediate crisp fallback tactical Void Katana/Karambit silhouette
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.16, 8), polymerMat);
  handle.rotation.x = Math.PI * 0.32;
  handle.position.set(0, -0.01, -0.02);

  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.016, 0.03), crimsonAccentMat);
  guard.position.set(0, 0.03, -0.07);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.038, 0.36), gunmetalMat);
  blade.rotation.x = -0.18;
  blade.position.set(0, 0.07, -0.23);

  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.36), tealAccentMat);
  edge.rotation.x = -0.18;
  edge.position.set(0, 0.09, -0.23);

  group.add(handle, guard, blade, edge);

  attachNormalizedGLB(
    group,
    () => loadGLBSubNode('/models/free_pack_-_sci_fi_weapon.glb', 'SM_Sci_FiWeapon_Katana'),
    {
      targetLength: 0.56,
      forwardAxis: '+x',
      pivotShift: [0, 0.01, -0.06],
    }
  );
  return group;
}

type WeaponModelRecipe = {
  source: 'sci-fi_gun' | 'handgun' | 'smg' | 'carbine' | 'riflegun' | 'honey_badger' | 'machinegun';
  length: number;
  height: number;
  mods?: TacticalAttachmentSpec;
};

const WEAPON_RECIPES: Record<string, WeaponModelRecipe> = {
  // Sidearms
  KADENCE: { source: 'sci-fi_gun', length: 0.24, height: 0.045, mods: { accentColor: 'teal' } },
  THORN: { source: 'handgun', length: 0.26, height: 0.046, mods: { suppressor: true, suppressorZ: -0.20, accentColor: 'teal' } },
  FURY: { source: 'smg', length: 0.31, height: 0.052, mods: { extendedMag: true, accentColor: 'crimson' } },
  FRENKY: { source: 'handgun', length: 0.29, height: 0.06, mods: { drumMag: false, accentColor: 'crimson' } },
  HANGMAN: { source: 'sci-fi_gun', length: 0.33, height: 0.058, mods: { holoSight: true, accentColor: 'crimson' } },

  // SMGs
  MANTIS: { source: 'smg', length: 0.52, height: 0.066, mods: { suppressor: true, suppressorZ: -0.34, holoSight: true, accentColor: 'teal' } },
  STINGRAY: { source: 'smg', length: 0.45, height: 0.062, mods: { extendedMag: true, accentColor: 'crimson' } },

  // Shotguns
  SLUG: { source: 'carbine', length: 0.72, height: 0.075, mods: { accentColor: 'crimson' } },
  JACKAL: { source: 'riflegun', length: 0.70, height: 0.08, mods: { drumMag: true, holoSight: true, accentColor: 'crimson' } },

  // Rifles
  REAPER: { source: 'carbine', length: 0.78, height: 0.08, mods: { holoSight: true, extendedMag: true, accentColor: 'crimson' } },
  ECLIPSE: { source: 'honey_badger', length: 0.78, height: 0.076, mods: { suppressor: true, suppressorZ: -0.48, holoSight: true, accentColor: 'teal' } },
  VEIL: { source: 'riflegun', length: 0.74, height: 0.078, mods: { holoSight: true, accentColor: 'teal' } },
  TUSK: { source: 'carbine', length: 0.75, height: 0.082, mods: { accentColor: 'crimson' } },

  // Snipers
  BOLT: { source: 'riflegun', length: 0.92, height: 0.074, mods: { sniperScope: true, accentColor: 'teal' } },
  ORACLE: { source: 'machinegun', length: 1.04, height: 0.086, mods: { sniperScope: true, accentColor: 'crimson' } },

  // Machine Guns
  STORM: { source: 'machinegun', length: 0.84, height: 0.086, mods: { drumMag: true, holoSight: true, accentColor: 'teal' } },
  THOR: { source: 'machinegun', length: 0.96, height: 0.095, mods: { drumMag: true, holoSight: true, accentColor: 'crimson' } },
};

function instantiateFromRecipe(recipe: WeaponModelRecipe): THREE.Group {
  const accent = recipe.mods?.accentColor ?? 'crimson';
  const group = buildCompactFallback(recipe.length, recipe.height, accent);

  if (recipe.mods) {
    group.add(buildTacticalAttachments(recipe.mods));
  }

  let loaderFn: () => Promise<THREE.Group | null>;
  let forwardAxis: '+x' | '-z' = '-z';

  switch (recipe.source) {
    case 'sci-fi_gun':
      loaderFn = () => loadGLBModel('/models/sci-fi_gun.glb');
      forwardAxis = '-z';
      break;
    case 'handgun':
      loaderFn = () => loadGLBSubNode('/models/free_pack_-_sci_fi_weapon.glb', 'SM_Sci_FiWeapon_HandGun');
      forwardAxis = '+x';
      break;
    case 'smg':
      loaderFn = () => loadGLBModel('/models/smg.glb');
      forwardAxis = '-z';
      break;
    case 'carbine':
      loaderFn = () => loadGLBModel('/models/carbine_rifle.glb');
      forwardAxis = '-z';
      break;
    case 'riflegun':
      loaderFn = () => loadGLBSubNode('/models/free_pack_-_sci_fi_weapon.glb', 'SM_Sci_FiWeapon_RifleGun');
      forwardAxis = '+x';
      break;
    case 'honey_badger':
      loaderFn = () => loadGLBModel('/models/aac_honey_badger.glb');
      forwardAxis = '+x';
      break;
    case 'machinegun':
    default:
      loaderFn = () => loadGLBSubNode('/models/free_pack_-_sci_fi_weapon.glb', 'SM_Sci_FiWeapon_MachineGun');
      forwardAxis = '+x';
      break;
  }

  attachNormalizedGLB(group, loaderFn, {
    targetLength: recipe.length,
    forwardAxis,
    pivotShift: [0, 0.015, -Math.min(0.07, recipe.length * 0.08)],
  });

  return group;
}

/**
 * Unified Weapon Model Factory by Weapon ID (supports all 18 arsenal weapons)
 */
export function createWeaponModel(weaponId: string): THREE.Group {
  if (weaponId === 'HOLLOW_BLADE') {
    return buildHollowBladeModel();
  }
  const recipe = WEAPON_RECIPES[weaponId] ?? WEAPON_RECIPES.KADENCE;
  return instantiateFromRecipe(recipe);
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
    color: 0xff4655,
    emissive: 0xff4655,
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
