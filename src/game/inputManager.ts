/**
 * Hollow Strike - Cross-Platform Input Manager
 * Manages PC Keyboard + Mouse (PointerLock + drag-look fallback) and Mobile Virtual Touch Controls.
 */

import { isMobileDevice } from './device';
import { soundEngine } from './audio';
import { ControlMode } from './types';

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
  startRoundJustPressed: boolean;
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
    startRoundJustPressed: false,
    weaponSlotJustPressed: null,
  };

  public isMobile: boolean = false;
  public isPointerLocked: boolean = false;
  public mouseSensitivity: number = 0.0022;
  public touchSensitivity: number = 0.0035;
  public adsSensitivityMultiplier: number = 0.7;
  public invertY: boolean = false;
  public uiBlocking: boolean = false;

  public onPointerLockLost?: () => void;
  public onPointerLockChange?: (locked: boolean) => void;

  private keysHeld: Set<string> = new Set();
  private element: HTMLElement | null = null;
  private mobileCrouchHeld: boolean = false;
  private isCanvasMouseDown: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private suppressNextLockLost: boolean = false;

  constructor(controlMode: ControlMode = 'AUTO') {
    this.detectDevice(controlMode);
  }

  public detectDevice(controlMode: ControlMode = 'AUTO'): void {
    this.isMobile = isMobileDevice(controlMode);
  }

  public setUiBlocking(blocked: boolean): void {
    this.uiBlocking = blocked;
    if (blocked) {
      this.keysHeld.clear();
      this.isCanvasMouseDown = false;
      this.state.fireHeld = false;
      this.state.fireJustPressed = false;
      this.state.plantDefuseHeld = false;
      this.state.moveForward = 0;
      this.state.moveRight = 0;
      this.exitPointerLock();
    }
  }

  public attach(element: HTMLElement): void {
    this.element = element;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);

    element.addEventListener('click', this.requestPointerLock);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('contextmenu', this.handleContextMenu);
  }

  public detach(): void {
    if (this.element) {
      this.element.removeEventListener('click', this.requestPointerLock);
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('contextmenu', this.handleContextMenu);
    this.element = null;
  }

  public requestPointerLock = (): void => {
    soundEngine.init();
    if (this.isMobile || this.uiBlocking || !this.element) return;
    if (document.pointerLockElement !== this.element) {
      try {
        const res = this.element.requestPointerLock?.() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } catch {
        // Ignore in sandboxed contexts without pointer lock permission
      }
    }
  };

  public exitPointerLock(): void {
    if (document.pointerLockElement) {
      this.suppressNextLockLost = true;
      try {
        document.exitPointerLock?.();
      } catch {
        // Ignore
      }
    }
  }

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private handlePointerLockChange = (): void => {
    const previous = this.isPointerLocked;
    this.isPointerLocked = document.pointerLockElement === this.element;
    this.onPointerLockChange?.(this.isPointerLocked);

    if (this.suppressNextLockLost) {
      this.suppressNextLockLost = false;
      return;
    }

    if (previous && !this.isPointerLocked && !this.isMobile && !this.uiBlocking) {
      this.onPointerLockLost?.();
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    soundEngine.init();
    if (e.repeat) return;

    if (this.uiBlocking) return;

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
        // C Key is ability C only (Crouch is ControlLeft only)
        this.state.abilityCJustPressed = true;
        break;
      case 'KeyX':
        this.state.abilityXJustPressed = true;
        break;
      case 'KeyG':
        this.state.startRoundJustPressed = true;
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
    soundEngine.init();
    if (this.isMobile || this.uiBlocking) return;
    // Ignore clicks on HUD buttons or overlays — only canvas clicks fire/aim
    if (this.element && e.target !== this.element) return;

    if (e.button === 0) {
      this.isCanvasMouseDown = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.state.fireHeld = true;
      this.state.fireJustPressed = true;
    } else if (e.button === 2) {
      this.state.adsHeld = !this.state.adsHeld;
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.isCanvasMouseDown = false;
      this.state.fireHeld = false;
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (this.uiBlocking || this.isMobile) return;

    const adsMult = this.state.adsHeld ? this.adsSensitivityMultiplier : 1.0;
    const ySign = this.invertY ? -1 : 1;

    if (this.isPointerLocked) {
      this.state.lookDeltaX += e.movementX * this.mouseSensitivity * adsMult;
      this.state.lookDeltaY += e.movementY * this.mouseSensitivity * adsMult * ySign;
    } else if (this.isCanvasMouseDown) {
      // Fallback drag-to-look when pointer lock is unavailable or before lock completes
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.state.lookDeltaX += dx * this.mouseSensitivity * 1.35 * adsMult;
      this.state.lookDeltaY += dy * this.mouseSensitivity * 1.35 * adsMult * ySign;
    }
  };

  private handleBlur = (): void => {
    this.keysHeld.clear();
    this.isCanvasMouseDown = false;
    this.mobileCrouchHeld = false;
    this.state.fireHeld = false;
    this.state.plantDefuseHeld = false;
    this.state.scoreboardHeld = false;
    this.state.moveForward = 0;
    this.state.moveRight = 0;
  };

  // Mobile virtual inputs injection API
  public setMobileMove(forward: number, right: number): void {
    soundEngine.init();
    this.state.moveForward = Math.max(-1, Math.min(1, forward));
    this.state.moveRight = Math.max(-1, Math.min(1, right));
  }

  public addMobileLook(dx: number, dy: number): void {
    const adsMult = this.state.adsHeld ? this.adsSensitivityMultiplier : 1.0;
    const ySign = this.invertY ? -1 : 1;
    this.state.lookDeltaX += dx * this.touchSensitivity * adsMult;
    this.state.lookDeltaY += dy * this.touchSensitivity * adsMult * ySign;
  }

  public setMobileFire(held: boolean): void {
    soundEngine.init();
    if (held && !this.state.fireHeld) {
      this.state.fireJustPressed = true;
    }
    this.state.fireHeld = held;
  }

  public setMobileADS(ads: boolean): void {
    this.state.adsHeld = ads;
  }

  public setMobileCrouch(crouch: boolean): void {
    this.mobileCrouchHeld = crouch;
  }

  public triggerMobileJump(): void {
    soundEngine.init();
    this.state.jumpJustPressed = true;
  }

  public triggerMobileReload(): void {
    soundEngine.init();
    this.state.reloadJustPressed = true;
  }

  public triggerMobileWeaponSlot(slot: 1 | 2): void {
    soundEngine.init();
    this.state.weaponSlotJustPressed = slot;
  }

  public triggerMobileStartRound(): void {
    soundEngine.init();
    this.state.startRoundJustPressed = true;
  }

  public triggerMobileAbility(slot: 'Q' | 'E' | 'C' | 'X'): void {
    soundEngine.init();
    if (slot === 'Q') this.state.abilityQJustPressed = true;
    if (slot === 'E') this.state.abilityEJustPressed = true;
    if (slot === 'C') this.state.abilityCJustPressed = true;
    if (slot === 'X') this.state.abilityXJustPressed = true;
  }

  public setMobilePlantDefuse(held: boolean): void {
    soundEngine.init();
    this.state.plantDefuseHeld = held;
  }

  public triggerMobileBuy(): void {
    this.state.buyMenuJustPressed = true;
  }

  public update(): void {
    if (this.uiBlocking) {
      this.state.moveForward = 0;
      this.state.moveRight = 0;
      this.state.crouchHeld = false;
      return;
    }

    if (!this.isMobile || (this.state.moveForward === 0 && this.state.moveRight === 0)) {
      let fwd = 0;
      let right = 0;

      if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) fwd += 1;
      if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) fwd -= 1;
      if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) right += 1;
      if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) right -= 1;

      if (fwd !== 0 && right !== 0) {
        fwd *= 0.7071;
        right *= 0.7071;
      }

      this.state.moveForward = fwd;
      this.state.moveRight = right;
    }

    this.state.crouchHeld = this.keysHeld.has('ControlLeft') || this.mobileCrouchHeld;
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
    this.state.startRoundJustPressed = false;
    this.state.weaponSlotJustPressed = null;
  }
}
