import * as THREE from 'three';
import type { GroundSampler } from './GroundSampler';
import { createSnowMaterial } from './SnowMaterial';
import { TerrainPiece, type TerrainType } from './TerrainPiece';

const DOWN = new THREE.Vector3(0, -1, 0);
const RAY_CLEARANCE = 10;

/** Grid resolution used when seating a tile onto the ground already placed. */
const SEAT_SAMPLES = 9;

export interface TerrainSpawn {
  type: TerrainType;
  x: number;
  z: number;
  rotationY?: number;
  scale?: number;
  /**
   * Fixed height for the tile's origin. Omit to seat it onto the ground placed
   * before it — which is what "ground alignment" means for terrain.
   */
  groundY?: number;
}

/**
 * The walkable landscape: several terrain tiles composed into one ground.
 *
 * Terrain stays the single GroundSampler the player is given, so adding tiles
 * never reaches into movement code — it just has more surfaces to raycast.
 * One raycast serves the whole field: hits come back sorted by distance, so a
 * tile stacked on the base ground is simply the first thing the downward ray
 * meets, and standing on the topmost surface falls out for free.
 */
export class Terrain implements GroundSampler {
  /** Every tile under one node, so the scene still takes a single object. */
  readonly root = new THREE.Group();

  private readonly surfaces: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly rayOrigin = new THREE.Vector3();
  /** Rays start above the highest tile so they always hit from outside. */
  private rayHeight = RAY_CLEARANCE;

  /**
   * Loads and places a layout. Every GLB is fetched in parallel, then tiles are
   * placed in order, because seating a tile means sampling the ground already
   * standing — so the base ground has to come first in the layout.
   */
  static async load(layout: readonly TerrainSpawn[]): Promise<Terrain> {
    // One material instance shared by every tile: one compiled shader, and one
    // place to change how all snow reads.
    const snow = createSnowMaterial();
    const pieces = await Promise.all(layout.map((spawn) => TerrainPiece.load(spawn.type, snow)));

    const terrain = new Terrain();

    pieces.forEach((piece, index) => {
      const spawn = layout[index];
      const footprint = piece.halfExtent * (spawn.scale ?? 1);

      piece.place({
        x: spawn.x,
        z: spawn.z,
        rotationY: spawn.rotationY,
        scale: spawn.scale,
        groundY: spawn.groundY ?? terrain.lowestGroundUnder(spawn.x, spawn.z, footprint),
      });

      terrain.add(piece);
    });

    return terrain;
  }

  private add(piece: TerrainPiece): void {
    this.root.add(piece.root);
    this.surfaces.push(...piece.surfaces);

    const top = new THREE.Box3().setFromObject(piece.root).max.y;
    this.rayHeight = Math.max(this.rayHeight, top + RAY_CLEARANCE);
  }

  /**
   * Lowest ground under a tile's footprint, or 0 where nothing is placed yet.
   *
   * The low point rather than the centre: these tiles have a flat rim, so
   * seating one on undulating ground has to pick a side to be wrong on.
   * Sinking the rim below the surrounding surface hides it, while lifting it
   * above leaves a floating ledge — so the tile is dropped to the lowest point
   * it spans and the base ground is allowed to swallow the rest.
   */
  private lowestGroundUnder(x: number, z: number, radius: number): number {
    let lowest = Infinity;

    for (let ix = 0; ix < SEAT_SAMPLES; ix++) {
      for (let iz = 0; iz < SEAT_SAMPLES; iz++) {
        const u = (ix / (SEAT_SAMPLES - 1)) * 2 - 1;
        const v = (iz / (SEAT_SAMPLES - 1)) * 2 - 1;

        const height = this.sampleHeight(x + u * radius, z + v * radius);
        if (height !== null) lowest = Math.min(lowest, height);
      }
    }

    return lowest === Infinity ? 0 : lowest;
  }

  sampleHeight(x: number, z: number): number | null {
    this.rayOrigin.set(x, this.rayHeight, z);
    this.raycaster.set(this.rayOrigin, DOWN);

    // Hits come back sorted by distance, so the first one is the top surface.
    const hits = this.raycaster.intersectObjects(this.surfaces, false);
    return hits.length > 0 ? hits[0].point.y : null;
  }
}
