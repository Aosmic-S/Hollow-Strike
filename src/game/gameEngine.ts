/**
 * Hollow Strike - 3D Simulation & Game Engine
 * Decoupled fixed-timestep simulation, Three.js renderer, object pooling, and round orchestrator.
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
  WEAPON_REGISTRY,
  AGENT_REGISTRY,
  SHIELD_REGISTRY,
  BUY_PHASE_DURATION,
  ROUND_LIVE_DURATION,
  SPIKE_PLANT_DURATION,
  SPIKE_DEFUSE_DURATION,
  SPIKE_DETONATION_TIME,
  ROUND_END_DURATION,
  ROUNDS_TO_WIN,
  HALF_TIME_ROUND,
  WeaponDef,
} from './types';
import { calculateDamage, calculateEconomy, checkRoundWin, checkMatchWin, shouldSwapSides, calculateSpread } from './rules';
import { buildTacticalMap, BuiltMap } from './mapBuilder';
import { BOMB_SITE_A, BOMB_SITE_B, SPAWN_ATTACKERS, SPAWN_DEFENDERS, checkCollision } from './mapData';
import { createAgentModel } from './agentModels';
import { createApex9Model, createViper9Model, createPhantomVModel, createVoidLanceModel, createSpikeModel } from './weaponModels';
import { soundEngine } from './audio';
import { AbilityManager } from './abilities';
import { BotCombatant, BotController } from './botAI';
import { InputManager } from './inputManager';

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

// Reusable scratch objects to guarantee ZERO per-frame GC allocations
const _vec3_1 = new THREE.Vector3();
const _vec3_2 = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

export interface EngineCallbacks {
  onStatsUpdate: (stats: PlayerStats[]) => void;
  onRoundPhaseChange: (phase: RoundPhase, timeRemaining: number) => void;
  onRoundScoreChange: (attackerWins: number, defenderWins: number, currentRound: number) => void;
  onKillEvent: (event: KillEvent) => void;
  onPlayerHealthUpdate: (hp: number, armor: number, maxHp: number, maxArmor: number) => void;
  onWeaponUpdate: (weapon: WeaponDef, ammoInMag: number, reserveAmmo: number, isReloading: boolean) => void;
  onSpikeStateUpdate: (state: 'not_planted' | 'planted' | 'defused' | 'detonated', timer: number, plantProgress: number, defuseProgress: number) => void;
  onHitmarker: (isHeadshot: boolean) => void;
  onFpsUpdate: (fps: number) => void;
  onMatchOver: (winner: TeamSide) => void;
}

export class GameEngine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public input: InputManager;
  public settings: GameSettings;
  public abilityMgr: AbilityManager;

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

  // Viewmodel & Hands
  public viewmodelRig: THREE.Group;
  public viewmodelWeapon: THREE.Group | null = null;
  public cameraShakeTrauma: number = 0;
  public hitstopTimer: number = 0;

  // Procedural Map & Lighting
  private mapData!: BuiltMap;
  private dirLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;

  // Tracer & Spark Pools
  private tracerLines: { line: THREE.Line; age: number; maxAge: number; inUse: boolean }[] = [];
  private sparks: { mesh: THREE.Mesh; vel: THREE.Vector3; age: number; maxAge: number; inUse: boolean }[] = [];

  // Runtime Tracking
  private frameId: number = 0;
  private lastTime: number = 0;
  private isDestroyed: boolean = false;
  private isPaused: boolean = false;
  private callbacks: EngineCallbacks;
  private fpsCounter: number = 0;
  private fpsTimer: number = 0;

  constructor(
    mountElement: HTMLElement,
    settings: GameSettings,
    playerAgentId: string,
    botDifficulty: BotDifficulty,
    callbacks: EngineCallbacks
  ) {
    this.settings = settings;
    this.callbacks = callbacks;
    this.input = new InputManager();

    // 1. Scene & Atmosphere Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090f1d);
    this.scene.fog = new THREE.FogExp2(0x090f1d, 0.014);

    // 2. Camera Setup (Tactical First-Person FOV)
    this.camera = new THREE.PerspectiveCamera(settings.fov, mountElement.clientWidth / mountElement.clientHeight, 0.1, 140);
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

    this.renderer.setSize(mountElement.clientWidth, mountElement.clientHeight);
    mountElement.appendChild(this.renderer.domElement);

    // 4. Studio Environment Lighting via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Warm Directional Key + Cool Hemisphere Fill
    this.dirLight = new THREE.DirectionalLight(0xffedd5, 1.4);
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

    this.hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x1e293b, 0.6);
    this.scene.add(this.hemiLight);

    // 5. Abilities & Procedural Map
    this.abilityMgr = new AbilityManager(this.scene);
    this.mapData = buildTacticalMap(this.scene);

    // 6. Viewmodel Rig
    this.viewmodelRig = new THREE.Group();
    this.camera.add(this.viewmodelRig);
    this.scene.add(this.camera);

    // 7. Initialize Object Pools (Tracers & Sparks)
    this.initObjectPools();

    // 8. Attach Input
    this.input.attach(this.renderer.domElement);
    this.input.mouseSensitivity = settings.mouseSensitivity;
    this.input.touchSensitivity = settings.touchSensitivity;

    // 9. Initialize 5v5 Combatants (Player + 4 bot allies vs 5 bot opponents)
    this.initCombatants(playerAgentId, botDifficulty);

    // 10. Start simulation loop
    this.lastTime = performance.now();
    this.tick();

    // Window Resize listener
    window.addEventListener('resize', this.handleResize);
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (paused) {
      this.input.exitPointerLock();
    }
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
    // 25 Bullet Tracers
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.9,
    });
    for (let i = 0; i < 25; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(geo, lineMat);
      line.visible = false;
      this.scene.add(line);
      this.tracerLines.push({ line, age: 0, maxAge: 0.08, inUse: false });
    }

    // 80 Impact Sparks
    const sparkGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
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

    // 1. Create Human Player
    const playerAgent = AGENT_REGISTRY[playerAgentId] || AGENT_REGISTRY.ZEPHYR;
    const playerMesh = createAgentModel(playerAgent, this.playerTeam);
    playerMesh.root.visible = false; // Hide third-person body for first person camera
    this.scene.add(playerMesh.root);

    const initialSpawn = this.playerTeam === 'ATTACKERS' ? SPAWN_ATTACKERS : SPAWN_DEFENDERS;

    this.playerCombatant = {
      id: 'player_0',
      name: 'Agent (You)',
      team: this.playerTeam,
      agentId: playerAgent.id,
      isHuman: true,
      hp: 100,
      armor: 0,
      alive: true,
      position: new THREE.Vector3(initialSpawn.x, 0, initialSpawn.z),
      velocity: new THREE.Vector3(),
      yaw: this.playerTeam === 'ATTACKERS' ? Math.PI : 0,
      pitch: 0,
      hasSpike: this.playerTeam === 'ATTACKERS',
      weapon: WEAPON_REGISTRY.APEX_9,
      ammoInMag: WEAPON_REGISTRY.APEX_9.magazineSize,
      reserveAmmo: WEAPON_REGISTRY.APEX_9.reserveAmmo,
      reloadTimer: 0,
      shootCooldown: 0,
      isPlanting: false,
      isDefusing: false,
      actionProgress: 0,
      modelPackage: playerMesh,
    };
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
      credits: 800,
      ping: 12,
      alive: true,
      hp: 100,
      maxHp: 100,
      armor: 0,
      maxArmor: 50,
      hasSpike: this.playerCombatant.hasSpike,
    });

    // 2. Create 4 Bot Teammates
    const allySpawn = initialSpawn;
    for (let i = 1; i <= 4; i++) {
      const agentKey = agentKeys[i % agentKeys.length];
      const agent = AGENT_REGISTRY[agentKey];
      const mesh = createAgentModel(agent, this.playerTeam);
      this.scene.add(mesh.root);

      const offsetX = (i - 2.5) * 2.8;
      const bot: BotCombatant = {
        id: `ally_${i}`,
        name: `Ally ${agent.name}`,
        team: this.playerTeam,
        agentId: agent.id,
        isHuman: false,
        hp: 100,
        armor: 0,
        alive: true,
        position: new THREE.Vector3(allySpawn.x + offsetX, 0, allySpawn.z),
        velocity: new THREE.Vector3(),
        yaw: this.playerTeam === 'ATTACKERS' ? Math.PI : 0,
        pitch: 0,
        hasSpike: false,
        weapon: WEAPON_REGISTRY.APEX_9,
        ammoInMag: WEAPON_REGISTRY.APEX_9.magazineSize,
        reserveAmmo: WEAPON_REGISTRY.APEX_9.reserveAmmo,
        reloadTimer: 0,
        shootCooldown: 0,
        isPlanting: false,
        isDefusing: false,
        actionProgress: 0,
        modelPackage: mesh,
      };

      this.combatants.push(bot);
      const ctrl = new BotController(bot, difficulty);
      this.botControllers.push(ctrl);

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
        ping: 24 + Math.floor(Math.random() * 10),
        alive: true,
        hp: 100,
        maxHp: 100,
        armor: 0,
        maxArmor: 50,
        hasSpike: false,
      });
    }

    // 3. Create 5 Bot Enemies
    const enemyTeam: TeamSide = this.playerTeam === 'ATTACKERS' ? 'DEFENDERS' : 'ATTACKERS';
    const enemySpawn = enemyTeam === 'ATTACKERS' ? SPAWN_ATTACKERS : SPAWN_DEFENDERS;

    for (let i = 1; i <= 5; i++) {
      const agentKey = agentKeys[(i + 1) % agentKeys.length];
      const agent = AGENT_REGISTRY[agentKey];
      const mesh = createAgentModel(agent, enemyTeam);
      this.scene.add(mesh.root);

      const offsetX = (i - 3) * 2.8;
      const bot: BotCombatant = {
        id: `enemy_${i}`,
        name: `Hostile ${agent.name}`,
        team: enemyTeam,
        agentId: agent.id,
        isHuman: false,
        hp: 100,
        armor: 0,
        alive: true,
        position: new THREE.Vector3(enemySpawn.x + offsetX, 0, enemySpawn.z),
        velocity: new THREE.Vector3(),
        yaw: enemyTeam === 'ATTACKERS' ? Math.PI : 0,
        pitch: 0,
        hasSpike: enemyTeam === 'ATTACKERS' && i === 1,
        weapon: WEAPON_REGISTRY.APEX_9,
        ammoInMag: WEAPON_REGISTRY.APEX_9.magazineSize,
        reserveAmmo: WEAPON_REGISTRY.APEX_9.reserveAmmo,
        reloadTimer: 0,
        shootCooldown: 0,
        isPlanting: false,
        isDefusing: false,
        actionProgress: 0,
        modelPackage: mesh,
      };

      if (bot.hasSpike) {
        this.spikeCarrierId = bot.id;
      }

      this.combatants.push(bot);
      const ctrl = new BotController(bot, difficulty);
      this.botControllers.push(ctrl);

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
        ping: 30 + Math.floor(Math.random() * 12),
        alive: true,
        hp: 100,
        maxHp: 100,
        armor: 0,
        maxArmor: 50,
        hasSpike: bot.hasSpike,
      });
    }

    // Set initial viewmodel weapon
    this.updateViewmodelWeapon(this.playerCombatant.weapon.id);
  }

  public updateViewmodelWeapon(weaponId: string): void {
    if (this.viewmodelWeapon) {
      this.viewmodelRig.remove(this.viewmodelWeapon);
    }

    switch (weaponId) {
      case 'APEX_9':
        this.viewmodelWeapon = createApex9Model();
        this.viewmodelWeapon.position.set(0.22, -0.16, -0.38);
        break;
      case 'VIPER_9':
        this.viewmodelWeapon = createViper9Model();
        this.viewmodelWeapon.position.set(0.24, -0.18, -0.42);
        break;
      case 'PHANTOM_V':
        this.viewmodelWeapon = createPhantomVModel();
        this.viewmodelWeapon.position.set(0.24, -0.18, -0.45);
        break;
      case 'VOID_LANCE':
        this.viewmodelWeapon = createVoidLanceModel();
        this.viewmodelWeapon.position.set(0.26, -0.2, -0.5);
        break;
      default:
        this.viewmodelWeapon = createApex9Model();
        this.viewmodelWeapon.position.set(0.22, -0.16, -0.38);
    }

    this.viewmodelRig.add(this.viewmodelWeapon);
  }

  // --- Main Tick Loop ---
  private tick = (): void => {
    if (this.isDestroyed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05); // Clamped simulation step per ultra skill

    // FPS calculation
    this.fpsCounter++;
    this.fpsTimer += rawDt;
    if (this.fpsTimer >= 0.5) {
      const currentFps = Math.round((this.fpsCounter / this.fpsTimer));
      this.callbacks.onFpsUpdate(currentFps);
      this.fpsCounter = 0;
      this.fpsTimer = 0;
    }

    if (!this.isPaused) {
      this.updateSimulation(dt);
    }

    // Render frame
    this.renderer.render(this.scene, this.camera);

    this.frameId = requestAnimationFrame(this.tick);
  };

  private updateSimulation(dt: number): void {
    this.input.update();

    // Hitstop freeze timer
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    // 1. Round Phase Orchestration
    this.updateRoundState(dt);

    // 2. Player Input, Movement & Gunplay
    this.updatePlayer(dt);

    // 3. Bot AI Updates
    for (const ctrl of this.botControllers) {
      ctrl.update(
        dt,
        this.combatants,
        this.spikeState,
        this.spikePosition,
        this.plantedSite,
        this.abilityMgr,
        (shooter, dir) => this.fireBullet(shooter, dir)
      );
    }

    // 4. Ability Effects (Smokes, Walls, Recon Pulses)
    this.abilityMgr.update(dt);

    // 5. Update Particle Pools
    this.updateTracersAndSparks(dt);

    // 6. Camera Shake & Viewmodel Smoothing
    this.updateCameraEffects(dt);

    // 7. Clear transient per-frame inputs
    this.input.clearFrameDeltas();
  }

  private updateRoundState(dt: number): void {
    this.roundTimer -= dt;

    // Buy Phase logic
    if (this.roundPhase === 'BUY_PHASE') {
      this.mapData.barrierAttackers.visible = true;
      this.mapData.barrierDefenders.visible = true;

      if (this.roundTimer <= 0) {
        this.roundPhase = 'ROUND_LIVE';
        this.roundTimer = ROUND_LIVE_DURATION;
        this.mapData.barrierAttackers.visible = false;
        this.mapData.barrierDefenders.visible = false;
        soundEngine.playRoundStart();

        // Bot paths start
        for (const ctrl of this.botControllers) {
          ctrl.planRound(false, null);
        }
      }
    } else if (this.roundPhase === 'ROUND_LIVE') {
      // Live 100s combat
      if (this.spikeState === 'planted') {
        this.roundPhase = 'SPIKE_PLANTED';
      } else if (this.roundTimer <= 0) {
        // Time expired -> Defenders win round
        this.endRound('DEFENDERS', 'TIME_EXPIRED');
      }
    } else if (this.roundPhase === 'SPIKE_PLANTED') {
      // 45s Spike Bomb countdown
      this.spikeTimer -= dt;
      this.spikeBeepTimer -= dt;

      // Beep tempo accelerates as timer reaches 0
      const urgencyFraction = 1 - (this.spikeTimer / SPIKE_DETONATION_TIME);
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

    // Check eliminations
    if (this.roundPhase === 'ROUND_LIVE' || this.roundPhase === 'SPIKE_PLANTED') {
      const aliveAtt = this.combatants.filter((c) => c.alive && c.team === 'ATTACKERS').length;
      const aliveDef = this.combatants.filter((c) => c.alive && c.team === 'DEFENDERS').length;

      const check = checkRoundWin(aliveAtt, aliveDef, this.spikeState, this.roundTimer);
      if (check.roundOver && check.winner) {
        this.endRound(check.winner, check.reason!);
      }
    }

    // Notify UI
    this.callbacks.onRoundPhaseChange(this.roundPhase, Math.max(0, this.roundTimer));
  }

  private updatePlayer(dt: number): void {
    if (!this.playerCombatant.alive) return;

    const p = this.playerCombatant;

    // 1. Camera Look Rotation
    p.yaw -= this.input.state.lookDeltaX;
    p.pitch -= this.input.state.lookDeltaY;
    p.pitch = Math.max(-1.45, Math.min(1.45, p.pitch)); // Clamp pitch

    // 2. Weapon Slot Change
    if (this.input.state.weaponSlotJustPressed) {
      const slot = this.input.state.weaponSlotJustPressed;
      const weaponDef = slot === 1 ? WEAPON_REGISTRY.PHANTOM_V : slot === 2 ? WEAPON_REGISTRY.APEX_9 : slot === 3 ? WEAPON_REGISTRY.VIPER_9 : WEAPON_REGISTRY.VOID_LANCE;
      p.weapon = weaponDef;
      p.ammoInMag = Math.min(p.ammoInMag, weaponDef.magazineSize);
      this.updateViewmodelWeapon(weaponDef.id);
      this.callbacks.onWeaponUpdate(p.weapon, p.ammoInMag, p.reserveAmmo, false);
    }

    // 3. Movement
    const fwd = this.input.state.moveForward;
    const right = this.input.state.moveRight;
    const isMoving = fwd !== 0 || right !== 0;

    let baseSpeed = 5.4; // m/s
    if (this.input.state.crouchHeld) baseSpeed *= 0.5;
    if (this.input.state.adsHeld && p.weapon.canADS) baseSpeed *= 0.65;

    _vec3_1.set(
      Math.sin(p.yaw) * fwd + Math.cos(p.yaw) * right,
      0,
      Math.cos(p.yaw) * fwd - Math.sin(p.yaw) * right
    ).normalize();

    p.velocity.x = _vec3_1.x * baseSpeed;
    p.velocity.z = _vec3_1.z * baseSpeed;

    // Collision check against map colliders
    const nextX = p.position.x + p.velocity.x * dt;
    const nextZ = p.position.z + p.velocity.z * dt;

    // Respect Buy Phase barrier
    let blockedByBarrier = false;
    if (this.roundPhase === 'BUY_PHASE') {
      if (p.team === 'ATTACKERS' && nextZ < 18.2) blockedByBarrier = true;
      if (p.team === 'DEFENDERS' && nextZ > -25.8) blockedByBarrier = true;
    }

    if (!blockedByBarrier) {
      const col = checkCollision(nextX, nextZ, 0.45);
      if (!col.collided) {
        p.position.x = nextX;
        p.position.z = nextZ;
      } else {
        // Slide along normal
        p.position.x += col.normalX * 0.08;
        p.position.z += col.normalZ * 0.08;
      }
    }

    // Footsteps sound
    if (isMoving && Math.random() < dt * 2.8) {
      soundEngine.playFootstep();
    }

    // Camera follow player position
    const eyeHeight = this.input.state.crouchHeld ? 1.05 : 1.65;
    this.camera.position.set(p.position.x, eyeHeight, p.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = p.yaw;
    this.camera.rotation.x = p.pitch;

    // 4. Reload Logic
    if (this.input.state.reloadJustPressed && p.ammoInMag < p.weapon.magazineSize && p.reserveAmmo > 0 && p.reloadTimer <= 0) {
      p.reloadTimer = p.weapon.reloadTime;
      soundEngine.playReload();
      this.callbacks.onWeaponUpdate(p.weapon, p.ammoInMag, p.reserveAmmo, true);
    }

    if (p.reloadTimer > 0) {
      p.reloadTimer -= dt;
      if (p.reloadTimer <= 0) {
        const needed = p.weapon.magazineSize - p.ammoInMag;
        const take = Math.min(needed, p.reserveAmmo);
        p.ammoInMag += take;
        p.reserveAmmo -= take;
        this.callbacks.onWeaponUpdate(p.weapon, p.ammoInMag, p.reserveAmmo, false);
      }
    }

    // 5. Fire Weapon
    if (p.shootCooldown > 0) p.shootCooldown -= dt;

    const wantsToFire = this.input.state.fireHeld || this.input.state.fireJustPressed;
    if (wantsToFire && p.shootCooldown <= 0 && p.reloadTimer <= 0 && this.roundPhase !== 'BUY_PHASE') {
      if (p.ammoInMag > 0) {
        p.ammoInMag--;
        p.shootCooldown = 1 / p.weapon.fireRate;
        this.callbacks.onWeaponUpdate(p.weapon, p.ammoInMag, p.reserveAmmo, false);

        // Calculate recoil & spread
        const isJumping = false;
        const spread = calculateSpread(p.weapon, isMoving, isJumping, this.input.state.crouchHeld, this.input.state.adsHeld);

        // Camera direction + spread
        const aimDir = new THREE.Vector3();
        this.camera.getWorldDirection(aimDir);
        aimDir.x += (Math.random() - 0.5) * spread;
        aimDir.y += (Math.random() - 0.5) * spread * 0.8;
        aimDir.z += (Math.random() - 0.5) * spread;
        aimDir.normalize();

        this.fireBullet(p, aimDir);

        // Recoil kick on viewmodel and pitch
        p.pitch += p.weapon.recoilPerShot * 0.45;
        this.cameraShakeTrauma = Math.min(1.0, this.cameraShakeTrauma + 0.15);
      } else {
        // Empty mag click
        if (this.input.state.fireJustPressed && p.reserveAmmo > 0) {
          p.reloadTimer = p.weapon.reloadTime;
          soundEngine.playReload();
        }
      }
    }

    // 6. Spike Planting & Defusing by Player
    this.updatePlayerSpikeActions(dt);

    // 7. Player Abilities (Q, E, C, X)
    this.updatePlayerAbilities();
  }

  private updatePlayerSpikeActions(dt: number): void {
    const p = this.playerCombatant;

    // Check if in site A or B
    const distA = p.position.distanceTo(new THREE.Vector3(BOMB_SITE_A.x, 0, BOMB_SITE_A.z));
    const distB = p.position.distanceTo(new THREE.Vector3(BOMB_SITE_B.x, 0, BOMB_SITE_B.z));
    const inSiteA = distA < BOMB_SITE_A.radius;
    const inSiteB = distB < BOMB_SITE_B.radius;

    // Plant logic (Attacker)
    if (p.team === 'ATTACKERS' && p.hasSpike && this.spikeState === 'not_planted' && (inSiteA || inSiteB)) {
      if (this.input.state.plantDefuseHeld) {
        p.isPlanting = true;
        p.actionProgress += dt / SPIKE_PLANT_DURATION;

        if (p.actionProgress >= 1.0) {
          // Plant successful!
          this.spikeState = 'planted';
          this.plantedSite = inSiteA ? 'A' : 'B';
          this.spikePosition = p.position.clone();
          p.hasSpike = false;
          p.isPlanting = false;
          p.actionProgress = 0;

          // Spawn 3D spike mesh
          this.spikeMesh = createSpikeModel();
          this.spikeMesh.position.copy(this.spikePosition);
          this.scene.add(this.spikeMesh);

          soundEngine.playSpikePlant();

          // Alert bots to rotate
          for (const ctrl of this.botControllers) {
            ctrl.planRound(true, this.plantedSite);
          }
        }
      } else {
        p.isPlanting = false;
        p.actionProgress = 0;
      }
    }

    // Defuse logic (Defender)
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

    this.callbacks.onSpikeStateUpdate(
      this.spikeState,
      this.spikeTimer,
      p.isPlanting ? p.actionProgress : 0,
      p.isDefusing ? p.actionProgress : 0
    );
  }

  private updatePlayerAbilities(): void {
    const p = this.playerCombatant;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);

    if (this.input.state.abilityEJustPressed) {
      if (p.agentId === 'ZEPHYR') {
        // Hollow Smoke: deploys 12m forward
        const targetPos = p.position.clone().add(forward.clone().multiplyScalar(14));
        this.abilityMgr.deploySmoke(targetPos.x, 0, targetPos.z);
      } else if (p.agentId === 'BLITZ') {
        // Blind Pulse flash
        soundEngine.playAbility('FLASH');
        this.cameraShakeTrauma = 0.4;
      } else if (p.agentId === 'BASTION') {
        // Barrier Wall 4m forward
        const wallPos = p.position.clone().add(forward.clone().multiplyScalar(5));
        this.abilityMgr.deployBarrier(wallPos.x, 0, wallPos.z, p.yaw);
      } else if (p.agentId === 'LUMEN') {
        // Healing burst: heal player up to 100
        p.hp = Math.min(100, p.hp + 50);
        soundEngine.playAbility('HEAL');
        this.callbacks.onPlayerHealthUpdate(p.hp, p.armor, 100, 50);
      }
    }

    if (this.input.state.abilityQJustPressed) {
      if (p.agentId === 'BLITZ') {
        // Kinetic dash
        p.position.add(forward.clone().multiplyScalar(7));
        soundEngine.playAbility('DASH');
      } else if (p.agentId === 'LUMEN') {
        // Recon pulse
        this.abilityMgr.triggerReconPulse(p.position.x, 0, p.position.z, p.team);
      }
    }

    if (this.input.state.abilityXJustPressed) {
      // Ultimate
      soundEngine.playAbility('ULT');
      this.cameraShakeTrauma = 0.8;
    }
  }

  public fireBullet(shooter: BotCombatant, dir: THREE.Vector3): void {
    soundEngine.playGunshot(shooter.weapon.category);

    const origin = shooter.isHuman
      ? this.camera.position.clone()
      : shooter.position.clone().add(new THREE.Vector3(0, 1.4, 0));

    // Raycast against all alive enemy combatants
    _raycaster.set(origin, dir);
    _raycaster.far = 100;

    let closestHit: { combatant: BotCombatant; hitZone: 'head' | 'body' | 'leg'; point: THREE.Vector3 } | null = null;
    let closestDist = Infinity;

    for (const target of this.combatants) {
      if (!target.alive || target.team === shooter.team) continue;

      // Check hit against head, torso, legs
      const hits = _raycaster.intersectObjects([
        target.modelPackage.headMesh,
        target.modelPackage.torsoMesh,
        target.modelPackage.leftLeg,
        target.modelPackage.rightLeg,
      ]);

      if (hits.length > 0) {
        const hit = hits[0];
        if (hit.distance < closestDist) {
          closestDist = hit.distance;
          const hitZone = (hit.object.userData?.hitZone as 'head' | 'body' | 'leg') || 'body';
          closestHit = { combatant: target, hitZone, point: hit.point };
        }
      }
    }

    // Check hit against static world colliders
    const worldHits = _raycaster.intersectObjects(this.mapData.collidableMeshes);
    let worldDist = Infinity;
    let worldPoint: THREE.Vector3 | null = null;
    if (worldHits.length > 0) {
      worldDist = worldHits[0].distance;
      worldPoint = worldHits[0].point;
    }

    const endPoint = new THREE.Vector3();

    if (closestHit && closestDist < worldDist) {
      // Hit Enemy!
      endPoint.copy(closestHit.point);
      this.applyDamage(shooter, closestHit.combatant, closestHit.hitZone, closestDist);
    } else if (worldPoint) {
      // Hit Wall / Crate
      endPoint.copy(worldPoint);
      this.spawnSparks(worldPoint);
    } else {
      endPoint.copy(origin).add(dir.clone().multiplyScalar(80));
    }

    // Spawn pooled visual tracer line
    this.spawnTracer(origin, endPoint);
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

    if (shooter.isHuman) {
      soundEngine.playHitmarker(dmg.isHeadshot);
      this.callbacks.onHitmarker(dmg.isHeadshot);
    }

    if (victim.isHuman) {
      soundEngine.playFootstep(); // hurt grunt
      this.cameraShakeTrauma = Math.min(1.0, this.cameraShakeTrauma + 0.35);
      this.callbacks.onPlayerHealthUpdate(victim.hp, victim.armor, 100, 50);
    }

    if (dmg.isDead) {
      victim.alive = false;
      victim.modelPackage.root.visible = false;

      // Update Kill Stats
      const shooterStats = this.playerStats.find((s) => s.id === shooter.id);
      const victimStats = this.playerStats.find((s) => s.id === victim.id);
      if (shooterStats) {
        shooterStats.kills++;
        shooterStats.score += dmg.isHeadshot ? 300 : 200;
      }
      if (victimStats) {
        victimStats.deaths++;
        victimStats.alive = false;
      }

      this.callbacks.onStatsUpdate([...this.playerStats]);

      // Emit Kill Feed Event
      const killEvent: KillEvent = {
        id: `kill_${Date.now()}_${Math.random()}`,
        killerName: shooter.name,
        killerTeam: shooter.team,
        victimName: victim.name,
        victimTeam: victim.team,
        weaponName: shooter.weapon.name,
        isHeadshot: dmg.isHeadshot,
        timestamp: Date.now(),
      };
      this.callbacks.onKillEvent(killEvent);

      if (shooter.isHuman) {
        // Hitstop on kill for dramatic impact per ultra mode craft
        this.hitstopTimer = 0.04;
      }

      // Check if victim carried spike -> drop on ground
      if (victim.hasSpike) {
        victim.hasSpike = false;
        this.spikePosition = victim.position.clone();
        if (!this.spikeMesh) {
          this.spikeMesh = createSpikeModel();
          this.scene.add(this.spikeMesh);
        }
        this.spikeMesh.position.copy(this.spikePosition);
      }
    }
  }

  private spawnTracer(start: THREE.Vector3, end: THREE.Vector3): void {
    const tracer = this.tracerLines.find((t) => !t.inUse);
    if (!tracer) return;

    tracer.inUse = true;
    tracer.age = 0;
    tracer.line.visible = true;

    const positions = (tracer.line.geometry as THREE.BufferGeometry).attributes.position;
    positions.setXYZ(0, start.x, start.y - 0.1, start.z);
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
    // Tracers
    for (const t of this.tracerLines) {
      if (t.inUse) {
        t.age += dt;
        if (t.age >= t.maxAge) {
          t.inUse = false;
          t.line.visible = false;
        }
      }
    }

    // Sparks
    for (const s of this.sparks) {
      if (s.inUse) {
        s.age += dt;
        s.vel.y -= 18 * dt; // gravity
        s.mesh.position.addScaledVector(s.vel, dt);

        if (s.age >= s.maxAge) {
          s.inUse = false;
          s.mesh.visible = false;
        }
      }
    }
  }

  private updateCameraEffects(dt: number): void {
    // 1. Camera Shake decay
    if (this.cameraShakeTrauma > 0) {
      const shake = this.cameraShakeTrauma * this.cameraShakeTrauma * 0.08;
      this.camera.rotation.z = (Math.random() - 0.5) * shake;
      this.camera.position.x += (Math.random() - 0.5) * shake * 0.5;
      this.camera.position.y += (Math.random() - 0.5) * shake * 0.5;
      this.cameraShakeTrauma = Math.max(0, this.cameraShakeTrauma - dt * 2.5);
    } else {
      this.camera.rotation.z = 0;
    }

    // 2. Viewmodel ADS smoothing & idle breathing
    if (this.viewmodelWeapon) {
      const p = this.playerCombatant;
      const isADS = this.input.state.adsHeld && p.weapon.canADS;

      const targetX = isADS ? 0 : 0.24;
      const targetY = isADS ? -0.12 : -0.18;
      const targetZ = isADS ? -0.28 : -0.42;

      this.viewmodelWeapon.position.x = THREE.MathUtils.damp(this.viewmodelWeapon.position.x, targetX, 14, dt);
      this.viewmodelWeapon.position.y = THREE.MathUtils.damp(this.viewmodelWeapon.position.y, targetY, 14, dt);
      this.viewmodelWeapon.position.z = THREE.MathUtils.damp(this.viewmodelWeapon.position.z, targetZ, 14, dt);

      // FOV zoom on ADS
      const targetFov = isADS ? this.settings.fov * p.weapon.adsZoom : this.settings.fov;
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 12, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  public endRound(winner: TeamSide, reason: string): void {
    if (this.roundPhase === 'ROUND_END' || this.roundPhase === 'MATCH_OVER') return;

    this.roundPhase = 'ROUND_END';
    this.roundTimer = ROUND_END_DURATION;

    const playerWon = winner === this.playerTeam;
    soundEngine.playRoundEnd(playerWon);

    if (winner === 'ATTACKERS') {
      this.attackerRoundsWon++;
    } else {
      this.defenderRoundsWon++;
    }

    this.callbacks.onRoundScoreChange(this.attackerRoundsWon, this.defenderRoundsWon, this.roundNumber);

    // Economy payouts
    const playerEcon = calculateEconomy(
      this.playerStats[0].credits,
      playerWon,
      this.playerLossStreak,
      this.spikeState === 'planted',
      0
    );
    this.playerStats[0].credits = playerEcon.newCredits;
    this.playerLossStreak = playerEcon.nextLossStreak;

    // Check Match Win (First to 13 rounds)
    const matchWinner = checkMatchWin(this.attackerRoundsWon, this.defenderRoundsWon);
    if (matchWinner) {
      this.roundPhase = 'MATCH_OVER';
      this.callbacks.onMatchOver(matchWinner);
    }
  }

  public startNextRound(): void {
    this.roundNumber++;

    // Halftime side swap check (after round 12)
    if (shouldSwapSides(this.roundNumber - 1)) {
      this.playerTeam = this.playerTeam === 'ATTACKERS' ? 'DEFENDERS' : 'ATTACKERS';
      this.playerCombatant.team = this.playerTeam;

      for (const c of this.combatants) {
        c.team = c.team === 'ATTACKERS' ? 'DEFENDERS' : 'ATTACKERS';
      }
    }

    // Reset round states
    this.roundPhase = 'BUY_PHASE';
    this.roundTimer = BUY_PHASE_DURATION;
    this.spikeState = 'not_planted';
    this.spikeTimer = SPIKE_DETONATION_TIME;
    this.spikePosition = null;
    this.plantedSite = null;

    if (this.spikeMesh) {
      this.scene.remove(this.spikeMesh);
      this.spikeMesh = null;
    }

    this.abilityMgr.clearAll();

    // Respawn all combatants at their spawn points
    const attSpawn = SPAWN_ATTACKERS;
    const defSpawn = SPAWN_DEFENDERS;

    this.combatants.forEach((c, idx) => {
      c.alive = true;
      c.hp = 100;
      c.armor = 0;
      c.isPlanting = false;
      c.isDefusing = false;
      c.actionProgress = 0;
      c.modelPackage.root.visible = !c.isHuman;

      const isAttacker = c.team === 'ATTACKERS';
      const spawnBase = isAttacker ? attSpawn : defSpawn;
      const offsetX = (idx % 5 - 2) * 2.8;

      c.position.set(spawnBase.x + offsetX, 0, spawnBase.z);
      c.yaw = isAttacker ? Math.PI : 0;
      c.ammoInMag = c.weapon.magazineSize;
      c.reserveAmmo = c.weapon.reserveAmmo;
      c.reloadTimer = 0;
      c.shootCooldown = 0;

      // Assign spike to attacker #1
      c.hasSpike = isAttacker && (idx === 0 || (idx === 5 && !this.playerCombatant.hasSpike));
      if (c.hasSpike) this.spikeCarrierId = c.id;

      const stats = this.playerStats.find((s) => s.id === c.id);
      if (stats) {
        stats.alive = true;
        stats.hp = 100;
        stats.armor = 0;
        stats.hasSpike = c.hasSpike;
      }
    });

    this.callbacks.onStatsUpdate([...this.playerStats]);
    this.callbacks.onPlayerHealthUpdate(100, 0, 100, 50);
    this.callbacks.onWeaponUpdate(this.playerCombatant.weapon, this.playerCombatant.ammoInMag, this.playerCombatant.reserveAmmo, false);
    this.callbacks.onSpikeStateUpdate('not_planted', SPIKE_DETONATION_TIME, 0, 0);

    // Camera reset to player spawn
    this.camera.position.set(this.playerCombatant.position.x, 1.65, this.playerCombatant.position.z);
  }

  // Buy Menu Purchases
  public buyItem(itemId: string): boolean {
    if (this.roundPhase !== 'BUY_PHASE') return false;

    const stats = this.playerStats[0];
    const p = this.playerCombatant;

    // Weapon
    if (WEAPON_REGISTRY[itemId]) {
      const w = WEAPON_REGISTRY[itemId];
      if (stats.credits >= w.cost) {
        stats.credits -= w.cost;
        p.weapon = w;
        p.ammoInMag = w.magazineSize;
        p.reserveAmmo = w.reserveAmmo;
        this.updateViewmodelWeapon(w.id);
        this.callbacks.onWeaponUpdate(w, p.ammoInMag, p.reserveAmmo, false);
        this.callbacks.onStatsUpdate([...this.playerStats]);
        return true;
      }
    }

    // Shield
    if (SHIELD_REGISTRY[itemId]) {
      const s = SHIELD_REGISTRY[itemId];
      if (stats.credits >= s.cost) {
        stats.credits -= s.cost;
        p.armor = s.armorPoints;
        stats.armor = s.armorPoints;
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
    this.input.detectDevice();
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
