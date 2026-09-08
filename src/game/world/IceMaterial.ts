import * as THREE from 'three';

/**
 * The stylized ice palette, sampled per face from the face's orientation.
 *
 * The kit's GLBs disagree with each other about their own look — every asset
 * names its material MAT_Ice_CoolBlue, but L/M author it blue (0.52, 0.76,
 * 0.90) while S/Peak/Jagged/Flat author it flat grey (0.8, 0.8, 0.8). Loading
 * those as-authored is what makes the field read as two unrelated sets of
 * rocks, so the look is defined here instead and applied to all six.
 *
 * Three tones rather than one flat colour: without them a faceted mesh under
 * a single albedo relies entirely on the diffuse term for shape, and the low
 * sun (see SceneManager) drives that to either blown white or near-black.
 *
 * All three sit well below the terrain's near-white snow. The sun is
 * deliberately over-driven for the flat terrain (intensity 16) and tone
 * mapping pushes bright values toward white, so a snow-bright albedo on a
 * 15m ice wall renders as a white cutout. Holding the albedo down is what
 * lets the blues survive to the screen at all.
 */
const CREST_COLOR = new THREE.Color(0xd3e6f6); // sun-facing snow on top faces
const FACE_COLOR = new THREE.Color(0x86b4d8); // pale blue on the vertical walls
const DEEP_COLOR = new THREE.Color(0x4a7ba8); // shadowed blue in undercuts

/**
 * How much a face's colour may drift from its palette tone, as a fraction.
 * Small on purpose: enough to break up neighbouring coplanar faces so the
 * facets read individually, not enough to look like noise.
 */
const FACET_VARIATION = 0.07;

/** Shared across every iceberg — one material means one compiled shader. */
let sharedMaterial: THREE.MeshStandardMaterial | null = null;

/**
 * The look for every iceberg surface, mirroring SnowMaterial's role for the
 * terrain: change ice here, not per asset.
 *
 * Albedo comes from the vertex colours baked by applyIceShading, so the base
 * colour stays white and simply passes them through. Roughness sits below
 * snow's fully-matte 1.0 — ice is a smoother dielectric than powder, and the
 * slight falloff separates the two materials without adding a specular hit.
 */
export function getIceMaterial(): THREE.MeshStandardMaterial {
  sharedMaterial ??= new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.62,
    metalness: 0,
  });
  return sharedMaterial;
}

/**
 * Deterministic 0..1 value per face index. Seeded arithmetic rather than
 * Math.random so a given asset shades identically on every load — otherwise
 * the icebergs would shimmer differently each refresh.
 */
function faceJitter(faceIndex: number): number {
  const s = Math.sin(faceIndex * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Bakes the ice palette into a geometry as per-face vertex colours.
 *
 * The GLBs cannot be edited and the silhouettes have to come from geometry
 * that already exists, so orientation is the only signal available: upward
 * faces catch snow and sky, vertical walls read as the ice body, and faces
 * tipped below horizontal are self-shadowed undercuts. Colouring by that
 * makes the faceting legible even where the diffuse term flattens out.
 *
 * Geometry is converted to non-indexed first so each triangle owns its three
 * vertices and can take a single flat colour; at 200-340 triangles per asset
 * the duplication is negligible.
 */
export function applyIceShading(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;

  const position = flat.getAttribute('position');
  const faceCount = position.count / 3;

  const colors = new Float32Array(position.count * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const color = new THREE.Color();

  for (let face = 0; face < faceCount; face++) {
    const i = face * 3;

    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);

    // Face normal from the winding, not the authored vertex normals: those
    // may be averaged, which would blur the per-face banding this is for.
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    normal.crossVectors(ab, ac).normalize();

    const up = normal.y;

    // Vertical walls are the baseline; blend up toward snow as the face
    // tips skyward, then down toward shadow as it tips past horizontal.
    color.copy(FACE_COLOR);
    color.lerp(CREST_COLOR, THREE.MathUtils.smoothstep(up, 0.35, 0.85));
    color.lerp(DEEP_COLOR, THREE.MathUtils.smoothstep(-up, -0.05, 0.45));

    const drift = 1 + (faceJitter(face) - 0.5) * FACET_VARIATION;

    for (let v = 0; v < 3; v++) {
      colors[(i + v) * 3] = color.r * drift;
      colors[(i + v) * 3 + 1] = color.g * drift;
      colors[(i + v) * 3 + 2] = color.b * drift;
    }
  }

  flat.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // The caller swapped to a new geometry object; the original is dead.
  if (flat !== geometry) geometry.dispose();

  return flat;
}
