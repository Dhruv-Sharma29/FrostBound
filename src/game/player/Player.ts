import * as THREE from 'three';
import type { InputManager } from '../input/InputManager';
import { PLAYER_BODY_LAYER } from '../core/layers';

const EYE_HEIGHT = 1.6;
const CAPSULE_RADIUS = 0.4;
const CAPSULE_LENGTH = 1.0;
const MOVE_SPEED = 5; // meters/second
const MOUSE_SENSITIVITY = 0.0025;
const MAX_PITCH = Math.PI / 2 - 0.01;
const GROUND_Y = 0;

/**
 * Player rig, following the classic FPS controller split:
 *  - yawObject: holds world position and left/right turning
 *  - pitchObject: child of yaw, holds up/down look only
 * Splitting the two means ground movement (derived from yaw) is never
 * affected by where the camera is currently looking (pitch).
 *
 * The capsule mesh is a placeholder body. The camera sits at eye height
 * *inside* it (normal for FPS rigs), so it's put on PLAYER_BODY_LAYER,
 * which the main camera doesn't render — otherwise back-face culling
 * would make the screen look empty from inside the mesh.
 */
export class Player {
  private readonly yawObject = new THREE.Object3D();
  private readonly pitchObject = new THREE.Object3D();

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.yawObject.position.set(0, GROUND_Y, 5);

    this.pitchObject.position.set(0, EYE_HEIGHT, 0);
    camera.position.set(0, 0, 0);
    this.pitchObject.add(camera);

    this.yawObject.add(this.pitchObject);
    this.yawObject.add(this.createBodyMesh());

    scene.add(this.yawObject);
  }

  private createBodyMesh(): THREE.Mesh {
    const geometry = new THREE.CapsuleGeometry(CAPSULE_RADIUS, CAPSULE_LENGTH, 4, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xff5533 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = CAPSULE_LENGTH / 2 + CAPSULE_RADIUS;
    mesh.castShadow = true;
    mesh.layers.set(PLAYER_BODY_LAYER);
    return mesh;
  }

  update(delta: number, input: InputManager): void {
    this.applyMouseLook(input);
    this.applyMovement(delta, input);
    this.applyGroundClamp();
  }

  private applyMouseLook(input: InputManager): void {
    const { x, y } = input.consumeMouseDelta();

    this.yawObject.rotation.y -= x * MOUSE_SENSITIVITY;

    this.pitchObject.rotation.x -= y * MOUSE_SENSITIVITY;
    this.pitchObject.rotation.x = THREE.MathUtils.clamp(
      this.pitchObject.rotation.x,
      -MAX_PITCH,
      MAX_PITCH,
    );
  }

  private applyMovement(delta: number, input: InputManager): void {
    const direction = new THREE.Vector3();
    if (input.isDown('KeyW')) direction.z -= 1;
    if (input.isDown('KeyS')) direction.z += 1;
    if (input.isDown('KeyA')) direction.x -= 1;
    if (input.isDown('KeyD')) direction.x += 1;

    if (direction.lengthSq() === 0) return;

    // Rotate the input vector by yaw only, so movement stays flat on the
    // ground regardless of camera pitch.
    direction.normalize().applyQuaternion(this.yawObject.quaternion);
    this.yawObject.position.addScaledVector(direction, MOVE_SPEED * delta);
  }

  private applyGroundClamp(): void {
    // Terrain is flat for this milestone, so "gravity" is just snapping
    // the player back to ground level. Swap for a raycast-against-terrain
    // step once height variation exists.
    this.yawObject.position.y = GROUND_Y;
  }
}
