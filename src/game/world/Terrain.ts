import * as THREE from 'three';

const SIZE = 500;
const SNOW_COLOR = 0xf5f9ff;

/**
 * A single large flat plane standing in for the Antarctic ice sheet.
 * Deliberately minimal — no height data or chunking yet; that belongs
 * to a future terrain milestone (procedural generation is out of scope here).
 */
export class Terrain {
  readonly mesh: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.PlaneGeometry(SIZE, SIZE);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: SNOW_COLOR,
      roughness: 1,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }
}
