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
  STARTER_SIDEARM_ID,
  MELEE_WEAPON_ID,
  CustomRoomState,
  RemotePlayerSync,
  TrainingDrillMode,
  TrainingSessionState,
  TrainingZoneId,
  TRAINING_ZONES,
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
  pickBotPurchase,
  isTdmMap,
  clampTeamSizeForMap,
  getTdmKillTarget,
  checkTdmMatchWin,
} from './rules';
import { buildTacticalMap, BuiltMap } from './mapBuilder';
import {
  BOMB_SITE_A,
  BOMB_SITE_B,
  BUY_BARRIER_ATTACKERS_Z,
  BUY_BARRIER_DEFENDERS_Z,
  SPAWN_ATTACKERS,
  SPAWN_DEFENDERS,
  checkCollision,
  checkWorldCeilingY,
  getActiveMapDef,
  isPointWalkable,
  raycastMapAABBs,
  resolveWorldMovement,
  sampleWorldFloorY,
  setActiveMap,
} from './mapData';
import { createAgentModel } from './agentModels';
import { createWeaponModel, getWeaponViewmodelProfile, createSpikeModel } from './weaponModels';
import { soundEngine, AnnouncerEvent } from './audio';
import { AbilityManager } from './abilities';
import { BotCombatant, BotController } from './botAI';
import { InputManager } from './inputManager';
import { MatchSummaryPayload } from './profileStore';
import { multiplayerClient } from './multiplayerClient';

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
  onWeaponUpdate: (weapon: WeaponDef, ammoInMag: number, reserveAmmo: number, isReloading: boolean, activeSlot?: 1 | 2 | 3) => void;
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
  onCrosshairBloomUpdate?: (bloomPx: number) => void;
  onTrainingUpdate?: (state: TrainingSessionState) => void;
  onTdmScoreUpdate?: (attackerKills: number, defenderKills: number, targetKills: number) => void;
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
  private vmEquipRoll: number = 0;
  private vmInspectTimer: number = 0;
  private vmStrafeRoll: number = 0;
  private vmSwayX: number = 0;
  private vmSwayY: number = 0;
  private vmLandOffset: number = 0;
  private lastSpreadBloomPx: number = -1;

  // Player Jump/Eye Physics & Status
  private playerVelY: number = 0;
  private isGrounded: boolean = true;
  private wasGrounded: boolean = true;
  private playerEyeHeight: number = 1.65;
  private playerOverdriveTimer: number = 0;
  private abilitySlots: Record<'Q' | 'E' | 'C' | 'X', AbilitySlotState> = {} as Record<'Q' | 'E' | 'C' | 'X', AbilitySlotState>;
  private abilitySyncTimer: number = 0;
  private wasBlinded: boolean = false;
  private roundPlayerKills: number = 0;
  private playedTenSecondsAudio: boolean = false;
  private phaseAnchor: { pos: THREE.Vector3; timer: number } | null = null;

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
  private customRoom: CustomRoomState | null = null;
  private syncAccumTimer: number = 0;
  private unsubInMatch: (() => void) | null = null;
  private contextLost: boolean = false;
  private meleeSlashTimer: number = 0;
  private glSyncTimer: number | null = null;

  // Mode flags: Warehouse TDM (1v1/2v2, no Spike) & The Range Training Area
  public isTdmMatch: boolean = false;
  public isTrainingMatch: boolean = false;
  public tdmTeamSize: number = 2;
  public tdmKillTarget: number = 25;
  public tdmAttackerKills: number = 0;
  public tdmDefenderKills: number = 0;
  private tdmRespawnBuyWindow: number = 0;
  private lastSafeGroundPos: THREE.Vector3 = new THREE.Vector3(-2, 8.05, 2);
  private trainingTargetBoards: THREE.Mesh[] = [];
  private trainingBoardGroup: THREE.Group | null = null;
  private trainingState: TrainingSessionState = {
    drillMode: 'PRACTICE',
    botArmor: false,
    botsStrafe: false,
    infiniteMag: true,
    activeTargetDistance: 18,
    trialStatus: 'IDLE',
    trialTimeElapsed: 0,
    trialKills: 0,
    trialTarget: 30,
    shotsFired: 0,
    shotsHit: 0,
    headshots: 0,
    bestSpeedTime: null,
    bestStreakScore: 0,
    spikeObjectiveActive: false,
    spikeObjectiveLabel: '',
    spikeObjectiveTimer: 0,
  };

  constructor(
    mountElement: HTMLElement,
    settings: GameSettings,
    playerAgentId: string,
    botDifficulty: BotDifficulty,
    callbacks: EngineCallbacks,
    matchMode: MatchMode = 'CUSTOM',
    customRoom: CustomRoomState | null = null,
    allyBotAgentIds: string[] = [],
    mapId?: string,
    tdmTeamSize?: number
  ) {
    this.settings = settings;
    this.callbacks = callbacks;
    this.matchMode = matchMode;
    this.customRoom = customRoom;
    this.input = new InputManager(settings.controlMode, settings.keyBindings);

    const activeMap = setActiveMap(customRoom?.mapId ?? mapId ?? getActiveMapDef().id);
    this.isTdmMatch = isTdmMap(activeMap);
    this.isTrainingMatch = Boolean(activeMap.isTrainingMap || matchMode === 'PRACTICE');
    this.tdmTeamSize = clampTeamSizeForMap(activeMap, tdmTeamSize ?? customRoom?.tdmTeamSize);
    this.tdmKillTarget = getTdmKillTarget(this.tdmTeamSize);

    // 1. Scene & Atmosphere Setup for active tactical map
    const lowDetail = isSoftwareGl || settings.graphics === 'LOW';
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(activeMap.skyColor);
    this.scene.fog = new THREE.FogExp2(activeMap.fogColor, 0.0046);

    // 2. Camera Setup (Tactical First-Person FOV)
    this.camera = new THREE.PerspectiveCamera(
      settings.fov,
      Math.max(1, mountElement.clientWidth) / Math.max(1, mountElement.clientHeight),
      0.08,
      450
    );
    const spawnEyeY = (SPAWN_ATTACKERS.y || 0) + 1.65;
    this.camera.position.set(SPAWN_ATTACKERS.x, spawnEyeY, SPAWN_ATTACKERS.z);
    this.lastSafeGroundPos.set(SPAWN_ATTACKERS.x, SPAWN_ATTACKERS.y || 0, SPAWN_ATTACKERS.z);

    // 3. Renderer with Software GL & Low Preset Guard
    this.renderer = new THREE.WebGLRenderer({
      antialias: !lowDetail,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.applyGraphicsPreset(settings.graphics);

    this.renderer.setSize(mountElement.clientWidth || window.innerWidth, mountElement.clientHeight || window.innerHeight);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored, false);
    mountElement.appendChild(this.renderer.domElement);

    // 4. Studio Environment Lighting (lightweight procedural PMREM on all presets so metallic/GLB guns never turn black)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Ambient fill ensures procedural arenas & guns remain clearly lit across presets
    const ambientLight = new THREE.AmbientLight(0xe2e8f0, lowDetail ? 0.85 : 0.45);
    this.scene.add(ambientLight);

    // Warm Directional Key + Cool Hemisphere Fill
    this.dirLight = new THREE.DirectionalLight(0xffedd5, lowDetail ? 1.75 : 1.55);
    this.dirLight.position.set(28, 45, 24);
    this.dirLight.castShadow = !lowDetail;
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

    this.hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x334155, lowDetail ? 1.15 : 0.75);
    this.scene.add(this.hemiLight);

    // 5. Abilities & Tactical Map (explicitly clear any prior map geometry first)
    this.abilityMgr = new AbilityManager(this.scene, lowDetail);
    this.mapData = this.loadMap(activeMap.id);

    // 6. Viewmodel Rig, Tactical Hands, Subtle Viewmodel Fill Light, and Barrel Muzzle Flash
    this.viewmodelRig = new THREE.Group();
    this.viewmodelArms = this.createViewmodelHands(playerAgentId);
    this.viewmodelFlash = this.createViewmodelFlash();
    this.viewmodelRig.add(this.viewmodelArms);
    const vmKeyLight = new THREE.PointLight(0xe2e8f0, 0.85, 2.4);
    vmKeyLight.position.set(0.22, 0.28, 0.15);
    this.camera.add(vmKeyLight);
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

    // 9. Initialize Combatants, Multiplayer Relay & Mode Setup
    this.initCombatants(playerAgentId, botDifficulty, allyBotAgentIds);
    this.initAbilitySlots(playerAgentId);
    this.configureInitialPhaseForMode();
    if (this.customRoom) {
      this.unsubInMatch = multiplayerClient.subscribeInMatch((msg) => this.handleIncomingMultiplayerMessage(msg));
    }

    // 10. Start simulation loop & seed initial FPS telemetry
    this.lastTime = performance.now();
    this.lastRenderTime = performance.now();
    this.callbacks.onFpsUpdate(this.settings.fpsCap > 0 ? this.settings.fpsCap : 60);
    this.tick();

    // Window Resize listener
    window.addEventListener('resize', this.handleResize);
  }

  private clearSceneMaps(): void {
    this.clearTrainingTargetBoards();
    if (this.mapData) {
      this.mapData.dispose();
    }
    const staleGroups: THREE.Object3D[] = [];
    for (const child of this.scene.children) {
      if (child.name.startsWith('TacticalMap_')) {
        staleGroups.push(child);
      }
    }
    for (const grp of staleGroups) {
      this.scene.remove(grp);
    }
  }

  public loadMap(mapId: string): BuiltMap {
    this.clearSceneMaps();
    const activeMap = setActiveMap(mapId);
    this.scene.background = new THREE.Color(activeMap.skyColor);
    this.scene.fog = new THREE.FogExp2(activeMap.fogColor, 0.0046);
    const lowDetail = isSoftwareGl || this.settings.graphics === 'LOW';
    this.mapData = buildTacticalMap(this.scene, { lowDetail, isSoftwareGl });
    return this.mapData;
  }

  private createViewmodelHands(agentId: string): THREE.Group {
    const agent = AGENT_REGISTRY[agentId] || AGENT_REGISTRY.KAEL;
    const handsGroup = new THREE.Group();

    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x162032, roughness: 0.72, metalness: 0.2 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x263447, roughness: 0.56, metalness: 0.32 });
    const accentMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(agent.primaryColor),
      emissive: new THREE.Color(agent.primaryColor),
      emissiveIntensity: 0.55,
    });

    // Sleek tapered Right Forearm + Glove cupped under the grip
    const rForearmGeo = new THREE.CylinderGeometry(0.024, 0.032, 0.25, 10);
    rForearmGeo.rotateX(Math.PI / 2);
    const rForearm = new THREE.Mesh(rForearmGeo, sleeveMat);
    rForearm.position.set(0.038, -0.115, 0.145);
    rForearm.rotation.set(0.28, -0.16, 0);

    const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.046, 0.078), gloveMat);
    rGlove.position.set(0.012, -0.072, 0.005);

    const rBandGeo = new THREE.CylinderGeometry(0.027, 0.028, 0.022, 10);
    rBandGeo.rotateX(Math.PI / 2);
    const rBand = new THREE.Mesh(rBandGeo, accentMat);
    rBand.position.set(0.026, -0.092, 0.068);
    rBand.rotation.set(0.28, -0.16, 0);

    // Sleek tapered Left Support Forearm + Glove tucked underneath trigger guard / forend
    const lForearmGeo = new THREE.CylinderGeometry(0.022, 0.029, 0.26, 10);
    lForearmGeo.rotateX(Math.PI / 2);
    const lForearm = new THREE.Mesh(lForearmGeo, sleeveMat);
    lForearm.position.set(-0.125, -0.135, 0.03);
    lForearm.rotation.set(0.32, 0.58, 0);

    const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.034, 0.076), gloveMat);
    lGlove.position.set(-0.028, -0.076, -0.078);

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
    flash.name = 'vm_muzzle_flash';
    flash.position.set(0, 0.04, -0.42);
    flash.visible = false;
    flash.raycast = () => {};
    return flash;
  }

  private configureInitialPhaseForMode(): void {
    if (this.isTrainingMatch) {
      this.roundPhase = 'ROUND_LIVE';
      this.roundTimer = 300;
      this.mapData.barrierAttackers.visible = false;
      this.mapData.barrierDefenders.visible = false;
      this.playerStats[0].credits = 9000;
      this.buildTrainingTargetBoards();
      this.applyTrainingBotLayout();
      this.callbacks.onStatsUpdate([...this.playerStats]);
      this.callbacks.onRoundPhaseChange(this.roundPhase, this.roundTimer);
      this.callbacks.onTrainingUpdate?.({ ...this.trainingState });
    } else if (this.isTdmMatch) {
      this.roundPhase = 'BUY_PHASE';
      this.roundTimer = 6;
      this.tdmAttackerKills = 0;
      this.tdmDefenderKills = 0;
      this.mapData.barrierAttackers.visible = false;
      this.mapData.barrierDefenders.visible = false;
      this.playerStats.forEach((s) => {
        s.credits = 2900;
        s.hasSpike = false;
      });
      this.callbacks.onTdmScoreUpdate?.(0, 0, this.tdmKillTarget);
      this.callbacks.onSpikeStateUpdate('not_planted', 0, 0, 0);
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
    const agent = AGENT_REGISTRY[agentId] || AGENT_REGISTRY.KAEL;
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
        ultPoints: ab.isUltimate && this.isTrainingMatch ? ultReq : 0,
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

    this.renderer.setPixelRatio(isSoftwareGl ? 0.75 : dpr);
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

  private getSpawnSlotPosition(team: TeamSide, indexWithinTeam: number): THREE.Vector3 {
    const base = team === 'ATTACKERS' ? SPAWN_ATTACKERS : SPAWN_DEFENDERS;
    const baseY = base.y || 0;
    const offsetX = (indexWithinTeam - 2) * 1.65;
    const tx = base.x + offsetX;
    const tz = base.z;
    if (isPointWalkable(tx, tz, 0.45, baseY)) {
      const fy = Math.max(0, sampleWorldFloorY(tx, tz, baseY, 2.0));
      return new THREE.Vector3(tx, fy, tz);
    }
    const fy = Math.max(0, sampleWorldFloorY(base.x, base.z, baseY, 2.0));
    return new THREE.Vector3(base.x, fy, base.z);
  }

  private initCombatants(playerAgentId: string, difficulty: BotDifficulty, allyBotAgentIds: string[] = []): void {
    this.combatants = [];
    this.botControllers = [];
    this.playerStats = [];
    this.spikeCarrierId = null;

    const myUsername = multiplayerClient.getCachedUsername();
    const myMember = this.customRoom?.members.find(
      (m) => m.username.toLowerCase() === myUsername.toLowerCase()
    );
    if (myMember) {
      this.playerTeam = myMember.team;
    }

    const starterSidearm = WEAPON_REGISTRY[STARTER_SIDEARM_ID] || WEAPON_REGISTRY.KADENCE;
    const meleeDef = WEAPON_REGISTRY[MELEE_WEAPON_ID] || WEAPON_REGISTRY.HOLLOW_BLADE;
    const skirmishGun = WEAPON_REGISTRY.MANTIS || starterSidearm;

    const agentKeys = Object.keys(AGENT_REGISTRY);
    const playerAgent = AGENT_REGISTRY[playerAgentId] || AGENT_REGISTRY.KAEL;
    const playerMesh = createAgentModel(playerAgent, this.playerTeam);
    playerMesh.root.visible = true;
    playerMesh.root.traverse((obj) => {
      obj.layers.set(1);
    });
    this.scene.add(playerMesh.root);

    const playerStartPos = this.getSpawnSlotPosition(this.playerTeam, 2);
    const playerStartYaw = this.playerTeam === 'ATTACKERS' ? Math.PI : 0;
    const playerStartWeapon =
      this.matchMode === 'SKIRMISH' || this.isTdmMatch ? skirmishGun : starterSidearm;
    const allowSpikeCarry = !this.isTdmMatch && !this.isTrainingMatch;

    this.playerCombatant = {
      id: 'player_0',
      name: myUsername ? `${myUsername} (You)` : 'Agent (You)',
      team: this.playerTeam,
      agentId: playerAgent.id,
      isHuman: true,
      hp: 100,
      armor: this.isTdmMatch ? 25 : 0,
      alive: true,
      deathTimer: 0,
      position: playerStartPos,
      velocity: new THREE.Vector3(),
      yaw: playerStartYaw,
      pitch: 0,
      hasSpike: allowSpikeCarry && this.playerTeam === 'ATTACKERS',
      weapon: playerStartWeapon,
      ammoInMag: playerStartWeapon.magazineSize,
      reserveAmmo: playerStartWeapon.reserveAmmo,
      primaryWeapon: playerStartWeapon.category !== 'SIDEARM' ? playerStartWeapon : null,
      primaryAmmoInMag: playerStartWeapon.category !== 'SIDEARM' ? playerStartWeapon.magazineSize : 0,
      primaryReserveAmmo: playerStartWeapon.category !== 'SIDEARM' ? playerStartWeapon.reserveAmmo : 0,
      sidearmWeapon: starterSidearm,
      sidearmAmmoInMag: starterSidearm.magazineSize,
      sidearmReserveAmmo: starterSidearm.reserveAmmo,
      meleeWeapon: meleeDef,
      activeSlot: playerStartWeapon.category !== 'SIDEARM' ? 1 : 2,
      reloadTimer: 0,
      shootCooldown: 0,
      isPlanting: false,
      isDefusing: false,
      actionProgress: 0,
      modelPackage: playerMesh,
    };
    playerMesh.setWeapon(playerStartWeapon.id);
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
      credits: this.isTrainingMatch ? 9000 : this.matchMode === 'SKIRMISH' || this.isTdmMatch ? 2900 : 800,
      ping: 12,
      alive: true,
      hp: 100,
      maxHp: 100,
      armor: this.playerCombatant.armor,
      maxArmor: 50,
      hasSpike: this.playerCombatant.hasSpike,
    });

    // Spawn remote human teammates/opponents if launched from a multiplayer room
    const remoteMembers = (this.customRoom?.members ?? []).filter(
      (m) => m.username.toLowerCase() !== myUsername.toLowerCase()
    );

    const teamSlotOrder: Record<TeamSide, number[]> = {
      ATTACKERS: this.playerTeam === 'ATTACKERS' ? [0, 1, 3, 4] : [2, 1, 3, 0, 4],
      DEFENDERS: this.playerTeam === 'DEFENDERS' ? [0, 1, 3, 4] : [2, 1, 3, 0, 4],
    };
    const teamSlotCursor: Record<TeamSide, number> = {
      ATTACKERS: 0,
      DEFENDERS: 0,
    };
    const takeNextSlot = (team: TeamSide): number => {
      const order = teamSlotOrder[team];
      const idx = teamSlotCursor[team]++;
      return order[idx % order.length];
    };

    for (const remote of remoteMembers) {
      const rAgent = AGENT_REGISTRY[remote.agentId] || AGENT_REGISTRY.KAEL;
      const rMesh = createAgentModel(rAgent, remote.team);
      this.scene.add(rMesh.root);

      const slotIdx = takeNextSlot(remote.team);
      const rPos = this.getSpawnSlotPosition(remote.team, slotIdx);
      const rYaw = remote.team === 'ATTACKERS' ? Math.PI : 0;
      const rStartWeapon = this.matchMode === 'SKIRMISH' || this.isTdmMatch ? skirmishGun : starterSidearm;

      const remoteCombatant: BotCombatant = {
        id: `remote_${remote.username}`,
        name: remote.username,
        team: remote.team,
        agentId: rAgent.id,
        isHuman: false,
        isRemoteHuman: true,
        hp: 100,
        armor: 0,
        alive: true,
        deathTimer: 0,
        position: rPos,
        velocity: new THREE.Vector3(),
        yaw: rYaw,
        pitch: 0,
        hasSpike: false,
        weapon: rStartWeapon,
        ammoInMag: rStartWeapon.magazineSize,
        reserveAmmo: rStartWeapon.reserveAmmo,
        primaryWeapon: rStartWeapon.category !== 'SIDEARM' ? rStartWeapon : null,
        primaryAmmoInMag: rStartWeapon.category !== 'SIDEARM' ? rStartWeapon.magazineSize : 0,
        primaryReserveAmmo: rStartWeapon.category !== 'SIDEARM' ? rStartWeapon.reserveAmmo : 0,
        sidearmWeapon: starterSidearm,
        sidearmAmmoInMag: starterSidearm.magazineSize,
        sidearmReserveAmmo: starterSidearm.reserveAmmo,
        meleeWeapon: meleeDef,
        activeSlot: rStartWeapon.category !== 'SIDEARM' ? 1 : 2,
        reloadTimer: 0,
        shootCooldown: 0,
        isPlanting: false,
        isDefusing: false,
        actionProgress: 0,
        modelPackage: rMesh,
      };
      rMesh.setWeapon(rStartWeapon.id);
      rMesh.root.position.copy(rPos);
      rMesh.root.rotation.y = rYaw;
      rMesh.root.updateMatrixWorld(true);
      this.combatants.push(remoteCombatant);

      this.playerStats.push({
        id: remoteCombatant.id,
        name: remoteCombatant.name,
        agentId: remoteCombatant.agentId,
        team: remoteCombatant.team,
        isHuman: false,
        isRemoteHuman: true,
        kills: 0,
        deaths: 0,
        assists: 0,
        score: 0,
        credits: 800,
        ping: 24,
        alive: true,
        hp: 100,
        maxHp: 100,
        armor: 0,
        maxArmor: 50,
        hasSpike: false,
      });
    }

    // Spawn AI Bots only when configured (Custom Room fillBots: true, or offline AI modes).
    // Ally bots default to empty unless player explicitly added teammates or enabled fillBots.
    const shouldFillEnemyBots = this.customRoom
      ? this.customRoom.fillBots
      : this.matchMode !== 'CUSTOM';
    const oppTeam: TeamSide = this.playerTeam === 'ATTACKERS' ? 'DEFENDERS' : 'ATTACKERS';
    const attAlready = this.combatants.filter((c) => c.team === 'ATTACKERS').length;
    const defAlready = this.combatants.filter((c) => c.team === 'DEFENDERS').length;

    const spawnBotTeam = (team: TeamSide, agentQueue: string[], isAlly: boolean) => {
      for (let i = 0; i < agentQueue.length; i++) {
        const agentKey = agentQueue[i];
        const agent = AGENT_REGISTRY[agentKey] || AGENT_REGISTRY.KAEL;
        const mesh = createAgentModel(agent, team);
        this.scene.add(mesh.root);

        const slotIdx = takeNextSlot(team);
        const botPos = this.getSpawnSlotPosition(team, slotIdx);
        const startYaw = team === 'ATTACKERS' ? Math.PI : 0;
        const startWeapon =
          this.matchMode === 'SKIRMISH' || this.isTdmMatch ? skirmishGun : starterSidearm;
        const carrySpike =
          !this.isTdmMatch && !this.isTrainingMatch && team === 'ATTACKERS' && !this.spikeCarrierId && i === 0;

        const bot: BotCombatant = {
          id: `${isAlly ? 'ally' : 'opp'}_${i + 1}`,
          name: `${isAlly ? 'Ally' : 'Foe'} ${agent.name}`,
          team,
          agentId: agent.id,
          isHuman: false,
          hp: 100,
          armor: this.isTdmMatch ? 25 : 0,
          alive: true,
          deathTimer: 0,
          position: botPos,
          velocity: new THREE.Vector3(),
          yaw: startYaw,
          pitch: 0,
          hasSpike: carrySpike,
          weapon: startWeapon,
          ammoInMag: startWeapon.magazineSize,
          reserveAmmo: startWeapon.reserveAmmo,
          primaryWeapon: startWeapon.category !== 'SIDEARM' ? startWeapon : null,
          primaryAmmoInMag: startWeapon.category !== 'SIDEARM' ? startWeapon.magazineSize : 0,
          primaryReserveAmmo: startWeapon.category !== 'SIDEARM' ? startWeapon.reserveAmmo : 0,
          sidearmWeapon: starterSidearm,
          sidearmAmmoInMag: starterSidearm.magazineSize,
          sidearmReserveAmmo: starterSidearm.reserveAmmo,
          meleeWeapon: meleeDef,
          activeSlot: startWeapon.category !== 'SIDEARM' ? 1 : 2,
          reloadTimer: 0,
          shootCooldown: 0,
          isPlanting: false,
          isDefusing: false,
          actionProgress: 0,
          modelPackage: mesh,
        };
        if (carrySpike) this.spikeCarrierId = bot.id;

        mesh.setWeapon(startWeapon.id);
        mesh.root.position.copy(bot.position);
        mesh.root.rotation.y = bot.yaw;
        mesh.root.updateMatrixWorld(true);

        this.combatants.push(bot);
        this.botControllers.push(new BotController(bot, difficulty, slotIdx));

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
          credits: this.isTdmMatch ? 2900 : 800,
          ping: Math.floor(Math.random() * 18 + 14),
          alive: true,
          hp: 100,
          maxHp: 100,
          armor: bot.armor,
          maxArmor: 50,
          hasSpike: bot.hasSpike,
        });
      }
    };

    const maxTeamCap = this.isTdmMatch ? this.tdmTeamSize : 5;
    if (this.customRoom) {
      if (this.customRoom.fillBots) {
        const allyNeeded = Math.max(
          0,
          maxTeamCap - (this.playerTeam === 'ATTACKERS' ? attAlready : defAlready)
        );
        const oppNeeded = Math.max(
          0,
          maxTeamCap - (oppTeam === 'ATTACKERS' ? attAlready : defAlready)
        );
        const allyList = Array.from({ length: allyNeeded }, (_, i) => agentKeys[(i + 1) % agentKeys.length]);
        const oppList = Array.from({ length: oppNeeded }, (_, i) => agentKeys[(i + 2) % agentKeys.length]);
        spawnBotTeam(this.playerTeam, allyList, true);
        spawnBotTeam(oppTeam, oppList, false);
      }
    } else {
      if (allyBotAgentIds.length > 0 && this.matchMode !== 'CUSTOM' && !this.isTrainingMatch) {
        const maxAllies = Math.max(0, maxTeamCap - 1);
        spawnBotTeam(this.playerTeam, allyBotAgentIds.slice(0, maxAllies), true);
      }
      if (shouldFillEnemyBots) {
        const oppNeeded = Math.max(
          0,
          maxTeamCap - (oppTeam === 'ATTACKERS' ? attAlready : defAlready)
        );
        const oppList = Array.from({ length: oppNeeded }, (_, i) => agentKeys[(i + 2) % agentKeys.length]);
        spawnBotTeam(oppTeam, oppList, false);
      }
    }

    // Guarantee Spike carrier ONLY on non-TDM, non-Training Spike matches
    if (!this.isTdmMatch && !this.isTrainingMatch && !this.spikeCarrierId) {
      const firstAtt = this.combatants.find((c) => c.team === 'ATTACKERS');
      if (firstAtt) {
        firstAtt.hasSpike = true;
        this.spikeCarrierId = firstAtt.id;
        const st = this.playerStats.find((s) => s.id === firstAtt.id);
        if (st) st.hasSpike = true;
      }
    }

    this.updateViewmodelWeapon(playerStartWeapon.id);
    this.camera.position.set(
      this.playerCombatant.position.x,
      this.playerCombatant.position.y + 1.65,
      this.playerCombatant.position.z
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.playerCombatant.yaw;
    this.camera.rotation.x = 0;

    this.callbacks.onStatsUpdate([...this.playerStats]);
    this.callbacks.onPlayerHealthUpdate(100, 0, 100, 50);
    this.callbacks.onWeaponUpdate(
      this.playerCombatant.weapon,
      this.playerCombatant.ammoInMag,
      this.playerCombatant.reserveAmmo,
      false,
      this.playerCombatant.activeSlot
    );
  }

  private updateViewmodelWeapon(weaponId: string): void {
    if (this.viewmodelWeapon) {
      this.viewmodelWeapon.remove(this.viewmodelFlash);
      this.viewmodelRig.remove(this.viewmodelWeapon);
    }

    const profile = getWeaponViewmodelProfile(weaponId);
    this.viewmodelWeapon = createWeaponModel(weaponId);
    this.viewmodelFlash.position.set(...profile.flashPos);

    this.viewmodelWeapon.position.set(...profile.hipPos);
    this.viewmodelArms.position.set(
      profile.hipPos[0] - 0.03,
      profile.hipPos[1] + 0.03,
      profile.hipPos[2] + 0.16
    );
    this.viewmodelWeapon.add(this.viewmodelFlash);
    this.viewmodelRig.add(this.viewmodelWeapon);

    this.vmEquipOffset = -0.18; // Crisp draw/equip rise without near-plane clipping
    this.vmEquipRoll = -0.32;
    this.vmInspectTimer = 0;
  }

  public switchWeaponSlot(slot: 1 | 2 | 3): boolean {
    const p = this.playerCombatant;
    if (!p.alive) return false;
    if (slot === 1 && !p.primaryWeapon) return false;
    if (slot === p.activeSlot) return false;

    if (p.activeSlot === 1) {
      p.primaryAmmoInMag = p.ammoInMag;
      p.primaryReserveAmmo = p.reserveAmmo;
    } else if (p.activeSlot === 2) {
      p.sidearmAmmoInMag = p.ammoInMag;
      p.sidearmReserveAmmo = p.reserveAmmo;
    }

    p.activeSlot = slot;
    p.reloadTimer = 0;
    p.shootCooldown = Number.isFinite(p.shootCooldown) ? Math.min(Math.max(0, p.shootCooldown), 0.12) : 0;

    if (slot === 1 && p.primaryWeapon) {
      p.weapon = p.primaryWeapon;
      p.ammoInMag = p.primaryAmmoInMag;
      p.reserveAmmo = p.primaryReserveAmmo;
    } else if (slot === 2) {
      p.weapon = p.sidearmWeapon;
      p.ammoInMag = p.sidearmAmmoInMag;
      p.reserveAmmo = p.sidearmReserveAmmo;
    } else {
      p.weapon = p.meleeWeapon;
      p.ammoInMag = 1;
      p.reserveAmmo = 0;
    }

    this.input.setMobileADS(false);
    this.updateViewmodelWeapon(p.weapon.id);
    soundEngine.playWeaponReload(p.weapon.id);
    this.callbacks.onWeaponUpdate(p.weapon, p.ammoInMag, p.reserveAmmo, false, p.activeSlot);
    return true;
  }

  private tick = (): void => {
    if (this.isDestroyed || this.contextLost) return;

    const now = performance.now();
    if (this.settings.fpsCap > 0) {
      const targetInterval = 1000 / this.settings.fpsCap;
      if (now - this.lastRenderTime < targetInterval - 1.0) {
        this.frameId = requestAnimationFrame(this.tick);
        return;
      }
    }

    const rawDt = Math.max(0.0001, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.lastRenderTime = now;
    const dt = Math.min(rawDt, 0.05);

    this.fpsCounter++;
    this.fpsTimer += rawDt;
    if (this.fpsTimer >= 0.35) {
      const currentFps = Math.max(1, Math.round(this.fpsCounter / this.fpsTimer));
      this.callbacks.onFpsUpdate(currentFps);
      this.fpsCounter = 0;
      this.fpsTimer = 0;
    }

    if (!this.isPaused) {
      this.updateSimulation(dt);
    }

    this.renderer.render(this.scene, this.camera);

    if (isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.isDestroyed && !this.contextLost) {
          this.frameId = requestAnimationFrame(this.tick);
        }
      });
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    if (this.glSyncTimer !== null) {
      window.clearTimeout(this.glSyncTimer);
      this.glSyncTimer = null;
    }
    const gl = this.renderer.getContext() as WebGL2RenderingContext | null;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.glSyncTimer = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) {
      this.glSyncTimer = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.isDestroyed || this.contextLost) {
        try {
          gl.deleteSync(sync);
        } catch {
          // Ignore
        }
        return;
      }
      const status = gl.clientWaitSync(sync, 0, 0);
      if (status === gl.TIMEOUT_EXPIRED) {
        this.glSyncTimer = window.setTimeout(poll, 35);
      } else {
        try {
          gl.deleteSync(sync);
        } catch {
          // Ignore
        }
        this.glSyncTimer = window.setTimeout(cb, 65);
      }
    };
    this.glSyncTimer = window.setTimeout(poll, 35);
  }

  private updateSimulation(dt: number): void {
    this.input.update();

    if (this.input.state.startRoundJustPressed && this.roundPhase === 'BUY_PHASE') {
      this.skipBuyPhase();
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      if (this.playerCombatant.shootCooldown > 0) {
        this.playerCombatant.shootCooldown = Math.max(0, this.playerCombatant.shootCooldown - dt);
      }
      this.input.clearFrameDeltas();
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
      (origin, dir, team) => this.fireTurretShot(origin, dir, team),
      (target, hpGain, armorGain) => {
        target.hp = Math.min(100, target.hp + hpGain);
        target.armor = Math.min(50, target.armor + armorGain);
        const st = this.playerStats.find((s) => s.id === target.id);
        if (st) {
          st.hp = target.hp;
          st.armor = target.armor;
        }
        if (target.isHuman) {
          this.callbacks.onPlayerHealthUpdate(target.hp, target.armor, 100, 50);
        }
      }
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
    soundEngine.playAnnouncer('spikePlanted');

    const siteChoice: 'A' | 'B' = this.roundNumber % 2 === 1 ? 'A' : 'B';
    for (const ctrl of this.botControllers) {
      ctrl.planRound(true, this.plantedSite, siteChoice);
    }

    if (this.customRoom && this.spikePosition) {
      multiplayerClient.sendSpikeEvent('PLANTED', site, [
        this.spikePosition.x,
        this.spikePosition.y,
        this.spikePosition.z,
      ]);
    }
  }

  private handleBotDefuseComplete(): void {
    if (this.spikeState !== 'planted') return;
    this.spikeState = 'defused';
    soundEngine.playSpikeDefused();
    soundEngine.playAnnouncer('spikeDefused');
    if (this.customRoom) {
      multiplayerClient.sendSpikeEvent('DEFUSED', this.plantedSite, [0, 0, 0]);
    }
    this.endRound('DEFENDERS', 'SPIKE_DEFUSED');
  }

  private updateRoundState(dt: number): void {
    this.roundTimer -= dt;
    if (this.tdmRespawnBuyWindow > 0) {
      this.tdmRespawnBuyWindow = Math.max(0, this.tdmRespawnBuyWindow - dt);
    }

    // Update live Training Area timers & Spike drill objectives
    if (this.isTrainingMatch && this.roundPhase === 'ROUND_LIVE') {
      let trainingDirty = false;
      if (this.trainingState.trialStatus === 'RUNNING') {
        this.trainingState.trialTimeElapsed += dt;
        trainingDirty = true;
      }
      if (this.trainingState.spikeObjectiveActive && this.trainingState.drillMode === 'DEFUSE_DRILL') {
        this.trainingState.spikeObjectiveTimer = Math.max(0, this.trainingState.spikeObjectiveTimer - dt);
        if (this.trainingState.spikeObjectiveTimer <= 0 && this.spikeState === 'planted') {
          this.spikeState = 'detonated';
          soundEngine.playSpikeExplosion();
          this.cameraShakeTrauma = 0.85;
          this.setupSpikeTrainingDrill('DEFUSE_DRILL');
        }
        trainingDirty = true;
      }
      if (trainingDirty) {
        this.callbacks.onTrainingUpdate?.({ ...this.trainingState });
      }
    }

    if (this.roundPhase === 'BUY_PHASE') {
      const showBarriers = !this.isTdmMatch && !this.isTrainingMatch;
      this.mapData.barrierAttackers.visible = showBarriers;
      this.mapData.barrierDefenders.visible = showBarriers;

      if (this.roundTimer <= 0) {
        this.roundPhase = 'ROUND_LIVE';
        this.roundTimer = this.isTdmMatch ? 300 : ROUND_LIVE_DURATION;
        this.mapData.barrierAttackers.visible = false;
        this.mapData.barrierDefenders.visible = false;
        soundEngine.playRoundStart();
        if (this.isTdmMatch) {
          this.tdmRespawnBuyWindow = 6.0;
        }

        const siteChoice: 'A' | 'B' = this.roundNumber % 2 === 1 ? 'A' : 'B';
        for (const ctrl of this.botControllers) {
          ctrl.planRound(false, null, siteChoice);
        }
      }
    } else if (this.roundPhase === 'ROUND_LIVE') {
      if (this.spikeState === 'planted' && !this.isTdmMatch && !this.isTrainingMatch) {
        this.roundPhase = 'SPIKE_PLANTED';
      } else {
        if (
          !this.playedTenSecondsAudio &&
          !this.isTrainingMatch &&
          this.roundTimer <= 10 &&
          this.roundTimer > 0
        ) {
          this.playedTenSecondsAudio = true;
          soundEngine.playAnnouncer('tenSecondsLeft');
        }
        if (this.roundTimer <= 0) {
          if (this.isTrainingMatch) {
            this.roundTimer = 300;
          } else if (this.isTdmMatch) {
            if (this.tdmAttackerKills === this.tdmDefenderKills) {
              this.roundTimer = 30;
            } else {
              const tdmWinner: TeamSide =
                this.tdmAttackerKills > this.tdmDefenderKills ? 'ATTACKERS' : 'DEFENDERS';
              this.roundPhase = 'MATCH_OVER';
              this.callbacks.onMatchOver(tdmWinner, this.getMatchSummary(tdmWinner === this.playerTeam));
            }
          } else {
            this.endRound('DEFENDERS', 'TIME_EXPIRED');
          }
        }
      }
    } else if (this.roundPhase === 'SPIKE_PLANTED') {
      this.spikeTimer -= dt;
      this.spikeBeepTimer -= dt;

      if (!this.playedTenSecondsAudio && !this.isTrainingMatch && this.spikeTimer <= 10 && this.spikeTimer > 0) {
        this.playedTenSecondsAudio = true;
        soundEngine.playAnnouncer('tenSecondsLeft');
      }

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

    if (
      (this.roundPhase === 'ROUND_LIVE' || this.roundPhase === 'SPIKE_PLANTED') &&
      !this.isTrainingMatch &&
      !this.isTdmMatch
    ) {
      const totalAtt = this.combatants.filter((c) => c.team === 'ATTACKERS').length;
      const totalDef = this.combatants.filter((c) => c.team === 'DEFENDERS').length;
      const aliveAtt = this.combatants.filter((c) => c.alive && c.team === 'ATTACKERS').length;
      const aliveDef = this.combatants.filter((c) => c.alive && c.team === 'DEFENDERS').length;

      const check = checkRoundWin(aliveAtt, aliveDef, this.spikeState, this.roundTimer, totalAtt, totalDef);
      if (check.roundOver && check.winner) {
        this.endRound(check.winner, check.reason!);
      }
    } else if ((this.isTrainingMatch || this.isTdmMatch) && this.roundPhase === 'ROUND_LIVE') {
      // Auto-respawn fallen bots cleanly in Training Area or Warehouse 1v1/2v2 TDM
      let statsChanged = false;
      for (let i = 0; i < this.combatants.length; i++) {
        const c = this.combatants[i];
        if (!c.alive && !c.isHuman && !c.isRemoteHuman && c.deathTimer <= 0) {
          c.alive = true;
          c.hp = 100;
          c.armor = this.isTrainingMatch ? (this.trainingState.botArmor ? 50 : 0) : 25;
          c.ammoInMag = c.weapon.magazineSize;
          c.reserveAmmo = c.weapon.reserveAmmo;
          c.reloadTimer = 0;
          c.modelPackage.resetPose();
          c.modelPackage.root.visible = true;

          if (this.isTrainingMatch) {
            const slotPos = this.getTrainingBotSlotPosition(i, c);
            c.position.copy(slotPos);
            if (c.rangeAnchor) c.rangeAnchor.copy(slotPos);
          } else {
            const spawnPos = this.getSpawnSlotPosition(c.team, (i % 2) + 1);
            c.position.copy(spawnPos);
            const ctrl = this.botControllers.find((b) => b.combatant === c);
            ctrl?.planRound(false, null, 'A');
          }

          c.modelPackage.root.position.copy(c.position);
          c.modelPackage.root.updateMatrixWorld(true);
          const st = this.playerStats.find((s) => s.id === c.id);
          if (st) {
            st.alive = true;
            st.hp = 100;
            st.armor = c.armor;
            statsChanged = true;
          }
        }
      }
      if (statsChanged) {
        this.callbacks.onStatsUpdate([...this.playerStats]);
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

    // 3. Weapon Slot Switching (1 = Primary, 2 = Sidearm, 3 = Hollow Blade)
    if (this.input.state.weaponSlotJustPressed) {
      const slot = this.input.state.weaponSlotJustPressed;
      if (slot === 1 || slot === 2 || slot === 3) {
        this.switchWeaponSlot(slot);
      } else {
        this.switchWeaponSlot(p.activeSlot === 1 ? 2 : 1);
      }
    }

    // 4. Movement & Status Modifiers
    const fwd = this.input.state.moveForward;
    const right = this.input.state.moveRight;
    const isMoving = Math.abs(fwd) > 0.05 || Math.abs(right) > 0.05;

    let baseSpeed = p.weapon.isMelee ? 6.35 : 5.6;
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
    this.vmStrafeRoll = THREE.MathUtils.damp(this.vmStrafeRoll, -right * 0.048, 12, dt);

    // Weapon Inspect trigger [Y]
    if (this.input.state.inspectWeaponJustPressed && p.reloadTimer <= 0 && !this.input.state.adsHeld) {
      this.vmInspectTimer = 2.6;
    }
    if (this.vmInspectTimer > 0) {
      if (this.input.state.fireHeld || this.input.state.adsHeld || p.reloadTimer > 0) {
        this.vmInspectTimer = 0;
      } else {
        this.vmInspectTimer = Math.max(0, this.vmInspectTimer - dt);
      }
    }

    p.velocity.x = _vec3_1.x * baseSpeed;
    p.velocity.z = _vec3_1.z * baseSpeed;

    const nextX = p.position.x + p.velocity.x * dt;
    const nextZ = p.position.z + p.velocity.z * dt;

    if (this.phaseAnchor) {
      this.phaseAnchor.timer -= dt;
      if (this.phaseAnchor.timer <= 0) this.phaseAnchor = null;
    }

    let blockedByBarrier = false;
    if (this.roundPhase === 'BUY_PHASE' && !this.isTdmMatch && !this.isTrainingMatch) {
      if (p.team === 'ATTACKERS' && nextZ > BUY_BARRIER_ATTACKERS_Z) blockedByBarrier = true;
      if (p.team === 'DEFENDERS' && nextZ < BUY_BARRIER_DEFENDERS_Z) blockedByBarrier = true;
    }

    // Check tactical energy barriers (Bastion Wall / Cosmic Divide)
    if (!blockedByBarrier && this.abilityMgr.isBlockedByBarrier(nextX, nextZ, 0.38)) {
      blockedByBarrier = true;
    }

    if (!blockedByBarrier) {
      const resolved = resolveWorldMovement(nextX, nextZ, p.position.y, 0.36);
      p.position.x = resolved.x;
      p.position.z = resolved.z;
    }

    // 5. 3D Terrain Floor / Ramps / Stairs / Ceiling & Jump Physics + Sea-Fall Safety Respawn
    const sampledFloor = sampleWorldFloorY(p.position.x, p.position.z, p.position.y, 0.72);
    if (this.input.state.jumpJustPressed && this.isGrounded) {
      this.playerVelY = 6.2;
      this.isGrounded = false;
    }

    if (!this.isGrounded) {
      this.playerVelY -= 19.5 * dt;
      const proposedY = p.position.y + this.playerVelY * dt;
      if (this.playerVelY > 0) {
        const ceilingY = checkWorldCeilingY(p.position.x, p.position.z, proposedY, 1.78);
        if (ceilingY !== null && proposedY + 1.78 > ceilingY) {
          p.position.y = Math.max(0, ceilingY - 1.79);
          this.playerVelY = 0;
        } else {
          p.position.y = proposedY;
        }
      } else {
        p.position.y = proposedY;
      }

      const landFloor = sampleWorldFloorY(p.position.x, p.position.z, p.position.y + 0.15, 0.85);
      if (landFloor > -2 && p.position.y <= landFloor) {
        p.position.y = landFloor;
        this.playerVelY = 0;
        this.isGrounded = true;
      } else if (!this.isTrainingMatch && p.position.y <= 0) {
        p.position.y = 0;
        this.playerVelY = 0;
        this.isGrounded = true;
      }
    } else if (sampledFloor > -2) {
      if (sampledFloor < p.position.y - 0.14) {
        // Stepped off a ledge or terrace -> fall smoothly under gravity
        this.isGrounded = false;
      } else {
        p.position.y = sampledFloor;
        if (this.isTrainingMatch && sampledFloor >= 2.0) {
          this.lastSafeGroundPos.set(p.position.x, sampledFloor, p.position.z);
        }
      }
    } else if (this.isTrainingMatch) {
      this.isGrounded = false;
    } else {
      p.position.y = 0;
    }

    // Safety sea-fall respawn in Training Island so players never get stranded in water
    if (this.isTrainingMatch && p.position.y < 1.5) {
      const safe = this.lastSafeGroundPos.y >= 2.0 ? this.lastSafeGroundPos : TRAINING_ZONES[0];
      p.position.set(safe.x, safe.y, safe.z);
      this.playerVelY = 0;
      this.isGrounded = true;
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
      soundEngine.playWeaponReload(p.weapon.id);
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

    if (!Number.isFinite(p.reloadTimer)) p.reloadTimer = 0;
    if (!Number.isFinite(p.shootCooldown)) p.shootCooldown = 0;
    if (p.shootCooldown > 0) p.shootCooldown = Math.max(0, p.shootCooldown - dt);

    // Replenish mag / reserve ammo in Training Area
    if (this.isTrainingMatch && !p.weapon.isMelee) {
      if (this.trainingState.infiniteMag && p.ammoInMag === 0) {
        p.ammoInMag = p.weapon.magazineSize;
        p.reserveAmmo = Math.max(p.weapon.magazineSize, p.weapon.reserveAmmo);
        this.callbacks.onWeaponUpdate(p.weapon, p.ammoInMag, p.reserveAmmo, false, p.activeSlot);
      } else if (p.reserveAmmo <= 0) {
        p.reserveAmmo = Math.max(p.weapon.magazineSize, p.weapon.reserveAmmo);
      }
    }

    // 7. Mobile Aim Assist & Auto-Fire Assistance
    let autoFireTrigger = false;
    if (this.input.isMobile && (this.settings.aimAssistMobile || this.settings.autoFireMobile) && this.roundPhase !== 'BUY_PHASE') {
      autoFireTrigger = this.evaluateMobileAimAndAutoFire(dt);
    }

    if (this.meleeSlashTimer > 0) this.meleeSlashTimer = Math.max(0, this.meleeSlashTimer - dt);

    // 8. Firing & Melee Slash Logic
    const wantsToFire = this.input.state.fireHeld || this.input.state.fireJustPressed || autoFireTrigger;
    if (wantsToFire && p.shootCooldown <= 0 && p.reloadTimer <= 0) {
      if (p.weapon.isMelee) {
        p.shootCooldown = 1 / Math.max(0.5, p.weapon.fireRate);
        this.meleeSlashTimer = 0.24;
        this.vmRecoilZ = -0.11;
        this.vmRecoilPitch = -0.35;
        this.camera.getWorldDirection(_vec3_2);
        this.fireMeleeSlash(p, _vec3_2);
      } else if (this.roundPhase === 'BUY_PHASE') {
        if (this.input.state.fireJustPressed) {
          p.shootCooldown = 0.16;
          soundEngine.playHitmarker(false);
        }
      } else if (p.ammoInMag > 0) {
        const fireRateMult = (hasStim ? 1.25 : 1.0) * (this.playerOverdriveTimer > 0 ? 1.3 : 1.0);
        if (!(this.isTrainingMatch && this.trainingState.infiniteMag)) {
          p.ammoInMag--;
        }
        p.shootCooldown = 1 / Math.max(0.5, p.weapon.fireRate * fireRateMult);
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
      } else if (p.reserveAmmo > 0) {
        p.reloadTimer = p.weapon.reloadTime / reloadSpeedMult;
        soundEngine.playWeaponReload(p.weapon.id);
        this.callbacks.onWeaponUpdate(p.weapon, p.ammoInMag, p.reserveAmmo, true, p.activeSlot);
      }
    }

    // Dynamic reticle bloom telemetry for HUD
    const moveBloom = isMoving ? (this.input.state.crouchHeld ? 2.5 : 6.0) : 0;
    const airBloom = !this.isGrounded ? 10.0 : 0;
    const recoilBloom = Math.min(12.0, this.vmRecoilZ * 95);
    const adsFactor = this.input.state.adsHeld && p.weapon.canADS ? 0.3 : 1.0;
    const totalBloom = Number(((moveBloom + airBloom + recoilBloom) * adsFactor).toFixed(1));
    if (Math.abs(totalBloom - this.lastSpreadBloomPx) > 0.3) {
      this.lastSpreadBloomPx = totalBloom;
      this.callbacks.onCrosshairBloomUpdate?.(totalBloom);
    }

    if (!this.isTdmMatch) {
      this.updatePlayerSpikeActions(dt);
    }
    this.updatePlayerAbilities();

    // Stream live multiplayer player transform at 20 Hz
    if (this.customRoom) {
      this.syncAccumTimer += dt;
      if (this.syncAccumTimer >= 0.05) {
        this.syncAccumTimer = 0;
        const uname = multiplayerClient.getCachedUsername();
        if (uname) {
          multiplayerClient.sendPlayerSync({
            username: uname,
            team: p.team,
            agentId: p.agentId,
            x: Number(p.position.x.toFixed(3)),
            y: Number(p.position.y.toFixed(3)),
            z: Number(p.position.z.toFixed(3)),
            yaw: Number(p.yaw.toFixed(3)),
            pitch: Number(p.pitch.toFixed(3)),
            crouch: Boolean(p.isCrouching),
            weaponId: p.weapon.id,
            hp: p.hp,
            armor: p.armor,
            alive: p.alive,
          });
        }
      }
    }
  }

  private updateSpectator(dt: number): void {
    const p = this.playerCombatant;
    this.viewmodelRig.visible = false;

    // Training Area & Warehouse TDM auto-respawn countdown
    if (this.isTrainingMatch || this.isTdmMatch) {
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
          const wallHit = raycastMapAABBs(
            _vec3_1.x,
            _vec3_1.y,
            _vec3_1.z,
            _vec3_3.x,
            _vec3_3.y,
            _vec3_3.z,
            desiredDist,
            true
          );
          if (wallHit && wallHit.distance < desiredDist) {
            const safeDist = Math.max(0.55, wallHit.distance - 0.3);
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
        const wallHit = raycastMapAABBs(
          _vec3_1.x,
          _vec3_1.y,
          _vec3_1.z,
          _vec3_3.x,
          _vec3_3.y,
          _vec3_3.z,
          dist,
          true
        );
        if (wallHit && wallHit.distance < dist) {
          _vec3_2.copy(_vec3_1).addScaledVector(_vec3_3, Math.max(0.8, wallHit.distance - 0.35));
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
    const spawnPos = this.getSpawnSlotPosition(p.team, 2);
    p.alive = true;
    p.hp = 100;
    p.armor = this.isTdmMatch ? 25 : 0;
    p.deathTimer = 0;
    p.position.copy(spawnPos);
    this.playerVelY = 0;
    this.isGrounded = true;
    p.yaw = p.team === 'ATTACKERS' ? Math.PI : 0;
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
    if (this.isTdmMatch) {
      this.tdmRespawnBuyWindow = 5.0;
    }

    const stats = this.playerStats.find((s) => s.id === p.id);
    if (stats) {
      stats.alive = true;
      stats.hp = 100;
      stats.armor = p.armor;
    }

    this.camera.position.set(p.position.x, p.position.y + 1.65, p.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = p.yaw;
    this.camera.rotation.x = 0;

    this.callbacks.onSpectateUpdate?.(null);
    this.callbacks.onPlayerHealthUpdate(100, p.armor, 100, 50);
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
    const respawnSec =
      this.isTrainingMatch || this.isTdmMatch ? Math.ceil(this.practiceRespawnTimer) : 0;

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
          const wallHit = raycastMapAABBs(
            this.camera.position.x,
            this.camera.position.y,
            this.camera.position.z,
            _vec3_3.x,
            _vec3_3.y,
            _vec3_3.z,
            dist,
            false
          );
          if (wallHit && wallHit.distance < dist - 0.35) {
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
        const wallHit = raycastMapAABBs(
          this.camera.position.x,
          this.camera.position.y,
          this.camera.position.z,
          _vec3_2.x,
          _vec3_2.y,
          _vec3_2.z,
          enemyDist,
          false
        );
        const wallDist = wallHit ? wallHit.distance : Infinity;
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
    if (this.roundPhase === 'BUY_PHASE' && !this.isTrainingMatch) {
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
    if (this.isTdmMatch) return;
    const p = this.playerCombatant;

    const distA = Math.hypot(p.position.x - BOMB_SITE_A.x, p.position.z - BOMB_SITE_A.z);
    const distB = Math.hypot(p.position.x - BOMB_SITE_B.x, p.position.z - BOMB_SITE_B.z);
    const inSiteA = distA < BOMB_SITE_A.radius && Math.abs(p.position.y - (BOMB_SITE_A.y || 0)) < 3.8;
    const inSiteB = distB < BOMB_SITE_B.radius && Math.abs(p.position.y - (BOMB_SITE_B.y || 0)) < 3.8;

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
          soundEngine.playAnnouncer('spikePlanted');

          const ultSlot = this.abilitySlots.X;
          if (ultSlot) {
            ultSlot.ultPoints = Math.min(ultSlot.ultRequired, ultSlot.ultPoints + 1);
            this.emitAbilityStates();
          }

          if (this.isTrainingMatch && this.trainingState.drillMode === 'PLANT_DRILL') {
            this.trainingState.trialKills++;
            this.trainingState.spikeObjectiveLabel = 'SITE SECURED · PLANT COMPLETE';
            this.trainingState.spikeObjectiveActive = false;
            this.callbacks.onTrainingUpdate?.({ ...this.trainingState });
            window.setTimeout(() => {
              if (!this.isDestroyed && this.isTrainingMatch && this.trainingState.drillMode === 'PLANT_DRILL') {
                this.setupSpikeTrainingDrill('PLANT_DRILL');
              }
            }, 1400);
          } else {
            const siteKey = inSiteA ? 'A' : 'B';
            if (this.customRoom) {
              multiplayerClient.sendSpikeEvent('PLANTED', siteKey, [
                this.spikePosition.x,
                this.spikePosition.y,
                this.spikePosition.z,
              ]);
            }
            for (const ctrl of this.botControllers) {
              ctrl.planRound(true, this.plantedSite, siteKey);
            }
          }
        }
      } else {
        p.isPlanting = false;
        p.actionProgress = 0;
      }
    }

    const canDefuseNow =
      (p.team === 'DEFENDERS' || (this.isTrainingMatch && this.trainingState.drillMode === 'DEFUSE_DRILL')) &&
      this.spikeState === 'planted' &&
      this.spikePosition;
    if (canDefuseNow && this.spikePosition) {
      const distToSpike = Math.hypot(p.position.x - this.spikePosition.x, p.position.z - this.spikePosition.z);
      const dy = Math.abs(p.position.y - this.spikePosition.y);
      if (distToSpike < 2.8 && dy < 3.2 && this.input.state.plantDefuseHeld) {
        p.isDefusing = true;
        p.actionProgress += dt / SPIKE_DEFUSE_DURATION;

        if (p.actionProgress >= 1.0) {
          this.spikeState = 'defused';
          p.isDefusing = false;
          p.actionProgress = 0;
          soundEngine.playSpikeDefused();
          soundEngine.playAnnouncer('spikeDefused');

          if (this.isTrainingMatch) {
            this.trainingState.trialKills++;
            this.trainingState.spikeObjectiveActive = false;
            this.trainingState.spikeObjectiveLabel = 'SPIKE DEFUSED · DRILL CLEARED';
            this.callbacks.onTrainingUpdate?.({ ...this.trainingState });
            window.setTimeout(() => {
              if (!this.isDestroyed && this.isTrainingMatch && this.trainingState.drillMode === 'DEFUSE_DRILL') {
                this.setupSpikeTrainingDrill('DEFUSE_DRILL');
              }
            }, 1400);
          } else {
            if (this.customRoom) {
              multiplayerClient.sendSpikeEvent('DEFUSED', this.plantedSite, [0, 0, 0]);
            }
            this.endRound('DEFENDERS', 'SPIKE_DEFUSED');
          }
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
    const hit = raycastMapAABBs(
      this.camera.position.x,
      this.camera.position.y,
      this.camera.position.z,
      _vec3_4.x,
      _vec3_4.y,
      _vec3_4.z,
      maxRange,
      true
    );
    if (hit && hit.distance < maxRange) {
      return _vec3_5.set(hit.x, hit.y, hit.z);
    }
    return _vec3_5.copy(this.playerCombatant.position).addScaledVector(_vec3_4, maxRange);
  }

  private performSteppedDash(distanceSteps: number, stepLength: number, lowGravityHang = false): void {
    const p = this.playerCombatant;
    this.camera.getWorldDirection(_vec3_2);
    _vec3_2.y = 0;
    if (_vec3_2.lengthSq() > 0.0001) _vec3_2.normalize();
    else _vec3_2.set(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));

    for (let step = 0; step < distanceSteps; step++) {
      const nx = p.position.x + _vec3_2.x * stepLength;
      const nz = p.position.z + _vec3_2.z * stepLength;
      if (this.abilityMgr.isBlockedByBarrier(nx, nz, 0.38)) {
        break;
      }
      const res = resolveWorldMovement(nx, nz, p.position.y, 0.36);
      p.position.x = res.x;
      p.position.z = res.z;
      const fy = sampleWorldFloorY(p.position.x, p.position.z, p.position.y, 0.72);
      if (fy > -2 && fy >= p.position.y - 0.5) {
        p.position.y = fy;
      }
      if (res.collided) break;
    }
    if (lowGravityHang) {
      this.playerVelY = 4.6;
      this.isGrounded = false;
    }
    soundEngine.playAbility('DASH');
    this.cameraShakeTrauma = Math.min(1.0, this.cameraShakeTrauma + 0.22);
  }

  private updatePlayerAbilities(): void {
    const p = this.playerCombatant;
    this.camera.getWorldDirection(_vec3_1);

    // [E] Signature Ability
    if (this.input.state.abilityEJustPressed && this.tryConsumeAbility('E')) {
      if (p.agentId === 'KAEL') {
        this.performSteppedDash(12, 0.65, true);
      } else if (p.agentId === 'ZED') {
        this.performSteppedDash(13, 0.65, false);
        for (const c of this.combatants) {
          if (c.alive && c.team !== p.team && c.position.distanceTo(p.position) <= 2.6) {
            this.applyExternalDamage(c, 35, 'Blink Slash');
            this.vmEquipOffset = 0;
            this.vmEquipRoll = 0;
          }
        }
      } else if (p.agentId === 'KORA') {
        const pt = this.findTargetPointAhead(15);
        this.abilityMgr.deploySmoke(pt.x, pt.y, pt.z, 14);
      } else if (p.agentId === 'SOREN') {
        const pt = this.findTargetPointAhead(16);
        this.abilityMgr.triggerReconPulse(pt.x, pt.y, pt.z, p.team, this.combatants, 18);
        for (const c of this.combatants) {
          if (!c.alive || c.team === p.team) continue;
          const dist = c.position.distanceTo(p.position);
          if (dist < 22) {
            _vec3_3.subVectors(c.position, p.position).setY(0).normalize();
            if (_vec3_3.dot(_vec3_1) > 0.72) {
              this.abilityMgr.slowedCombatantIds.set(c.id, 3.0);
              this.applyExternalDamage(c, 22, 'Prism Beam');
            }
          }
        }
        this.cameraShakeTrauma = Math.min(1.0, this.cameraShakeTrauma + 0.25);
      } else if (p.agentId === 'PULSE') {
        const pt = this.findTargetPointAhead(14);
        this.abilityMgr.triggerReconPulse(pt.x, pt.y, pt.z, p.team, this.combatants, 26);
      } else if (p.agentId === 'AEGIS') {
        const pt = this.findTargetPointAhead(5);
        this.abilityMgr.deployBarrier(pt.x, pt.y, pt.z, p.yaw, 20, 5.6);
      } else if (p.agentId === 'ROOK') {
        const pt = this.findTargetPointAhead(4.5);
        this.abilityMgr.deployTurret(pt.x, pt.z, p.yaw, p.team, pt.y);
      }
    }

    // [Q] Basic Ability 1
    if (this.input.state.abilityQJustPressed && this.tryConsumeAbility('Q')) {
      if (p.agentId === 'KAEL') {
        const pt = this.findTargetPointAhead(12);
        this.abilityMgr.deployZone('GRAVITY', pt.x, pt.z, 4.6, 5.5, p.team, pt.y);
      } else if (p.agentId === 'ZED') {
        const pt = this.findTargetPointAhead(13);
        this.abilityMgr.triggerReconPulse(pt.x, pt.y, pt.z, p.team, this.combatants, 14);
        for (const c of this.combatants) {
          if (c.alive && c.team !== p.team && c.position.distanceTo(pt) < 4.5) {
            this.applyExternalDamage(c, 30, 'Ricochet Shuriken');
            break;
          }
        }
      } else if (p.agentId === 'KORA') {
        const pt = this.findTargetPointAhead(13);
        this.abilityMgr.deployZone('GRAVITY', pt.x, pt.z, 4.8, 5.0, p.team, pt.y);
      } else if (p.agentId === 'SOREN' || p.agentId === 'PULSE') {
        this.abilityMgr.throwFlashOrb(
          this.camera.position.x,
          this.camera.position.y - 0.1,
          this.camera.position.z,
          _vec3_1,
          p.team
        );
      } else if (p.agentId === 'AEGIS') {
        const pt = this.findTargetPointAhead(7);
        this.abilityMgr.deployZone('LOCKDOWN', pt.x, pt.z, 4.0, 12.0, p.team, pt.y);
      } else if (p.agentId === 'ROOK') {
        const pt = this.findTargetPointAhead(6.5);
        this.abilityMgr.deployZone('LOCKDOWN', pt.x, pt.z, 3.8, 14.0, p.team, pt.y);
        this.abilityMgr.deployZone('TOXIN', pt.x, pt.z, 2.8, 5.0, p.team, pt.y);
      }
    }

    // [C] Basic Ability 2
    if (this.input.state.abilityCJustPressed && this.tryConsumeAbility('C')) {
      if (p.agentId === 'KAEL') {
        if (
          this.phaseAnchor &&
          !checkCollision(this.phaseAnchor.pos.x, this.phaseAnchor.pos.z, 0.36, this.phaseAnchor.pos.y).collided
        ) {
          p.position.copy(this.phaseAnchor.pos);
          this.playerVelY = 0;
          this.isGrounded = true;
          this.phaseAnchor = null;
          soundEngine.playAbility('DASH');
        } else {
          this.phaseAnchor = { pos: p.position.clone(), timer: 10.0 };
          soundEngine.playAbility('HEAL');
        }
      } else if (p.agentId === 'ZED') {
        const pt = this.findTargetPointAhead(10);
        this.abilityMgr.deploySmoke(pt.x, pt.y, pt.z, 10);
      } else if (p.agentId === 'KORA') {
        this.abilityMgr.throwFlashOrb(
          this.camera.position.x,
          this.camera.position.y - 0.1,
          this.camera.position.z,
          _vec3_1,
          p.team
        );
      } else if (p.agentId === 'SOREN') {
        this.abilityMgr.deployZone('STIM', p.position.x, p.position.z, 5.5, 9.0, p.team, p.position.y);
        this.abilityMgr.triggerReconPulse(p.position.x, p.position.y, p.position.z, p.team, this.combatants, 14);
      } else if (p.agentId === 'PULSE') {
        const pt = this.findTargetPointAhead(5.5);
        this.abilityMgr.deployTurret(pt.x, pt.z, p.yaw, p.team, pt.y);
        this.abilityMgr.triggerReconPulse(pt.x, pt.y, pt.z, p.team, this.combatants, 18);
      } else if (p.agentId === 'AEGIS') {
        this.abilityMgr.deployZone('HEAL', p.position.x, p.position.z, 5.8, 8.0, p.team, p.position.y);
        p.hp = Math.min(100, p.hp + 25);
        p.armor = Math.min(50, p.armor + 15);
        const st = this.playerStats.find((s) => s.id === p.id);
        if (st) {
          st.hp = p.hp;
          st.armor = p.armor;
        }
        this.callbacks.onPlayerHealthUpdate(p.hp, p.armor, 100, 50);
      } else if (p.agentId === 'ROOK') {
        const pt = this.findTargetPointAhead(8);
        for (const c of this.combatants) {
          if (c.alive && c.team !== p.team && c.position.distanceTo(pt) < 5.0) {
            this.applyExternalDamage(c, 40, 'Blast Pack');
            this.abilityMgr.slowedCombatantIds.set(c.id, 2.0);
          }
        }
        this.abilityMgr.barriers.forEach((b) => {
          if (b.position.distanceTo(pt) < 5.5) b.hp -= 250;
        });
        soundEngine.playAbility('FLASH');
        this.cameraShakeTrauma = Math.min(1.0, this.cameraShakeTrauma + 0.35);
      }
    }

    // [X] Ultimate Ability
    if (this.input.state.abilityXJustPressed && this.tryConsumeAbility('X')) {
      if (p.agentId === 'KAEL') {
        const pt = this.findTargetPointAhead(15);
        this.abilityMgr.deployZone('GRAVITY', pt.x, pt.z, 7.5, 8.0, p.team, pt.y);
        this.abilityMgr.deployZone('BLACKOUT', pt.x, pt.z, 7.5, 8.0, p.team, pt.y);
        this.cameraShakeTrauma = 0.7;
      } else if (p.agentId === 'ZED') {
        this.playerOverdriveTimer = 12.0;
        this.abilitySlots.X.activeRemaining = 12.0;
        soundEngine.playAbility('ULT');
        this.cameraShakeTrauma = 0.65;
        this.emitAbilityStates();
      } else if (p.agentId === 'KORA') {
        const pt = this.findTargetPointAhead(7);
        this.abilityMgr.deployBarrier(pt.x, pt.y, pt.z, p.yaw, 9.5, 14.0);
        soundEngine.playAbility('ULT');
        this.cameraShakeTrauma = 0.65;
      } else if (p.agentId === 'SOREN') {
        const pt = this.findTargetPointAhead(18);
        this.abilityMgr.deployZone('BLACKOUT', pt.x, pt.z, 7.5, 6.0, p.team, pt.y);
        this.abilityMgr.triggerReconPulse(pt.x, pt.y, pt.z, p.team, this.combatants, 22);
        for (const c of this.combatants) {
          if (c.alive && c.team !== p.team && c.position.distanceTo(pt) < 7.5) {
            this.applyExternalDamage(c, 45, 'Zenith Strike');
          }
        }
        this.cameraShakeTrauma = 0.7;
      } else if (p.agentId === 'PULSE') {
        this.abilityMgr.deployZone('LOCKDOWN', p.position.x, p.position.z, 12.0, 9.0, p.team, p.position.y);
        this.abilityMgr.triggerReconPulse(p.position.x, p.position.y, p.position.z, p.team, this.combatants, 28);
        this.cameraShakeTrauma = 0.7;
      } else if (p.agentId === 'AEGIS') {
        this.abilityMgr.deployZone('HEAL', p.position.x, p.position.z, 8.5, 8.0, p.team, p.position.y);
        const pt = this.findTargetPointAhead(4);
        this.abilityMgr.deployBarrier(pt.x, pt.y, pt.z, p.yaw, 8.0, 8.0);
        p.armor = Math.min(50, p.armor + 25);
        this.callbacks.onPlayerHealthUpdate(p.hp, p.armor, 100, 50);
        soundEngine.playAbility('ULT');
      } else if (p.agentId === 'ROOK') {
        this.abilityMgr.deployZone('LOCKDOWN', p.position.x, p.position.z, 11.0, 10.0, p.team, p.position.y);
        this.cameraShakeTrauma = 0.7;
      }
    }
  }

  private fireTurretShot(origin: THREE.Vector3, dir: THREE.Vector3, team: string): void {
    soundEngine.playWeaponShot('STINGRAY', 'SMG', true, 0.45);
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

    const worldHit = raycastMapAABBs(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, 30, true);
    const worldDist = worldHit ? worldHit.distance : Infinity;

    if (closestTarget && closestPoint && closestDist < worldDist) {
      this.spawnTracer(origin, closestPoint);
      this.applyExternalDamage(closestTarget, 16, 'Sentinel Turret');
    } else if (worldHit) {
      _vec3_3.set(worldHit.x, worldHit.y, worldHit.z);
      this.spawnTracer(origin, _vec3_3);
      this.spawnSparks(_vec3_3);
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

  public fireMeleeSlash(shooter: BotCombatant, dir: THREE.Vector3): void {
    soundEngine.playGunshot('MELEE');
    const origin = shooter.isHuman
      ? _vec3_1.copy(this.camera.position)
      : _vec3_1.copy(shooter.position).add(_vec3_4.set(0, 1.38, 0));

    const maxRange = shooter.weapon.range ?? 2.8;
    _raycaster.set(origin, dir);
    _raycaster.far = maxRange;

    let closestTarget: BotCombatant | null = null;
    let closestZone: 'head' | 'body' | 'leg' = 'body';
    let closestPoint: THREE.Vector3 | null = null;
    let closestDist = Infinity;

    for (const target of this.combatants) {
      if (!target.alive || target.team === shooter.team) continue;
      target.modelPackage.root.updateMatrixWorld(true);
      const hits = _raycaster.intersectObjects(target.modelPackage.hitboxMeshes, false);
      if (hits.length > 0 && hits[0].distance < closestDist) {
        closestDist = hits[0].distance;
        closestZone = (hits[0].object.userData?.hitZone as 'head' | 'body' | 'leg') || 'body';
        closestTarget = target;
        closestPoint = hits[0].point;
      } else {
        // Generous close-quarters slash arc within 2.5m forward cone
        const dist = origin.distanceTo(target.position);
        if (dist <= maxRange - 0.25) {
          _vec3_3.subVectors(target.position, origin).setY(0).normalize();
          if (_vec3_3.dot(dir) > 0.52 && dist < closestDist) {
            closestDist = dist;
            closestZone = 'body';
            closestTarget = target;
            closestPoint = target.position.clone().add(_vec3_4.set(0, 1.2, 0));
          }
        }
      }
    }

    if (closestTarget && closestPoint) {
      this.applyDamage(shooter, closestTarget, closestZone, closestDist);
      this.spawnSparks(closestPoint);
    }
  }

  public fireBullet(shooter: BotCombatant, dir: THREE.Vector3): void {
    if (shooter.weapon.isMelee) {
      this.fireMeleeSlash(shooter, dir);
      return;
    }

    const isSpray = shooter.isHuman && this.vmRecoilZ > 0.02;
    soundEngine.playWeaponShot(shooter.weapon.id, shooter.weapon.category, isSpray, shooter.isHuman ? 0.78 : 0.42);

    const origin = shooter.isHuman
      ? _vec3_1.copy(this.camera.position)
      : _vec3_1.copy(shooter.position).add(_vec3_4.set(0, 1.38, 0));

    if (shooter.isHuman && this.customRoom) {
      multiplayerClient.sendPlayerShoot(
        [origin.x, origin.y, origin.z],
        [dir.x, dir.y, dir.z],
        shooter.weapon.id
      );
    }

    const pellets = Math.max(1, shooter.weapon.pellets ?? 1);
    const pelletSpread = pellets > 1 ? shooter.weapon.spreadBase * 1.15 : 0;

    if (shooter.isHuman) {
      this.getWeaponEntry(shooter.weapon.id).shotsFired++;
      if (this.isTrainingMatch) {
        this.trainingState.shotsFired++;
        this.callbacks.onTrainingUpdate?.({ ...this.trainingState });
      }
    }

    for (let pIdx = 0; pIdx < pellets; pIdx++) {
      const pelletDir = _vec3_5.copy(dir);
      if (pelletSpread > 0) {
        pelletDir.x += (Math.random() - 0.5) * pelletSpread;
        pelletDir.y += (Math.random() - 0.5) * pelletSpread * 0.85;
        pelletDir.z += (Math.random() - 0.5) * pelletSpread;
        pelletDir.normalize();
      }

      _raycaster.set(origin, pelletDir);
      _raycaster.far = shooter.weapon.range && shooter.weapon.category === 'SHOTGUN' ? 42 : 110;

      let closestHit: { combatant: BotCombatant; hitZone: 'head' | 'body' | 'leg'; point: THREE.Vector3 } | null = null;
      let closestDist = Infinity;

      for (const target of this.combatants) {
        if (!target.alive || target.team === shooter.team) continue;

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

      let boardDist = Infinity;
      let boardHitPoint: THREE.Vector3 | null = null;
      let boardMeshHit: THREE.Object3D | null = null;
      if (shooter.isHuman && this.isTrainingMatch && this.trainingTargetBoards.length > 0) {
        const tHits = _raycaster.intersectObjects(this.trainingTargetBoards, false);
        if (tHits.length > 0) {
          boardDist = tHits[0].distance;
          boardHitPoint = tHits[0].point;
          boardMeshHit = tHits[0].object;
        }
      }

      const maxRay = _raycaster.far;
      const worldHit = raycastMapAABBs(
        origin.x,
        origin.y,
        origin.z,
        pelletDir.x,
        pelletDir.y,
        pelletDir.z,
        maxRay,
        true
      );
      const worldDist = worldHit ? worldHit.distance : Infinity;
      const worldPoint = worldHit ? _vec3_4.set(worldHit.x, worldHit.y, worldHit.z) : null;

      if (closestHit && closestDist < worldDist && closestDist < barrierDist && closestDist < boardDist) {
        _vec3_3.copy(closestHit.point);
        this.applyDamage(shooter, closestHit.combatant, closestHit.hitZone, closestDist);
        this.spawnSparks(closestHit.point);
      } else if (boardHitPoint && boardMeshHit && boardDist < worldDist && boardDist < barrierDist) {
        _vec3_3.copy(boardHitPoint);
        this.spawnSparks(boardHitPoint);
        const boardCenter = _vec3_2.setFromMatrixPosition(boardMeshHit.matrixWorld);
        const bullseye = boardHitPoint.distanceTo(boardCenter) < 0.22;
        this.trainingState.shotsHit++;
        if (bullseye) this.trainingState.headshots++;
        soundEngine.playHitmarker(bullseye);
        this.callbacks.onHitmarker(bullseye);
        this.callbacks.onHitFeedback?.({
          active: true,
          isHeadshot: bullseye,
          isKill: false,
          damage: bullseye ? shooter.weapon.damageHead : shooter.weapon.damageBody,
          targetName: `Target ${boardMeshHit.userData?.distanceM ?? ''}m`,
          targetHp: 100,
          targetMaxHp: 100,
        });
        this.callbacks.onTrainingUpdate?.({ ...this.trainingState });
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
        _vec3_3.copy(origin).addScaledVector(pelletDir, 80);
      }

      this.spawnTracer(origin, _vec3_3);
    }
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

    if (shooter.isHuman && victim.isRemoteHuman && this.customRoom) {
      multiplayerClient.sendPlayerHit(victim.name, totalDmg, dmg.isHeadshot, shooter.weapon.name);
    }

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

      if (this.isTrainingMatch) {
        this.trainingState.shotsHit++;
        if (dmg.isHeadshot) this.trainingState.headshots++;
        this.callbacks.onTrainingUpdate?.({ ...this.trainingState });
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
      this.roundPlayerKills++;
      if (!this.isTrainingMatch) {
        if (this.roundPlayerKills === 3) soundEngine.playAnnouncer('tripleKill');
        else if (this.roundPlayerKills === 4) soundEngine.playAnnouncer('quadraKill');
        else if (this.roundPlayerKills >= 5) soundEngine.playAnnouncer('ace');
      } else if (this.trainingState.trialStatus === 'RUNNING') {
        this.trainingState.trialKills++;
        if (this.trainingState.drillMode === 'SPEED_30' && this.trainingState.trialKills >= 30) {
          this.trainingState.trialStatus = 'COMPLETE';
          const elapsed = Number(this.trainingState.trialTimeElapsed.toFixed(2));
          if (this.trainingState.bestSpeedTime === null || elapsed < this.trainingState.bestSpeedTime) {
            this.trainingState.bestSpeedTime = elapsed;
          }
          soundEngine.playRoundEnd(true);
        } else if (this.trainingState.drillMode === 'STREAK_50' && this.trainingState.trialKills >= 50) {
          this.trainingState.trialStatus = 'COMPLETE';
          this.trainingState.bestStreakScore = Math.max(this.trainingState.bestStreakScore, 50);
          soundEngine.playRoundEnd(true);
        } else if (this.trainingState.drillMode === 'STREAK_50') {
          this.trainingState.bestStreakScore = Math.max(this.trainingState.bestStreakScore, this.trainingState.trialKills);
        }
        this.callbacks.onTrainingUpdate?.({ ...this.trainingState });
      }
      const ultSlot = this.abilitySlots.X;
      if (ultSlot && ultSlot.ultPoints < ultSlot.ultRequired) {
        ultSlot.ultPoints++;
        this.emitAbilityStates();
      }
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

    // Warehouse 1v1/2v2 TDM kill-limit scoring & instant win check
    if (this.isTdmMatch && this.roundPhase !== 'MATCH_OVER') {
      if (victim.team === 'DEFENDERS') {
        this.tdmAttackerKills++;
      } else {
        this.tdmDefenderKills++;
      }
      this.attackerRoundsWon = this.tdmAttackerKills;
      this.defenderRoundsWon = this.tdmDefenderKills;
      this.callbacks.onRoundScoreChange(this.tdmAttackerKills, this.tdmDefenderKills, this.roundNumber);
      this.callbacks.onTdmScoreUpdate?.(this.tdmAttackerKills, this.tdmDefenderKills, this.tdmKillTarget);

      const tdmWinner = checkTdmMatchWin(this.tdmAttackerKills, this.tdmDefenderKills, this.tdmKillTarget);
      if (tdmWinner) {
        this.roundPhase = 'MATCH_OVER';
        const won = tdmWinner === this.playerTeam;
        soundEngine.playRoundEnd(won);
        if (won) soundEngine.playAnnouncer('victory');
        this.callbacks.onMatchOver(tdmWinner, this.getMatchSummary(won));
        return;
      }
    }

    if (victim.hasSpike && !this.isTdmMatch && !this.isTrainingMatch) {
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

      if (this.isTrainingMatch || this.isTdmMatch) {
        this.practiceRespawnTimer = this.isTdmMatch ? 2.2 : 2.5;
        if (this.isTrainingMatch && this.trainingState.drillMode === 'STREAK_50' && this.trainingState.trialStatus === 'RUNNING') {
          this.trainingState.trialStatus = 'COMPLETE';
          this.callbacks.onTrainingUpdate?.({ ...this.trainingState });
        }
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
    this.vmEquipOffset = THREE.MathUtils.damp(this.vmEquipOffset, 0, 12, dt);
    this.vmEquipRoll = THREE.MathUtils.damp(this.vmEquipRoll, 0, 12, dt);
    this.vmSwayX = THREE.MathUtils.damp(this.vmSwayX, 0, 12, dt);
    this.vmSwayY = THREE.MathUtils.damp(this.vmSwayY, 0, 12, dt);
    this.vmLandOffset = THREE.MathUtils.damp(this.vmLandOffset, 0, 14, dt);

    if (this.cameraShakeTrauma > 0) {
      const shake = this.cameraShakeTrauma * this.cameraShakeTrauma * 0.08;
      this.camera.rotation.z = (Math.random() - 0.5) * shake + this.vmStrafeRoll * 0.25;
      this.camera.position.x += (Math.random() - 0.5) * shake * 0.5;
      this.camera.position.y += (Math.random() - 0.5) * shake * 0.5;
      this.cameraShakeTrauma = Math.max(0, this.cameraShakeTrauma - dt * 2.5);
    } else {
      this.camera.rotation.z = this.vmStrafeRoll * 0.25;
    }

    if (this.viewmodelWeapon) {
      const p = this.playerCombatant;
      const isADS = this.input.state.adsHeld && p.weapon.canADS;
      const profile = getWeaponViewmodelProfile(p.weapon.id);

      if (isADS) {
        _vmTargetPos.set(...profile.adsPos);
      } else {
        _vmTargetPos.set(...profile.hipPos);
      }

      // Multi-phase tactical reload (0..0.3 drop & tilt, 0.3..0.65 mag seat pulse, 0.65..1.0 bolt rack)
      const isReloading = p.reloadTimer > 0;
      const reloadProgress = isReloading ? 1 - p.reloadTimer / Math.max(0.2, p.weapon.reloadTime) : 0;
      const reloadWave = isReloading ? Math.sin(reloadProgress * Math.PI) : 0;
      const magTapPulse =
        isReloading && reloadProgress > 0.35 && reloadProgress < 0.62
          ? Math.sin(((reloadProgress - 0.35) / 0.27) * Math.PI) * 0.032
          : 0;
      const boltRackPull =
        isReloading && reloadProgress > 0.68 && reloadProgress < 0.88
          ? Math.sin(((reloadProgress - 0.68) / 0.2) * Math.PI) * 0.04
          : 0;
      const reloadDip = -0.14 * reloadWave + magTapPulse;
      const reloadTilt = 0.52 * reloadWave;

      // Weapon Inspect showcase [Y]
      const inspectNorm = this.vmInspectTimer > 0 ? Math.sin((1 - this.vmInspectTimer / 2.6) * Math.PI) : 0;
      const inspectShiftX = -0.09 * inspectNorm;
      const inspectShiftY = 0.055 * inspectNorm;
      const inspectYaw = inspectNorm * 0.85;
      const inspectRoll = inspectNorm * 0.55;
      const inspectPitch = inspectNorm * 0.14;

      // Movement figure-8 bob, crouch shift, & idle breathe
      const speed = Math.hypot(p.velocity.x, p.velocity.z);
      const moveWeight = Math.min(1, speed / 5.4);
      const adsDamp = isADS ? 0.3 : 1.0;
      const crouchRoll = this.input.state.crouchHeld && !isADS ? -0.14 : 0;
      const crouchShiftY = this.input.state.crouchHeld && !isADS ? -0.025 : 0;
      const walkBobX = Math.cos(this.vmWalkPhase * 0.5) * 0.015 * moveWeight * adsDamp;
      const walkBobY = Math.abs(Math.sin(this.vmWalkPhase)) * 0.016 * moveWeight * adsDamp;
      const breath = Math.sin(performance.now() * 0.0024) * 0.0045 * adsDamp;

      _vmTargetPos.x += walkBobX + this.vmSwayX * adsDamp + inspectShiftX;
      _vmTargetPos.y += breath - walkBobY + this.vmEquipOffset + reloadDip + this.vmLandOffset + this.vmSwayY * adsDamp + crouchShiftY + inspectShiftY;
      _vmTargetPos.z += this.vmRecoilZ + boltRackPull;

      this.viewmodelWeapon.position.x = THREE.MathUtils.damp(this.viewmodelWeapon.position.x, _vmTargetPos.x, 18, dt);
      this.viewmodelWeapon.position.y = THREE.MathUtils.damp(this.viewmodelWeapon.position.y, _vmTargetPos.y, 18, dt);
      this.viewmodelWeapon.position.z = THREE.MathUtils.damp(this.viewmodelWeapon.position.z, _vmTargetPos.z, 18, dt);

      this.viewmodelWeapon.rotation.x = THREE.MathUtils.damp(
        this.viewmodelWeapon.rotation.x,
        this.vmRecoilPitch - reloadTilt - this.vmSwayY * 0.7 + inspectPitch,
        16,
        dt
      );
      this.viewmodelWeapon.rotation.y = THREE.MathUtils.damp(
        this.viewmodelWeapon.rotation.y,
        -this.vmSwayX * 0.9 + inspectYaw,
        14,
        dt
      );
      this.viewmodelWeapon.rotation.z = THREE.MathUtils.damp(
        this.viewmodelWeapon.rotation.z,
        reloadWave * 0.36 - this.vmSwayX * 0.55 + this.vmEquipRoll + this.vmStrafeRoll + crouchRoll + inspectRoll,
        14,
        dt
      );

      // Sync arms smoothly with weapon grip offsets & animations
      const basePos = isADS ? profile.adsPos : profile.hipPos;
      this.viewmodelArms.position.x = THREE.MathUtils.damp(
        this.viewmodelArms.position.x,
        basePos[0] - 0.015 + this.vmSwayX * 0.65 + inspectShiftX * 0.5,
        16,
        dt
      );
      this.viewmodelArms.position.y = THREE.MathUtils.damp(
        this.viewmodelArms.position.y,
        basePos[1] + 0.012 + this.vmEquipOffset * 0.65 + reloadDip * 0.55 + this.vmLandOffset * 0.75 + crouchShiftY * 0.7,
        16,
        dt
      );
      this.viewmodelArms.position.z = THREE.MathUtils.damp(
        this.viewmodelArms.position.z,
        basePos[2] + 0.14 + this.vmRecoilZ * 0.65 + boltRackPull * 0.8,
        18,
        dt
      );
      this.viewmodelArms.rotation.z = THREE.MathUtils.damp(
        this.viewmodelArms.rotation.z,
        this.vmStrafeRoll * 0.8 + crouchRoll * 0.6 + inspectRoll * 0.35,
        14,
        dt
      );

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

    const winnerTeam = checkMatchWin(this.attackerRoundsWon, this.defenderRoundsWon);
    if (this.matchMode !== 'PRACTICE') {
      const winners = this.combatants.filter((c) => c.team === winner);
      const aliveWinners = winners.filter((c) => c.alive);
      const losers = this.combatants.filter((c) => c.team !== winner);
      const deadLosers = losers.filter((c) => !c.alive);
      let event: AnnouncerEvent = winner === 'ATTACKERS' ? 'attackersWin' : 'defendersWin';
      if (winnerTeam && winnerTeam === this.playerTeam) {
        event = 'victory';
      } else if (winners.length >= 2 && aliveWinners.length === winners.length) {
        event = 'flawless';
      } else if (aliveWinners.length === 1 && deadLosers.length >= 2) {
        event = 'clutch';
      }
      soundEngine.playAnnouncer(event);
    }

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

    if (winnerTeam) {
      this.roundPhase = 'MATCH_OVER';
      this.callbacks.onMatchOver(winnerTeam, this.getMatchSummary(winnerTeam === this.playerTeam));
    }

    if (this.customRoom && multiplayerClient.username === this.customRoom.hostUsername) {
      multiplayerClient.sendRoundSync(
        this.roundPhase,
        this.attackerRoundsWon,
        this.defenderRoundsWon,
        this.roundNumber
      );
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
    this.roundPlayerKills = 0;
    this.playedTenSecondsAudio = false;
    this.phaseAnchor = null;

    if (this.spikeMesh) {
      this.scene.remove(this.spikeMesh);
      this.spikeMesh = null;
    }

    this.abilityMgr.clearAll();

    // Refresh non-ult ability charges between rounds & grant +1 ult orb per round played
    const agent = AGENT_REGISTRY[this.playerCombatant.agentId] || AGENT_REGISTRY.KAEL;
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

    const roundSlotOrder: Record<TeamSide, number[]> = {
      ATTACKERS: [0, 1, 3, 4],
      DEFENDERS: [0, 1, 3, 4],
    };
    const roundSlotCursor: Record<TeamSide, number> = {
      ATTACKERS: 0,
      DEFENDERS: 0,
    };

    const firstAttackerId = this.combatants.find((x) => x.team === 'ATTACKERS')?.id ?? null;

    this.combatants.forEach((c) => {
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
      const slotIdx = c.isHuman
        ? 2
        : roundSlotOrder[c.team][roundSlotCursor[c.team]++ % roundSlotOrder[c.team].length];
      const spawnPos = this.getSpawnSlotPosition(c.team, slotIdx);
      const spawnYaw = isAttacker ? Math.PI : 0;

      c.position.copy(spawnPos);
      c.yaw = spawnYaw;
      c.pitch = 0;

      // Smart AI bots dynamically buy from the full 18-weapon arsenal based on economy & agent role
      if (!c.isHuman && !c.isRemoteHuman) {
        c.armor = this.roundNumber >= 2 ? 25 : 0;
        const botStats = this.playerStats.find((s) => s.id === c.id);
        if (botStats) {
          const buy = pickBotPurchase(botStats.credits, this.roundNumber, this.botDifficulty, c.agentId);
          if (buy && WEAPON_REGISTRY[buy.weaponId]) {
            const w = WEAPON_REGISTRY[buy.weaponId];
            botStats.credits -= buy.cost;
            if (buy.isSidearm) {
              c.sidearmWeapon = w;
              c.sidearmAmmoInMag = w.magazineSize;
              c.sidearmReserveAmmo = w.reserveAmmo;
              if (!c.primaryWeapon) {
                c.weapon = w;
                c.activeSlot = 2;
              }
            } else {
              c.primaryWeapon = w;
              c.primaryAmmoInMag = w.magazineSize;
              c.primaryReserveAmmo = w.reserveAmmo;
              c.weapon = w;
              c.activeSlot = 1;
            }
          }
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

      c.hasSpike = isAttacker && c.id === firstAttackerId;
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

    this.camera.position.set(
      this.playerCombatant.position.x,
      this.playerCombatant.position.y + 1.65,
      this.playerCombatant.position.z
    );
    this.camera.rotation.y = this.playerCombatant.yaw;
    this.camera.rotation.x = 0;
    this.camera.updateMatrixWorld(true);

    if (this.customRoom && multiplayerClient.username === this.customRoom.hostUsername) {
      multiplayerClient.sendRoundSync(
        this.roundPhase,
        this.attackerRoundsWon,
        this.defenderRoundsWon,
        this.roundNumber
      );
    }
  }

  public buyItem(itemId: string): boolean {
    const p = this.playerCombatant;
    const canBuyNow =
      this.roundPhase === 'BUY_PHASE' ||
      this.isTrainingMatch ||
      (this.isTdmMatch && p.alive);
    if (!canBuyNow) return false;

    const stats = this.playerStats[0];
    const freeArmory = this.isTrainingMatch || this.isTdmMatch;

    if (WEAPON_REGISTRY[itemId]) {
      const w = WEAPON_REGISTRY[itemId];
      const effectiveCost = freeArmory ? 0 : w.cost;
      if (stats.credits >= effectiveCost) {
        stats.credits = freeArmory ? stats.credits : stats.credits - effectiveCost;
        if (w.category === 'SIDEARM') {
          p.sidearmWeapon = w;
          p.sidearmAmmoInMag = w.magazineSize;
          p.sidearmReserveAmmo = w.reserveAmmo;
          p.activeSlot = 2;
        } else if (w.isMelee) {
          p.meleeWeapon = w;
          p.activeSlot = 3;
        } else {
          p.primaryWeapon = w;
          p.primaryAmmoInMag = w.magazineSize;
          p.primaryReserveAmmo = w.reserveAmmo;
          p.activeSlot = 1;
        }
        p.weapon = w;
        p.ammoInMag = w.isMelee ? 1 : w.magazineSize;
        p.reserveAmmo = w.isMelee ? 0 : w.reserveAmmo;
        p.reloadTimer = 0;
        this.updateViewmodelWeapon(w.id);
        soundEngine.playWeaponReload(w.id);
        this.callbacks.onWeaponUpdate(w, p.ammoInMag, p.reserveAmmo, false, p.activeSlot);
        this.callbacks.onStatsUpdate([...this.playerStats]);
        return true;
      }
    }

    if (SHIELD_REGISTRY[itemId]) {
      const s = SHIELD_REGISTRY[itemId];
      const effectiveCost = freeArmory ? 0 : s.cost;
      if (stats.credits >= effectiveCost && p.armor < s.armorPoints) {
        stats.credits = freeArmory ? stats.credits : stats.credits - effectiveCost;
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

  private handleIncomingMultiplayerMessage(msg: Record<string, unknown>): void {
    const type = String(msg.type ?? '');
    const fromUsername = String(msg.fromUsername ?? '');
    if (!fromUsername) return;

    const remote = this.combatants.find(
      (c) => c.isRemoteHuman && c.name.toLowerCase() === fromUsername.toLowerCase()
    );

    if (type === 'PLAYER_SYNC' && remote && msg.payload) {
      const payload = msg.payload as RemotePlayerSync;
      remote.position.set(payload.x, payload.y, payload.z);
      remote.yaw = payload.yaw;
      remote.pitch = payload.pitch;
      remote.isCrouching = payload.crouch;
      remote.hp = payload.hp;
      remote.armor = payload.armor;
      remote.alive = payload.alive;
      if (remote.weapon.id !== payload.weaponId && WEAPON_REGISTRY[payload.weaponId]) {
        remote.weapon = WEAPON_REGISTRY[payload.weaponId];
        remote.modelPackage.setWeapon(payload.weaponId);
      }
      remote.modelPackage.root.visible = payload.alive;
      remote.modelPackage.root.position.copy(remote.position);
      remote.modelPackage.root.rotation.y = remote.yaw;
      remote.modelPackage.updateAnimation(0.05, true, 4.5, payload.crouch, !payload.alive, payload.pitch, false);

      const st = this.playerStats.find((s) => s.id === remote.id);
      if (st) {
        st.hp = payload.hp;
        st.armor = payload.armor;
        st.alive = payload.alive;
      }
    } else if (type === 'PLAYER_SHOOT' && remote) {
      const origin = (msg.origin as [number, number, number]) ?? [remote.position.x, 1.4, remote.position.z];
      const dir = (msg.dir as [number, number, number]) ?? [0, 0, -1];
      remote.modelPackage.triggerMuzzleFlash();
      const s = new THREE.Vector3(...origin);
      const e = s.clone().add(new THREE.Vector3(...dir).multiplyScalar(32));
      this.spawnTracer(s, e);
    } else if (type === 'PLAYER_HIT') {
      const targetName = String(msg.targetUsername ?? '');
      const myName = multiplayerClient.getCachedUsername();
      if (myName && targetName.toLowerCase() === myName.toLowerCase() && this.playerCombatant.alive) {
        const dmgAmt = Math.max(1, Number(msg.damage ?? 20));
        this.applyExternalDamage(this.playerCombatant, dmgAmt, String(msg.weaponName ?? 'Rifle'));
      }
    } else if (type === 'SPIKE_EVENT') {
      const ev = String(msg.event ?? '');
      if (ev === 'PLANTED' && this.spikeState === 'not_planted') {
        const pos = (msg.pos as [number, number, number]) ?? [BOMB_SITE_A.x, 0, BOMB_SITE_A.z];
        this.spikeState = 'planted';
        this.plantedSite = (msg.site as 'A' | 'B') ?? 'A';
        this.spikePosition = new THREE.Vector3(...pos);
        if (!this.spikeMesh) {
          this.spikeMesh = createSpikeModel();
          this.scene.add(this.spikeMesh);
        }
        this.spikeMesh.position.copy(this.spikePosition);
        soundEngine.playSpikePlant();
        soundEngine.playAnnouncer('spikePlanted');
      } else if (ev === 'DEFUSED' && this.spikeState === 'planted') {
        this.spikeState = 'defused';
        soundEngine.playSpikeDefused();
        soundEngine.playAnnouncer('spikeDefused');
        this.endRound('DEFENDERS', 'SPIKE_DEFUSED');
      }
    } else if (type === 'ROUND_SYNC') {
      const hostName = this.customRoom?.hostUsername ?? '';
      if (hostName && fromUsername.toLowerCase() === hostName.toLowerCase()) {
        const syncedRound = Number(msg.roundNumber ?? this.roundNumber);
        const att = Number(msg.attackerRounds ?? this.attackerRoundsWon);
        const def = Number(msg.defenderRounds ?? this.defenderRoundsWon);
        this.attackerRoundsWon = att;
        this.defenderRoundsWon = def;
        this.callbacks.onRoundScoreChange(att, def, syncedRound);
        if (syncedRound > this.roundNumber && String(msg.roundPhase) === 'BUY_PHASE') {
          this.roundNumber = syncedRound - 1;
          this.startNextRound();
        }
      }
    }
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
    this.lastTime = performance.now();
    this.tick();
  };

  private handleResize = (): void => {
    if (!this.renderer || !this.camera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.input.detectDevice(this.settings.controlMode);
  };

  private clearTrainingTargetBoards(): void {
    this.trainingTargetBoards = [];
    if (this.trainingBoardGroup) {
      this.trainingBoardGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
          else mesh.material.dispose();
        }
      });
      this.scene.remove(this.trainingBoardGroup);
      this.trainingBoardGroup = null;
    }
  }

  private buildTrainingTargetBoards(): void {
    this.clearTrainingTargetBoards();
    const group = new THREE.Group();
    group.name = 'TrainingTargetBoards';
    const distances: Array<{ distM: 10 | 18 | 26; x: number; z: number }> = [
      { distM: 10, x: 20.5, z: -16 },
      { distM: 18, x: 24.0, z: -24 },
      { distM: 26, x: 27.5, z: -32 },
    ];
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.65 });
    const outerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.25 });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x17e5b8, side: THREE.DoubleSide });
    const bullMat = new THREE.MeshBasicMaterial({ color: 0xff4655, side: THREE.DoubleSide });

    for (const d of distances) {
      const fy = Math.max(8.0, sampleWorldFloorY(d.x, d.z, 12.2, 4.0));
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.8, 8), frameMat);
      post.position.set(d.x, fy + 0.9, d.z);
      group.add(post);

      const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.12), outerMat);
      board.position.set(d.x, fy + 2.1, d.z);
      board.userData = { isTargetBoard: true, distanceM: d.distM };
      group.add(board);
      this.trainingTargetBoards.push(board);

      const outerRing = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.56, 24), ringMat);
      outerRing.position.set(d.x, fy + 2.1, d.z + 0.068);
      group.add(outerRing);

      const bull = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), bullMat);
      bull.position.set(d.x, fy + 2.1, d.z + 0.072);
      group.add(bull);
    }

    this.trainingBoardGroup = group;
    this.scene.add(group);
  }

  private getTrainingBotSlotPosition(index: number, _bot: BotCombatant): THREE.Vector3 {
    const mode = this.trainingState.drillMode;
    if (mode === 'PLANT_DRILL') {
      const offsets: Array<[number, number]> = [
        [-28, -16],
        [-23, -15],
        [-26, -8],
        [-19, -12],
        [-29, -11],
      ];
      const [bx, bz] = offsets[index % offsets.length];
      const fy = Math.max(8, sampleWorldFloorY(bx, bz, 13.0, 4.0));
      return new THREE.Vector3(bx, fy, bz);
    }
    if (mode === 'DEFUSE_DRILL') {
      const offsets: Array<[number, number]> = [
        [21, 21],
        [27, 20],
        [24, 24],
        [20, 15],
        [28, 16],
      ];
      const [bx, bz] = offsets[index % offsets.length];
      const fy = Math.max(4, sampleWorldFloorY(bx, bz, 6.0, 4.0));
      return new THREE.Vector3(bx, fy, bz);
    }
    if (mode === 'FREE_ROAM') {
      const roamSpots: Array<[number, number, number]> = [
        [24, 12.05, -16],
        [22, 8.6, 1],
        [-26, 12.3, -13],
        [24, 5.1, 18],
        [0, 12.5, -24],
      ];
      const [rx, ry, rz] = roamSpots[index % roamSpots.length];
      const fy = Math.max(4, sampleWorldFloorY(rx, rz, ry + 0.5, 4.0));
      return new THREE.Vector3(rx, fy, rz);
    }

    // Shooting Gallery Lane Bots (10m / 18m / 26m range)
    const xSlots = [19.2, 21.6, 24.0, 26.4, 28.8];
    const distZ =
      this.trainingState.activeTargetDistance === 10
        ? -16
        : this.trainingState.activeTargetDistance === 26
          ? -30
          : -22;
    const gx = xSlots[index % xSlots.length];
    const gz = distZ - (index % 2) * 3.0;
    const fy = Math.max(8.0, sampleWorldFloorY(gx, gz, 12.6, 4.0));
    return new THREE.Vector3(gx, fy, gz);
  }

  private applyTrainingBotLayout(): void {
    const mode = this.trainingState.drillMode;
    const isCombatDrill = mode === 'FREE_ROAM' || mode === 'PLANT_DRILL' || mode === 'DEFUSE_DRILL';
    const strafeOn = mode === 'STRAFE' || this.trainingState.botsStrafe;

    let botIdx = 0;
    for (const c of this.combatants) {
      if (c.isHuman) continue;
      c.alive = true;
      c.deathTimer = 0;
      c.hp = 100;
      c.armor = this.trainingState.botArmor ? 50 : 0;
      c.hasSpike = false;
      const slotPos = this.getTrainingBotSlotPosition(botIdx++, c);
      c.position.copy(slotPos);
      c.yaw = 0;
      c.pitch = 0;

      if (isCombatDrill) {
        c.rangeMode = 'COMBAT';
        c.rangeAnchor = undefined;
      } else {
        c.rangeMode = strafeOn ? 'STRAFE' : 'IDLE';
        c.rangeAnchor = slotPos.clone();
        c.rangeStrafePhase = botIdx * 1.1;
      }

      c.modelPackage.resetPose();
      c.modelPackage.root.visible = true;
      c.modelPackage.root.position.copy(c.position);
      c.modelPackage.root.rotation.y = c.yaw;
      c.modelPackage.root.updateMatrixWorld(true);

      const st = this.playerStats.find((s) => s.id === c.id);
      if (st) {
        st.alive = true;
        st.hp = 100;
        st.armor = c.armor;
        st.hasSpike = false;
      }
    }

    if (isCombatDrill) {
      const targetSite: 'A' | 'B' = mode === 'DEFUSE_DRILL' ? 'B' : 'A';
      for (const ctrl of this.botControllers) {
        ctrl.planRound(mode === 'DEFUSE_DRILL', targetSite, targetSite);
      }
    }
    this.callbacks.onStatsUpdate([...this.playerStats]);
  }

  private setupSpikeTrainingDrill(mode: 'PLANT_DRILL' | 'DEFUSE_DRILL'): void {
    const p = this.playerCombatant;
    this.trainingState.drillMode = mode;
    this.trainingState.spikeObjectiveActive = true;
    this.trainingState.trialStatus = 'RUNNING';
    this.trainingState.trialTimeElapsed = 0;

    if (mode === 'PLANT_DRILL') {
      const temple = TRAINING_ZONES.find((z) => z.id === 'TEMPLE')!;
      p.team = 'ATTACKERS';
      p.hasSpike = true;
      p.hp = 100;
      this.playerTeam = 'ATTACKERS';
      this.spikeState = 'not_planted';
      this.spikePosition = null;
      this.plantedSite = null;
      if (this.spikeMesh) {
        this.scene.remove(this.spikeMesh);
        this.spikeMesh = null;
      }
      this.trainingState.spikeObjectiveLabel = 'PLANT SPIKE AT TEMPLE (SITE A) [HOLD F]';
      this.trainingState.spikeObjectiveTimer = 45;
      const startX = temple.x + 5;
      const startZ = temple.z + 5;
      const fy = Math.max(8, sampleWorldFloorY(startX, startZ, temple.y + 1, 3.0));
      p.position.set(startX, fy, startZ);
      this.lastSafeGroundPos.copy(p.position);
    } else {
      const dock = TRAINING_ZONES.find((z) => z.id === 'DOCK')!;
      p.team = 'DEFENDERS';
      p.hasSpike = false;
      p.hp = 100;
      this.playerTeam = 'DEFENDERS';
      const siteFy = Math.max(4, sampleWorldFloorY(BOMB_SITE_B.x, BOMB_SITE_B.z, BOMB_SITE_B.y + 1, 3.0));
      this.spikeState = 'planted';
      this.plantedSite = 'B';
      this.spikePosition = new THREE.Vector3(BOMB_SITE_B.x, siteFy, BOMB_SITE_B.z);
      if (!this.spikeMesh) {
        this.spikeMesh = createSpikeModel();
        this.scene.add(this.spikeMesh);
      }
      this.spikeMesh.position.copy(this.spikePosition);
      this.trainingState.spikeObjectiveLabel = 'DEFUSE SPIKE AT DOCK (SITE B) [HOLD F]';
      this.trainingState.spikeObjectiveTimer = 35;
      const startX = dock.x - 4;
      const startZ = dock.z - 6;
      const fy = Math.max(4, sampleWorldFloorY(startX, startZ, dock.y + 1, 3.0));
      p.position.set(startX, fy, startZ);
      this.lastSafeGroundPos.copy(p.position);
    }

    p.yaw = mode === 'PLANT_DRILL' ? Math.PI * 0.25 : Math.PI;
    p.pitch = 0;
    this.playerVelY = 0;
    this.isGrounded = true;
    this.camera.position.set(p.position.x, p.position.y + this.playerEyeHeight, p.position.z);
    for (const c of this.combatants) {
      if (!c.isHuman) c.team = p.team === 'ATTACKERS' ? 'DEFENDERS' : 'ATTACKERS';
    }
    this.applyTrainingBotLayout();
    this.callbacks.onTrainingUpdate?.({ ...this.trainingState });
  }

  public setTrainingDrill(mode: TrainingDrillMode): void {
    if (!this.isTrainingMatch) return;
    this.trainingState.drillMode = mode;
    this.trainingState.trialKills = 0;
    this.trainingState.trialTimeElapsed = 0;
    this.trainingState.spikeObjectiveActive = false;
    this.trainingState.spikeObjectiveLabel = '';

    if (mode === 'PLANT_DRILL' || mode === 'DEFUSE_DRILL') {
      this.setupSpikeTrainingDrill(mode);
      return;
    }

    // Standard Range modes restore clean Attacker vs Defender teams
    this.playerTeam = 'ATTACKERS';
    this.playerCombatant.team = 'ATTACKERS';
    this.playerCombatant.hasSpike = false;
    this.spikeState = 'not_planted';
    this.spikePosition = null;
    if (this.spikeMesh) {
      this.scene.remove(this.spikeMesh);
      this.spikeMesh = null;
    }
    for (const c of this.combatants) {
      if (!c.isHuman) c.team = 'DEFENDERS';
    }

    if (mode === 'SPEED_30') {
      this.trainingState.trialStatus = 'RUNNING';
      this.trainingState.trialTarget = 30;
      this.warpToTrainingZone('GALLERY');
    } else if (mode === 'STREAK_50') {
      this.trainingState.trialStatus = 'RUNNING';
      this.trainingState.trialTarget = 50;
      this.warpToTrainingZone('GALLERY');
    } else if (mode === 'STRAFE') {
      this.trainingState.trialStatus = 'IDLE';
      this.trainingState.botsStrafe = true;
      this.warpToTrainingZone('GALLERY');
    } else if (mode === 'PRACTICE') {
      this.trainingState.trialStatus = 'IDLE';
      this.warpToTrainingZone('GALLERY');
    } else {
      this.trainingState.trialStatus = 'IDLE';
    }

    this.applyTrainingBotLayout();
    this.callbacks.onTrainingUpdate?.({ ...this.trainingState });
  }

  public warpToTrainingZone(zoneId: TrainingZoneId): void {
    if (!this.isTrainingMatch) return;
    const z = TRAINING_ZONES.find((item) => item.id === zoneId) || TRAINING_ZONES[0];
    const fy = sampleWorldFloorY(z.x, z.z, z.y + 1.2, 4.0);
    const groundY = fy > -2 ? fy : z.y;
    const p = this.playerCombatant;
    p.alive = true;
    p.hp = 100;
    p.position.set(z.x, groundY, z.z);
    p.yaw = z.yaw;
    p.pitch = 0;
    this.playerVelY = 0;
    this.isGrounded = true;
    this.lastSafeGroundPos.copy(p.position);
    this.camera.position.set(p.position.x, p.position.y + this.playerEyeHeight, p.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = p.yaw;
    this.camera.rotation.x = 0;
    this.callbacks.onPlayerHealthUpdate(p.hp, p.armor, 100, 50);
  }

  public setTrainingConfig(
    patch: Partial<Pick<TrainingSessionState, 'botArmor' | 'botsStrafe' | 'infiniteMag' | 'activeTargetDistance'>>
  ): void {
    if (!this.isTrainingMatch) return;
    Object.assign(this.trainingState, patch);
    this.applyTrainingBotLayout();
    this.callbacks.onTrainingUpdate?.({ ...this.trainingState });
  }

  public resetTrainingStats(): void {
    if (!this.isTrainingMatch) return;
    this.trainingState.shotsFired = 0;
    this.trainingState.shotsHit = 0;
    this.trainingState.headshots = 0;
    this.trainingState.trialKills = 0;
    this.trainingState.trialTimeElapsed = 0;
    if (this.trainingState.drillMode === 'SPEED_30' || this.trainingState.drillMode === 'STREAK_50') {
      this.trainingState.trialStatus = 'RUNNING';
    }
    this.callbacks.onTrainingUpdate?.({ ...this.trainingState });
  }

  public getTrainingState(): TrainingSessionState {
    return { ...this.trainingState };
  }

  public dispose(): void {
    this.isDestroyed = true;
    cancelAnimationFrame(this.frameId);
    if (this.glSyncTimer !== null) {
      window.clearTimeout(this.glSyncTimer);
      this.glSyncTimer = null;
    }
    this.unsubInMatch?.();
    if (this.customRoom) {
      multiplayerClient.notifyMatchEnded();
    }
    window.removeEventListener('resize', this.handleResize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.input.detach();
    this.abilityMgr.dispose();
    this.clearSceneMaps();

    for (const c of this.combatants) {
      c.modelPackage.dispose();
    }

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
