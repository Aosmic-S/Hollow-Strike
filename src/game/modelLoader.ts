/**
 * Hollow Strike - GLB Model Loader, Extension Polyfills & Geometric Normalization
 * Includes a full KHR_materials_pbrSpecularGlossiness parser plugin for Three.js r187+,
 * sub-node extraction for multi-asset GLB packs, and Box3-based scale/orientation normalization.
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

/**
 * Registers KHR_materials_pbrSpecularGlossiness extension handler on a GLTFLoader.
 * Three.js removed native support in r150+; Sketchfab architectural/urban GLBs (like japan_map.glb)
 * often require this extension for textures and materials to appear properly.
 */
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

        // Convert specular/glossiness into clean PBR roughness & moderate metalness
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

const modelCache = new Map<string, THREE.Group>();
const loadingPromises = new Map<string, Promise<THREE.Group>>();

/**
 * Loads and caches a full GLB scene, returning a deep structural clone on every call.
 */
export function loadGLBModel(path: string): Promise<THREE.Group | null> {
  if (modelCache.has(path)) {
    return Promise.resolve(SkeletonUtils.clone(modelCache.get(path)!) as THREE.Group);
  }
  if (loadingPromises.has(path)) {
    return loadingPromises
      .get(path)!
      .then((group) => SkeletonUtils.clone(group) as THREE.Group)
      .catch(() => null);
  }

  const promise = new Promise<THREE.Group>((resolve, reject) => {
    gltfLoader.load(
      path,
      (gltf) => {
        const group = gltf.scene;
        const toStrip: THREE.Object3D[] = [];
        group.traverse((child) => {
          if ((child as THREE.Light).isLight || (child as THREE.Camera).isCamera) {
            toStrip.push(child);
            return;
          }
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
              child.frustumCulled = false;
            }
            const mat = (child as THREE.Mesh).material;
            const mats = Array.isArray(mat) ? mat : [mat];
            mats.forEach((m) => {
              if (m && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
                const sm = m as THREE.MeshStandardMaterial;
                if (sm.map) {
                  sm.map.colorSpace = THREE.SRGBColorSpace;
                  sm.map.needsUpdate = true;
                }
              }
            });
          }
        });
        toStrip.forEach((o) => o.parent?.remove(o));
        modelCache.set(path, group);
        resolve(group);
      },
      undefined,
      (error) => {
        console.warn(`Failed to load GLB model at ${path}:`, error);
        reject(error);
      }
    );
  });

  loadingPromises.set(path, promise);
  return promise.then((group) => SkeletonUtils.clone(group) as THREE.Group).catch(() => null);
}

/**
 * Extracts a specific named object from a multi-asset GLB pack while preserving its
 * accumulated world orientation (ignoring its giant world offset so it can be cleanly centered).
 */
export async function loadGLBSubNode(path: string, nodeName: string): Promise<THREE.Group | null> {
  const root = await loadGLBModel(path);
  if (!root) return null;

  root.updateMatrixWorld(true);
  let target: THREE.Object3D | undefined;
  root.traverse((obj) => {
    if (!target && obj.name === nodeName) {
      target = obj;
    }
  });

  if (!target) {
    console.warn(`Sub-node "${nodeName}" not found in GLB "${path}"`);
    return null;
  }

  // Extract world rotation & scale without keeping unrelated pack siblings
  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  target.matrixWorld.decompose(worldPos, worldQuat, worldScale);

  const wrapper = new THREE.Group();
  wrapper.name = nodeName;
  const detached = target.clone(true);
  detached.position.set(0, 0, 0);
  detached.quaternion.copy(worldQuat);
  detached.scale.copy(worldScale);
  wrapper.add(detached);
  wrapper.updateMatrixWorld(true);

  return wrapper;
}

export type ForwardAxis = '-z' | '+z' | '+x' | '-x';

export interface NormalizeWeaponOptions {
  targetLength: number; // Desired length in meters along -Z
  forwardAxis: ForwardAxis;
  /**
   * Offset applied after normalization in final weapon-local meters
   * so the grip/receiver sits right at (0,0,0) in the player's hand.
   */
  pivotShift?: [number, number, number];
  /**
   * Optional roll/pitch trim in radians before scaling
   */
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

  // Rotate so raw forwardAxis aligns to -Z
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

  // Measure world Box3 of the oriented model
  const box = new THREE.Box3().setFromObject(oriented);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const lengthAlongZ = Math.max(0.001, size.z);
  const uniformScale = options.targetLength / lengthAlongZ;

  // Center at origin and scale to exact real-world meters
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
