import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CollisionVolume } from './CollisionVolume';
import { applyIceShading, getIceMaterial } from './IceMaterial';

// The player is treated as a point on the ground (see Player.ts), so the
// collider is padded by roughly the player's own radius — otherwise the
// camera would visually clip into the ice before movement is refused.
const COLLISION_MARGIN = 0.5;

/** Frees the GPU resources of a subtree being dropped before it is ever drawn. */
function disposeSubtree(object: THREE.Object3D): void {
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      material.dispose();
    }
  });
}

/** One iceberg variant: its GLB and the in-file node names it exposes. */
export interface IcebergType {
  url: string;
  visualNodeName: string;
  collisionNodeName: string;
}

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

  static async load(type: IcebergType, placement: IcebergPlacement): Promise<Iceberg> {
    const gltf = await new GLTFLoader().loadAsync(type.url);
    const root = gltf.scene;

    const visual = root.getObjectByName(type.visualNodeName);
    const collision = root.getObjectByName(type.collisionNodeName);

    if (!visual) throw new Error(`Iceberg asset is missing visual node "${type.visualNodeName}": ${type.url}`);
    if (!collision) throw new Error(`Iceberg asset is missing collision node "${type.collisionNodeName}": ${type.url}`);

    // Some GLBs ship more than the pair they are named for — SM_Iceberg_Peak
    // also contains SM_Iceberg_S and COL_Iceberg_S. Adding the whole scene
    // would render a second iceberg inside this one, along with its raw
    // collision cylinder (only the matched collider gets hidden below), so
    // anything outside the requested pair is dropped.
    for (const child of [...root.children]) {
      const wanted =
        child.getObjectByName(type.visualNodeName) === visual ||
        child.getObjectByName(type.collisionNodeName) === collision;
      if (wanted) continue;

      root.remove(child);
      disposeSubtree(child);
    }

    visual.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      // The kit's authored materials contradict each other between assets
      // (see IceMaterial), so every iceberg is re-shaded from one definition.
      for (const authored of Array.isArray(object.material) ? object.material : [object.material]) {
        authored.dispose();
      }
      object.geometry = applyIceShading(object.geometry);
      object.material = getIceMaterial();

      object.castShadow = true;
      object.receiveShadow = true;
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
