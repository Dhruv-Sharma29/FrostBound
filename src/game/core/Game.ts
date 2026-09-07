import * as THREE from 'three';
import { createScene } from '../scene/SceneManager';
import { Terrain } from '../world/Terrain';
import { Player } from '../player/Player';
import { InputManager } from '../input/InputManager';

/**
 * Top-level orchestrator: owns the renderer/scene/camera and wires the
 * other modules together. Nothing here knows the internals of terrain,
 * player, or input — this keeps each concern independently replaceable.
 */
export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly clock = new THREE.Clock();
  private readonly input: InputManager;
  private readonly player: Player;

  constructor(container: HTMLElement) {
    this.scene = createScene();

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    new Terrain(this.scene);
    this.input = new InputManager(this.renderer.domElement);
    this.player = new Player(this.scene, this.camera);

    window.addEventListener('resize', this.onResize);
  }

  start(): void {
    this.renderer.setAnimationLoop(() => this.tick());
  }

  private tick(): void {
    const delta = this.clock.getDelta();
    this.player.update(delta, this.input);
    this.renderer.render(this.scene, this.camera);
  }

  private readonly onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}
