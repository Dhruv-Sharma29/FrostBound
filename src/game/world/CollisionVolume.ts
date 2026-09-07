/**
 * Anything that blocks horizontal player movement at a world-space point.
 * Player checks these alongside GroundSampler, so adding an obstacle (an
 * iceberg, and later other props) never requires touching movement code —
 * only a new implementation of this interface.
 */
export interface CollisionVolume {
  /** True if (x, z) falls inside this obstacle's footprint. */
  blocks(x: number, z: number): boolean;
}
