import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applySnowShading } from './TerrainShading';

/** One terrain variant: its GLB and the in-file node names it exposes. */
export interface TerrainType {
  url: string;
  visualNodeName: string;
  /** Low-poly walkable proxy. Omitted by assets that ship only a visual mesh. */
  collisionNodeName?: string;
}

export interface TerrainPlacement {
  x: number;
  z: number;
  /** Height for the tile's local origin — see the note on burying, below. */
  groundY: number;
  rotationY?: number;
  scale?: number;
}

/**
 * One placed terrain tile.
 *
 * Mirrors Iceberg's shape (type descriptor + placement + load) but differs in
 * what a COL_ mesh means. An iceberg's collider is a volume that blocks
 * movement; a terrain collider is the surface you stand on. So it is never
 * turned into a CollisionVolume — it feeds the ground raycast instead, which
 * is both the surface the artist authored for gameplay and a fraction of the
 * visual mesh's triangle count (142-430 tris against 1038-1438).
 *
 * Ground alignment also differs. An iceberg rests its collider's base on the
 * ground, so nothing sinks. These tiles are authored with their rim at y=0 and
 * roughly a metre of solid skirt below it, meant to be buried so the edges
 * disappear into surrounding ground — so the origin goes at ground height and
 * the skirt sinks, rather than being lifted clear of it.
 */
export class TerrainPiece {
  readonly root: THREE.Object3D;
  /** Meshes the ground raycast should hit — the collision proxy when present. */
  readonly surfaces: readonly THREE.Mesh[];
  /** Half-width of the unscaled footprint, for seating the tile onto other ground. */
  readonly halfExtent: number;

  private constructor(root: THREE.Object3D, surfaces: THREE.Mesh[], halfExtent: number) {
    this.root = root;
    this.surfaces = surfaces;
    this.halfExtent = halfExtent;
  }

  /**
   * Loads the tile unplaced. Placement is a separate step because seating a
   * tile onto existing ground needs its footprint, which is only known once
   * the GLB is here — so the caller loads, measures, then places.
   *
   * The snow material is passed in rather than created per tile: one instance
   * across every piece means one compiled shader for the whole landscape.
   */
  static async load(type: TerrainType, material: THREE.Material): Promise<TerrainPiece> {
    const gltf = await new GLTFLoader().loadAsync(type.url);
    const root = gltf.scene;

    const visual = root.getObjectByName(type.visualNodeName);
    if (!visual) {
      throw new Error(`Terrain asset is missing visual node "${type.visualNodeName}": ${type.url}`);
    }

    visual.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      // Kept from the single-terrain loader: GLTFLoader's own fallback for a
      // missing normal attribute (flat shading off screen-space derivatives)
      // misfires on large near-camera triangles, so compute them instead.
      if (!object.geometry.getAttribute('normal')) {
        object.geometry.computeVertexNormals();
      }
      applySnowShading(object.geometry);

      for (const authored of Array.isArray(object.material) ? object.material : [object.material]) {
        authored.dispose();
      }
      object.material = material;

      object.castShadow = true;
      object.receiveShadow = true;
    });

    // The collision proxy is gameplay-only and must never render. Hiding it is
    // enough to keep it out of the frame while leaving it raycastable, because
    // Raycaster tests layers rather than visibility.
    const surfaces: THREE.Mesh[] = [];
    let collision: THREE.Object3D | undefined;

    if (type.collisionNodeName !== undefined) {
      collision = root.getObjectByName(type.collisionNodeName);
      if (!collision) {
        throw new Error(`Terrain asset is missing collision node "${type.collisionNodeName}": ${type.url}`);
      }
      collision.visible = false;
      collision.traverse((object) => {
        if (object instanceof THREE.Mesh) surfaces.push(object);
      });
    }

    // Assets without an authored proxy fall back to walking the visual mesh,
    // which is how the original snow ground has always been sampled.
    if (surfaces.length === 0) {
      visual.traverse((object) => {
        if (object instanceof THREE.Mesh) surfaces.push(object);
      });
    }

    if (surfaces.length === 0) {
      throw new Error(`Terrain asset contains no meshes: ${type.url}`);
    }

    root.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());

    return new TerrainPiece(root, surfaces, Math.max(size.x, size.z) / 2);
  }

  place(placement: TerrainPlacement): void {
    this.root.rotation.y = placement.rotationY ?? 0;
    this.root.scale.setScalar(placement.scale ?? 1);
    this.root.position.set(placement.x, placement.groundY, placement.z);
    this.root.updateMatrixWorld(true);
  }
}
