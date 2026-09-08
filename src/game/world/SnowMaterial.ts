import * as THREE from 'three';

/**
 * Cool near-white snow base. Deliberately biased toward blue rather than a
 * neutral white: the base colour multiplies incoming light, and tone mapping
 * desaturates bright values toward white, so a neutral tint renders as grey.
 * Starting cool is what survives to the screen as snow.
 */
export const SNOW_BASE_COLOR = 0xe3edfa;

/**
 * The shared look for every snow surface, so terrain and any future snow
 * asset speak the same visual language — change snow here, not per asset.
 *
 * Snow is a rough dielectric: no metalness and maximum roughness, which
 * keeps it matte and lets the cool sky fill read as blue shading on slopes
 * facing away from the sun.
 *
 * vertexColors is on so TerrainShading's per-vertex tint can multiply the
 * base colour — without it, relief only reads via the sun's exact angle on
 * each surface, which flattens out to pure white on gentler terrain.
 */
export function createSnowMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: SNOW_BASE_COLOR,
    roughness: 1,
    metalness: 0,
    vertexColors: true,
  });
}
