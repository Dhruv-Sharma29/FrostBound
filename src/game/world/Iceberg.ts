import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CollisionVolume } from './CollisionVolume';

// The asset's in-file node names (not the "_A" variant suffix on the
// filename — that only distinguishes which GLB to load).
const VISUAL_NODE_NAME = 'SM_Iceberg_L';
const COLLISION_NODE_NAME = 'COL_Iceberg_L';

// The player is treated as a point on the ground (see Player.ts), so the
// collider is padded by roughly the player's own radius — otherwise the
// camera would visually clip into the ice before movement is refused.
const COLLISION_MARGIN = 0.5;

export interface IcebergPlacement {
  x: number;
  z: number;
  /** Ground height at (x, z) — the iceberg's authored base rests here. */
  groundY: number;
  rotationY?: number;
  scale?: number;
}

/**
 * One placed iceberg instance. Reusable for multiple icebergs/variants:
 * call load() again with a different URL and/or placement for each one —
 * see Game.ts for how several are composed into the scene and into the
 * player's obstacle list.
 */
export class Iceberg implements CollisionVolume {
  /** Visual + (invisible) collision nodes, already positioned — add to the scene. */
  readonly root: THREE.Object3D;

  private readonly colliderCenter: THREE.Vector2;
  private readonly colliderRadiusSq: number;

  private constructor(root: THREE.Object3D, colliderCenter: THREE.Vector2, colliderRadiusSq: number) {
    this.root = root;
    this.colliderCenter = colliderCenter;
    this.colliderRadiusSq = colliderRadiusSq;
  }

  static async load(url: string, placement: IcebergPlacement): Promise<Iceberg> {
    const gltf = await new GLTFLoader().loadAsync(url);
    const root = gltf.scene;

    const visual = root.getObjectByName(VISUAL_NODE_NAME);
    const collision = root.getObjectByName(COLLISION_NODE_NAME);

    if (!visual) throw new Error(`Iceberg asset is missing visual node "${VISUAL_NODE_NAME}": ${url}`);
    if (!collision) throw new Error(`Iceberg asset is missing collision node "${COLLISION_NODE_NAME}": ${url}`);

    visual.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    // Gameplay-only geometry; the low-poly collision proxy must never render.
    collision.visible = false;

    root.rotation.y = placement.rotationY ?? 0;
    root.scale.setScalar(placement.scale ?? 1);
    root.updateMatrixWorld(true);

    // Rest the collider's authored base on the ground rather than assuming
    // the asset's local origin already sits there — keeps this correct for
    // any future variant regardless of how it was modelled.
    const localBox = new THREE.Box3().setFromObject(collision);
    root.position.set(placement.x, placement.groundY - localBox.min.y, placement.z);
    root.updateMatrixWorld(true);

    const worldBox = new THREE.Box3().setFromObject(collision);
    const size = worldBox.getSize(new THREE.Vector3());
    const center = worldBox.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.z) / 2 + COLLISION_MARGIN;

    return new Iceberg(root, new THREE.Vector2(center.x, center.z), radius * radius);
  }

  blocks(x: number, z: number): boolean {
    const dx = x - this.colliderCenter.x;
    const dz = z - this.colliderCenter.y;
    return dx * dx + dz * dz < this.colliderRadiusSq;
  }
}
