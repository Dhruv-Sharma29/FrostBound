import * as THREE from 'three';

/**
 * Subtle per-vertex ambient-occlusion-like tint for snow terrain, so relief
 * reads as shape rather than flat white regardless of exact sun angle.
 *
 * Unlike IceMaterial's per-face palette (flat colour bands for a faceted,
 * low-poly look), this works per *vertex* using the mesh's own shipped
 * normals: these terrain assets are dense and smoothly shaded already
 * (1038-5182 triangles), so a per-face tint would just add banding. A vertex
 * tint stays smooth and only needs to be gentle — crests (facing the sky)
 * read a little brighter, hollows and steep faces a little darker.
 */
const CREST_TINT = 1.05;
const HOLLOW_TINT = 0.9;

export function applySnowShading(geometry: THREE.BufferGeometry): void {
  const normal = geometry.getAttribute('normal');
  if (!normal) return; // computeVertexNormals() runs first when needed — see TerrainPiece.

  const colors = new Float32Array(normal.count * 3);

  for (let i = 0; i < normal.count; i++) {
    const upness = normal.getY(i); // -1 (facing down) .. 1 (facing straight up)
    const tint = THREE.MathUtils.lerp(HOLLOW_TINT, CREST_TINT, THREE.MathUtils.smoothstep(upness, 0.4, 1.0));
    colors[i * 3] = tint;
    colors[i * 3 + 1] = tint;
    colors[i * 3 + 2] = tint;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
