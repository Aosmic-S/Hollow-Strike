/**
 * Hollow Strike - GLB Model Loader & Cache with Procedural Fallbacks
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();
const modelCache = new Map<string, THREE.Group>();
const loadingPromises = new Map<string, Promise<THREE.Group>>();

export function loadGLBModel(path: string): Promise<THREE.Group | null> {
  if (modelCache.has(path)) {
    return Promise.resolve(modelCache.get(path)!.clone(true));
  }
  if (loadingPromises.has(path)) {
    return loadingPromises.get(path)!.then(group => group.clone(true)).catch(() => null);
  }

  const promise = new Promise<THREE.Group>((resolve, reject) => {
    gltfLoader.load(
      path,
      (gltf) => {
        const group = gltf.scene;
        // Normalize shadows
        group.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
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
  return promise.then(group => group.clone(true)).catch(() => null);
}
