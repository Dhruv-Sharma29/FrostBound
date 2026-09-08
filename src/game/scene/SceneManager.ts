import * as THREE from 'three';
import { PLAYER_BODY_LAYER } from '../core/layers';
import { createSky, HAZE_COLOR } from './Sky';

/** Half-width of the sun's shadow box; covers the terrain's 100m diagonal. */
const SHADOW_EXTENT = 80;
// Tuned so the far icebergs (~50m out) sit back in noticeable haze while
// anything within ~20m stays essentially clear — aerial perspective for
// depth, without the field turning into soup.
const FOG_DENSITY = 0.0105;

/**
 * Builds the base THREE.Scene: sky, fog and lighting.
 * Kept as a factory function so Game.ts doesn't need to know these details.
 */
export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();

  scene.background = HAZE_COLOR;
  // Exponential fog falls off like real air, and sharing the sky's horizon
  // colour makes the terrain edge dissolve into haze instead of ending.
  scene.fog = new THREE.FogExp2(HAZE_COLOR.getHex(), FOG_DENSITY);

  scene.add(createSky());

  // A LOW sun is what gives this terrain its form. The dunes only have ~3.4m
  // of relief over 100m (max slope ~9°), so under a high sun every facing sits
  // at nearly the same brightness and the tile reads as one flat grey. At this
  // elevation (~13°) that same 9° of slope swings the diffuse term roughly 6x,
  // which is what makes the undulations legible. Intensity is high to
  // compensate: grazing light delivers little energy to flat ground.
  // Intensity was 16 when flat terrain was the only thing lit: ground at this
  // elevation only catches sin(13°) of it, so the number had to be large. The
  // icebergs changed that — a vertical wall facing the sun catches cos(13°),
  // nearly 5x what the ground does, which at 16 landed far above white and
  // clipped every sunlit face into a flat silhouette. Lowering it puts those
  // walls back inside the tone mapper's usable range. The ground keeps its
  // relief because that comes from the *ratio* between neighbouring slopes,
  // which intensity does not change — and it reads better here, no longer
  // compressed against white.
  const sun = new THREE.DirectionalLight(0xfff4e2, 11.0);
  sun.position.set(75, 19, 38);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 300;
  sun.shadow.camera.left = -SHADOW_EXTENT;
  sun.shadow.camera.right = SHADOW_EXTENT;
  sun.shadow.camera.top = SHADOW_EXTENT;
  sun.shadow.camera.bottom = -SHADOW_EXTENT;
  // Terrain both casts and receives, so offset along the normal to keep
  // gentle slopes from shadowing themselves.
  sun.shadow.normalBias = 0.02;
  // The player body is hidden from the main camera on this layer (see
  // Player.ts) but the shadow-casting light still needs to see it.
  sun.shadow.camera.layers.enable(PLAYER_BODY_LAYER);

  // Snow bounces enormous amounts of light, so the fill comes from a
  // hemisphere pair — cool from the sky, bright from the ground — which
  // keeps slopes facing away from the sun blue rather than black. A plain
  // ambient light at this strength flattened the shading instead.
  const fill = new THREE.HemisphereLight(0x9ec6ea, 0xf2f7ff, 0.85);

  // The icebergs introduced tall vertical faces, which the terrain never had.
  // Under a 13° sun those either face the light and blow out, or face away and
  // fall to the hemisphere term alone and read as flat dark shapes. This is
  // the light the snow field bounces back into them: aimed low from the
  // opposite side, weak, and shadowless, so it opens up the shaded faces
  // without touching the sun's contrast on the ground.
  const bounce = new THREE.DirectionalLight(0xc8dcf2, 0.9);
  bounce.position.set(-70, 14, -30);

  scene.add(sun, fill, bounce);

  return scene;
}
