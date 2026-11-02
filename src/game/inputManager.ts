/**
 * Hollow Strike - Cross-Platform Input Manager
 * Manages PC Keyboard + Mouse (PointerLock) and Mobile Virtual Touch Controls.
 */

export interface InputState {
  moveForward: number; // -1 to 1
  moveRight: number;   // -1 to 1
  lookDeltaX: number;
  lookDeltaY: number;
  fireHeld: boolean;
  fireJustPressed: boolean;
  adsHeld: boolean;
  jumpJustPressed: boolean;
  crouchHeld: boolean;
  reloadJustPressed: boolean;
  plantDefuseHeld: boolean;
  abilityQJustPressed: boolean;
  abilityEJustPressed: boolean;
  abilityCJustPressed: boolean;
  abilityXJustPressed: boolean;
  buyMenuJustPressed: boolean;
  scoreboardHeld: boolean;
  pauseJustPressed: boolean;
  weaponSlotJustPressed: number | null; // 1, 2, 3, 4
}

export class InputManager {
  public state: InputState = {
    moveForward: 0,
    moveRight: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    fireHeld: false,
    fireJustPressed: false,
    adsHeld: false,
    jumpJustPressed: false,
    crouchHeld: false,
    reloadJustPressed: false,
    plantDefuseHeld: false,
    abilityQJustPressed: false,
    abilityEJustPressed: false,
    abilityCJustPressed: false,
    abilityXJustPressed: false,
    buyMenuJustPressed: false,
    scoreboardHeld: false,
    pauseJustPressed: false,
    weaponSlotJustPressed: null,
  };

  public isMobile: boolean = false;
  public isPointerLocked: boolean = false;
  public mouseSensitivity: number = 0.0022;
  public touchSensitivity: number = 0.0035;

  private keysHeld: Set<string> = new Set();
  private element: HTMLElement | null = null;

  constructor() {
    this.detectDevice();
  }

  public detectDevice(): void {
    if (typeof window === 'undefined') return;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    this.isMobile = hasTouch || isCoarse || window.innerWidth < 800;
  }

  public attach(element: HTMLElement): void {
    this.element = element;

    // Keyboard events
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);

    // Mouse pointer lock & look
    element.addEventListener('click', this.requestPointerLock);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  public detach(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
  }

  public requestPointerLock = (): void => {
    if (this.isMobile || !this.element) return;
    if (document.pointerLockElement !== this.element) {
      this.element.requestPointerLock?.();
    }
  };

  public exitPointerLock(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }

  private handlePointerLockChange = (): void => {
    this.isPointerLocked = document.pointerLockElement === this.element;
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    this.keysHeld.add(e.code);

    switch (e.code) {
      case 'Space':
        this.state.jumpJustPressed = true;
        break;
      case 'KeyR':
        this.state.reloadJustPressed = true;
        break;
      case 'KeyQ':
        this.state.abilityQJustPressed = true;
        break;
      case 'KeyE':
        this.state.abilityEJustPressed = true;
        break;
      case 'KeyC':
        this.state.abilityCJustPressed = true;
        break;
      case 'KeyX':
        this.state.abilityXJustPressed = true;
        break;
      case 'KeyB':
        this.state.buyMenuJustPressed = true;
        break;
      case 'KeyF':
        this.state.plantDefuseHeld = true;
        break;
      case 'Digit1':
        this.state.weaponSlotJustPressed = 1;
        break;
      case 'Digit2':
        this.state.weaponSlotJustPressed = 2;
        break;
      case 'Digit3':
        this.state.weaponSlotJustPressed = 3;
        break;
      case 'Digit4':
        this.state.weaponSlotJustPressed = 4;
        break;
      case 'Tab':
        e.preventDefault();
        this.state.scoreboardHeld = true;
        break;
      case 'Escape':
      case 'KeyP':
        this.state.pauseJustPressed = true;
        break;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);

    if (e.code === 'KeyF') {
      this.state.plantDefuseHeld = false;
    }
    if (e.code === 'Tab') {
      this.state.scoreboardHeld = false;
    }
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.state.fireHeld = true;
      this.state.fireJustPressed = true;
    } else if (e.button === 2) {
      this.state.adsHeld = !this.state.adsHeld; // Toggle ADS on right click
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.state.fireHeld = false;
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.isPointerLocked) return;
    this.state.lookDeltaX += e.movementX * this.mouseSensitivity;
    this.state.lookDeltaY += e.movementY * this.mouseSensitivity;
  };

  private handleBlur = (): void => {
    this.keysHeld.clear();
    this.state.fireHeld = false;
    this.state.plantDefuseHeld = false;
    this.state.scoreboardHeld = false;
    this.state.moveForward = 0;
    this.state.moveRight = 0;
  };

  // Mobile virtual inputs injection API
  public setMobileMove(forward: number, right: number): void {
    this.state.moveForward = Math.max(-1, Math.min(1, forward));
    this.state.moveRight = Math.max(-1, Math.min(1, right));
  }

  public addMobileLook(dx: number, dy: number): void {
    this.state.lookDeltaX += dx * this.touchSensitivity;
    this.state.lookDeltaY += dy * this.touchSensitivity;
  }

  public setMobileFire(held: boolean): void {
    if (held && !this.state.fireHeld) {
      this.state.fireJustPressed = true;
    }
    this.state.fireHeld = held;
  }

  public setMobileADS(ads: boolean): void {
    this.state.adsHeld = ads;
  }

  public triggerMobileJump(): void {
    this.state.jumpJustPressed = true;
  }

  public triggerMobileReload(): void {
    this.state.reloadJustPressed = true;
  }

  public triggerMobileAbility(slot: 'Q' | 'E' | 'C' | 'X'): void {
    if (slot === 'Q') this.state.abilityQJustPressed = true;
    if (slot === 'E') this.state.abilityEJustPressed = true;
    if (slot === 'C') this.state.abilityCJustPressed = true;
    if (slot === 'X') this.state.abilityXJustPressed = true;
  }

  public setMobilePlantDefuse(held: boolean): void {
    this.state.plantDefuseHeld = held;
  }

  public triggerMobileBuy(): void {
    this.state.buyMenuJustPressed = true;
  }

  public update(): void {
    // Process keyboard continuous move if not overridden by mobile joystick
    if (!this.isMobile || (this.state.moveForward === 0 && this.state.moveRight === 0)) {
      let fwd = 0;
      let right = 0;

      if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) fwd += 1;
      if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) fwd -= 1;
      if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) right += 1;
      if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) right -= 1;

      // Normalize diagonal move
      if (fwd !== 0 && right !== 0) {
        fwd *= 0.7071;
        right *= 0.7071;
      }

      this.state.moveForward = fwd;
      this.state.moveRight = right;
    }

    this.state.crouchHeld = this.keysHeld.has('ControlLeft') || this.keysHeld.has('KeyC');
  }

  public clearFrameDeltas(): void {
    this.state.lookDeltaX = 0;
    this.state.lookDeltaY = 0;
    this.state.fireJustPressed = false;
    this.state.jumpJustPressed = false;
    this.state.reloadJustPressed = false;
    this.state.abilityQJustPressed = false;
    this.state.abilityEJustPressed = false;
    this.state.abilityCJustPressed = false;
    this.state.abilityXJustPressed = false;
    this.state.buyMenuJustPressed = false;
    this.state.pauseJustPressed = false;
    this.state.weaponSlotJustPressed = null;
  }
}
