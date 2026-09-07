/**
 * Captures raw keyboard + mouse-look input and exposes it in a
 * consumable form. Other modules (Player) poll this instead of
 * attaching their own DOM listeners, keeping input handling in one place.
 */
export class InputManager {
  private readonly domElement: HTMLElement;
  private readonly keys = new Set<string>();
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;

  constructor(domElement: HTMLElement) {
    this.domElement = domElement;

    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    // Mouse-look requires the Pointer Lock API; we request it on click
    // since browsers won't grant it without a user gesture. The browser
    // itself releases the lock on Escape, firing 'pointerlockchange'.
    domElement.addEventListener('click', () => domElement.requestPointerLock());

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.domElement) {
        // Lock was released (e.g. Escape) — drop any held keys so movement
        // doesn't get stuck mid-stride while the pointer is free.
        this.keys.clear();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.domElement) return;
      this.mouseDeltaX += e.movementX;
      this.mouseDeltaY += e.movementY;
    });
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** Returns mouse movement accumulated since the last call, then resets it. */
  consumeMouseDelta(): { x: number; y: number } {
    const delta = { x: this.mouseDeltaX, y: this.mouseDeltaY };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return delta;
  }
}
