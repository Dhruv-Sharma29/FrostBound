import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GroundSampler } from './GroundSampler';
import { createSnowMaterial } from './SnowMaterial';

// Public-directory asset, so it's referenced by URL rather than imported.
// BASE_URL keeps it correct if the game is ever served from a sub-path.
const TERRAIN_URL = `${import.meta.env.BASE_URL}assets/environment/terrain/SM_Terrain_Snow_A.glb`;

const DOWN = new THREE.Vector3(0, -1, 0);
const RAY_CLEARANCE = 10;

/**
 * The snow terrain, loaded from a GLB at its authored scale — no scaling
 * or reorientation is applied, so it stays undistorted.
 *
 * Terrain also serves as the ground-height source for anything that walks
 * on it (see GroundSampler), because the mesh itself is the only authority
 * on where the surface is.
 */
export class Terrain implements GroundSampler {
  readonly root: THREE.Object3D;

  private readonly surfaces: THREE.Mesh[];
  private readonly raycaster = new THREE.Raycaster();
  private readonly rayOrigin = new THREE.Vector3();
  /** Rays start above the highest point so they always hit from outside. */
  private readonly rayHeight: number;

  private constructor(root: THREE.Object3D, surfaces: THREE.Mesh[]) {
    this.root = root;
    this.surfaces = surfaces;
    this.rayHeight = new THREE.Box3().setFromObject(root).max.y + RAY_CLEARANCE;
  }

  /**
   * Resolves once the terrain is ready to be added to a scene. The game
   * waits on this so the world is never rendered — or walked on — before
   * there is ground.
   */
  static async load(): Promise<Terrain> {
    const gltf = await new GLTFLoader().loadAsync(TERRAIN_URL);
    const surfaces: THREE.Mesh[] = [];
    const snow = createSnowMaterial();

    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      // The asset ships authored normals, but keep the fallback: GLTFLoader's
      // own (flat shading off screen-space derivatives) misfires on large
      // near-camera triangles, so compute them rather than let it guess.
      if (!object.geometry.getAttribute('normal')) {
        object.geometry.computeVertexNormals();
      }

      // Swap the authored material for the shared snow look, so the terrain
      // and later snow assets stay consistent from one definition.
      for (const authored of Array.isArray(object.material) ? object.material : [object.material]) {
        authored.dispose();
      }
      object.material = snow;

      object.castShadow = true;
      object.receiveShadow = true;
      surfaces.push(object);
    });

    if (surfaces.length === 0) {
      throw new Error(`Terrain asset contains no meshes: ${TERRAIN_URL}`);
    }

    return new Terrain(gltf.scene, surfaces);
  }

  sampleHeight(x: number, z: number): number | null {
    this.rayOrigin.set(x, this.rayHeight, z);
    this.raycaster.set(this.rayOrigin, DOWN);

    // Hits come back sorted by distance, so the first one is the top surface.
    const hits = this.raycaster.intersectObjects(this.surfaces, false);
    return hits.length > 0 ? hits[0].point.y : null;
  }
}
