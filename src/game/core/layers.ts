/**
 * Shared THREE.js render-layer indices.
 * Layer 0 (default) is what the main first-person camera renders.
 * PLAYER_BODY_LAYER holds meshes that represent the player's own body —
 * excluded from the main camera (so you don't see your own head from
 * inside it) but still opted into by the shadow-casting light, so the
 * player's presence stays visible as a shadow on the terrain.
 */
export const PLAYER_BODY_LAYER = 1;
