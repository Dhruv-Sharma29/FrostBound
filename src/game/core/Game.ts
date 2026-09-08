import * as THREE from 'three';
import { createScene } from '../scene/SceneManager';
import { Terrain } from '../world/Terrain';
import { Iceberg, type IcebergType } from '../world/Iceberg';
import { Player } from '../player/Player';
import { InputManager } from '../input/InputManager';

const MODELS_URL = `${import.meta.env.BASE_URL}assets/models`;

// Each iceberg GLB and the in-file node names it exposes (see Iceberg.ts).
// Filename suffixes like "_A" only distinguish which GLB to load — they
// aren't part of the node names baked into the asset.
const ICEBERG_TYPES = {
  L: { url: `${MODELS_URL}/SM_Iceberg_L_A.glb`, visualNodeName: 'SM_Iceberg_L', collisionNodeName: 'COL_Iceberg_L' },
  M: { url: `${MODELS_URL}/SM_Iceberg_M.glb`, visualNodeName: 'SM_Iceberg_M', collisionNodeName: 'COL_Iceberg_M' },
  S: { url: `${MODELS_URL}/SM_Iceberg_S.glb`, visualNodeName: 'SM_Iceberg_S', collisionNodeName: 'COL_Iceberg_S' },
  Peak: { url: `${MODELS_URL}/SM_Iceberg_Peak.glb`, visualNodeName: 'SM_Iceberg_Peak', collisionNodeName: 'COL_Iceberg_Peak' },
  Jagged: { url: `${MODELS_URL}/SM_Iceberg_Jagged.glb`, visualNodeName: 'SM_Iceberg_Jagged', collisionNodeName: 'COL_Iceberg_Jagged' },
  Flat: { url: `${MODELS_URL}/SM_Iceberg_Flat.glb`, visualNodeName: 'SM_Iceberg_Flat', collisionNodeName: 'COL_Iceberg_Flat' },
} as const satisfies Record<string, IcebergType>;

/** Where to place each iceberg instance; groundY is resolved from terrain at load time. */
interface IcebergSpawn {
  type: IcebergType;
  x: number;
  z: number;
  rotationY?: number;
  scale?: number;
}

/**
 * The iceberg field, composed for the view from spawn (0, 5) looking down -Z.
 *
 * The kit is built at a much larger scale than it first appears — L is 15.6m
 * tall and 13.9m wide, M is 15.7m wide — on a 100m terrain tile, so spacing is
 * driven by the assets' measured footprints rather than by eye. Centres sit
 * 17m+ apart, which is what keeps them from interpenetrating.
 *
 * Scales set the size hierarchy the kit implies: Peak is the tall landmark,
 * L the large mass, Jagged large and wide, M mid, with S and Flat as low
 * foreground pieces that give the taller bergs something to be read against.
 *
 * The four big silhouettes are placed at separated bearings from spawn
 * (roughly -32°, -6°, +13°, +29°) so no two sharp peaks stack up; S and Flat
 * deliberately sit nearer and lower, overlapping only the bases behind them,
 * which is what produces depth rather than clutter. Everything stays inside
 * the tile's +/-50m edge so the ground alignment always has terrain to sample.
 */
const ICEBERG_SPAWNS: readonly IcebergSpawn[] = [
  // Near foreground, low and small — establishes scale for everything behind.
  { type: ICEBERG_TYPES.S, x: 14, z: -10, rotationY: 2.4, scale: 0.65 },
  { type: ICEBERG_TYPES.Flat, x: -8, z: -18, rotationY: 0.9, scale: 0.75 },

  // Mid ground.
  { type: ICEBERG_TYPES.M, x: 7, z: -24, rotationY: 1.9, scale: 0.6 },
  { type: ICEBERG_TYPES.L, x: -22, z: -27, rotationY: 0.5, scale: 0.95 },

  // Far, hazed back by fog — the landmarks that close the composition.
  { type: ICEBERG_TYPES.Jagged, x: 22, z: -34, rotationY: 3.4, scale: 0.85 },
  { type: ICEBERG_TYPES.Peak, x: -4, z: -36, rotationY: 1.2, scale: 1.25 },
];

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
   * World assets are fetched before the Game exists, so every field can be
   * assigned once and the loop never runs against a half-built world.
   */
  static async create(container: HTMLElement): Promise<Game> {
    const terrain = await Terrain.load();

    const icebergs = await Promise.all(
      ICEBERG_SPAWNS.map((spawn) =>
        Iceberg.load(spawn.type, {
          x: spawn.x,
          z: spawn.z,
          groundY: terrain.sampleHeight(spawn.x, spawn.z) ?? 0,
          rotationY: spawn.rotationY,
          scale: spawn.scale,
        }),
      ),
    );

    return new Game(container, terrain, icebergs);
  }

  private constructor(container: HTMLElement, terrain: Terrain, icebergs: readonly Iceberg[]) {
    this.scene = createScene();
    this.scene.add(terrain.root);
    for (const iceberg of icebergs) this.scene.add(iceberg.root);

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
    this.player = new Player(this.scene, this.camera, terrain, icebergs);

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
