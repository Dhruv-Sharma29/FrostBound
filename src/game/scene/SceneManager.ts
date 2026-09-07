import * as THREE from 'three';
import { PLAYER_BODY_LAYER } from '../core/layers';

/**
 * Builds the base THREE.Scene: background/fog and lighting.
 * Kept as a factory function so Game.ts doesn't need to know lighting details.
 */
export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();

  const skyColor = 0xbfd9ff;
  scene.background = new THREE.Color(skyColor);
  scene.fog = new THREE.Fog(skyColor, 30, 200);

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);

  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(60, 100, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -50;
  sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50;
  sun.shadow.camera.bottom = -50;
  // The player body is hidden from the main camera on this layer (see
  // Player.ts) but the shadow-casting light still needs to see it.
  sun.shadow.camera.layers.enable(PLAYER_BODY_LAYER);

  scene.add(ambient, sun);

  return scene;
}
