/**
 * Hollow Strike - 3D Simulation & Game Engine
 * Decoupled fixed-timestep simulation, Three.js renderer, object pooling, viewmodel animations, and round orchestrator.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  RoundPhase,
  TeamSide,
  BotDifficulty,
  GraphicsPreset,
  PlayerStats,
  KillEvent,
  GameSettings,
  MatchMode,
  AbilitySlotState,
  HitFeedback,
  WEAPON_REGISTRY,
  AGENT_REGISTRY,
  SHIELD_REGISTRY,
  BUY_PHASE_DURATION,
  ROUND_LIVE_DURATION,
  SPIKE_PLANT_DURATION,
  SPIKE_DEFUSE_DURATION,
  SPIKE_DETONATION_TIME,
  ROUND_END_DURATION,
  HALF_TIME_ROUND,
  WeaponDef,
  SpectateCameraMode,
  SpectateState,
} from './types';
import {
  calculateDamage,
  calculateEconomy,
  checkRoundWin,
  checkMatchWin,
  shouldSwapSides,
  calculateSpread,
  selectNextSpectateTargetId,
  computeGentleAimAssist,
} from './rules';
import { buildTacticalMap, BuiltMap } from './mapBuilder';
import { BOMB_SITE_A, BOMB_SITE_B, SPAWN_ATTACKERS, SPAWN_DEFENDERS, checkCollision } from './mapData';
import { createAgentModel } from './agentModels';
import { createApex9Model, createViper9Model, createPhantomVModel, createVoidLanceModel, createSpikeModel } from './weaponModels';
import { soundEngine } from './audio';
import { AbilityManager } from './abilities';
import { BotCombatant, BotController } from './botAI';
import { InputManager } from './inputManager';
import { MatchSummaryPayload } from './profileStore';

// Software GL detector per Three.js skill
export const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return false;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
})();

// Reusable scratch objects — zero per-frame allocations
const _vec3_1 = new THREE.Vector3();
const _vec3_2 = new THREE.Vector3();
const _vec3_3 = new THREE.Vector3();
const _vec3_4 = new THREE.Vector3();
const _vec3_5 = new THREE.Vector3();
const _vmTargetPos = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
// Enable Layer 0 (bots + map) and Layer 1 (player first-person hidden hitboxes)
_raycaster.layers.enable(0);
_raycaster.layers.enable(1);

export interface EngineCallbacks {
  onStatsUpdate: (stats: PlayerStats[]) => void;
  onRoundPhaseChange: (phase: RoundPhase, timeRemaining: number) => void;
  onRoundScoreChange: (attackerWins: number, defenderWins: number, currentRound: number) => void;
  onKillEvent: (event: KillEvent) => void;
  onPlayerHealthUpdate: (hp: number, armor: number, maxHp: number, maxArmor: number) => void;
  onPlayerDamage?: (amount: number) => void;
  onWeaponUpdate: (weapon: WeaponDef, ammoInMag: number, reserveAmmo: number, isReloading: boolean, activeSlot?: 1 | 2) => void;
  onSpikeStateUpdate: (state: 'not_planted' | 'planted' | 'defused' | 'detonated', timer: number, plantProgress: number, defuseProgress: number) => void;
  onHitmarker: (isHeadshot: boolean) => void;
  onHitFeedback?: (feedback: HitFeedback) => void;
  onAbilityStateUpdate?: (states: AbilitySlotState[]) => void;
  onBlindStateChange?: (isBlinded: boolean) => void;
  onPointerLockChange?: (locked: boolean) => void;
  onFpsUpdate: (fps: number) => void;
  onMatchOver: (winner: TeamSide, summary: MatchSummaryPayload) => void;
  onPointerLockLost?: () => void;
  onSpectateUpdate?: (state: SpectateState | null) => void;
}

export class GameEngine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public input: InputManager;
  public settings: GameSettings;
  public abilityMgr: AbilityManager;
  public matchMode: MatchMode;

  // Round & Economy State
  public roundPhase: RoundPhase = 'BUY_PHASE';
  public roundTimer: number = BUY_PHASE_DURATION;
  public roundNumber: number = 1;
  public attackerRoundsWon: number = 0;
  public defenderRoundsWon: number = 0;
  public playerTeam: TeamSide = 'ATTACKERS';
  public playerLossStreak: number = 0;
  public botLossStreak: number = 0;

  // Spike State
  public spikeState: 'not_planted' | 'planted' | 'defused' | 'detonated' = 'not_planted';
  public spikeTimer: number = SPIKE_DETONATION_TIME;
  public spikeCarrierId: string | null = null;
  public spikeMesh: THREE.Group | null = null;
  public spikePosition: THREE.Vector3 | null = null;
  public plantedSite: 'A' | 'B' | null = null;
  public spikeBeepTimer: number = 1.0;

  // Combatants
  public playerCombatant!: BotCombatant;
  public combatants: BotCombatant[] = [];
  public botControllers: BotController[] = [];
  public playerStats: PlayerStats[] = [];

  // Viewmodel & First-Person Animations
  public viewmodelRig: THREE.Group;
  public viewmodelWeapon: THREE.Group | null = null;
  private viewmodelArms: THREE.Group;
  private viewmodelFlash: THREE.Mesh;
  private vmFlashTimer: number = 0;
  private vmRecoilZ: number = 0;
  private vmRecoilPitch: number = 0;
  private vmWalkPhase: number = 0;
  private vmEquipOffset: number = 0;
  private vmSwayX: number = 0;
  private vmSwayY: number = 0;
  private vmLandOffset: number = 0;

  // Player Jump/Eye Physics & Status
  private playerVelY: number = 0;
  private isGrounded: boolean = true;
  private wasGrounded: boolean = true;
  private playerEyeHeight: number = 1.65;
  private playerOverdriveTimer: number = 0;
  private abilitySlots: Record<'Q' | 'E' | 'C' | 'X', AbilitySlotState> = {} as Record<'Q' | 'E' | 'C' | 'X', AbilitySlotState>;
  private abilitySyncTimer: number = 0;
  private wasBlinded: boolean = false;

  // Real Match Combat Telemetry
  private playerHeadshots: number = 0;
  private playerDamageDealt: number = 0;
  private weaponBreakdown: MatchSummaryPayload['weaponBreakdown'] = {};
  private botDifficulty: BotDifficulty = 'MEDIUM';

  public cameraShakeTrauma: number = 0;
  public hitstopTimer: number = 0;

  // Procedural Map & Lighting
  private mapData!: BuiltMap;
  private dirLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;

  // Tracer & Spark Pools
  private tracerLines: { line: THREE.Line; age: number; maxAge: number; inUse: boolean }[] = [];
  private sparks: { mesh: THREE.Mesh; vel: THREE.Vector3; age: number; maxAge: number; inUse: boolean }[] = [];

  // Throttled UI Emissions
  private lastNotifiedRoundPhase: RoundPhase | null = null;
  private lastNotifiedRoundSecond: number = -1;
  private lastNotifiedSpikeKey: string = '';

  // Runtime & Spectator Tracking
  private frameId: number = 0;
  private lastTime: number = 0;
  private lastRenderTime: number = 0;
  private isDestroyed: boolean = false;
  private isPaused: boolean = false;
  private callbacks: EngineCallbacks;
  private fpsCounter: number = 0;
  private fpsTimer: number = 0;

  private spectateTargetId: string | null = null;
  private spectateMode: SpectateCameraMode = 'THIRD_PERSON';
  private spectateOrbitYawOffset: number = 0;
  private spectateOrbitPitch: number = 0.22;
  private practiceRespawnTimer: number = 0;
  private lastSpectateKey: string = '';
  private deathCamAnchor: THREE.Vector3 = new THREE.Vector3();
  private aimAssistSwipeCooldown: number = 0;

  constructor(
    mountElement: HTMLElement,
    settings: GameSettings,
    playerAgentId: string,
    botDifficulty: BotDifficulty,
    callbacks: EngineCallbacks,
    matchMode: MatchMode = 'COMPETITIVE'
  ) {
    this.settings = settings;
    this.callbacks = callbacks;
    this.matchMode = matchMode;
    this.input = new InputManager(settings.controlMode, settings.keyBindings);

    // 1. Scene & Atmosphere Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090f1d);
    this.scene.fog = new THREE.FogExp2(0x090f1d, 0.013);

    // 2. Camera Setup (Tactical First-Person FOV)
    this.camera = new THREE.PerspectiveCamera(
      settings.fov,
      Math.max(1, mountElement.clientWidth) / Math.max(1, mountElement.clientHeight),
      0.1,
      140
    );
    this.camera.position.set(0, 1.65, 36);

    // 3. Renderer with Software GL Guard
    this.renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl && settings.graphics !== 'LOW',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.applyGraphicsPreset(settings.graphics);

    this.renderer.setSize(mountElement.clientWidth || window.innerWidth, mountElement.clientHeight || window.innerHeight);
    mountElement.appendChild(this.renderer.domElement);

    // 4. Studio Environment Lighting via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Warm Directional Key + Cool Hemisphere Fill
    this.dirLight = new THREE.DirectionalLight(0xffedd5, 1.45);
    this.dirLight.position.set(28, 45, 24);
    this.dirLight.castShadow = !isSoftwareGl && settings.graphics !== 'LOW';
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 110;
    this.dirLight.shadow.camera.left = -48;
    this.dirLight.shadow.camera.right = 48;
    this.dirLight.shadow.camera.top = 48;
    this.dirLight.shadow.camera.bottom = -48;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    this.hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x1e293b, 0.65);
    this.scene.add(this.hemiLight);

    // 5. Abilities & Procedural Map
    this.abilityMgr = new AbilityManager(this.scene);
    this.mapData = buildTacticalMap(this.scene);

    // 6. Viewmodel Rig, Tactical Hands, and Barrel Muzzle Flash
    this.viewmodelRig = new THREE.Group();
    this.viewmodelArms = this.createViewmodelHands(playerAgentId);
    this.viewmodelFlash = this.createViewmodelFlash();
    this.viewmodelRig.add(this.viewmodelArms);
    this.camera.add(this.viewmodelRig);
    this.scene.add(this.camera);

    // 7. Initialize Object Pools (Tracers & Sparks)
    this.initObjectPools();

    // 8. Attach Input & pointer lock handlers
    this.botDifficulty = botDifficulty;
    this.input.attach(this.renderer.domElement);
    this.input.mouseSensitivity = settings.mouseSensitivity;
    this.input.touchSensitivity = settings.touchSensitivity;
    this.input.adsSensitivityMultiplier = settings.adsSensitivityMultiplier ?? 0.7;
    this.input.invertY = settings.invertY ?? false;
    this.input.onPointerLockLost = () => {
      if (this.roundPhase !== 'MATCH_OVER' && !this.isPaused) {
        this.setPaused(true);
        this.callbacks.onPointerLockLost?.();
      }
    };
    this.input.onPointerLockChange = (locked) => {
      this.callbacks.onPointerLockChange?.(locked);
    };

    // 9. Initialize 5v5 Combatants & Mode Setup
    this.initCombatants(playerAgentId, botDifficulty);
    this.initAbilitySlots(playerAgentId);
    this.configureInitialPhaseForMode();

    // 10. Start simulation loop
    this.lastTime = performance.now();
    this.lastRenderTime = performance.now();
    this.tick();

    // Window Resize listener
    window.addEventListener('resize', this.handleResize);
  }

  private createViewmodelHands(agentId: string): THREE.Group {
    const agent = AGENT_REGISTRY[agentId] || AGENT_REGISTRY.ZEPHYR;
    const handsGroup = new THREE.Group();

    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.75, metalness: 0.2 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.35 });
    const accentMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(agent.primaryColor),
      emissive: new THREE.Color(agent.primaryColor),
      emissiveIntensity: 0.5,
    });

    // Right Forearm + Glove (holding grip)
    const rForearm = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.068, 0.28), sleeveMat);
    rForearm.position.set(0.04, -0.09, 0.14);
    rForearm.rotation.set(0.25, -0.15, 0);
    const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.062, 0.11), gloveMat);
    rGlove.position.set(0.01, -0.055, 0.01);
    const rBand = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.018, 0.04), accentMat);
    rBand.position.set(0.025, -0.07, 0.06);

    // Left Support Forearm + Glove (under forend)
    const lForearm = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.062, 0.28), sleeveMat);
    lForearm.position.set(-0.14, -0.11, 0.02);
    lForearm.rotation.set(0.32, 0.55, 0);
    const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.056, 0.10), gloveMat);
    lGlove.position.set(-0.04, -0.04, -0.11);

    handsGroup.add(rForearm, rGlove, rBand, lForearm, lGlove);
    return handsGroup;
  }

  private createViewmodelFlash(): THREE.Mesh {
    const flashGeo = new THREE.OctahedronGeometry(0.07, 0);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.set(0, 0.045, -0.52);
    flash.visible = false;
    flash.raycast = () => {};
    return flash;
  }

  private configureInitialPhaseForMode(): void {
    if (this.matchMode === 'PRACTICE') {
      this.roundPhase = 'ROUND_LIVE';
      this.roundTimer = 300;
      this.mapData.barrierAttackers.visible = false;
      this.mapData.barrierDefenders.visible = false;
      this.playerStats[0].credits = 9000;
      // Start bots roaming/engaging immediately in Practice
      for (const ctrl of this.botControllers) {
        ctrl.planRound(false, null);
      }
      this.callbacks.onStatsUpdate([...this.playerStats]);
      this.callbacks.onRoundPhaseChange(this.roundPhase, this.roundTimer);
    } else if (this.matchMode === 'SKIRMISH') {
      this.roundPhase = 'BUY_PHASE';
      this.roundTimer = 8;
      this.playerStats.forEach((s) => {
        s.credits = 2900;
      });
      this.callbacks.onStatsUpdate([...this.playerStats]);
      this.callbacks.onRoundPhaseChange(this.roundPhase, this.roundTimer);
    } else {
      this.roundPhase = 'BUY_PHASE';
      this.roundTimer = BUY_PHASE_DURATION;
      this.callbacks.onRoundPhaseChange(this.roundPhase, this.roundTimer);
    }
  }

  private initAbilitySlots(agentId: string): void {
    const agent = AGENT_REGISTRY[agentId] || AGENT_REGISTRY.ZEPHYR;
    const slots = {} as Record<'Q' | 'E' | 'C' | 'X', AbilitySlotState>;
    for (const ab of agent.abilities) {
      const ultReq = ab.ultPointsRequired ?? 5;
      slots[ab.keySlot] = {
        keySlot: ab.keySlot,
        charges: ab.isUltimate ? 0 : ab.maxCharges,
        maxCharges: ab.maxCharges,
        cooldownRemaining: 0,
        cooldownTotal: ab.cooldownTime,
        isUltimate: ab.isUltimate,
        ultPoints: ab.isUltimate && this.matchMode === 'PRACTICE' ? ultReq : 0,
        ultRequired: ultReq,
        activeRemaining: 0,
      };
    }
    this.abilitySlots = slots;
    this.emitAbilityStates();
  }

  private emitAbilityStates(): void {
    this.callbacks.onAbilityStateUpdate?.([
      this.abilitySlots.Q,
      this.abilitySlots.E,
      this.abilitySlots.C,
      this.abilitySlots.X,
    ]);
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (paused) {
      this.input.exitPointerLock();
    }
  }

  public setUiBlocking(blocked: boolean): void {
    this.input.setUiBlocking(blocked);
  }

  public skipBuyPhase(): void {
    if (this.roundPhase === 'BUY_PHASE') {
      this.roundTimer = 0;
    }
  }

  public cycleSpectateTarget(direction: 1 | -1): void {
    if (this.playerCombatant.alive) return;
    this.spectateTargetId = selectNextSpectateTargetId(
      this.combatants,
      this.playerTeam,
      this.spectateTargetId,
      direction
    );
    this.spectateOrbitYawOffset = 0;
    this.emitSpectateState(true);
  }

  public toggleSpectateMode(): void {
    if (this.playerCombatant.alive) return;
    this.spectateMode = this.spectateMode === 'THIRD_PERSON' ? 'FIRST_PERSON' : 'THIRD_PERSON';
    this.spectateOrbitYawOffset = 0;
    this.emitSpectateState(true);
  }

  public updateSettings(newSettings: GameSettings): void {
    this.settings = newSettings;
    this.camera.fov = newSettings.fov;
    this.camera.updateProjectionMatrix();
    soundEngine.setVolume(newSettings.volume);
    soundEngine.setMuted(!newSettings.soundEnabled);
    this.input.mouseSensitivity = newSettings.mouseSensitivity;
    this.input.touchSensitivity = newSettings.touchSensitivity;
    this.input.adsSensitivityMultiplier = newSettings.adsSensitivityMultiplier ?? 0.7;
    this.input.invertY = newSettings.invertY ?? false;
    this.input.setKeyBindings(newSettings.keyBindings);
    this.input.detectDevice(newSettings.controlMode);
    this.applyGraphicsPreset(newSettings.graphics);
  }

  public applyGraphicsPreset(preset: GraphicsPreset): void {
    this.settings.graphics = preset;
    let dpr = 1.0;
    let shadowEnabled = true;

    switch (preset) {
      case 'LOW':
        dpr = 0.65;
        shadowEnabled = false;
        break;
      case 'MEDIUM':
        dpr = 0.85;
        shadowEnabled = !isSoftwareGl;
        break;
      case 'HIGH':
        dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        shadowEnabled = !isSoftwareGl;
        break;
      case 'ULTRA':
        dpr = Math.min(window.devicePixelRatio || 1, 2.0);
        shadowEnabled = !isSoftwareGl;
        break;
    }

    this.renderer.setPixelRatio(isSoftwareGl ? 1.0 : dpr);
    this.renderer.shadowMap.enabled = shadowEnabled;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  private initObjectPools(): void {
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.9,
    });
    for (let i = 0; i < 30; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(geo, lineMat);
      line.visible = false;
      this.scene.add(line);
      this.tracerLines.push({ line, age: 0, maxAge: 0.08, inUse: false });
    }

    const sparkGeo = new THREE.BoxGeometry(0.045, 0.045, 0.045);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    for (let i = 0; i < 80; i++) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.sparks.push({ mesh, vel: new THREE.Vector3(), age: 0, maxAge: 0.25, inUse: false });
    }
  }

  private initCombatants(playerAgentId: string, difficulty: BotDifficulty): void {
    this.combatants = [];
    this.botControllers = [];
    this.playerStats = [];

    const agentKeys = Object.keys(AGENT_REGISTRY);
    const playerAgent = AGENT_REGISTRY[playerAgentId] || AGENT_REGISTRY.ZEPHYR;
    const playerMesh = createAgentModel(playerAgent, this.playerTeam);
    // Keep visible = true so bot raycasts always hit live hitboxMeshes, but isolate to Layer 1 so FP camera (Layer 0) doesn't render self-body
    playerMesh.root.visible = true;
    playerMesh.root.traverse((obj) => {
      obj.layers.set(1);
    });
    this.scene.add(playerMesh.root);

    const initialSpawn = this.playerTeam === 'ATTACKERS' ? SPAWN_ATTACKERS : SPAWN_DEFENDERS;
    const playerStartYaw = this.playerTeam === 'ATTACKERS' ? 0 : Math.PI; // Three.js -Z is North at yaw=0

    this.playerCombatant = {
      id: 'player_0',
      name: 'Agent (You)',
      team: this.playerTeam,
      agentId: playerAgent.id,
      isHuman: true,
      hp: 100,
      armor: 0,
      alive: true,
      deathTimer: 0,
      position: new THREE.Vector3(initialSpawn.x, 0, initialSpawn.z),
      velocity: new THREE.Vector3(),
      yaw: playerStartYaw,
      pitch: 0,
      hasSpike: this.playerTeam === 'ATTACKERS',
      weapon: WEAPON_REGISTRY.APEX_9,
      ammoInMag: WEAPON_REGISTRY.APEX_9.magazineSize,
      reserveAmmo: WEAPON_REGISTRY.APEX_9.reserveAmmo,
      primaryWeapon: null,
      primaryAmmoInMag: 0,
      primaryReserveAmmo: 0,
      sidearmWeapon: WEAPON_REGISTRY.APEX_9,
      sidearmAmmoInMag: WEAPON_REGISTRY.APEX_9.magazineSize,
      sidearmReserveAmmo: WEAPON_REGISTRY.APEX_9.reserveAmmo,
      activeSlot: 2,
      reloadTimer: 0,
      shootCooldown: 0,
      isPlanting: false,
      isDefusing: false,
      actionProgress: 0,
      modelPackage: playerMesh,
    };
    playerMesh.root.position.copy(this.playerCombatant.position);
    playerMesh.root.rotation.y = this.playerCombatant.yaw;
    playerMesh.root.updateMatrixWorld(true);

    this.combatants.push(this.playerCombatant);
    if (this.playerCombatant.hasSpike) {
      this.spikeCarrierId = this.playerCombatant.id;
    }

    this.playerStats.push({
      id: this.playerCombatant.id,
      name: this.playerCombatant.name,
      agentId: this.playerCombatant.agentId,
      team: this.playerCombatant.team,
      isHuman: true,
      kills: 0,
      deaths: 0,
      assists: 0,
      score: 0,
      credits: this.matchMode === 'PRACTICE' ? 9000 : this.matchMode === 'SKIRMISH' ? 2900 : 800,
      ping: 12,
      alive: true,
      hp: 100,
      maxHp: 100,
      armor: 0,
      maxArmor: 50,
      hasSpike: this.playerCombatant.hasSpike,
    });

    // Create 4 Bot Teammates
    const allySpawn = initialSpawn;
    for (let i = 1; i <= 4; i++) {
      const agentKey = agentKeys[i % agentKeys.length];
      const agent = AGENT_REGISTRY[agentKey];
      const mesh = createAgentModel(agent, this.playerTeam);
      this.scene.add(mesh.root);

      const offsetX = (i - 2.5) * 3.0;
      const startYaw = this.playerTeam === 'ATTACKERS' ? 0 : Math.PI;
      const startWeapon = this.matchMode === 'SKIRMISH' ? WEAPON_REGISTRY.VIPER_9 : WEAPON_REGISTRY.APEX_9;

      const bot: BotCombatant = {
        id: `ally_${i}`,
        name: `Ally ${agent.name}`,
        team: this.playerTeam,
        agentId: agent.id,
        isHuman: false,
        hp: 100,
        armor: 0,
        alive: true,
        deathTimer: 0,
        position: new THREE.Vector3(allySpawn.x + offsetX, 0, allySpawn.z),
        velocity: new THREE.Vector3(),
        yaw: startYaw,
        pitch: 0,
        hasSpike: false,
        weapon: startWeapon,
        ammoInMag: startWeapon.magazineSize,
        reserveAmmo: startWeapon.reserveAmmo,
        primaryWeapon: startWeapon.category !== 'SIDEARM' ? startWeapon : null,
        primaryAmmoInMag: startWeapon.category !== 'SIDEARM' ? startWeapon.magazineSize : 0,
        primaryReserveAmmo: startWeapon.category !== 'SIDEARM' ? startWeapon.reserveAmmo : 0,
        sidearmWeapon: WEAPON_REGISTRY.APEX_9,
        sidearmAmmoInMag: WEAPON_REGISTRY.APEX_9.magazineSize,
        sidearmReserveAmmo: WEAPON_REGISTRY.APEX_9.reserveAmmo,
        activeSlot: startWeapon.category !== 'SIDEARM' ? 1 : 2,
        reloadTimer: 0,
        shootCooldown: 0,
        isPlanting: false,
        isDefusing: false,
        actionProgress: 0,
        modelPackage: mesh,
      };
      mesh.setWeapon(startWeapon.id);
      mesh.root.position.copy(bot.position);
      mesh.root.rotation.y = bot.yaw;
      mesh.root.updateMatrixWorld(true);

      this.combatants.push(bot);
      this.botControllers.push(new BotController(bot, difficulty));

      this.playerStats.push({
        id: bot.id,
        name: bot.name,
        agentId: bot.agentId,
        team: bot.team,
        isHuman: false,
        kills: 0,
        deaths: 0,
        assists: 0,
        score: 0,
        credits: 800,
        ping: Math.floor(Math.random() * 20 + 15),
        alive: true,
        hp: 100,
        maxHp: 100,
        armor: 0,
        maxArmor: 50,
        hasSpike: false,
      });
    }

    // Create 5 Bot Opponents
    const oppTeam: TeamSide = this.playerTeam === 'ATTACKERS' ? 'DEFENDERS' : 'ATTACKERS';
    const oppSpawn = oppTeam === 'ATTACKERS' ? SPAWN_ATTACKERS : SPAWN_DEFENDERS;
    for (let i = 1; i <= 5; i++) {
      const agentKey = agentKeys[(i + 2) % agentKeys.length];
      const agent = AGENT_REGISTRY[agentKey];
      const mesh = createAgentModel(agent, oppTeam);
      this.scene.add(mesh.root);

      const offsetX = (i - 3) * 3.0;
      const startYaw = oppTeam === 'ATTACKERS' ? 0 : Math.PI;
      const startWeapon = this.matchMode === 'SKIRMISH' ? WEAPON_REGISTRY.VIPER_9 : WEAPON_REGISTRY.APEX_9;

      const bot: BotCombatant = {
        id: `opp_${i}`,
        name: `Foe ${agent.name}`,
        team: oppTeam,
        agentId: agent.id,
        isHuman: false,
        hp: 100,
        armor: 0,
        alive: true,
        deathTimer: 0,
        position: new THREE.Vector3(oppSpawn.x + offsetX, 0, oppSpawn.z),
        velocity: new THREE.Vector3(),
        yaw: startYaw,
        pitch: 0,
        hasSpike: oppTeam === 'ATTACKERS' && i === 1,
        weapon: startWeapon,
        ammoInMag: startWeapon.magazineSize,
        reserveAmmo: startWeapon.reserveAmmo,
        primaryWeapon: startWeapon.category !== 'SIDEARM' ? startWeapon : null,
        primaryAmmoInMag: startWeapon.category !== 'SIDEARM' ? startWeapon.magazineSize : 0,
        primaryReserveAmmo: startWeapon.category !== 'SIDEARM' ? startWeapon.reserveAmmo : 0,
        sidearmWeapon: WEAPON_REGISTRY.APEX_9,
        sidearmAmmoInMag: WEAPON_REGISTRY.APEX_9.magazineSize,
        sidearmReserveAmmo: WEAPON_REGISTRY.APEX_9.reserveAmmo,
        activeSlot: startWeapon.category !== 'SIDEARM' ? 1 : 2,
        reloadTimer: 0,
        shootCooldown: 0,
        isPlanting: false,
        isDefusing: false,
        actionProgress: 0,
        modelPackage: mesh,
      };
      mesh.setWeapon(startWeapon.id);
      mesh.root.position.copy(bot.position);
      mesh.root.rotation.y = bot.yaw;
      mesh.root.updateMatrixWorld(true);

      this.combatants.push(bot);
      this.botControllers.push(new BotController(bot, difficulty));

      this.playerStats.push({
        id: bot.id,
        name: bot.name,
        agentId: bot.agentId,
        team: bot.team,
        isHuman: false,
        kills: 0,
        deaths: 0,
        assists: 0,
        score: 0,
        credits: 800,
        ping: Math.floor(Math.random() * 25 + 20),
        alive: true,
        hp: 100,
        maxHp: 100,
        armor: 0,
        maxArmor: 50,
        hasSpike: bot.hasSpike,
      });
    }

    this.updateViewmodelWeapon(WEAPON_REGISTRY.APEX_9.id);
    this.camera.position.set(this.playerCombatant.position.x, 1.65, this.playerCombatant.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.playerCombatant.yaw;
    this.camera.rotation.x = 0;

    this.callbacks.onStatsUpdate([...this.playerStats]);
    this.callbacks.onPlayerHealthUpdate(100, 0, 100, 50);
    this.callbacks.onWeaponUpdate(this.playerCombatant.weapon, this.playerCombatant.ammoInMag, this.playerCombatant.reserveAmmo, false, 2);
  }

  private updateViewmodelWeapon(weaponId: string): void {
    if (this.viewmodelWeapon) {
      this.viewmodelWeapon.remove(this.viewmodelFlash);
      this.viewmodelRig.remove(this.viewmodelWeapon);
    }

    switch (weaponId) {
      case 'APEX_9':
        this.viewmodelWeapon = createApex9Model();
        this.viewmodelFlash.position.set(0, 0.045, -0.22);
        break;
      case 'VIPER_9':
        this.viewmodelWeapon = createViper9Model();
        this.viewmodelFlash.position.set(0, 0.045, -0.44);
        break;
      case 'PHANTOM_V':
        this.viewmodelWeapon = createPhantomVModel();
        this.viewmodelFlash.position.set(0, 0.045, -0.66);
        break;
      case 'VOID_LANCE':
        this.viewmodelWeapon = createVoidLanceModel();
        this.viewmodelFlash.position.set(0, 0.045, -0.98);
        break;
      default:
        this.viewmodelWeapon = createApex9Model();
        this.viewmodelFlash.position.set(0, 0.045, -0.22);
    }

    this.viewmodelWeapon.position.set(0.28, -0.24, -0.42);
    this.viewmodelWeapon.add(this.viewmodelFlash);
    this.viewmodelRig.add(this.viewmodelWeapon);
    this.vmEquipOffset = -0.22; // Trigger raise animation
  }

  public switchWeaponSlot(slot: 1 | 2): boolean {
    const p = this.playerCombatant;
    if (!p.alive) return false;
    if (slot === 1 && !p.primaryWeapon) return false;
    if (slot === p.activeSlot) return false;

    // Save current slot's ammo
    if (p.activeSlot === 1) {
      p.primaryAmmoInMag = p.ammoInMag;
      p.primaryReserveAmmo = p.reserveAmmo;
    } else {
      p.sidearmAmmoInMag = p.ammoInMag;
      p.sidearmReserveAmmo = p.reserveAmmo;
    }

    p.activeSlot = slot;
    p.reloadTimer = 0;

    if (slot === 1 && p.primaryWeapon) {
      p.weapon = p.primaryWeapon;
      p.ammoInMag = p.primaryAmmoInMag;
      p.reserveAmmo = p.primaryReserveAmmo;
    } else {
      p.weapon = p.sidearmWeapon;
      p.ammoInMag = p.sidearmAmmoInMag;
      p.reserveAmmo = p.sidearmReserveAmmo;
    }

    this.input.setMobileADS(false);
    this.updateViewmodelWeapon(p.weapon.id);
    soundEngine.playReload();
    this.callbacks.onWeaponUpdate(p.weapon, p.ammoInMag, p.reserveAmmo, false, p.activeSlot);
    return true;
  }

  private tick = (): void => {
    if (this.isDestroyed) return;

    const now = performance.now();
    if (this.settings.fpsCap > 0) {
      const targetInterval = 1000 / this.settings.fpsCap;
      if (now - this.lastRenderTime < targetInterval - 1.0) {
        this.frameId = requestAnimationFrame(this.tick);
        return;
      }
    }

    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.lastRenderTime = now;
    const dt = Math.min(rawDt, 0.05);

    this.fpsCounter++;
    this.fpsTimer += rawDt;
    if (this.fpsTimer >= 0.5) {
      const currentFps = Math.round(this.fpsCounter / this.fpsTimer);
      this.callbacks.onFpsUpdate(currentFps);
      this.fpsCounter = 0;
      this.fpsTimer = 0;
    }

    if (!this.isPaused) {
      this.updateSimulation(dt);
    }

    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.tick);
  };

  private updateSimulation(dt: number): void {
    this.input.update();

    if (this.input.state.startRoundJustPressed && this.roundPhase === 'BUY_PHASE') {
      this.skipBuyPhase();
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    this.updateRoundState(dt);

    if (this.playerCombatant.alive) {
      this.updatePlayer(dt);
    } else {
      this.updateSpectator(dt);
    }

    // Bots stay put during BUY_PHASE
    if (this.roundPhase !== 'BUY_PHASE') {
      for (const ctrl of this.botControllers) {
        ctrl.update(
          dt,
          this.combatants,
          this.spikeState,
          this.spikePosition,
          this.plantedSite,
          this.abilityMgr,
          this.mapData.collidableMeshes,
          (shooter, dir) => this.fireBullet(shooter, dir),
          (bot, site) => this.handleBotPlantComplete(bot, site),
          () => this.handleBotDefuseComplete()
        );
      }
    }

    this.abilityMgr.update(
      dt,
      this.combatants,
      (target, dmgAmount, label) => this.applyExternalDamage(target, dmgAmount, label),
      (origin, dir, team) => this.fireTurretShot(origin, dir, team)
    );

    // Notify HUD if player blind state changed
    const isBlinded = this.playerCombatant.alive && this.abilityMgr.blindedCombatantIds.has(this.playerCombatant.id);
    if (isBlinded !== this.wasBlinded) {
      this.wasBlinded = isBlinded;
      this.callbacks.onBlindStateChange?.(isBlinded);
    }

    this.updateTracersAndSparks(dt);
    if (this.playerCombatant.alive) {
      this.updateCameraEffects(dt);
    } else {
      this.camera.rotation.z = 0;
      this.cameraShakeTrauma = Math.max(0, this.cameraShakeTrauma - dt * 2.5);
    }
    this.input.clearFrameDeltas();
  }

  private handleBotPlantComplete(bot: BotCombatant, site: 'A' | 'B'): void {
    if (this.spikeState !== 'not_planted') return;
    this.spikeState = 'planted';
    this.plantedSite = site;
    this.spikePosition = bot.position.clone();
    bot.hasSpike = false;

    if (!this.spikeMesh) {
      this.spikeMesh = createSpikeModel();
      this.scene.add(this.spikeMesh);
    }
    this.spikeMesh.position.copy(this.spikePosition);
    soundEngine.playSpikePlant();

    for (const ctrl of this.botControllers) {
      ctrl.planRound(true, this.plantedSite);
    }
  }

  private handleBotDefuseComplete(): void {
    if (this.spikeState !== 'planted') return;
    this.spikeState = 'defused';
    soundEngine.playSpikeDefused();
    this.endRound('DEFENDERS', 'SPIKE_DEFUSED');
  }

  private updateRoundState(dt: number): void {
    this.roundTimer -= dt;

    if (this.roundPhase === 'BUY_PHASE') {
      this.mapData.barrierAttackers.visible = true;
      this.mapData.barrierDefenders.visible = true;

      if (this.roundTimer <= 0) {
        this.roundPhase = 'ROUND_LIVE';
        this.roundTimer = ROUND_LIVE_DURATION;
        this.mapData.barrierAttackers.visible = false;
        this.mapData.barrierDefenders.visible = false;
        soundEngine.playRoundStart();

        for (const ctrl of this.botControllers) {
          ctrl.planRound(false, null);
        }
      }
    } else if (this.roundPhase === 'ROUND_LIVE') {
      if (this.spikeState === 'planted') {
        this.roundPhase = 'SPIKE_PLANTED';
      } else if (this.roundTimer <= 0) {
        if (this.matchMode === 'PRACTICE') {
          this.roundTimer = 300;
        } else {
          this.endRound('DEFENDERS', 'TIME_EXPIRED');
        }
      }
    } else if (this.roundPhase === 'SPIKE_PLANTED') {
      this.spikeTimer -= dt;
      this.spikeBeepTimer -= dt;

      const urgencyFraction = 1 - this.spikeTimer / SPIKE_DETONATION_TIME;
      const beepInterval = Math.max(0.12, 1.0 - urgencyFraction * 0.88);

      if (this.spikeBeepTimer <= 0) {
        this.spikeBeepTimer = beepInterval;
        soundEngine.playSpikeBeep(urgencyFraction);
      }

      if (this.spikeTimer <= 0) {
        this.spikeState = 'detonated';
        soundEngine.playSpikeExplosion();
        this.cameraShakeTrauma = 1.0;
        this.endRound('ATTACKERS', 'SPIKE_DETONATED');
      }
    } else if (this.roundPhase === 'ROUND_END') {
      if (this.roundTimer <= 0) {
        this.startNextRound();
      }
    }

    if ((this.roundPhase === 'ROUND_LIVE' || this.roundPhase === 'SPIKE_PLANTED') && this.matchMode !== 'PRACTICE') {
      const aliveAtt = this.combatants.filter((c) => c.alive && c.team === 'ATTACKERS').length;
      const aliveDef = this.combatants.filter((c) => c.alive && c.team === 'DEFENDERS').length;

      const check = checkRoundWin(aliveAtt, aliveDef, this.spikeState, this.roundTimer);
      if (check.roundOver && check.winner) {
        this.endRound(check.winner, check.reason!);
      }
    } else if (this.matchMode === 'PRACTICE' && this.roundPhase === 'ROUND_LIVE') {
      // Auto-respawn fallen enemies in Practice Range after their collapse finishes
      for (const c of this.combatants) {
        if (!c.alive && !c.isHuman && c.deathTimer <= 0) {
          c.alive = true;
          c.hp = 100;
          c.armor = 0;
          c.modelPackage.resetPose();
          c.modelPackage.root.visible = true;
          const spawnBase = c.team === 'ATTACKERS' ? SPAWN_ATTACKERS : SPAWN_DEFENDERS;
          c.position.set(spawnBase.x + (Math.random() - 0.5) * 14, 0, spawnBase.z * 0.55);
          c.modelPackage.root.position.copy(c.position);
          c.modelPackage.root.updateMatrixWorld(true);
        }
      }
    }

    const sec = Math.max(0, Math.ceil(this.roundTimer));
    if (this.roundPhase !== this.lastNotifiedRoundPhase || sec !== this.lastNotifiedRoundSecond) {
      this.lastNotifiedRoundPhase = this.roundPhase;
      this.lastNotifiedRoundSecond = sec;
      this.callbacks.onRoundPhaseChange(this.roundPhase, Math.max(0, this.roundTimer));
    }
  }

  private updatePlayer(dt: number): void {
    const p = this.playerCombatant;
    if (!p.alive) return;

    // 1. Tick ability cooldowns & buffs
    this.tickPlayerAbilityCooldowns(dt);
    if (this.playerOverdriveTimer > 0) {
      this.playerOverdriveTimer = Math.max(0, this.playerOverdriveTimer - dt);
    }

    // 2. Apply look rotation (mouse or touch) & viewmodel sway feedback
    const dx = this.input.state.lookDeltaX;
    const dy = this.input.state.lookDeltaY;
    p.yaw -= dx;
    p.pitch -= dy;
    p.pitch = Math.max(-1.45, Math.min(1.45, p.pitch));
    this.vmSwayX = THREE.MathUtils.clamp(this.vmSwayX + dx * 0.38, -0.045, 0.045);
    this.vmSwayY = THREE.MathUtils.clamp(this.vmSwayY + dy * 0.38, -0.045, 0.045);

    // 3. Weapon Slot Switching (1 = Primary, 2 = Sidearm)
    if (this.input.state.weaponSlotJustPressed) {
      const slot = this.input.state.weaponSlotJustPressed;
      if (slot === 1 || slot === 2) {
        this.switchWeaponSlot(slot);
      } else if (slot === 3 || slot === 4) {
        this.switchWeaponSlot(p.activeSlot === 1 ? 2 : 1);
      }
    }

    // 4. Movement & Status Modifiers
    const fwd = this.input.state.moveForward;
    const right = this.input.state.moveRight;
    const isMoving = Math.abs(fwd) > 0.05 || Math.abs(right) > 0.05;

    let baseSpeed = 5.6;
    if (this.input.state.crouchHeld) baseSpeed *= 0.52;
    if (this.input.state.adsHeld && p.weapon.canADS) baseSpeed *= 0.65;
    if (this.playerOverdriveTimer > 0) baseSpeed *= 1.35;
    if (this.abilityMgr.slowedCombatantIds.has(p.id)) baseSpeed *= 0.55;

    const sin = Math.sin(p.yaw);
    const cos = Math.cos(p.yaw);

    _vec3_1.set(-sin * fwd + cos * right, 0, -cos * fwd - sin * right);
    if (isMoving) {
      _vec3_1.normalize();
      this.vmWalkPhase += dt * (this.input.state.crouchHeld ? 6.5 : 10.5);
    }

    p.velocity.x = _vec3_1.x * baseSpeed;
    p.velocity.z = _vec3_1.z * baseSpeed;

    const nextX = p.position.x + p.velocity.x * dt;
    const nextZ = p.position.z + p.velocity.z * dt;

    let blockedByBarrier = false;
    if (this.roundPhase === 'BUY_PHASE') {
      if (p.team === 'ATTACKERS' && nextZ < 18.2) blockedByBarrier = true;
      if (p.team === 'DEFENDERS' && nextZ > -25.8) blockedByBarrier = true;
    }

    // Check Bastion tactical energy barriers
    if (!blockedByBarrier) {
      for (const b of this.abilityMgr.barriers) {
        if (Math.abs(nextX - b.position.x) < b.width * 0.52 && Math.abs(nextZ - b.position.z) < 0.75) {
          blockedByBarrier = true;
          break;
        }
      }
    }

    if (!blockedByBarrier) {
      const col = checkCollision(nextX, nextZ, 0.45);
      if (!col.collided) {
        p.position.x = nextX;
        p.position.z = nextZ;
      } else {
        // Slide along wall normal cleanly
        const tryX = checkCollision(nextX, p.position.z, 0.45);
        if (!tryX.collided) p.position.x = nextX;
        const tryZ = checkCollision(p.position.x, nextZ, 0.45);
        if (!tryZ.collided) p.position.z = nextZ;
      }
    }

    // 5. Jump & Gravity Physics + Landing Dip
    if (this.input.state.jumpJustPressed && this.isGrounded) {
      this.playerVelY = 6.2;
      this.isGrounded = false;
    }
    if (!this.isGrounded || p.position.y > 0) {
      this.playerVelY -= 19.5 * dt;
      p.position.y += this.playerVelY * dt;
      if (p.position.y <= 0) {
        p.position.y = 0;
        this.playerVelY = 0;
        this.isGrounded = true;
      }
    }
    if (!this.wasGrounded && this.isGrounded) {
      this.vmLandOffset = -0.055;
      soundEngine.playFootstep();
    }
    this.wasGrounded = this.isGrounded;

    if (isMoving && this.isGrounded && Math.random() < dt * 2.8) {
      soundEngine.playFootstep();
    }

    const targetEye = this.input.state.crouchHeld ? 1.08 : 1.65;
    this.playerEyeHeight = THREE.MathUtils.damp(this.playerEyeHeight, targetEye, 16, dt);

    // CRITICAL: Keep player's 3rd-person hitbox rig & crouch state synchronized so enemies aim realistically
    p.isCrouching = this.input.state.crouchHeld;
    p.modelPackage.root.position.copy(p.position);
    p.modelPackage.root.rotation.y = p.yaw;
    p.modelPackage.updateAnimation(
      dt,
      isMoving,
      baseSpeed,
      this.input.state.crouchHeld,
      !p.alive,
      p.pitch,
      p.reloadTimer > 0
    );
    p.modelPackage.root.updateMatrixWorld(true);

    this.camera.position.set(p.position.x, p.position.y + this.playerEyeHeight, p.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = p.yaw;
    this.camera.rotation.x = p.pitch;
    this.camera.updateMatrixWorld(true);

    // 6. Reload Handling
    const hasStim = this.abilityMgr.hasActiveStimNear(p.position, p.team);
    const reloadSpeedMult = hasStim || this.playerOverdriveTimer > 0 ? 1.35 : 1.0;

    if (this.input.state.reloadJustPressed && p.ammoInMag < p.weapon.magazineSize && p.reserveAmmo > 0 && p.reloadTimer <= 0) {
      p.reloadTimer = p.weapon.reloadTime / reloadSpeedMult;
      soundEngine.playReload();
      this.callbacks.onWeaponUpdate(p.weapon, p.ammoInMag, p.reserveAmmo, true, p.activeSlot);
    }

    if (p.reloadTimer > 0) {
      p.reloadTimer -= dt;
      if (p.reloadTimer <= 0) {
        p.reloadTimer = 0;
        const needed = p.weapon.magazineSize - p.ammoInMag;
        const take = Math.min(needed, p.reserveAmmo);
        p.ammoInMag += take;
        p.reserveAmmo -= take;
        this.callbacks.onWeaponUpdate(p.weapon, p.ammoInMag, p.reserveAmmo, false, p.activeSlot);
      }
    }

    if (p.shootCooldown > 0) p.shootCooldown -= dt;

    // 7. Mobile Aim Assist & Auto-Fire Assistance
    let autoFireTrigger = false;
    if (this.input.isMobile && (this.settings.aimAssistMobile || this.settings.autoFireMobile) && this.roundPhase !== 'BUY_PHASE') {
      autoFireTrigger = this.evaluateMobileAimAndAutoFire(dt);
    }

    // 8. Firing Logic
    const wantsToFire = this.input.state.fireHeld || this.input.state.fireJustPressed || autoFireTrigger;
    if (wantsToFire && p.shootCooldown <= 0 && p.reloadTimer <= 0) {
      if (this.roundPhase === 'BUY_PHASE') {
        if (this.input.state.fireJustPressed) {
          p.shootCooldown = 0.25;
          soundEngine.playHitmarker(false);
        }
      } else if (p.ammoInMag > 0) {
        const fireRateMult = (hasStim ? 1.25 : 1.0) * (this.playerOverdriveTimer > 0 ? 1.3 : 1.0);
        p.ammoInMag--;
        p.shootCooldown = 1 / (p.weapon.fireRate * fireRateMult);
        this.callbacks.onWeaponUpdate(p.weapon, p.ammoInMag, p.reserveAmmo, false, p.activeSlot);

        const spread = calculateSpread(p.weapon, isMoving, !this.isGrounded, this.input.state.crouchHeld, this.input.state.adsHeld);

        this.camera.getWorldDirection(_vec3_2);
        _vec3_2.x += (Math.random() - 0.5) * spread;
        _vec3_2.y += (Math.random() - 0.5) * spread * 0.8;
        _vec3_2.z += (Math.random() - 0.5) * spread;
        _vec3_2.normalize();

        // Trigger viewmodel kick & muzzle flash
        this.vmFlashTimer = 0.045;
        this.vmRecoilZ = 0.085;
        this.vmRecoilPitch = 0.14;
        this.viewmodelFlash.visible = true;
        this.viewmodelFlash.rotation.z = Math.random() * Math.PI;

        this.fireBullet(p, _vec3_2);

        p.pitch = Math.min(1.45, p.pitch + p.weapon.recoilPerShot * 0.42);
        this.cameraShakeTrauma = Math.min(1.0, this.cameraShakeTrauma + 0.14);
      } else if ((this.input.state.fireJustPressed || autoFireTrigger) && p.reserveAmmo > 0) {
        p.reloadTimer = p.weapon.reloadTime / reloadSpeedMult;
        soundEngine.playReload();
        this.callbacks.onWeaponUpdate(p.weapon, p.ammoInMag, p.reserveAmmo, true, p.activeSlot);
      }
    }

    this.updatePlayerSpikeActions(dt);
    this.updatePlayerAbilities();
  }

  private updateSpectator(dt: number): void {
    const p = this.playerCombatant;
    this.viewmodelRig.visible = false;

    // Practice Mode auto-respawn countdown
    if (this.matchMode === 'PRACTICE') {
      this.practiceRespawnTimer = Math.max(0, this.practiceRespawnTimer - dt);
      if (this.practiceRespawnTimer <= 0) {
        this.respawnPlayerForPractice();
        return;
      }
    }

    // Input controls while spectating
    if (this.input.state.spectateNextJustPressed || this.input.state.fireJustPressed) {
      this.cycleSpectateTarget(1);
    } else if (this.input.state.spectatePrevJustPressed) {
      this.cycleSpectateTarget(-1);
    }

    if (this.input.state.spectateModeJustPressed || this.input.state.jumpJustPressed) {
      this.toggleSpectateMode();
    }

    // Free orbit adjustment in 3rd-person spectate
    if (this.spectateMode === 'THIRD_PERSON') {
      this.spectateOrbitYawOffset -= this.input.state.lookDeltaX;
      this.spectateOrbitPitch = THREE.MathUtils.clamp(
        this.spectateOrbitPitch - this.input.state.lookDeltaY,
        -0.25,
        1.1
      );
    }

    // Ensure current target is valid and alive; otherwise pick next alive teammate
    let target = this.spectateTargetId
      ? this.combatants.find((c) => c.id === this.spectateTargetId && c.alive && c.team === p.team)
      : undefined;

    if (!target) {
      this.spectateTargetId = selectNextSpectateTargetId(this.combatants, p.team, null, 1);
      target = this.spectateTargetId
        ? this.combatants.find((c) => c.id === this.spectateTargetId)
        : undefined;
    }

    if (target) {
      if (this.spectateMode === 'FIRST_PERSON') {
        // Place camera slightly ahead of target eye to avoid clipping inside own head mesh
        const sin = Math.sin(target.yaw);
        const cos = Math.cos(target.yaw);
        _vec3_1.set(
          target.position.x - sin * 0.28,
          target.position.y + 1.56,
          target.position.z - cos * 0.28
        );
        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _vec3_1.x, 20, dt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _vec3_1.y, 20, dt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _vec3_1.z, 20, dt);
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = target.yaw;
        this.camera.rotation.x = target.pitch;
      } else {
        // Third-person over-the-shoulder follow with wall pull-in raycast
        const camYaw = target.yaw + this.spectateOrbitYawOffset;
        const sin = Math.sin(camYaw);
        const cos = Math.cos(camYaw);
        const horizDist = Math.cos(this.spectateOrbitPitch) * 3.6;
        const vertHeight = Math.sin(this.spectateOrbitPitch) * 3.6;

        // Anchor at teammate upper torso
        _vec3_1.set(target.position.x, target.position.y + 1.5, target.position.z);
        // Desired offset behind + slightly right shoulder
        _vec3_2.set(
          _vec3_1.x + sin * horizDist + cos * 0.45,
          Math.max(0.6, _vec3_1.y + vertHeight),
          _vec3_1.z + cos * horizDist - sin * 0.45
        );

        _vec3_3.copy(_vec3_2).sub(_vec3_1);
        const desiredDist = _vec3_3.length();
        if (desiredDist > 0.01) {
          _vec3_3.divideScalar(desiredDist);
          _raycaster.set(_vec3_1, _vec3_3);
          _raycaster.far = desiredDist;
          const wallHits = _raycaster.intersectObjects(this.mapData.collidableMeshes, false);
          if (wallHits.length > 0 && wallHits[0].distance < desiredDist) {
            const safeDist = Math.max(0.55, wallHits[0].distance - 0.3);
            _vec3_2.copy(_vec3_1).addScaledVector(_vec3_3, safeDist);
          }
        }

        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _vec3_2.x, 14, dt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _vec3_2.y, 14, dt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _vec3_2.z, 14, dt);

        // Look ahead of the spectated teammate
        _vec3_4.set(
          target.position.x - sin * 6,
          target.position.y + 1.35,
          target.position.z - cos * 6
        );
        this.camera.lookAt(_vec3_4);
      }
    } else {
      // No alive teammates left (round wrap-up) -> elevated overview around death spot
      _vec3_1.set(this.deathCamAnchor.x, this.deathCamAnchor.y + 1.2, this.deathCamAnchor.z);
      _vec3_2.set(this.deathCamAnchor.x + 3.2, this.deathCamAnchor.y + 4.8, this.deathCamAnchor.z + 3.8);
      _vec3_3.copy(_vec3_2).sub(_vec3_1);
      const dist = _vec3_3.length();
      if (dist > 0.01) {
        _vec3_3.divideScalar(dist);
        _raycaster.set(_vec3_1, _vec3_3);
        _raycaster.far = dist;
        const wallHits = _raycaster.intersectObjects(this.mapData.collidableMeshes, false);
        if (wallHits.length > 0 && wallHits[0].distance < dist) {
          _vec3_2.copy(_vec3_1).addScaledVector(_vec3_3, Math.max(0.8, wallHits[0].distance - 0.35));
        }
      }
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _vec3_2.x, 6, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _vec3_2.y, 6, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _vec3_2.z, 6, dt);
      this.camera.lookAt(_vec3_1);
    }

    this.emitSpectateState(false);
  }

  private respawnPlayerForPractice(): void {
    const p = this.playerCombatant;
    const spawnBase = p.team === 'ATTACKERS' ? SPAWN_ATTACKERS : SPAWN_DEFENDERS;
    p.alive = true;
    p.hp = 100;
    p.armor = 0;
    p.deathTimer = 0;
    p.position.set(spawnBase.x, 0, spawnBase.z);
    p.yaw = p.team === 'ATTACKERS' ? 0 : Math.PI;
    p.pitch = 0;
    p.ammoInMag = p.weapon.magazineSize;
    p.reserveAmmo = p.weapon.reserveAmmo;
    p.reloadTimer = 0;
    p.modelPackage.resetPose();
    p.modelPackage.root.position.copy(p.position);
    p.modelPackage.root.rotation.y = p.yaw;
    p.modelPackage.root.updateMatrixWorld(true);

    this.viewmodelRig.visible = true;
    this.spectateTargetId = null;
    this.practiceRespawnTimer = 0;
    this.lastSpectateKey = '';

    const stats = this.playerStats.find((s) => s.id === p.id);
    if (stats) {
      stats.alive = true;
      stats.hp = 100;
      stats.armor = 0;
    }

    this.camera.position.set(p.position.x, 1.65, p.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = p.yaw;
    this.camera.rotation.x = 0;

    this.callbacks.onSpectateUpdate?.(null);
    this.callbacks.onPlayerHealthUpdate(100, 0, 100, 50);
    this.callbacks.onWeaponUpdate(p.weapon, p.ammoInMag, p.reserveAmmo, false, p.activeSlot);
    this.callbacks.onStatsUpdate([...this.playerStats]);
  }

  private emitSpectateState(force: boolean): void {
    if (this.playerCombatant.alive) {
      if (this.lastSpectateKey !== '') {
        this.lastSpectateKey = '';
        this.callbacks.onSpectateUpdate?.(null);
      }
      return;
    }

    const aliveTeammatesCount = this.combatants.filter(
      (c) => c.alive && c.team === this.playerTeam && !c.isHuman
    ).length;
    const target = this.spectateTargetId
      ? this.combatants.find((c) => c.id === this.spectateTargetId && c.alive)
      : undefined;
    const tStats = target ? this.playerStats.find((s) => s.id === target.id) : undefined;
    const respawnSec = this.matchMode === 'PRACTICE' ? Math.ceil(this.practiceRespawnTimer) : 0;

    const key = `${target?.id ?? 'none'}_${target?.hp ?? 0}_${target?.armor ?? 0}_${target?.ammoInMag ?? 0}_${this.spectateMode}_${aliveTeammatesCount}_${respawnSec}`;
    if (!force && key === this.lastSpectateKey) return;
    this.lastSpectateKey = key;

    this.callbacks.onSpectateUpdate?.({
      active: true,
      targetId: target?.id ?? null,
      targetName: target ? target.name : 'Squad Eliminated',
      agentId: target?.agentId ?? this.playerCombatant.agentId,
      team: this.playerTeam,
      hp: target?.hp ?? 0,
      armor: target?.armor ?? 0,
      weaponName: target?.weapon.name ?? '—',
      ammoInMag: target?.ammoInMag ?? 0,
      reserveAmmo: target?.reserveAmmo ?? 0,
      kills: tStats?.kills ?? 0,
      deaths: tStats?.deaths ?? 0,
      aliveTeammatesCount,
      mode: this.spectateMode,
      practiceRespawnIn: respawnSec,
    });
  }

  private evaluateMobileAimAndAutoFire(dt: number): boolean {
    const p = this.playerCombatant;
    this.camera.getWorldDirection(_vec3_2);

    if (this.aimAssistSwipeCooldown > 0) {
      this.aimAssistSwipeCooldown = Math.max(0, this.aimAssistSwipeCooldown - dt);
    }
    if (Math.abs(this.input.state.lookDeltaX) > 0.025) {
      this.aimAssistSwipeCooldown = 0.18;
    }

    // Gentle, wall-occluded, non-resistive Aim Assist
    if (this.settings.aimAssistMobile) {
      let bestTarget: BotCombatant | null = null;
      let bestDot = 0.985; // ~9.9 deg half-cone

      for (const c of this.combatants) {
        if (!c.alive || c.team === p.team) continue;
        _vec3_3.set(c.position.x, c.position.y + 1.32, c.position.z).sub(this.camera.position);
        const dist = _vec3_3.length();
        if (dist > 45 || dist < 1.2) continue;
        _vec3_3.divideScalar(dist);
        const dot = _vec3_2.dot(_vec3_3);
        if (dot > bestDot) {
          // Verify target is not behind a wall
          _raycaster.set(this.camera.position, _vec3_3);
          _raycaster.far = dist;
          const wallHits = _raycaster.intersectObjects(this.mapData.collidableMeshes, false);
          if (wallHits.length > 0 && wallHits[0].distance < dist - 0.35) {
            continue;
          }
          bestDot = dot;
          bestTarget = c;
        }
      }

      if (bestTarget) {
        _vec3_3.set(bestTarget.position.x, bestTarget.position.y + 1.32, bestTarget.position.z).sub(this.camera.position).normalize();
        const desiredYaw = Math.atan2(-_vec3_3.x, -_vec3_3.z);
        const desiredPitch = Math.asin(Math.max(-0.98, Math.min(0.98, _vec3_3.y)));
        let yawDiff = ((desiredYaw - p.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        const pitchDiff = desiredPitch - p.pitch;

        const { yawStep, pitchStep } = computeGentleAimAssist({
          yawDiff,
          pitchDiff,
          userDeltaX: this.input.state.lookDeltaX,
          userDeltaY: this.input.state.lookDeltaY,
          swipeCooldownRemaining: this.aimAssistSwipeCooldown,
          dt,
        });
        p.yaw += yawStep;
        p.pitch = THREE.MathUtils.clamp(p.pitch + pitchStep, -1.45, 1.45);
      }
    }

    // Auto-Fire: raycast directly along crosshair
    if (this.settings.autoFireMobile) {
      this.camera.getWorldDirection(_vec3_2);
      _raycaster.set(this.camera.position, _vec3_2);
      _raycaster.far = 55;

      let enemyDist = Infinity;
      for (const c of this.combatants) {
        if (!c.alive || c.team === p.team) continue;
        c.modelPackage.root.updateMatrixWorld(true);
        const hits = _raycaster.intersectObjects(c.modelPackage.hitboxMeshes, false);
        if (hits.length > 0 && hits[0].distance < enemyDist) {
          enemyDist = hits[0].distance;
        }
      }

      if (enemyDist < Infinity) {
        const wallHits = _raycaster.intersectObjects(this.mapData.collidableMeshes, false);
        const wallDist = wallHits.length > 0 ? wallHits[0].distance : Infinity;
        if (enemyDist < wallDist) {
          return true;
        }
      }
    }

    return false;
  }

  private tickPlayerAbilityCooldowns(dt: number): void {
    let changed = false;
    for (const key of ['Q', 'E', 'C', 'X'] as const) {
      const st = this.abilitySlots[key];
      if (!st) continue;
      if (st.cooldownRemaining > 0) {
        st.cooldownRemaining = Math.max(0, st.cooldownRemaining - dt);
        changed = true;
      }
      if (key === 'X' && st.activeRemaining > 0) {
        st.activeRemaining = Math.max(0, st.activeRemaining - dt);
        changed = true;
      }
    }

    this.abilitySyncTimer += dt;
    if (changed && this.abilitySyncTimer >= 0.1) {
      this.abilitySyncTimer = 0;
      this.emitAbilityStates();
    }
  }

  private tryConsumeAbility(slotKey: 'Q' | 'E' | 'C' | 'X'): boolean {
    if (this.roundPhase === 'BUY_PHASE' && this.matchMode !== 'PRACTICE') {
      // Allow utility/heal/info checks or block offensive casts cleanly
      return false;
    }

    const st = this.abilitySlots[slotKey];
    if (!st) return false;

    if (st.isUltimate) {
      if (st.ultPoints < st.ultRequired) return false;
      st.ultPoints = 0;
      st.charges = 0;
      this.emitAbilityStates();
      return true;
    }

    if (st.charges <= 0 || st.cooldownRemaining > 0) return false;
    st.charges--;
    st.cooldownRemaining = st.cooldownTotal;
    this.emitAbilityStates();
    return true;
  }

  private updatePlayerSpikeActions(dt: number): void {
    const p = this.playerCombatant;

    const distA = p.position.distanceTo(_vec3_1.set(BOMB_SITE_A.x, 0, BOMB_SITE_A.z));
    const distB = p.position.distanceTo(_vec3_2.set(BOMB_SITE_B.x, 0, BOMB_SITE_B.z));
    const inSiteA = distA < BOMB_SITE_A.radius;
    const inSiteB = distB < BOMB_SITE_B.radius;

    if (p.team === 'ATTACKERS' && p.hasSpike && this.spikeState === 'not_planted' && (inSiteA || inSiteB)) {
      if (this.input.state.plantDefuseHeld) {
        p.isPlanting = true;
        p.actionProgress += dt / SPIKE_PLANT_DURATION;

        if (p.actionProgress >= 1.0) {
          this.spikeState = 'planted';
          this.plantedSite = inSiteA ? 'A' : 'B';
          this.spikePosition = p.position.clone();
          p.hasSpike = false;
          p.isPlanting = false;
          p.actionProgress = 0;

          if (!this.spikeMesh) {
            this.spikeMesh = createSpikeModel();
            this.scene.add(this.spikeMesh);
          }
          this.spikeMesh.position.copy(this.spikePosition);
          soundEngine.playSpikePlant();

          // Plant grants +1 Ult point
          const ultSlot = this.abilitySlots.X;
          if (ultSlot) {
            ultSlot.ultPoints = Math.min(ultSlot.ultRequired, ultSlot.ultPoints + 1);
            this.emitAbilityStates();
          }

          for (const ctrl of this.botControllers) {
            ctrl.planRound(true, this.plantedSite);
          }
        }
      } else {
        p.isPlanting = false;
        p.actionProgress = 0;
      }
    }

    if (p.team === 'DEFENDERS' && this.spikeState === 'planted' && this.spikePosition) {
      const distToSpike = p.position.distanceTo(this.spikePosition);
      if (distToSpike < 2.8 && this.input.state.plantDefuseHeld) {
        p.isDefusing = true;
        p.actionProgress += dt / SPIKE_DEFUSE_DURATION;

        if (p.actionProgress >= 1.0) {
          this.spikeState = 'defused';
          p.isDefusing = false;
          p.actionProgress = 0;
          soundEngine.playSpikeDefused();
          this.endRound('DEFENDERS', 'SPIKE_DEFUSED');
        }
      } else {
        p.isDefusing = false;
        p.actionProgress = 0;
      }
    }

    const plantPct = p.isPlanting ? Math.round(p.actionProgress * 100) : 0;
    const defusePct = p.isDefusing ? Math.round(p.actionProgress * 100) : 0;
    const spikeSec = Math.round(this.spikeTimer * 10);
    const spikeKey = `${this.spikeState}_${spikeSec}_${plantPct}_${defusePct}`;
    if (spikeKey !== this.lastNotifiedSpikeKey) {
      this.lastNotifiedSpikeKey = spikeKey;
      this.callbacks.onSpikeStateUpdate(
        this.spikeState,
        this.spikeTimer,
        p.isPlanting ? p.actionProgress : 0,
        p.isDefusing ? p.actionProgress : 0
      );
    }
  }

  private findTargetPointAhead(maxRange: number): THREE.Vector3 {
    this.camera.getWorldDirection(_vec3_4);
    _raycaster.set(this.camera.position, _vec3_4);
    _raycaster.far = maxRange;
    const hits = _raycaster.intersectObjects(this.mapData.collidableMeshes, false);
    if (hits.length > 0 && hits[0].distance < maxRange) {
      return _vec3_5.copy(hits[0].point);
    }
    return _vec3_5.copy(this.playerCombatant.position).addScaledVector(_vec3_4, maxRange);
  }

  private updatePlayerAbilities(): void {
    const p = this.playerCombatant;
    this.camera.getWorldDirection(_vec3_1);

    // [E] Primary Signature Ability
    if (this.input.state.abilityEJustPressed && this.tryConsumeAbility('E')) {
      if (p.agentId === 'ZEPHYR') {
        const pt = this.findTargetPointAhead(14);
        this.abilityMgr.deploySmoke(pt.x, 0, pt.z, 14);
      } else if (p.agentId === 'BLITZ') {
        this.abilityMgr.throwFlashOrb(this.camera.position.x, this.camera.position.y - 0.1, this.camera.position.z, _vec3_1, p.team);
        this.cameraShakeTrauma = Math.min(1.0, this.cameraShakeTrauma + 0.25);
      } else if (p.agentId === 'BASTION') {
        const pt = this.findTargetPointAhead(5);
        this.abilityMgr.deployBarrier(pt.x, 0, pt.z, p.yaw, 20);
      } else if (p.agentId === 'LUMEN') {
        for (const ally of this.combatants) {
          if (!ally.alive || ally.team !== p.team) continue;
          const healAmt = ally.isHuman ? 60 : 40;
          if (ally.isHuman || ally.position.distanceTo(p.position) < 15) {
            ally.hp = Math.min(100, ally.hp + healAmt);
            const st = this.playerStats.find((s) => s.id === ally.id);
            if (st) st.hp = ally.hp;
          }
        }
        soundEngine.playAbility('HEAL');
        this.callbacks.onPlayerHealthUpdate(p.hp, p.armor, 100, 50);
        this.callbacks.onStatsUpdate([...this.playerStats]);
      }
    }

    // [Q] Secondary Tactical Ability
    if (this.input.state.abilityQJustPressed && this.tryConsumeAbility('Q')) {
      if (p.agentId === 'ZEPHYR') {
        const pt = this.findTargetPointAhead(12);
        this.abilityMgr.deployZone('TOXIN', pt.x, pt.z, 4.2, 8.0, p.team);
      } else if (p.agentId === 'BLITZ') {
        // Collision-safe stepped kinetic dash (prevents phasing through walls)
        _vec3_2.set(_vec3_1.x, 0, _vec3_1.z).normalize();
        for (let step = 0; step < 12; step++) {
          const nx = p.position.x + _vec3_2.x * 0.65;
          const nz = p.position.z + _vec3_2.z * 0.65;
          if (checkCollision(nx, nz, 0.5).collided) break;
          p.position.x = nx;
          p.position.z = nz;
        }
        soundEngine.playAbility('DASH');
        this.cameraShakeTrauma = Math.min(1.0, this.cameraShakeTrauma + 0.22);
      } else if (p.agentId === 'BASTION') {
        const pt = this.findTargetPointAhead(7);
        this.abilityMgr.deployZone('LOCKDOWN', pt.x, pt.z, 3.8, 14.0, p.team);
        this.abilityMgr.triggerReconPulse(pt.x, 0, pt.z, p.team, this.combatants);
      } else if (p.agentId === 'LUMEN') {
        this.abilityMgr.triggerReconPulse(p.position.x, 0, p.position.z, p.team, this.combatants);
      }
    }

    // [C] Utility / Deployable Ability
    if (this.input.state.abilityCJustPressed && this.tryConsumeAbility('C')) {
      if (p.agentId === 'ZEPHYR') {
        this.abilityMgr.deployZone('STIM', p.position.x, p.position.z, 5.5, 10.0, p.team);
      } else if (p.agentId === 'BLITZ') {
        const pt = this.findTargetPointAhead(10);
        this.abilityMgr.deployZone('GRAVITY', pt.x, pt.z, 4.8, 4.5, p.team);
        for (const c of this.combatants) {
          if (c.alive && c.team !== p.team && c.position.distanceTo(pt) < 5.2) {
            this.applyExternalDamage(c, 35, 'Concussion Mine');
            this.abilityMgr.slowedCombatantIds.set(c.id, 3.0);
          }
        }
        soundEngine.playAbility('FLASH');
      } else if (p.agentId === 'BASTION') {
        const pt = this.findTargetPointAhead(4);
        this.abilityMgr.deployTurret(pt.x, pt.z, p.yaw, p.team);
      } else if (p.agentId === 'LUMEN') {
        const pt = this.findTargetPointAhead(12);
        this.abilityMgr.deployZone('GRAVITY', pt.x, pt.z, 4.5, 6.0, p.team);
      }
    }

    // [X] Ultimate Ability
    if (this.input.state.abilityXJustPressed && this.tryConsumeAbility('X')) {
      if (p.agentId === 'ZEPHYR') {
        const pt = this.findTargetPointAhead(18);
        this.abilityMgr.deployZone('BLACKOUT', pt.x, pt.z, 8.5, 9.0, p.team);
        this.cameraShakeTrauma = 0.7;
      } else if (p.agentId === 'BLITZ') {
        this.playerOverdriveTimer = 12.0;
        this.abilitySlots.X.activeRemaining = 12.0;
        soundEngine.playAbility('ULT');
        this.cameraShakeTrauma = 0.65;
        this.emitAbilityStates();
      } else if (p.agentId === 'BASTION') {
        this.abilityMgr.deployZone('LOCKDOWN', p.position.x, p.position.z, 11.0, 10.0, p.team);
        this.cameraShakeTrauma = 0.7;
      } else if (p.agentId === 'LUMEN') {
        // Resurgence: Revive fallen teammate, or supercharge self shield + health if all alive
        const fallenAlly = this.combatants.find((c) => !c.alive && !c.isHuman && c.team === p.team);
        if (fallenAlly) {
          fallenAlly.alive = true;
          fallenAlly.hp = 100;
          fallenAlly.armor = 25;
          fallenAlly.deathTimer = 0;
          fallenAlly.modelPackage.resetPose();
          fallenAlly.modelPackage.root.visible = true;
          fallenAlly.position.set(p.position.x + 1.5, 0, p.position.z + 1.5);
          fallenAlly.modelPackage.root.position.copy(fallenAlly.position);
          fallenAlly.modelPackage.root.updateMatrixWorld(true);

          const st = this.playerStats.find((s) => s.id === fallenAlly.id);
          if (st) {
            st.alive = true;
            st.hp = 100;
            st.armor = 25;
          }
          this.callbacks.onStatsUpdate([...this.playerStats]);
        } else {
          p.hp = 100;
          p.armor = Math.min(50, p.armor + 50);
          this.callbacks.onPlayerHealthUpdate(p.hp, p.armor, 100, 50);
        }
        soundEngine.playAbility('ULT');
        this.cameraShakeTrauma = 0.65;
      }
    }
  }

  private fireTurretShot(origin: THREE.Vector3, dir: THREE.Vector3, team: string): void {
    soundEngine.playGunshot('SMG');
    _raycaster.set(origin, dir);
    _raycaster.far = 30;

    let closestTarget: BotCombatant | null = null;
    let closestDist = Infinity;
    let closestPoint: THREE.Vector3 | null = null;

    for (const c of this.combatants) {
      if (!c.alive || c.team === team) continue;
      c.modelPackage.root.updateMatrixWorld(true);
      const hits = _raycaster.intersectObjects(c.modelPackage.hitboxMeshes, false);
      if (hits.length > 0 && hits[0].distance < closestDist) {
        closestDist = hits[0].distance;
        closestTarget = c;
        closestPoint = hits[0].point;
      }
    }

    const worldHits = _raycaster.intersectObjects(this.mapData.collidableMeshes, false);
    const worldDist = worldHits.length > 0 ? worldHits[0].distance : Infinity;

    if (closestTarget && closestPoint && closestDist < worldDist) {
      this.spawnTracer(origin, closestPoint);
      this.applyExternalDamage(closestTarget, 16, 'Sentinel Turret');
    } else if (worldHits.length > 0) {
      this.spawnTracer(origin, worldHits[0].point);
      this.spawnSparks(worldHits[0].point);
    } else {
      _vec3_3.copy(origin).addScaledVector(dir, 28);
      this.spawnTracer(origin, _vec3_3);
    }
  }

  private applyExternalDamage(victim: BotCombatant, rawDamage: number, sourceLabel: string): void {
    if (!victim.alive) return;
    const armorAbsorb = Math.min(victim.armor, Math.round(rawDamage * 0.4));
    victim.armor = Math.max(0, victim.armor - armorAbsorb);
    victim.hp = Math.max(0, victim.hp - (rawDamage - armorAbsorb));
    victim.modelPackage.triggerHitFlash();

    const victimStats = this.playerStats.find((s) => s.id === victim.id);
    if (victimStats) {
      victimStats.hp = victim.hp;
      victimStats.armor = victim.armor;
    }

    if (victim.team !== this.playerTeam) {
      soundEngine.playHitmarker(false);
      this.callbacks.onHitmarker(false);
      this.callbacks.onHitFeedback?.({
        active: true,
        isHeadshot: false,
        isKill: victim.hp <= 0,
        damage: rawDamage,
        targetName: victim.name,
        targetHp: victim.hp,
        targetMaxHp: 100,
      });
    }

    if (victim.isHuman) {
      soundEngine.playPlayerHurt();
      this.callbacks.onPlayerDamage?.(rawDamage);
      this.cameraShakeTrauma = Math.min(1.0, this.cameraShakeTrauma + 0.25);
      this.callbacks.onPlayerHealthUpdate(victim.hp, victim.armor, 100, 50);
    }

    if (victim.hp <= 0) {
      this.handleCombatantDeath(this.playerCombatant, victim, sourceLabel, false);
    }
  }

  private getWeaponEntry(weaponId: string) {
    if (!this.weaponBreakdown[weaponId]) {
      this.weaponBreakdown[weaponId] = {
        kills: 0,
        headshots: 0,
        shotsFired: 0,
        shotsHit: 0,
        damageDealt: 0,
      };
    }
    return this.weaponBreakdown[weaponId];
  }

  public fireBullet(shooter: BotCombatant, dir: THREE.Vector3): void {
    soundEngine.playGunshot(shooter.weapon.category);

    if (shooter.isHuman) {
      this.getWeaponEntry(shooter.weapon.id).shotsFired++;
    }

    const origin = shooter.isHuman
      ? _vec3_1.copy(this.camera.position)
      : _vec3_1.copy(shooter.position).add(_vec3_4.set(0, 1.38, 0));

    _raycaster.set(origin, dir);
    _raycaster.far = 110;

    let closestHit: { combatant: BotCombatant; hitZone: 'head' | 'body' | 'leg'; point: THREE.Vector3 } | null = null;
    let closestDist = Infinity;

    for (const target of this.combatants) {
      if (!target.alive || target.team === shooter.team) continue;

      // Sync world matrices immediately so animated/moving targets register 100% accurately
      target.modelPackage.root.updateMatrixWorld(true);
      const hits = _raycaster.intersectObjects(target.modelPackage.hitboxMeshes, false);

      if (hits.length > 0) {
        const hit = hits[0];
        if (hit.distance < closestDist) {
          closestDist = hit.distance;
          const hitZone = (hit.object.userData?.hitZone as 'head' | 'body' | 'leg') || 'body';
          closestHit = { combatant: target, hitZone, point: hit.point };
        }
      }
    }

    // Check Bastion tactical energy barriers too
    const barrierMeshes = this.abilityMgr.getBarrierMeshes();
    let barrierDist = Infinity;
    let barrierPoint: THREE.Vector3 | null = null;
    let hitBarrierIdx = -1;
    if (barrierMeshes.length > 0) {
      const bHits = _raycaster.intersectObjects(barrierMeshes, false);
      if (bHits.length > 0) {
        barrierDist = bHits[0].distance;
        barrierPoint = bHits[0].point;
        hitBarrierIdx = this.abilityMgr.barriers.findIndex((b) => b.mesh === bHits[0].object);
      }
    }

    const worldHits = _raycaster.intersectObjects(this.mapData.collidableMeshes, false);
    let worldDist = Infinity;
    let worldPoint: THREE.Vector3 | null = null;
    if (worldHits.length > 0) {
      worldDist = worldHits[0].distance;
      worldPoint = worldHits[0].point;
    }

    if (closestHit && closestDist < worldDist && closestDist < barrierDist) {
      _vec3_3.copy(closestHit.point);
      this.applyDamage(shooter, closestHit.combatant, closestHit.hitZone, closestDist);
      this.spawnSparks(closestHit.point);
    } else if (barrierPoint && barrierDist < worldDist) {
      _vec3_3.copy(barrierPoint);
      this.spawnSparks(barrierPoint);
      if (hitBarrierIdx >= 0) {
        this.abilityMgr.barriers[hitBarrierIdx].hp -= shooter.weapon.damageBody;
      }
    } else if (worldPoint) {
      _vec3_3.copy(worldPoint);
      this.spawnSparks(worldPoint);
    } else {
      _vec3_3.copy(origin).addScaledVector(dir, 80);
    }

    this.spawnTracer(origin, _vec3_3);
  }

  private applyDamage(
    shooter: BotCombatant,
    victim: BotCombatant,
    hitZone: 'head' | 'body' | 'leg',
    distance: number
  ): void {
    const dmg = calculateDamage(shooter.weapon, hitZone, distance, victim.hp, victim.armor);
    victim.hp = dmg.remainingHp;
    victim.armor = dmg.remainingArmor;
    victim.modelPackage.triggerHitFlash();

    const victimStats = this.playerStats.find((s) => s.id === victim.id);
    if (victimStats) {
      victimStats.hp = victim.hp;
      victimStats.armor = victim.armor;
    }

    const totalDmg = dmg.healthDamage + dmg.armorDamage;

    if (shooter.isHuman) {
      this.playerDamageDealt += totalDmg;
      const wEntry = this.getWeaponEntry(shooter.weapon.id);
      wEntry.shotsHit++;
      wEntry.damageDealt += totalDmg;
      if (dmg.isHeadshot) {
        this.playerHeadshots++;
        wEntry.headshots++;
      }
      if (dmg.isDead) {
        wEntry.kills++;
      }

      soundEngine.playHitmarker(dmg.isHeadshot);
      this.callbacks.onHitmarker(dmg.isHeadshot);
      this.callbacks.onHitFeedback?.({
        active: true,
        isHeadshot: dmg.isHeadshot,
        isKill: dmg.isDead,
        damage: totalDmg,
        targetName: victim.name,
        targetHp: dmg.remainingHp,
        targetMaxHp: 100,
      });
    }

    if (victim.isHuman) {
      soundEngine.playPlayerHurt();
      this.callbacks.onPlayerDamage?.(totalDmg);
      this.cameraShakeTrauma = Math.min(1.0, this.cameraShakeTrauma + 0.35);
      this.callbacks.onPlayerHealthUpdate(victim.hp, victim.armor, 100, 50);
    }

    if (!victim.isHuman && victim.alive && !dmg.isDead) {
      const botCtrl = this.botControllers.find((c) => c.combatant === victim);
      botCtrl?.notifyDamaged(shooter);
    }

    if (dmg.isDead) {
      this.handleCombatantDeath(shooter, victim, shooter.weapon.name, dmg.isHeadshot);
    }
  }

  private handleCombatantDeath(
    killer: BotCombatant,
    victim: BotCombatant,
    weaponName: string,
    isHeadshot: boolean
  ): void {
    if (!victim.alive) return;
    victim.alive = false;
    victim.deathTimer = 1.4; // Collapses smoothly onto ground over ~0.3s, stays 1.4s

    const shooterStats = this.playerStats.find((s) => s.id === killer.id);
    const victimStats = this.playerStats.find((s) => s.id === victim.id);
    if (shooterStats) {
      shooterStats.kills++;
      shooterStats.score += isHeadshot ? 300 : 200;
      shooterStats.credits = Math.min(9000, shooterStats.credits + 200);
    }
    if (victimStats) {
      victimStats.deaths++;
      victimStats.alive = false;
      victimStats.hp = 0;
    }

    if (killer.isHuman) {
      this.hitstopTimer = 0.035;
      // Grant +1 Ult charge on kill
      const ultSlot = this.abilitySlots.X;
      if (ultSlot && ultSlot.ultPoints < ultSlot.ultRequired) {
        ultSlot.ultPoints++;
        this.emitAbilityStates();
      }
      // Overdrive Matrix heal on kill
      if (this.playerOverdriveTimer > 0) {
        killer.hp = Math.min(100, killer.hp + 35);
        this.callbacks.onPlayerHealthUpdate(killer.hp, killer.armor, 100, 50);
      }
    }

    this.callbacks.onStatsUpdate([...this.playerStats]);

    const killEvent: KillEvent = {
      id: `kill_${Date.now()}_${Math.random()}`,
      killerName: killer.name,
      killerTeam: killer.team,
      victimName: victim.name,
      victimTeam: victim.team,
      weaponName,
      isHeadshot,
      timestamp: Date.now(),
    };
    this.callbacks.onKillEvent(killEvent);

    if (victim.hasSpike) {
      victim.hasSpike = false;
      this.spikePosition = victim.position.clone();
      if (!this.spikeMesh) {
        this.spikeMesh = createSpikeModel();
        this.scene.add(this.spikeMesh);
      }
      this.spikeMesh.position.copy(this.spikePosition);
    }

    if (victim.isHuman) {
      this.viewmodelRig.visible = false;
      this.deathCamAnchor.copy(victim.position);
      this.spectateOrbitYawOffset = 0;
      this.spectateOrbitPitch = 0.22;
      this.input.setMobileFire(false);
      this.input.setMobileADS(false);
      this.input.setMobileCrouch(false);
      this.input.setMobilePlantDefuse(false);

      if (Math.abs(this.camera.fov - this.settings.fov) > 0.1) {
        this.camera.fov = this.settings.fov;
        this.camera.updateProjectionMatrix();
      }

      if (this.matchMode === 'PRACTICE') {
        this.practiceRespawnTimer = 2.5;
      }

      this.spectateTargetId = selectNextSpectateTargetId(
        this.combatants,
        this.playerTeam,
        null,
        1
      );
      this.emitSpectateState(true);
    } else if (this.spectateTargetId === victim.id && !this.playerCombatant.alive) {
      this.cycleSpectateTarget(1);
    }
  }

  private spawnTracer(start: THREE.Vector3, end: THREE.Vector3): void {
    const tracer = this.tracerLines.find((t) => !t.inUse);
    if (!tracer) return;

    tracer.inUse = true;
    tracer.age = 0;
    tracer.line.visible = true;

    const positions = (tracer.line.geometry as THREE.BufferGeometry).attributes.position;
    positions.setXYZ(0, start.x, start.y - 0.08, start.z);
    positions.setXYZ(1, end.x, end.y, end.z);
    positions.needsUpdate = true;
  }

  private spawnSparks(point: THREE.Vector3): void {
    let count = 0;
    for (const s of this.sparks) {
      if (!s.inUse) {
        s.inUse = true;
        s.age = 0;
        s.mesh.visible = true;
        s.mesh.position.copy(point);
        s.vel.set(
          (Math.random() - 0.5) * 6,
          Math.random() * 5 + 2,
          (Math.random() - 0.5) * 6
        );
        count++;
        if (count >= 4) break;
      }
    }
  }

  private updateTracersAndSparks(dt: number): void {
    for (const t of this.tracerLines) {
      if (t.inUse) {
        t.age += dt;
        if (t.age >= t.maxAge) {
          t.inUse = false;
          t.line.visible = false;
        }
      }
    }

    for (const s of this.sparks) {
      if (s.inUse) {
        s.age += dt;
        s.vel.y -= 18 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);

        if (s.age >= s.maxAge) {
          s.inUse = false;
          s.mesh.visible = false;
        }
      }
    }
  }

  private updateCameraEffects(dt: number): void {
    // Muzzle flash fade
    if (this.vmFlashTimer > 0) {
      this.vmFlashTimer -= dt;
      if (this.vmFlashTimer <= 0) {
        this.viewmodelFlash.visible = false;
      }
    }

    // Smooth viewmodel spring decays (recoil, equip raise, look sway, landing dip)
    this.vmRecoilZ = THREE.MathUtils.damp(this.vmRecoilZ, 0, 18, dt);
    this.vmRecoilPitch = THREE.MathUtils.damp(this.vmRecoilPitch, 0, 16, dt);
    this.vmEquipOffset = THREE.MathUtils.damp(this.vmEquipOffset, 0, 14, dt);
    this.vmSwayX = THREE.MathUtils.damp(this.vmSwayX, 0, 12, dt);
    this.vmSwayY = THREE.MathUtils.damp(this.vmSwayY, 0, 12, dt);
    this.vmLandOffset = THREE.MathUtils.damp(this.vmLandOffset, 0, 14, dt);

    if (this.cameraShakeTrauma > 0) {
      const shake = this.cameraShakeTrauma * this.cameraShakeTrauma * 0.08;
      this.camera.rotation.z = (Math.random() - 0.5) * shake;
      this.camera.position.x += (Math.random() - 0.5) * shake * 0.5;
      this.camera.position.y += (Math.random() - 0.5) * shake * 0.5;
      this.cameraShakeTrauma = Math.max(0, this.cameraShakeTrauma - dt * 2.5);
    } else {
      this.camera.rotation.z = 0;
    }

    if (this.viewmodelWeapon) {
      const p = this.playerCombatant;
      const isADS = this.input.state.adsHeld && p.weapon.canADS;

      if (isADS) {
        _vmTargetPos.set(0, -0.145, -0.28);
      } else {
        _vmTargetPos.set(0.28, -0.24, -0.42);
      }

      // Multi-phase smooth reload dip + cant
      const isReloading = p.reloadTimer > 0;
      const reloadProgress = isReloading ? 1 - p.reloadTimer / Math.max(0.2, p.weapon.reloadTime) : 0;
      const reloadWave = isReloading ? Math.sin(reloadProgress * Math.PI) : 0;
      const reloadDip = -0.15 * reloadWave;
      const reloadTilt = 0.56 * reloadWave;

      // Movement bob & idle breathing
      const speed = Math.hypot(p.velocity.x, p.velocity.z);
      const moveWeight = Math.min(1, speed / 5.4);
      const adsDamp = isADS ? 0.35 : 1.0;
      const walkBobX = Math.cos(this.vmWalkPhase * 0.5) * 0.012 * moveWeight * adsDamp;
      const walkBobY = Math.abs(Math.sin(this.vmWalkPhase)) * 0.014 * moveWeight * adsDamp;
      const breath = Math.sin(performance.now() * 0.0025) * 0.004 * adsDamp;

      _vmTargetPos.x += walkBobX + this.vmSwayX * adsDamp;
      _vmTargetPos.y += breath - walkBobY + this.vmEquipOffset + reloadDip + this.vmLandOffset + this.vmSwayY * adsDamp;
      _vmTargetPos.z += this.vmRecoilZ;

      this.viewmodelWeapon.position.x = THREE.MathUtils.damp(this.viewmodelWeapon.position.x, _vmTargetPos.x, 18, dt);
      this.viewmodelWeapon.position.y = THREE.MathUtils.damp(this.viewmodelWeapon.position.y, _vmTargetPos.y, 18, dt);
      this.viewmodelWeapon.position.z = THREE.MathUtils.damp(this.viewmodelWeapon.position.z, _vmTargetPos.z, 18, dt);

      this.viewmodelWeapon.rotation.x = THREE.MathUtils.damp(
        this.viewmodelWeapon.rotation.x,
        this.vmRecoilPitch - reloadTilt - this.vmSwayY * 0.65,
        16,
        dt
      );
      this.viewmodelWeapon.rotation.y = THREE.MathUtils.damp(
        this.viewmodelWeapon.rotation.y,
        -this.vmSwayX * 0.85,
        14,
        dt
      );
      this.viewmodelWeapon.rotation.z = THREE.MathUtils.damp(
        this.viewmodelWeapon.rotation.z,
        reloadWave * 0.34 - this.vmSwayX * 0.55,
        14,
        dt
      );

      // Sync arms smoothly with weapon offsets
      this.viewmodelArms.position.x = THREE.MathUtils.damp(
        this.viewmodelArms.position.x,
        (isADS ? -0.22 : 0) + this.vmSwayX * 0.6,
        16,
        dt
      );
      this.viewmodelArms.position.y = THREE.MathUtils.damp(
        this.viewmodelArms.position.y,
        this.vmEquipOffset * 0.6 + reloadDip * 0.5 + this.vmLandOffset * 0.7,
        16,
        dt
      );
      this.viewmodelArms.position.z = THREE.MathUtils.damp(this.viewmodelArms.position.z, this.vmRecoilZ * 0.6, 18, dt);

      const targetFOV = isADS ? this.settings.fov * p.weapon.adsZoom : this.settings.fov;
      if (Math.abs(this.camera.fov - targetFOV) > 0.05) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFOV, 14, dt);
        this.camera.updateProjectionMatrix();
      }
    }
  }

  public getMatchSummary(won: boolean): MatchSummaryPayload {
    const pStats = this.playerStats[0];
    return {
      mode: this.matchMode,
      difficulty: this.botDifficulty,
      agentId: this.playerCombatant.agentId,
      won,
      playerTeam: this.playerTeam,
      attackerScore: this.attackerRoundsWon,
      defenderScore: this.defenderRoundsWon,
      kills: pStats?.kills ?? 0,
      deaths: pStats?.deaths ?? 0,
      headshots: this.playerHeadshots,
      damageDealt: this.playerDamageDealt,
      weaponBreakdown: this.weaponBreakdown,
    };
  }

  private endRound(winner: TeamSide, reason: string): void {
    if (this.roundPhase === 'ROUND_END' || this.roundPhase === 'MATCH_OVER') return;

    this.roundPhase = 'ROUND_END';
    this.roundTimer = ROUND_END_DURATION;

    if (winner === 'ATTACKERS') {
      this.attackerRoundsWon++;
    } else {
      this.defenderRoundsWon++;
    }

    const isPlayerTeamWinner = winner === this.playerTeam;
    soundEngine.playRoundEnd(isPlayerTeamWinner);
    this.callbacks.onRoundScoreChange(this.attackerRoundsWon, this.defenderRoundsWon, this.roundNumber);

    const isPlantBonus = reason === 'SPIKE_PLANTED' || reason === 'SPIKE_DETONATED';

    const playerEcon = calculateEconomy(0, isPlayerTeamWinner, this.playerLossStreak, isPlantBonus, 0);
    const botEcon = calculateEconomy(0, !isPlayerTeamWinner, this.botLossStreak, false, 0);

    this.playerLossStreak = playerEcon.nextLossStreak;
    this.botLossStreak = botEcon.nextLossStreak;

    this.playerStats.forEach((s) => {
      const award = s.team === this.playerTeam ? playerEcon.creditsGained : botEcon.creditsGained;
      s.credits = Math.min(9000, s.credits + award);
    });

    this.callbacks.onStatsUpdate([...this.playerStats]);

    const winnerTeam = checkMatchWin(this.attackerRoundsWon, this.defenderRoundsWon);
    if (winnerTeam) {
      this.roundPhase = 'MATCH_OVER';
      this.callbacks.onMatchOver(winnerTeam, this.getMatchSummary(winnerTeam === this.playerTeam));
    }
  }

  public startNextRound(): void {
    this.roundNumber++;
    this.viewmodelRig.visible = true;
    this.spectateTargetId = null;
    this.practiceRespawnTimer = 0;
    this.lastSpectateKey = '';
    this.callbacks.onSpectateUpdate?.(null);

    if (shouldSwapSides(this.roundNumber - 1)) {
      this.playerTeam = this.playerTeam === 'ATTACKERS' ? 'DEFENDERS' : 'ATTACKERS';
      for (const c of this.combatants) {
        c.team = c.team === 'ATTACKERS' ? 'DEFENDERS' : 'ATTACKERS';
      }
      this.playerStats.forEach((s) => {
        s.team = s.team === 'ATTACKERS' ? 'DEFENDERS' : 'ATTACKERS';
      });
    }

    this.roundPhase = 'BUY_PHASE';
    this.roundTimer = this.matchMode === 'SKIRMISH' ? 8 : BUY_PHASE_DURATION;
    this.spikeState = 'not_planted';
    this.spikeTimer = SPIKE_DETONATION_TIME;
    this.spikePosition = null;
    this.plantedSite = null;

    if (this.spikeMesh) {
      this.scene.remove(this.spikeMesh);
      this.spikeMesh = null;
    }

    this.abilityMgr.clearAll();

    // Refresh non-ult ability charges between rounds & grant +1 ult orb per round played
    const agent = AGENT_REGISTRY[this.playerCombatant.agentId] || AGENT_REGISTRY.ZEPHYR;
    for (const ab of agent.abilities) {
      const st = this.abilitySlots[ab.keySlot];
      if (!st) continue;
      if (ab.isUltimate) {
        st.ultPoints = Math.min(st.ultRequired, st.ultPoints + 1);
        st.activeRemaining = 0;
      } else {
        st.charges = ab.maxCharges;
        st.cooldownRemaining = 0;
      }
    }
    this.playerOverdriveTimer = 0;
    this.emitAbilityStates();

    const attSpawn = SPAWN_ATTACKERS;
    const defSpawn = SPAWN_DEFENDERS;

    this.combatants.forEach((c, idx) => {
      c.alive = true;
      c.deathTimer = 0;
      c.hp = 100;
      c.isPlanting = false;
      c.isDefusing = false;
      c.actionProgress = 0;
      c.modelPackage.resetPose();
      c.modelPackage.root.visible = true;
      c.modelPackage.root.traverse((obj) => {
        obj.layers.set(c.isHuman ? 1 : 0);
      });

      const isAttacker = c.team === 'ATTACKERS';
      const spawnBase = isAttacker ? attSpawn : defSpawn;
      const offsetX = ((idx % 5) - 2) * 3.0;
      const spawnYaw = isAttacker ? 0 : Math.PI;

      c.position.set(spawnBase.x + offsetX, 0, spawnBase.z);
      c.yaw = spawnYaw;
      c.pitch = 0;

      // Bots upgrade to SMG/Rifle when rounds progress and credits allow
      if (!c.isHuman) {
        c.armor = this.roundNumber >= 2 ? 25 : 0;
        const botStats = this.playerStats.find((s) => s.id === c.id);
        if (botStats && botStats.credits >= 2900) {
          botStats.credits -= 2900;
          c.primaryWeapon = WEAPON_REGISTRY.PHANTOM_V;
          c.primaryAmmoInMag = WEAPON_REGISTRY.PHANTOM_V.magazineSize;
          c.primaryReserveAmmo = WEAPON_REGISTRY.PHANTOM_V.reserveAmmo;
          c.weapon = c.primaryWeapon;
          c.activeSlot = 1;
        } else if (botStats && botStats.credits >= 1600 && !c.primaryWeapon) {
          botStats.credits -= 1600;
          c.primaryWeapon = WEAPON_REGISTRY.VIPER_9;
          c.primaryAmmoInMag = WEAPON_REGISTRY.VIPER_9.magazineSize;
          c.primaryReserveAmmo = WEAPON_REGISTRY.VIPER_9.reserveAmmo;
          c.weapon = c.primaryWeapon;
          c.activeSlot = 1;
        }
        c.modelPackage.setWeapon(c.weapon.id);
      }

      // Reset mag & reserve for round
      if (c.primaryWeapon) {
        c.primaryAmmoInMag = c.primaryWeapon.magazineSize;
        c.primaryReserveAmmo = c.primaryWeapon.reserveAmmo;
      }
      c.sidearmAmmoInMag = c.sidearmWeapon.magazineSize;
      c.sidearmReserveAmmo = c.sidearmWeapon.reserveAmmo;
      c.ammoInMag = c.weapon.magazineSize;
      c.reserveAmmo = c.weapon.reserveAmmo;
      c.reloadTimer = 0;
      c.shootCooldown = 0;

      c.modelPackage.root.position.copy(c.position);
      c.modelPackage.root.rotation.y = c.yaw;
      c.modelPackage.root.updateMatrixWorld(true);

      c.hasSpike = isAttacker && (idx === 0 || (idx === 5 && !this.playerCombatant.hasSpike));
      if (c.hasSpike) this.spikeCarrierId = c.id;

      const stats = this.playerStats.find((s) => s.id === c.id);
      if (stats) {
        stats.alive = true;
        stats.hp = 100;
        stats.armor = c.armor;
        stats.hasSpike = c.hasSpike;
      }
    });

    this.updateViewmodelWeapon(this.playerCombatant.weapon.id);
    this.callbacks.onStatsUpdate([...this.playerStats]);
    this.callbacks.onPlayerHealthUpdate(100, this.playerCombatant.armor, 100, 50);
    this.callbacks.onWeaponUpdate(
      this.playerCombatant.weapon,
      this.playerCombatant.ammoInMag,
      this.playerCombatant.reserveAmmo,
      false,
      this.playerCombatant.activeSlot
    );
    this.callbacks.onSpikeStateUpdate('not_planted', SPIKE_DETONATION_TIME, 0, 0);

    this.camera.position.set(this.playerCombatant.position.x, 1.65, this.playerCombatant.position.z);
    this.camera.rotation.y = this.playerCombatant.yaw;
    this.camera.rotation.x = 0;
    this.camera.updateMatrixWorld(true);
  }

  public buyItem(itemId: string): boolean {
    if (this.roundPhase !== 'BUY_PHASE' && this.matchMode !== 'PRACTICE') return false;

    const stats = this.playerStats[0];
    const p = this.playerCombatant;

    if (WEAPON_REGISTRY[itemId]) {
      const w = WEAPON_REGISTRY[itemId];
      if (stats.credits >= w.cost) {
        stats.credits -= w.cost;
        if (w.category === 'SIDEARM') {
          p.sidearmWeapon = w;
          p.sidearmAmmoInMag = w.magazineSize;
          p.sidearmReserveAmmo = w.reserveAmmo;
          p.activeSlot = 2;
        } else {
          p.primaryWeapon = w;
          p.primaryAmmoInMag = w.magazineSize;
          p.primaryReserveAmmo = w.reserveAmmo;
          p.activeSlot = 1;
        }
        p.weapon = w;
        p.ammoInMag = w.magazineSize;
        p.reserveAmmo = w.reserveAmmo;
        p.reloadTimer = 0;
        this.updateViewmodelWeapon(w.id);
        soundEngine.playReload();
        this.callbacks.onWeaponUpdate(w, p.ammoInMag, p.reserveAmmo, false, p.activeSlot);
        this.callbacks.onStatsUpdate([...this.playerStats]);
        return true;
      }
    }

    if (SHIELD_REGISTRY[itemId]) {
      const s = SHIELD_REGISTRY[itemId];
      if (stats.credits >= s.cost && p.armor < s.armorPoints) {
        stats.credits -= s.cost;
        p.armor = s.armorPoints;
        stats.armor = s.armorPoints;
        soundEngine.playAbility('WALL');
        this.callbacks.onPlayerHealthUpdate(p.hp, p.armor, 100, 50);
        this.callbacks.onStatsUpdate([...this.playerStats]);
        return true;
      }
    }

    return false;
  }

  private handleResize = (): void => {
    if (!this.renderer || !this.camera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.input.detectDevice(this.settings.controlMode);
  };

  public dispose(): void {
    this.isDestroyed = true;
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    this.input.detach();
    this.abilityMgr.dispose();
    this.mapData.dispose();

    for (const c of this.combatants) {
      c.modelPackage.dispose();
    }

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
