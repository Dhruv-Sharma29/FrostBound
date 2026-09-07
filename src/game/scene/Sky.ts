import * as THREE from 'three';

// Comfortably inside the camera's far plane.
const RADIUS = 800;

const ZENITH_COLOR = new THREE.Color(0x4d86c9);
const MIDDLE_COLOR = new THREE.Color(0x9dc3e6);
const HORIZON_COLOR = new THREE.Color(0xdfe9f2);

const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;

  void main() {
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 zenithColor;
  uniform vec3 middleColor;
  uniform vec3 horizonColor;

  varying vec3 vWorldPosition;

  void main() {
    float height = normalize(vWorldPosition).y;

    // Two blends rather than one: a tight haze band hugging the horizon,
    // then a long ramp to deeper blue overhead. A single mix leaves the
    // horizon too blue to read as polar air.
    vec3 color = mix(horizonColor, middleColor, smoothstep(0.0, 0.22, height));
    color = mix(color, zenithColor, smoothstep(0.18, 0.85, height));

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Procedural gradient sky. One inward-facing sphere with an unlit shader:
 * a single draw call, no lighting work, and no skybox texture to ship.
 *
 * Below the horizon it settles into the haze colour, which also hides the
 * empty space under the terrain tile's edges.
 */
export function createSky(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenithColor: { value: ZENITH_COLOR },
      middleColor: { value: MIDDLE_COLOR },
      horizonColor: { value: HORIZON_COLOR },
    },
    vertexShader,
    fragmentShader,
  });

  const sky = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 32, 16), material);
  sky.frustumCulled = false;
  return sky;
}

/** Shared so fog can dissolve the terrain into the same band of air. */
export const HAZE_COLOR = HORIZON_COLOR;
