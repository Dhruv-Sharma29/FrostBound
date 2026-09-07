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

  /**
   * The terrain GLB is fetched before the Game exists, so every field can
   * be assigned once and the loop never runs against a half-built world.
   */
  static async create(container: HTMLElement): Promise<Game> {
    return new Game(container, await Terrain.load());
  }

  private constructor(container: HTMLElement, terrain: Terrain) {
    this.scene = createScene();
    this.scene.add(terrain.root);

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
    // Sunlit snow is bright enough to clip to flat white, which would throw
    // away the shading the lighting exists to produce. Tone mapping rolls the
    // highlights off instead, keeping the relief visible.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.input = new InputManager(this.renderer.domElement);
    this.player = new Player(this.scene, this.camera, terrain);

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
