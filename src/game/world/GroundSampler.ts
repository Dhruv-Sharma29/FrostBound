/**
 * Anything that can report the ground height beneath a world-space point.
 * Player depends on this abstraction rather than on Terrain directly, so
 * how the ground is represented (GLB mesh, heightmap, streamed chunks)
 * can change without touching the controller.
 */
export interface GroundSampler {
  /** Surface height at (x, z), or null when there is no ground there. */
  sampleHeight(x: number, z: number): number | null;
}
