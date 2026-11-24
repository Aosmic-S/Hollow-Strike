/**
 * Hollow Strike - 3D Weapon Models & Viewmodel Profiles
 * Uses the 5 bespoke weapon GLBs in /Assests/Weapon_models/ (Jackal, Mantis, Oracle, Stingray, Veil)
 * plus distinct, crisp multi-part 3D silhouettes for the remaining arsenal and Hollow Blade.
 * Zero legacy /models/*.glb references remain.
 */

import * as THREE from 'three';
import { LoadGLBOptions, loadGLBModel, normalizeWeaponModel } from './modelLoader';

const darkMetalMat = new THREE.MeshStandardMaterial({
  color: 0x334458,
  roughness: 0.42,
  metalness: 0.48,
});

const gunmetalMat = new THREE.MeshStandardMaterial({
  color: 0x62758a,
  roughness: 0.36,
  metalness: 0.52,
});

const chromeMat = new THREE.MeshStandardMaterial({
  color: 0xdbe4ef,
  roughness: 0.24,
  metalness: 0.62,
});

const polymerMat = new THREE.MeshStandardMaterial({
  color: 0x243140,
  roughness: 0.72,
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

const amberAccentMat = new THREE.MeshStandardMaterial({
  color: 0xf59e0b,
  emissive: 0xf59e0b,
  emissiveIntensity: 0.65,
  roughness: 0.25,
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
  KADENCE: { hipPos: [0.22, -0.21, -0.40], adsPos: [0, -0.118, -0.32], flashPos: [0, 0.04, -0.18] },
  THORN: { hipPos: [0.22, -0.20, -0.39], adsPos: [0, -0.118, -0.32], flashPos: [0, 0.04, -0.21] },
  FURY: { hipPos: [0.23, -0.21, -0.40], adsPos: [0, -0.12, -0.31], flashPos: [0, 0.04, -0.22] },
  FRENKY: { hipPos: [0.23, -0.22, -0.41], adsPos: [0, -0.125, -0.32], flashPos: [0, 0.045, -0.24] },
  HANGMAN: { hipPos: [0.23, -0.21, -0.42], adsPos: [0, -0.122, -0.32], flashPos: [0, 0.045, -0.25] },

  // === SMGs ===
  MANTIS: { hipPos: [0.23, -0.21, -0.41], adsPos: [0, -0.105, -0.30], flashPos: [0, 0.036, -0.31] },
  STINGRAY: { hipPos: [0.22, -0.21, -0.40], adsPos: [0, -0.102, -0.29], flashPos: [0, 0.036, -0.27] },

  // === SHOTGUNS ===
  SLUG: { hipPos: [0.25, -0.23, -0.46], adsPos: [0, -0.135, -0.33], flashPos: [0, 0.04, -0.42] },
  JACKAL: { hipPos: [0.24, -0.22, -0.44], adsPos: [0, -0.112, -0.32], flashPos: [0, 0.04, -0.37] },

  // === RIFLES ===
  REAPER: { hipPos: [0.25, -0.23, -0.46], adsPos: [0, -0.135, -0.31], flashPos: [0, 0.045, -0.44] },
  ECLIPSE: { hipPos: [0.25, -0.23, -0.46], adsPos: [0, -0.135, -0.31], flashPos: [0, 0.045, -0.49] },
  VEIL: { hipPos: [0.24, -0.22, -0.44], adsPos: [0, -0.112, -0.30], flashPos: [0, 0.04, -0.40] },
  TUSK: { hipPos: [0.25, -0.22, -0.45], adsPos: [0, -0.135, -0.31], flashPos: [0, 0.042, -0.42] },

  // === SNIPERS ===
  BOLT: { hipPos: [0.26, -0.23, -0.48], adsPos: [0, -0.138, -0.30], flashPos: [0, 0.045, -0.52] },
  ORACLE: { hipPos: [0.25, -0.23, -0.47], adsPos: [0, -0.118, -0.29], flashPos: [0, 0.044, -0.52] },

  // === MACHINE GUNS ===
  STORM: { hipPos: [0.26, -0.24, -0.47], adsPos: [0, -0.138, -0.32], flashPos: [0, 0.045, -0.45] },
  THOR: { hipPos: [0.27, -0.25, -0.49], adsPos: [0, -0.142, -0.32], flashPos: [0, 0.05, -0.50] },

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

export const WEAPON_GLB_LOAD_OPTIONS: LoadGLBOptions = {
  clone: true,
  castShadow: false,
  maxTextureSize: 256,
  stripSecondaryMaps: true,
  normalizePbrForLighting: true,
};

// Optimized bespoke weapon GLBs under /public/Assests/Weapon_models/
export const WEAPON_GLB_CONFIG: Record<
  string,
  {
    path: string;
    targetLength: number;
    forwardAxis: '+x' | '-x' | '+z' | '-z';
    pivotShift: [number, number, number];
    sightType: 'holo' | 'scope';
    sightZ: number;
    accentColor: 'teal' | 'crimson';
  }
> = {
  JACKAL: {
    path: '/Assests/Weapon_models/Jackal.glb',
    targetLength: 0.58,
    forwardAxis: '-x',
    pivotShift: [0, 0.012, -0.09],
    sightType: 'holo',
    sightZ: -0.06,
    accentColor: 'crimson',
  },
  MANTIS: {
    path: '/Assests/Weapon_models/mantis.glb',
    targetLength: 0.48,
    forwardAxis: '-x',
    pivotShift: [0, 0.014, -0.07],
    sightType: 'holo',
    sightZ: -0.04,
    accentColor: 'teal',
  },
  ORACLE: {
    path: '/Assests/Weapon_models/oracle.glb',
    targetLength: 0.78,
    forwardAxis: '-x',
    pivotShift: [0, 0.015, -0.14],
    sightType: 'scope',
    sightZ: -0.08,
    accentColor: 'crimson',
  },
  STINGRAY: {
    path: '/Assests/Weapon_models/stringray.glb',
    targetLength: 0.42,
    forwardAxis: '-x',
    pivotShift: [0, 0.012, -0.06],
    sightType: 'holo',
    sightZ: -0.03,
    accentColor: 'crimson',
  },
  VEIL: {
    path: '/Assests/Weapon_models/veil.glb',
    targetLength: 0.64,
    forwardAxis: '-x',
    pivotShift: [0, 0.012, -0.11],
    sightType: 'holo',
    sightZ: -0.06,
    accentColor: 'teal',
  },
};

export function getWeaponGLBPaths(): Array<{ id: string; path: string }> {
  return Object.entries(WEAPON_GLB_CONFIG).map(([id, cfg]) => ({ id, path: cfg.path }));
}

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function cyl(rTop: number, rBot: number, len: number, mat: THREE.Material, x: number, y: number, z: number, axis: 'z' | 'y' | 'x' = 'z'): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(rTop, rBot, len, 12);
  if (axis === 'z') geo.rotateX(Math.PI / 2);
  if (axis === 'x') geo.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

function addHoloOptic(g: THREE.Group, y: number, z: number, accent: THREE.Material) {
  const railBase = box(0.028, 0.012, 0.064, darkMetalMat, 0, y, z);
  const frameL = box(0.005, 0.026, 0.036, gunmetalMat, -0.016, y + 0.018, z);
  const frameR = box(0.005, 0.026, 0.036, gunmetalMat, 0.016, y + 0.018, z);
  const frameTop = box(0.037, 0.005, 0.036, gunmetalMat, 0, y + 0.031, z);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.026, 0.022, 0.004),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })
  );
  glass.position.set(0, y + 0.018, z);
  const reticleDot = box(0.005, 0.005, 0.005, accent, 0, y + 0.018, z - 0.002);
  g.add(railBase, frameL, frameR, frameTop, glass, reticleDot);
}

function addScope(g: THREE.Group, y: number, z: number, len: number, accent: THREE.Material) {
  g.add(
    box(0.022, 0.018, len * 0.4, darkMetalMat, 0, y - 0.012, z),
    cyl(0.017, 0.017, len, darkMetalMat, 0, y + 0.008, z, 'z'),
    cyl(0.024, 0.017, 0.055, gunmetalMat, 0, y + 0.008, z - len * 0.52, 'z'),
    cyl(0.020, 0.020, 0.008, lensMat, 0, y + 0.008, z - len * 0.55, 'z'),
    box(0.038, 0.007, 0.018, accent, 0, y + 0.008, z)
  );
}

function buildPistol(id: string): THREE.Group {
  const g = new THREE.Group();
  const isCrimson = id === 'FURY' || id === 'FRENKY' || id === 'HANGMAN';
  const accent = isCrimson ? crimsonAccentMat : tealAccentMat;

  // Ergonomic grip
  const grip = box(0.032, 0.105, 0.044, polymerMat, 0, -0.042, 0.015);
  grip.rotation.x = -0.24;
  g.add(grip);

  if (id === 'HANGMAN') {
    // Heavy revolver silhouette with rotating 6-shot cylinder
    g.add(
      box(0.034, 0.042, 0.14, gunmetalMat, 0, 0.022, -0.05),
      cyl(0.026, 0.026, 0.062, chromeMat, 0, 0.03, -0.06, 'z'),
      box(0.026, 0.034, 0.15, darkMetalMat, 0, 0.034, -0.16),
      box(0.03, 0.008, 0.11, accent, 0, 0.054, -0.11)
    );
    addHoloOptic(g, 0.056, -0.07, accent);
    return g;
  }

  if (id === 'FRENKY') {
    // Double-barrel pocket shotgun with fiber-optic front sight
    g.add(
      box(0.044, 0.04, 0.13, polymerMat, 0, 0.018, -0.04),
      cyl(0.014, 0.014, 0.18, chromeMat, -0.015, 0.036, -0.14, 'z'),
      cyl(0.014, 0.014, 0.18, chromeMat, 0.015, 0.036, -0.14, 'z'),
      box(0.046, 0.01, 0.08, accent, 0, 0.025, -0.10),
      box(0.007, 0.012, 0.012, accent, 0, 0.052, -0.21)
    );
    addHoloOptic(g, 0.048, -0.04, accent);
    return g;
  }

  // Standard tactical pistol / auto-pistol (Kadence, Thorn, Fury)
  const triggerGuardFront = box(0.012, 0.032, 0.01, darkMetalMat, 0, -0.014, -0.056);
  const triggerGuardBottom = box(0.012, 0.009, 0.048, darkMetalMat, 0, -0.03, -0.036);
  const triggerBlade = box(0.006, 0.02, 0.008, chromeMat, 0, -0.012, -0.034);
  triggerBlade.rotation.x = 0.25;
  const magBasePlate = box(0.035, 0.012, 0.048, chromeMat, 0, -0.095, 0.028);
  magBasePlate.rotation.x = -0.24;

  g.add(
    // Lower polymer frame + dustcover rail
    box(0.035, 0.028, 0.185, polymerMat, 0, 0.014, -0.062),
    // Two-tone machined tungsten slide + top flat + glowing iron sights
    box(0.037, 0.030, 0.196, gunmetalMat, 0, 0.041, -0.066),
    box(0.029, 0.007, 0.194, chromeMat, 0, 0.057, -0.066),
    // Ejection port accent + side rail trim
    box(0.039, 0.007, 0.098, accent, 0, 0.041, -0.092),
    // Exposed chrome barrel crown at muzzle
    cyl(0.011, 0.011, 0.026, chromeMat, 0, 0.040, -0.17, 'z'),
    // Illuminated fiber-optic front & rear sights
    box(0.007, 0.011, 0.012, accent, 0, 0.064, -0.155),
    box(0.009, 0.010, 0.008, accent, -0.009, 0.064, 0.02),
    box(0.009, 0.010, 0.008, accent, 0.009, 0.064, 0.02),
    triggerGuardFront,
    triggerGuardBottom,
    triggerBlade,
    magBasePlate
  );
  if (id === 'THORN') {
    // Integrated suppressor can
    g.add(
      cyl(0.016, 0.016, 0.125, darkMetalMat, 0, 0.040, -0.225, 'z'),
      cyl(0.017, 0.017, 0.014, accent, 0, 0.040, -0.175, 'z')
    );
  }
  if (id === 'FURY') {
    // Extended high-cap magazine & fore-rail compensator
    const extMag = box(0.024, 0.09, 0.032, darkMetalMat, 0, -0.085, 0.028);
    extMag.rotation.x = -0.24;
    g.add(extMag, box(0.036, 0.020, 0.065, chromeMat, 0, 0.004, -0.13));
  }
  return g;
}

function buildLongGun(id: string): THREE.Group {
  const g = new THREE.Group();
  const useTeal = id === 'ECLIPSE' || id === 'VEIL' || id === 'BOLT' || id === 'STORM' || id === 'MANTIS';
  const accent = useTeal ? tealAccentMat : id === 'TUSK' ? amberAccentMat : crimsonAccentMat;

  const isSniper = id === 'BOLT' || id === 'ORACLE';
  const isShotgun = id === 'SLUG' || id === 'JACKAL';
  const isLMG = id === 'STORM' || id === 'THOR';
  const isSMG = id === 'MANTIS' || id === 'STINGRAY';

  const bodyLen = isSniper ? 0.56 : isLMG ? 0.52 : isSMG ? 0.32 : 0.44;
  const barrelLen = isSniper ? 0.46 : isLMG ? 0.32 : isSMG ? 0.18 : 0.28;

  // Rear grip & stock
  const grip = box(0.034, 0.115, 0.048, polymerMat, 0, -0.052, 0.025);
  grip.rotation.x = -0.25;
  g.add(
    grip,
    box(0.038, 0.072, 0.18, polymerMat, 0, 0.016, 0.13),
    box(0.04, 0.085, 0.03, gunmetalMat, 0, 0.008, 0.22)
  );

  // Main upper & lower receiver
  g.add(
    box(0.048, 0.064, bodyLen, gunmetalMat, 0, 0.028, -bodyLen * 0.35),
    box(0.042, 0.032, bodyLen * 0.88, darkMetalMat, 0, 0.062, -bodyLen * 0.34),
    box(0.052, 0.008, bodyLen * 0.55, accent, 0, 0.042, -bodyLen * 0.36)
  );

  // Barrel + muzzle or suppressor
  g.add(
    cyl(0.012, 0.014, barrelLen, darkMetalMat, 0, 0.04, -bodyLen * 0.78 - barrelLen * 0.45, 'z')
  );

  if (id === 'ECLIPSE' || id === 'MANTIS') {
    g.add(
      cyl(0.02, 0.02, 0.16, polymerMat, 0, 0.04, -bodyLen * 0.78 - barrelLen * 0.85, 'z'),
      box(0.042, 0.01, 0.022, accent, 0, 0.04, -bodyLen * 0.78 - barrelLen * 0.6)
    );
  } else {
    g.add(
      cyl(0.016, 0.016, 0.045, chromeMat, 0, 0.04, -bodyLen * 0.78 - barrelLen * 0.9, 'z')
    );
  }

  // Pump / handguard
  if (isShotgun) {
    g.add(
      cyl(0.019, 0.019, 0.24, darkMetalMat, 0, 0.015, -0.34, 'z'),
      box(0.044, 0.032, 0.16, polymerMat, 0, 0.008, -0.32)
    );
  }

  // Magazine / Drum
  if (isLMG || id === 'JACKAL') {
    g.add(
      cyl(0.055, 0.055, 0.06, polymerMat, 0, -0.055, -0.14, 'x'),
      box(0.062, 0.012, 0.05, accent, 0, -0.055, -0.14)
    );
    if (isLMG) {
      g.add(box(0.044, 0.035, 0.09, darkMetalMat, 0, -0.035, -0.04));
    }
  } else if (!isShotgun) {
    const mag = box(0.026, 0.14, 0.044, polymerMat, 0, -0.075, -0.12);
    mag.rotation.x = 0.2;
    g.add(mag);
  }

  // Optics (all long guns including Slug now feature crisp tactical optics)
  if (isSniper) {
    addScope(g, 0.088, -0.12, 0.25, accent);
  } else {
    addHoloOptic(g, 0.082, -0.06, accent);
  }

  return g;
}

function buildHollowBladeModel(): THREE.Group {
  const group = new THREE.Group();
  const handle = cyl(0.015, 0.017, 0.16, polymerMat, 0, -0.01, -0.02, 'y');
  handle.rotation.x = Math.PI * 0.32;

  const pommel = box(0.026, 0.022, 0.026, crimsonAccentMat, 0, -0.055, 0.025);
  const guard = box(0.062, 0.016, 0.034, darkMetalMat, 0, 0.032, -0.072);
  const blade = box(0.01, 0.04, 0.38, chromeMat, 0, 0.075, -0.24);
  blade.rotation.x = -0.18;
  const edge = box(0.012, 0.01, 0.38, tealAccentMat, 0, 0.095, -0.24);
  edge.rotation.x = -0.18;
  const spine = box(0.014, 0.012, 0.28, crimsonAccentMat, 0, 0.058, -0.19);
  spine.rotation.x = -0.18;

  group.add(handle, pommel, guard, blade, edge, spine);
  return group;
}

/**
 * Unified Weapon Model Factory by Weapon ID (supports all 18 arsenal weapons)
 * Uses optimized bespoke GLBs under /Assests/Weapon_models/ for first-person viewmodels,
 * mounts calibrated 3D holo/scope optics directly onto the normalized receiver top rail,
 * and allows lightweight `proceduralOnly` models for third-person bots.
 */
export function createWeaponModel(
  weaponId: string,
  options: { proceduralOnly?: boolean } = {}
): THREE.Group {
  if (weaponId === 'HOLLOW_BLADE') {
    return buildHollowBladeModel();
  }

  const isSidearm = ['KADENCE', 'THORN', 'FURY', 'FRENKY', 'HANGMAN'].includes(weaponId);
  const container = isSidearm ? buildPistol(weaponId) : buildLongGun(weaponId);

  const glbCfg = options.proceduralOnly ? undefined : WEAPON_GLB_CONFIG[weaponId];
  if (glbCfg) {
    loadGLBModel(glbCfg.path, WEAPON_GLB_LOAD_OPTIONS).then((rawObj) => {
      if (!rawObj) return;
      rawObj.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = false;
        }
      });
      const normalized = normalizeWeaponModel(rawObj, {
        targetLength: glbCfg.targetLength,
        forwardAxis: glbCfg.forwardAxis,
        pivotShift: glbCfg.pivotShift,
      });

      const normBox = new THREE.Box3().setFromObject(normalized);
      const topRailY = THREE.MathUtils.clamp(normBox.max.y, 0.032, 0.095);
      const opticGroup = new THREE.Group();
      opticGroup.name = 'vm_mounted_optic';
      const accent = glbCfg.accentColor === 'teal' ? tealAccentMat : crimsonAccentMat;
      if (glbCfg.sightType === 'scope') {
        addScope(opticGroup, topRailY + 0.014, glbCfg.sightZ, 0.22, accent);
      } else {
        addHoloOptic(opticGroup, topRailY + 0.004, glbCfg.sightZ, accent);
      }

      syncLayerMask(normalized, container.layers.mask);
      syncLayerMask(opticGroup, container.layers.mask);

      for (let i = container.children.length - 1; i >= 0; i--) {
        const child = container.children[i];
        if (child.name !== 'vm_muzzle_flash') {
          container.remove(child);
        }
      }
      container.add(normalized, opticGroup);
    });
  }

  return container;
}

/**
 * Creates 3D model for the Tactical Spike Core (procedural Void-reactor bomb)
 */
export function createSpikeModel(): THREE.Group {
  const group = new THREE.Group();

  const base = cyl(0.22, 0.26, 0.1, darkMetalMat, 0, 0.05, 0, 'y');
  const core = cyl(0.15, 0.17, 0.30, polymerMat, 0, 0.24, 0, 'y');
  const collar = cyl(0.19, 0.19, 0.05, gunmetalMat, 0, 0.15, 0, 'y');
  const topCap = cyl(0.11, 0.16, 0.06, chromeMat, 0, 0.41, 0, 'y');

  const lightGeo = new THREE.TorusGeometry(0.19, 0.026, 8, 24);
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xff4655,
    emissive: 0xff4655,
    emissiveIntensity: 2.2,
  });
  const light = new THREE.Mesh(lightGeo, lightMat);
  light.rotation.x = Math.PI / 2;
  light.position.y = 0.34;
  light.name = 'spike_light';

  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.08), tealAccentMat);
    fin.position.set(Math.sin(angle) * 0.19, 0.22, Math.cos(angle) * 0.19);
    fin.rotation.y = angle;
    group.add(fin);
  }

  group.add(base, core, collar, topCap, light);
  return group;
}
