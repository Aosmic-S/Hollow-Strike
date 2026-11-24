/**
 * Hollow Strike - GLB Model Loader, Texture Optimizer & Geometric Normalization
 * - Downscales oversized 2048px+ Tripo/Warehouse GLB textures on load to prevent GPU VRAM crashes.
 * - Uses fast geometry-sharing clone (`group.clone(true)`) for non-skinned static meshes.
 * - Normalizes weapon GLBs into standardized -Z forward frame.
 */

import * as THREE from 'three';
import { GLTFLoader, GLTFParser } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

interface SpecGlossExtDef {
  diffuseFactor?: number[];
  diffuseTexture?: { index: number; texCoord?: number };
  specularFactor?: number[];
  glossinessFactor?: number;
  specularGlossinessTexture?: { index: number; texCoord?: number };
}

function registerSpecGlossPlugin(loader: GLTFLoader) {
  loader.register((parser: GLTFParser) => {
    const extName = 'KHR_materials_pbrSpecularGlossiness';
    return {
      name: extName,
      getMaterialType: (materialIndex: number) => {
        const materialDef = parser.json.materials?.[materialIndex];
        if (!materialDef?.extensions?.[extName]) return null;
        return THREE.MeshStandardMaterial;
      },
      extendMaterialParams: async (
        materialIndex: number,
        materialParams: Record<string, unknown>
      ) => {
        const materialDef = parser.json.materials?.[materialIndex];
        const ext = materialDef?.extensions?.[extName] as SpecGlossExtDef | undefined;
        if (!ext) return;

        const pending: Promise<unknown>[] = [];

        if (Array.isArray(ext.diffuseFactor)) {
          materialParams.color = new THREE.Color().fromArray(ext.diffuseFactor);
          if (ext.diffuseFactor.length >= 4 && ext.diffuseFactor[3] < 1) {
            materialParams.opacity = ext.diffuseFactor[3];
            materialParams.transparent = true;
          }
        } else {
          materialParams.color = new THREE.Color(0xffffff);
        }

        if (ext.diffuseTexture) {
          pending.push(
            parser.assignTexture(materialParams, 'map', ext.diffuseTexture, THREE.SRGBColorSpace)
          );
        }

        const glossiness = ext.glossinessFactor !== undefined ? ext.glossinessFactor : 1.0;
        const specMax = Array.isArray(ext.specularFactor)
          ? Math.max(ext.specularFactor[0] ?? 0, ext.specularFactor[1] ?? 0, ext.specularFactor[2] ?? 0)
          : 0.15;

        materialParams.roughness = THREE.MathUtils.clamp(1.0 - glossiness * 0.72, 0.25, 0.96);
        materialParams.metalness = THREE.MathUtils.clamp(specMax * 0.35, 0.0, 0.35);

        if (ext.specularGlossinessTexture) {
          pending.push(
            parser.assignTexture(materialParams, 'roughnessMap', ext.specularGlossinessTexture)
          );
        }

        await Promise.all(pending);
      },
    };
  });
}

const gltfLoader = new GLTFLoader();
registerSpecGlossPlugin(gltfLoader);

interface CachedModelEntry {
  group: THREE.Group;
  hasSkinnedMesh: boolean;
}

const modelCache = new Map<string, CachedModelEntry>();
const loadingPromises = new Map<string, Promise<CachedModelEntry>>();

export interface LoadGLBOptions {
  /** Set false for heavy static arenas (e.g. Warehouse.glb) to skip cloning */
  clone?: boolean;
  /** Whether meshes should cast real-time shadows */
  castShadow?: boolean;
  /** Maximum texture dimension in pixels; downscales larger decoded GLB images */
  maxTextureSize?: number;
  /** Strip secondary normal/bump/roughness/metalness/ao maps to save GPU VRAM */
  stripSecondaryMaps?: boolean;
  /** Cap metalness and floor roughness so PBR weapons stay clearly lit */
  normalizePbrForLighting?: boolean;
}

function downscaleTexture(tex: THREE.Texture | null | undefined, maxDim: number): void {
  if (!tex || !tex.image || maxDim <= 0) return;
  const img = tex.image as {
    width?: number;
    height?: number;
    videoWidth?: number;
    close?: () => void;
  };
  const w = img.width || img.videoWidth || 0;
  const h = img.height || 0;
  if (w <= maxDim && h <= maxDim) return;
  if (w <= 0 || h <= 0) return;

  const scale = maxDim / Math.max(w, h);
  const nw = Math.max(16, Math.round(w * scale));
  const nh = Math.max(16, Math.round(h * scale));

  try {
    const canvas = document.createElement('canvas');
    canvas.width = nw;
    canvas.height = nh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(tex.image as CanvasImageSource, 0, 0, nw, nh);
    if (typeof img.close === 'function') {
      img.close();
    }
    tex.image = canvas;
    tex.needsUpdate = true;
  } catch {
    // Non-fatal fallback: keep original image
  }
}

function cloneEntry(entry: CachedModelEntry, shouldClone: boolean): THREE.Group {
  if (!shouldClone) return entry.group;
  if (entry.hasSkinnedMesh) {
    return SkeletonUtils.clone(entry.group) as THREE.Group;
  }
  // Static/non-skinned clone shares geometries & optimized textures cleanly
  return entry.group.clone(true);
}

function buildGLBCacheKey(path: string, options: LoadGLBOptions = {}): string {
  const maxTex = options.maxTextureSize ?? 512;
  const stripSecondary = options.stripSecondaryMaps === true;
  const normalizePbr = options.normalizePbrForLighting === true;
  return `${path}|t${maxTex}|s${stripSecondary ? 1 : 0}|p${normalizePbr ? 1 : 0}`;
}

/**
 * Loads and caches a GLB scene with optional texture downscaling & fast GPU-buffer sharing.
 */
export function loadGLBModel(path: string, options: LoadGLBOptions = {}): Promise<THREE.Group | null> {
  const shouldClone = options.clone !== false;
  const castShadow = options.castShadow === true;
  const maxTex = options.maxTextureSize ?? 512;
  const stripSecondary = options.stripSecondaryMaps === true;
  const normalizePbr = options.normalizePbrForLighting === true;
  const cacheKey = buildGLBCacheKey(path, options);

  if (modelCache.has(cacheKey)) {
    return Promise.resolve(cloneEntry(modelCache.get(cacheKey)!, shouldClone));
  }
  if (loadingPromises.has(cacheKey)) {
    return loadingPromises
      .get(cacheKey)!
      .then((entry) => cloneEntry(entry, shouldClone))
      .catch(() => null);
  }

  const promise = new Promise<CachedModelEntry>((resolve, reject) => {
    gltfLoader.load(
      path,
      (gltf) => {
        const group = gltf.scene;
        const toStrip: THREE.Object3D[] = [];
        const seenMats = new Set<THREE.Material>();
        const seenTex = new Set<THREE.Texture>();
        let hasSkinnedMesh = false;

        group.traverse((child) => {
          if ((child as THREE.Light).isLight || (child as THREE.Camera).isCamera) {
            toStrip.push(child);
            return;
          }
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = castShadow;
            child.receiveShadow = true;
            if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
              hasSkinnedMesh = true;
              child.frustumCulled = false;
            }
            const mat = (child as THREE.Mesh).material;
            const mats = Array.isArray(mat) ? mat : [mat];
            mats.forEach((m) => {
              if (!m || seenMats.has(m)) return;
              seenMats.add(m);

              if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
                const sm = m as THREE.MeshStandardMaterial;
                if (sm.map) {
                  sm.map.colorSpace = THREE.SRGBColorSpace;
                  if (!seenTex.has(sm.map)) {
                    seenTex.add(sm.map);
                    downscaleTexture(sm.map, maxTex);
                  }
                }
                if (stripSecondary) {
                  if (sm.normalMap) {
                    sm.normalMap.dispose();
                    sm.normalMap = null;
                  }
                  if (sm.bumpMap) {
                    sm.bumpMap.dispose();
                    sm.bumpMap = null;
                  }
                  if (sm.roughnessMap) {
                    sm.roughnessMap.dispose();
                    sm.roughnessMap = null;
                    sm.roughness = Math.max(sm.roughness, 0.72);
                  }
                  if (sm.metalnessMap) {
                    sm.metalnessMap.dispose();
                    sm.metalnessMap = null;
                    sm.metalness = Math.min(sm.metalness, 0.15);
                  }
                  if (sm.aoMap) {
                    sm.aoMap.dispose();
                    sm.aoMap = null;
                  }
                } else {
                  const secMax = Math.min(maxTex, 256);
                  for (const t of [sm.normalMap, sm.roughnessMap, sm.metalnessMap, sm.aoMap, sm.emissiveMap]) {
                    if (t && !seenTex.has(t)) {
                      seenTex.add(t);
                      downscaleTexture(t, secMax);
                    }
                  }
                }

                if (normalizePbr) {
                  sm.metalness = THREE.MathUtils.clamp(sm.metalness, 0, 0.62);
                  sm.roughness = THREE.MathUtils.clamp(sm.roughness, 0.28, 0.92);
                  sm.envMapIntensity = 1.25;
                }
                sm.needsUpdate = true;
              }
            });
          }
        });

        toStrip.forEach((o) => o.parent?.remove(o));
        const entry: CachedModelEntry = { group, hasSkinnedMesh };
        modelCache.set(cacheKey, entry);
        resolve(entry);
      },
      undefined,
      (error) => {
        loadingPromises.delete(cacheKey);
        console.warn(`Failed to load GLB model at ${path}:`, error);
        reject(error);
      }
    );
  });

  loadingPromises.set(cacheKey, promise);
  return promise
    .then((entry) => cloneEntry(entry, shouldClone))
    .catch(() => null);
}

/**
 * Concurrently preloads a batch of map + weapon GLBs into modelCache with matching options
 * so in-match instantiation and weapon swaps are instantaneous.
 */
export async function preloadGLBAssets(
  items: Array<{ path: string; options?: LoadGLBOptions }>,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  const unique = new Map<string, { path: string; options: LoadGLBOptions }>();
  for (const item of items) {
    if (!item?.path) continue;
    const opts: LoadGLBOptions = { ...item.options, clone: false };
    const key = buildGLBCacheKey(item.path, opts);
    if (!unique.has(key)) {
      unique.set(key, { path: item.path, options: opts });
    }
  }

  const list = Array.from(unique.values());
  const total = list.length;
  if (total === 0) {
    onProgress?.(1, 1);
    return;
  }

  let loaded = 0;
  onProgress?.(0, total);
  await Promise.all(
    list.map((entry) =>
      loadGLBModel(entry.path, entry.options).finally(() => {
        loaded++;
        onProgress?.(loaded, total);
      })
    )
  );
}

export type ForwardAxis = '-z' | '+z' | '+x' | '-x';

export interface NormalizeWeaponOptions {
  targetLength: number;
  forwardAxis: ForwardAxis;
  pivotShift?: [number, number, number];
  extraEuler?: [number, number, number];
}

/**
 * Normalizes any loaded weapon GLB into a standardized Three.js coordinate frame:
 * - Barrel points cleanly along -Z
 * - Upright along +Y
 * - Exact physical length in meters (`targetLength`)
 * - Centered cleanly around hand-grip origin (0, 0, 0)
 */
export function normalizeWeaponModel(
  rawObj: THREE.Object3D,
  options: NormalizeWeaponOptions
): THREE.Group {
  const oriented = new THREE.Group();
  const rotHolder = new THREE.Group();

  switch (options.forwardAxis) {
    case '-z':
      rotHolder.rotation.y = 0;
      break;
    case '+z':
      rotHolder.rotation.y = Math.PI;
      break;
    case '+x':
      rotHolder.rotation.y = Math.PI / 2;
      break;
    case '-x':
      rotHolder.rotation.y = -Math.PI / 2;
      break;
  }

  if (options.extraEuler) {
    rotHolder.rotation.x += options.extraEuler[0];
    rotHolder.rotation.y += options.extraEuler[1];
    rotHolder.rotation.z += options.extraEuler[2];
  }

  rotHolder.add(rawObj);
  oriented.add(rotHolder);
  oriented.updateMatrixWorld(true);
  oriented.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      const skinned = child as THREE.SkinnedMesh;
      skinned.frustumCulled = false;
      skinned.skeleton?.update();
    }
  });

  const box = new THREE.Box3().setFromObject(oriented);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const lengthAlongZ = Math.max(0.001, size.z);
  const uniformScale = options.targetLength / lengthAlongZ;

  rawObj.updateMatrixWorld(true);
  rotHolder.position.sub(center);

  const normalized = new THREE.Group();
  normalized.add(oriented);
  oriented.scale.setScalar(uniformScale);

  if (options.pivotShift) {
    oriented.position.set(
      options.pivotShift[0],
      options.pivotShift[1],
      options.pivotShift[2]
    );
  }

  normalized.updateMatrixWorld(true);
  return normalized;
}
