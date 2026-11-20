/**
 * Hollow Strike - Game Types and Constants
 */

export type TeamSide = 'ATTACKERS' | 'DEFENDERS';

export type MatchMode = 'COMPETITIVE' | 'SKIRMISH' | 'PRACTICE' | 'CUSTOM';

export type RoundPhase =
  | 'BUY_PHASE'       // Buy time, barrier up
  | 'ROUND_LIVE'      // 100s live round
  | 'SPIKE_PLANTED'   // 45s spike detonation countdown
  | 'ROUND_END'       // 5s round wrap-up & score update
  | 'MATCH_OVER';     // First to 13 rounds won

export type BotDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type GraphicsPreset = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';

export type ControlMode = 'AUTO' | 'TOUCH' | 'DESKTOP';

export type WeaponCategory =
  | 'SIDEARM'
  | 'SMG'
  | 'SHOTGUN'
  | 'RIFLE'
  | 'SNIPER'
  | 'MACHINE_GUN'
  | 'MELEE';

export interface WeaponDef {
  id: string;
  name: string;
  category: WeaponCategory;
  cost: number;
  damageHead: number;
  damageBody: number;
  damageLeg: number;
  fireRate: number;      // rounds per second (or swings per second for melee)
  magazineSize: number;
  reserveAmmo: number;
  reloadTime: number;    // seconds
  spreadBase: number;    // radians
  spreadRun: number;
  recoilPerShot: number;
  firstShotAccurate: boolean;
  canADS: boolean;
  adsZoom: number;       // FOV multiplier (e.g. 0.72 or 0.32 for sniper)
  pellets?: number;      // Multi-pellet burst per trigger pull (Shotguns / Frenky)
  isMelee?: boolean;
  range?: number;        // Effective max range in meters (melee or short falloff)
  description: string;
}

export interface ShieldDef {
  id: 'LIGHT_SHIELD' | 'HEAVY_SHIELD';
  name: string;
  cost: number;
  armorPoints: number;
  description: string;
}

export interface AbilityDef {
  id: string;
  name: string;
  keySlot: 'Q' | 'E' | 'C' | 'X';
  isUltimate: boolean;
  cost: number;
  maxCharges: number;
  cooldownTime: number; // seconds
  ultPointsRequired?: number;
  description: string;
  iconType: string;
}

export interface AbilitySlotState {
  keySlot: 'Q' | 'E' | 'C' | 'X';
  charges: number;
  maxCharges: number;
  cooldownRemaining: number;
  cooldownTotal: number;
  isUltimate: boolean;
  ultPoints: number;
  ultRequired: number;
  activeRemaining: number;
}

export interface AgentDef {
  id: string;
  name: string;
  role: 'CONTROLLER' | 'DUELIST' | 'SENTINEL' | 'INITIATOR';
  description: string;
  primaryColor: string;
  accentColor: string;
  abilities: AbilityDef[];
}

export interface KillEvent {
  id: string;
  killerName: string;
  killerTeam: TeamSide;
  victimName: string;
  victimTeam: TeamSide;
  weaponName: string;
  isHeadshot: boolean;
  timestamp: number;
}

export interface HitFeedback {
  active: boolean;
  isHeadshot: boolean;
  isKill: boolean;
  damage: number;
  targetName: string;
  targetHp: number;
  targetMaxHp: number;
}

export type SpectateCameraMode = 'THIRD_PERSON' | 'FIRST_PERSON';

export interface SpectateState {
  active: boolean;
  targetId: string | null;
  targetName: string;
  agentId: string;
  team: TeamSide;
  hp: number;
  armor: number;
  weaponName: string;
  ammoInMag: number;
  reserveAmmo: number;
  kills: number;
  deaths: number;
  aliveTeammatesCount: number;
  mode: SpectateCameraMode;
  practiceRespawnIn: number;
}

export interface PlayerStats {
  id: string;
  name: string;
  agentId: string;
  team: TeamSide;
  isHuman: boolean;
  isRemoteHuman?: boolean;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  credits: number;
  ping: number;
  alive: boolean;
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  hasSpike: boolean;
}

export type CrosshairColor = 'cyan' | 'green' | 'amber' | 'white' | 'rose';
export type CrosshairSize = 'small' | 'medium' | 'large';
export type CrosshairStyle = 'classic' | 'cross' | 'dot' | 'circle' | 'chevron' | 't-shape';

export interface CrosshairConfig {
  style: CrosshairStyle;
  color: string; // Hex color string (e.g. #22d3ee)
  length: number; // 2 - 22 px
  thickness: number; // 1 - 6 px
  gap: number; // 0 - 16 px
  showDot: boolean;
  dotSize: number; // 2 - 8 px
  opacity: number; // 0.25 - 1.0
  outline: boolean;
  dynamic: boolean;
}

export const DEFAULT_CROSSHAIR_CONFIG: CrosshairConfig = {
  style: 'classic',
  color: '#22d3ee',
  length: 8,
  thickness: 2,
  gap: 5,
  showDot: true,
  dotSize: 4,
  opacity: 0.92,
  outline: true,
  dynamic: true,
};

export interface CrosshairPreset {
  id: string;
  label: string;
  config: CrosshairConfig;
}

export const CROSSHAIR_PRESETS: CrosshairPreset[] = [
  {
    id: 'competitive',
    label: 'Competitive',
    config: { ...DEFAULT_CROSSHAIR_CONFIG },
  },
  {
    id: 'headshot_dot',
    label: 'Pinpoint Dot',
    config: {
      style: 'dot',
      color: '#34d399',
      length: 4,
      thickness: 2,
      gap: 2,
      showDot: true,
      dotSize: 5,
      opacity: 1,
      outline: true,
      dynamic: false,
    },
  },
  {
    id: 'holo_ring',
    label: 'Holo Ring',
    config: {
      style: 'circle',
      color: '#fbbf24',
      length: 7,
      thickness: 2,
      gap: 6,
      showDot: true,
      dotSize: 3,
      opacity: 0.9,
      outline: true,
      dynamic: true,
    },
  },
  {
    id: 'tactical_t',
    label: 'T-Bar Precision',
    config: {
      style: 't-shape',
      color: '#f8fafc',
      length: 9,
      thickness: 2,
      gap: 4,
      showDot: false,
      dotSize: 3,
      opacity: 0.95,
      outline: true,
      dynamic: true,
    },
  },
  {
    id: 'cyber_chevron',
    label: 'Cyber Chevron',
    config: {
      style: 'chevron',
      color: '#fb7185',
      length: 9,
      thickness: 2,
      gap: 4,
      showDot: true,
      dotSize: 3,
      opacity: 0.95,
      outline: true,
      dynamic: true,
    },
  },
];

export type TouchControlId =
  | 'joystick'
  | 'fire'
  | 'ads'
  | 'crouch'
  | 'jump'
  | 'reload'
  | 'weaponSwap'
  | 'plantDefuse'
  | 'abilityE'
  | 'abilityQ'
  | 'abilityC'
  | 'abilityX';

export interface TouchControlSlot {
  xPct: number; // Horizontal center anchor % of viewport width (4..96)
  yPct: number; // Vertical center anchor % of viewport height (12..94)
  scale: number; // 0.65..1.5
  visible: boolean;
}

export type TouchControlLayout = Record<TouchControlId, TouchControlSlot>;
export type TouchLayoutPresetId = 'DEFAULT' | 'CLAW_4FINGER' | 'LEFT_HANDED';

export const DEFAULT_TOUCH_LAYOUT: TouchControlLayout = {
  joystick: { xPct: 12, yPct: 78, scale: 1.0, visible: true },
  fire: { xPct: 92, yPct: 81, scale: 1.0, visible: true },
  plantDefuse: { xPct: 92, yPct: 60, scale: 1.0, visible: true },
  weaponSwap: { xPct: 92, yPct: 43, scale: 1.0, visible: true },
  jump: { xPct: 81, yPct: 86, scale: 1.0, visible: true },
  reload: { xPct: 81, yPct: 71, scale: 1.0, visible: true },
  ads: { xPct: 81, yPct: 56, scale: 1.0, visible: true },
  crouch: { xPct: 81, yPct: 41, scale: 1.0, visible: true },
  abilityX: { xPct: 72, yPct: 86, scale: 1.0, visible: true },
  abilityC: { xPct: 72, yPct: 71, scale: 1.0, visible: true },
  abilityQ: { xPct: 72, yPct: 56, scale: 1.0, visible: true },
  abilityE: { xPct: 72, yPct: 41, scale: 1.0, visible: true },
};

export const TOUCH_LAYOUT_PRESETS: Record<TouchLayoutPresetId, { label: string; layout: TouchControlLayout }> = {
  DEFAULT: {
    label: 'Default Thumb',
    layout: DEFAULT_TOUCH_LAYOUT,
  },
  CLAW_4FINGER: {
    label: '4-Finger Claw',
    layout: {
      joystick: { xPct: 12, yPct: 78, scale: 1.0, visible: true },
      fire: { xPct: 12, yPct: 26, scale: 1.05, visible: true },
      ads: { xPct: 89, yPct: 26, scale: 1.0, visible: true },
      jump: { xPct: 91, yPct: 78, scale: 1.05, visible: true },
      crouch: { xPct: 81, yPct: 84, scale: 0.95, visible: true },
      reload: { xPct: 80, yPct: 67, scale: 0.95, visible: true },
      weaponSwap: { xPct: 92, yPct: 56, scale: 0.95, visible: true },
      plantDefuse: { xPct: 80, yPct: 46, scale: 1.0, visible: true },
      abilityE: { xPct: 70, yPct: 72, scale: 0.9, visible: true },
      abilityQ: { xPct: 70, yPct: 56, scale: 0.9, visible: true },
      abilityC: { xPct: 62, yPct: 84, scale: 0.9, visible: true },
      abilityX: { xPct: 71, yPct: 86, scale: 0.95, visible: true },
    },
  },
  LEFT_HANDED: {
    label: 'Left-Handed Swap',
    layout: {
      joystick: { xPct: 88, yPct: 78, scale: 1.0, visible: true },
      fire: { xPct: 8, yPct: 81, scale: 1.0, visible: true },
      plantDefuse: { xPct: 8, yPct: 60, scale: 1.0, visible: true },
      weaponSwap: { xPct: 8, yPct: 43, scale: 1.0, visible: true },
      jump: { xPct: 19, yPct: 86, scale: 1.0, visible: true },
      reload: { xPct: 19, yPct: 71, scale: 1.0, visible: true },
      ads: { xPct: 19, yPct: 56, scale: 1.0, visible: true },
      crouch: { xPct: 19, yPct: 41, scale: 1.0, visible: true },
      abilityX: { xPct: 28, yPct: 86, scale: 1.0, visible: true },
      abilityC: { xPct: 28, yPct: 71, scale: 1.0, visible: true },
      abilityQ: { xPct: 28, yPct: 56, scale: 1.0, visible: true },
      abilityE: { xPct: 28, yPct: 41, scale: 1.0, visible: true },
    },
  },
};

export interface KeyBindings {
  moveForward: string;
  moveBackward: string;
  moveLeft: string;
  moveRight: string;
  jump: string;
  crouch: string;
  reload: string;
  inspectWeapon: string;
  plantDefuse: string;
  abilityE: string;
  abilityQ: string;
  abilityC: string;
  abilityX: string;
  primaryWeapon: string;
  sidearmWeapon: string;
  meleeWeapon: string;
  buyMenu: string;
  tacticalMap: string;
  scoreboard: string;
  pause: string;
  startRound: string;
}

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  moveForward: 'KeyW',
  moveBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  crouch: 'ControlLeft',
  reload: 'KeyR',
  inspectWeapon: 'KeyY',
  plantDefuse: 'KeyF',
  abilityE: 'KeyE',
  abilityQ: 'KeyQ',
  abilityC: 'KeyC',
  abilityX: 'KeyX',
  primaryWeapon: 'Digit1',
  sidearmWeapon: 'Digit2',
  meleeWeapon: 'Digit3',
  buyMenu: 'KeyB',
  tacticalMap: 'KeyM',
  scoreboard: 'Tab',
  pause: 'KeyP',
  startRound: 'KeyG',
};

export interface GameSettings {
  graphics: GraphicsPreset;
  fpsCap: 30 | 60 | 120 | 0; // 0 = unlimited
  showFps: boolean;
  mouseSensitivity: number;
  touchSensitivity: number;
  adsSensitivityMultiplier: number;
  invertY: boolean;
  fov: number;
  crosshairColor: CrosshairColor;
  crosshairSize: CrosshairSize;
  crosshairConfig?: CrosshairConfig;
  volume: number;
  soundEnabled: boolean;
  autoFireMobile: boolean;
  aimAssistMobile: boolean;
  touchScale: number; // 0.8 - 1.3
  touchOpacity: number; // 0.3 - 1.0
  touchLayout?: TouchControlLayout;
  controlMode: ControlMode;
  keyBindings: KeyBindings;
}

export interface AgentCareerStats {
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
}

export interface WeaponCareerStats {
  kills: number;
  headshots: number;
  shotsFired: number;
  shotsHit: number;
  damageDealt: number;
}

export interface MatchRecord {
  id: string;
  timestamp: number;
  mode: MatchMode;
  difficulty: BotDifficulty;
  agentId: string;
  won: boolean;
  playerTeam: TeamSide;
  attackerScore: number;
  defenderScore: number;
  kills: number;
  deaths: number;
  headshots: number;
  damageDealt: number;
}

export interface PlayerProfile {
  callsign: string;
  favoriteAgentId: string;
  totalMatches: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  headshots: number;
  damageDealt: number;
  roundsWon: number;
  roundsLost: number;
  agentStats: Record<string, AgentCareerStats>;
  weaponStats: Record<string, WeaponCareerStats>;
  matchHistory: MatchRecord[];
}

export const STARTER_SIDEARM_ID = 'KADENCE';
export const DEFAULT_PRIMARY_ID = 'REAPER';
export const MELEE_WEAPON_ID = 'HOLLOW_BLADE';

export const WEAPON_REGISTRY: Record<string, WeaponDef> = {
  // === SIDEARMS ===
  KADENCE: {
    id: 'KADENCE',
    name: 'Kadence',
    category: 'SIDEARM',
    cost: 0,
    damageHead: 105,
    damageBody: 34,
    damageLeg: 26,
    fireRate: 6.5,
    magazineSize: 12,
    reserveAmmo: 36,
    reloadTime: 1.4,
    spreadBase: 0.007,
    spreadRun: 0.042,
    recoilPerShot: 0.015,
    firstShotAccurate: true,
    canADS: false,
    adsZoom: 1.0,
    description: 'Standard-issue balanced semi-auto service pistol with crisp first-shot precision.',
  },
  THORN: {
    id: 'THORN',
    name: 'Thorn',
    category: 'SIDEARM',
    cost: 400,
    damageHead: 96,
    damageBody: 32,
    damageLeg: 25,
    fireRate: 8.0,
    magazineSize: 13,
    reserveAmmo: 39,
    reloadTime: 1.45,
    spreadBase: 0.008,
    spreadRun: 0.045,
    recoilPerShot: 0.016,
    firstShotAccurate: true,
    canADS: false,
    adsZoom: 1.0,
    description: 'Nimble high-capacity tactical pistol tuned for close-quarters bursts.',
  },
  FURY: {
    id: 'FURY',
    name: 'Fury',
    category: 'SIDEARM',
    cost: 450,
    damageHead: 66,
    damageBody: 26,
    damageLeg: 21,
    fireRate: 10.5,
    magazineSize: 15,
    reserveAmmo: 45,
    reloadTime: 1.55,
    spreadBase: 0.014,
    spreadRun: 0.05,
    recoilPerShot: 0.019,
    firstShotAccurate: false,
    canADS: false,
    adsZoom: 1.0,
    description: 'Full-automatic machine pistol built to overwhelm opponents in pistol rounds.',
  },
  FRENKY: {
    id: 'FRENKY',
    name: 'Frenky',
    category: 'SIDEARM',
    cost: 300,
    damageHead: 22,
    damageBody: 12,
    damageLeg: 9,
    fireRate: 3.3,
    magazineSize: 2,
    reserveAmmo: 10,
    reloadTime: 1.7,
    spreadBase: 0.065,
    spreadRun: 0.095,
    recoilPerShot: 0.045,
    firstShotAccurate: false,
    canADS: false,
    adsZoom: 1.0,
    pellets: 6,
    range: 16,
    description: 'Double-barrel pocket scattergun pistol. Devastating at point-blank corners.',
  },
  HANGMAN: {
    id: 'HANGMAN',
    name: 'Hangman',
    category: 'SIDEARM',
    cost: 800,
    damageHead: 159,
    damageBody: 55,
    damageLeg: 46,
    fireRate: 3.4,
    magazineSize: 6,
    reserveAmmo: 24,
    reloadTime: 1.85,
    spreadBase: 0.004,
    spreadRun: 0.058,
    recoilPerShot: 0.055,
    firstShotAccurate: true,
    canADS: true,
    adsZoom: 0.88,
    description: 'Heavy-caliber revolver delivering lethal 1-tap headshots at eco prices.',
  },

  // === SMGs ===
  MANTIS: {
    id: 'MANTIS',
    name: 'Mantis',
    category: 'SMG',
    cost: 1600,
    damageHead: 78,
    damageBody: 26,
    damageLeg: 22,
    fireRate: 13.5,
    magazineSize: 30,
    reserveAmmo: 90,
    reloadTime: 1.85,
    spreadBase: 0.014,
    spreadRun: 0.048,
    recoilPerShot: 0.02,
    firstShotAccurate: false,
    canADS: true,
    adsZoom: 0.82,
    description: 'Integrally suppressed tactical SMG with laser-tight mid-close control.',
  },
  STINGRAY: {
    id: 'STINGRAY',
    name: 'Stingray',
    category: 'SMG',
    cost: 1100,
    damageHead: 67,
    damageBody: 27,
    damageLeg: 22,
    fireRate: 15.0,
    magazineSize: 24,
    reserveAmmo: 72,
    reloadTime: 1.75,
    spreadBase: 0.018,
    spreadRun: 0.045,
    recoilPerShot: 0.024,
    firstShotAccurate: false,
    canADS: true,
    adsZoom: 0.85,
    description: 'Blistering rate-of-fire rush SMG built for aggressive entry speed.',
  },

  // === SHOTGUNS ===
  SLUG: {
    id: 'SLUG',
    name: 'Slug',
    category: 'SHOTGUN',
    cost: 850,
    damageHead: 40,
    damageBody: 20,
    damageLeg: 16,
    fireRate: 1.3,
    magazineSize: 5,
    reserveAmmo: 15,
    reloadTime: 2.3,
    spreadBase: 0.048,
    spreadRun: 0.08,
    recoilPerShot: 0.065,
    firstShotAccurate: false,
    canADS: false,
    adsZoom: 1.0,
    pellets: 8,
    range: 22,
    description: 'Heavy pump-action combat shotgun launching an 8-pellet lethal spread.',
  },
  JACKAL: {
    id: 'JACKAL',
    name: 'Jackal',
    category: 'SHOTGUN',
    cost: 1850,
    damageHead: 32,
    damageBody: 16,
    damageLeg: 13,
    fireRate: 3.5,
    magazineSize: 7,
    reserveAmmo: 21,
    reloadTime: 2.4,
    spreadBase: 0.056,
    spreadRun: 0.085,
    recoilPerShot: 0.05,
    firstShotAccurate: false,
    canADS: false,
    adsZoom: 1.0,
    pellets: 7,
    range: 20,
    description: 'Rapid semi-automatic drum shotgun built for clearing cramped site pockets.',
  },

  // === RIFLES ===
  REAPER: {
    id: 'REAPER',
    name: 'Reaper',
    category: 'RIFLE',
    cost: 2900,
    damageHead: 160,
    damageBody: 40,
    damageLeg: 34,
    fireRate: 9.75,
    magazineSize: 25,
    reserveAmmo: 75,
    reloadTime: 2.2,
    spreadBase: 0.0045,
    spreadRun: 0.08,
    recoilPerShot: 0.036,
    firstShotAccurate: true,
    canADS: true,
    adsZoom: 0.76,
    description: 'Premier high-caliber assault rifle. Uncompromising 1-tap headshots at any range.',
  },
  ECLIPSE: {
    id: 'ECLIPSE',
    name: 'Eclipse',
    category: 'RIFLE',
    cost: 2900,
    damageHead: 156,
    damageBody: 39,
    damageLeg: 33,
    fireRate: 11.0,
    magazineSize: 30,
    reserveAmmo: 90,
    reloadTime: 2.05,
    spreadBase: 0.004,
    spreadRun: 0.072,
    recoilPerShot: 0.028,
    firstShotAccurate: true,
    canADS: true,
    adsZoom: 0.75,
    description: 'Suppressed phantom-grade rifle offering razor spray control and 30-round mags.',
  },
  VEIL: {
    id: 'VEIL',
    name: 'Veil',
    category: 'RIFLE',
    cost: 2050,
    damageHead: 138,
    damageBody: 34,
    damageLeg: 29,
    fireRate: 8.5,
    magazineSize: 24,
    reserveAmmo: 72,
    reloadTime: 2.0,
    spreadBase: 0.0055,
    spreadRun: 0.074,
    recoilPerShot: 0.029,
    firstShotAccurate: true,
    canADS: true,
    adsZoom: 0.68,
    description: 'Versatile scoped tactical carbine with tight zoomed accuracy.',
  },
  TUSK: {
    id: 'TUSK',
    name: 'Tusk',
    category: 'RIFLE',
    cost: 2250,
    damageHead: 120,
    damageBody: 35,
    damageLeg: 29,
    fireRate: 9.2,
    magazineSize: 20,
    reserveAmmo: 60,
    reloadTime: 2.1,
    spreadBase: 0.005,
    spreadRun: 0.076,
    recoilPerShot: 0.032,
    firstShotAccurate: true,
    canADS: true,
    adsZoom: 0.7,
    description: 'Heavy-hitting armored carbine engineered for force-buy rifle duels.',
  },

  // === SNIPERS ===
  BOLT: {
    id: 'BOLT',
    name: 'Bolt',
    category: 'SNIPER',
    cost: 1500,
    damageHead: 202,
    damageBody: 101,
    damageLeg: 85,
    fireRate: 1.5,
    magazineSize: 5,
    reserveAmmo: 15,
    reloadTime: 2.5,
    spreadBase: 0.001,
    spreadRun: 0.16,
    recoilPerShot: 0.08,
    firstShotAccurate: true,
    canADS: true,
    adsZoom: 0.42,
    description: 'Lightweight agile scout sniper capable of snappy flicks and one-shot headshots.',
  },
  ORACLE: {
    id: 'ORACLE',
    name: 'Oracle',
    category: 'SNIPER',
    cost: 4700,
    damageHead: 255,
    damageBody: 150,
    damageLeg: 120,
    fireRate: 0.75,
    magazineSize: 5,
    reserveAmmo: 15,
    reloadTime: 3.1,
    spreadBase: 0.0008,
    spreadRun: 0.22,
    recoilPerShot: 0.12,
    firstShotAccurate: true,
    canADS: true,
    adsZoom: 0.30,
    description: 'Apex dual-zoom anti-materiel sniper rifle. One lethal center-mass elimination.',
  },

  // === MACHINE GUNS ===
  STORM: {
    id: 'STORM',
    name: 'Storm',
    category: 'MACHINE_GUN',
    cost: 1600,
    damageHead: 68,
    damageBody: 28,
    damageLeg: 23,
    fireRate: 11.5,
    magazineSize: 50,
    reserveAmmo: 100,
    reloadTime: 3.0,
    spreadBase: 0.015,
    spreadRun: 0.095,
    recoilPerShot: 0.025,
    firstShotAccurate: false,
    canADS: true,
    adsZoom: 0.78,
    description: 'Rapid-fire tactical squad LMG for locking down corridors with sustained lead.',
  },
  THOR: {
    id: 'THOR',
    name: 'Thor',
    category: 'MACHINE_GUN',
    cost: 3200,
    damageHead: 95,
    damageBody: 38,
    damageLeg: 32,
    fireRate: 13.0,
    magazineSize: 100,
    reserveAmmo: 200,
    reloadTime: 3.8,
    spreadBase: 0.013,
    spreadRun: 0.11,
    recoilPerShot: 0.026,
    firstShotAccurate: false,
    canADS: true,
    adsZoom: 0.74,
    description: '100-round belt-fed heavy siege gun built to shred barriers and rushes.',
  },

  // === MELEE ===
  HOLLOW_BLADE: {
    id: 'HOLLOW_BLADE',
    name: 'Hollow Blade',
    category: 'MELEE',
    cost: 0,
    damageHead: 110,
    damageBody: 55,
    damageLeg: 50,
    fireRate: 2.2,
    magazineSize: 1,
    reserveAmmo: 0,
    reloadTime: 0.5,
    spreadBase: 0,
    spreadRun: 0,
    recoilPerShot: 0,
    firstShotAccurate: true,
    canADS: false,
    adsZoom: 1.0,
    isMelee: true,
    range: 2.8,
    description: 'Razor-edged Void-forged tactical blade. Highest sprint speed and silent close slashes.',
  },
};

export const SHIELD_REGISTRY: Record<string, ShieldDef> = {
  LIGHT_SHIELD: {
    id: 'LIGHT_SHIELD',
    name: 'Light Kevlar',
    cost: 400,
    armorPoints: 25,
    description: 'Absorbs 66% of incoming damage up to 25 HP.',
  },
  HEAVY_SHIELD: {
    id: 'HEAVY_SHIELD',
    name: 'Titan Plating',
    cost: 1000,
    armorPoints: 50,
    description: 'Absorbs 66% of incoming damage up to 50 HP.',
  },
};

export const AGENT_REGISTRY: Record<string, AgentDef> = {
  ZEPHYR: {
    id: 'ZEPHYR',
    name: 'Zephyr',
    role: 'CONTROLLER',
    description: 'Atmospheric controller who commands dense smoke screens and vision-dampening zones.',
    primaryColor: '#06b6d4',
    accentColor: '#0e7490',
    abilities: [
      {
        id: 'HOLLOW_SMOKE',
        name: 'Hollow Smoke',
        keySlot: 'E',
        isUltimate: false,
        cost: 150,
        maxCharges: 2,
        cooldownTime: 10,
        description: 'Deploy an opaque sphere that blocks line of sight for 14 seconds.',
        iconType: 'smoke',
      },
      {
        id: 'TOXIN_PUDDLE',
        name: 'Toxin Puddle',
        keySlot: 'Q',
        isUltimate: false,
        cost: 200,
        maxCharges: 1,
        cooldownTime: 14,
        description: 'Launch a chemical canister that creates a slowing, damaging corrosive pool.',
        iconType: 'puddle',
      },
      {
        id: 'STIM_BEACON',
        name: 'Stim Beacon',
        keySlot: 'C',
        isUltimate: false,
        cost: 200,
        maxCharges: 1,
        cooldownTime: 18,
        description: 'Place a combat beacon granting +25% fire rate and faster reloads.',
        iconType: 'beacon',
      },
      {
        id: 'ORBITAL_BLACKOUT',
        name: 'Orbital Blackout',
        keySlot: 'X',
        isUltimate: true,
        cost: 0,
        maxCharges: 1,
        cooldownTime: 0,
        ultPointsRequired: 5,
        description: 'Cast a massive blackout field across an area, blinding and slowing foes.',
        iconType: 'blackout',
      },
    ],
  },
  BLITZ: {
    id: 'BLITZ',
    name: 'Blitz',
    role: 'DUELIST',
    description: 'High-velocity entry fragger equipped with blinding pulse flares and burst dashes.',
    primaryColor: '#f97316',
    accentColor: '#c2410c',
    abilities: [
      {
        id: 'BLIND_PULSE',
        name: 'Blind Pulse',
        keySlot: 'E',
        isUltimate: false,
        cost: 250,
        maxCharges: 2,
        cooldownTime: 10,
        description: 'Cast an explosive flare forward that stuns and blinds nearby enemies.',
        iconType: 'flash',
      },
      {
        id: 'KINETIC_DASH',
        name: 'Kinetic Dash',
        keySlot: 'Q',
        isUltimate: false,
        cost: 150,
        maxCharges: 2,
        cooldownTime: 9,
        description: 'Instantly burst in your movement direction with rapid speed.',
        iconType: 'dash',
      },
      {
        id: 'CONCUSSION_MINE',
        name: 'Concussion Mine',
        keySlot: 'C',
        isUltimate: false,
        cost: 200,
        maxCharges: 1,
        cooldownTime: 15,
        description: 'Throw a shock charge that damages and slows enemies in its blast radius.',
        iconType: 'mine',
      },
      {
        id: 'OVERDRIVE_MATRIX',
        name: 'Overdrive Matrix',
        keySlot: 'X',
        isUltimate: true,
        cost: 0,
        maxCharges: 1,
        cooldownTime: 0,
        ultPointsRequired: 5,
        description: 'Ignite kinetic servos for 12s: +35% speed, +30% fire rate, and heal on kill.',
        iconType: 'overdrive',
      },
    ],
  },
  BASTION: {
    id: 'BASTION',
    name: 'Bastion',
    role: 'SENTINEL',
    description: 'Defensive engineer who holds chokepoints with solid energy barriers and sentry turrets.',
    primaryColor: '#3b82f6',
    accentColor: '#1d4ed8',
    abilities: [
      {
        id: 'BARRIER_WALL',
        name: 'Barrier Wall',
        keySlot: 'E',
        isUltimate: false,
        cost: 350,
        maxCharges: 1,
        cooldownTime: 22,
        description: 'Raise a solid physical barrier wall blocking passage and bullets.',
        iconType: 'wall',
      },
      {
        id: 'STASIS_TRIPWIRE',
        name: 'Stasis Tripwire',
        keySlot: 'Q',
        isUltimate: false,
        cost: 200,
        maxCharges: 2,
        cooldownTime: 14,
        description: 'Deploy a covert laser sensor that reveals and slows intruders.',
        iconType: 'tripwire',
      },
      {
        id: 'SENTINEL_TURRET',
        name: 'Sentinel Turret',
        keySlot: 'C',
        isUltimate: false,
        cost: 200,
        maxCharges: 1,
        cooldownTime: 22,
        description: 'Deploy an automated sentry turret that fires bursts at spotted foes.',
        iconType: 'turret',
      },
      {
        id: 'LOCKDOWN_DOME',
        name: 'Lockdown Dome',
        keySlot: 'X',
        isUltimate: true,
        cost: 0,
        maxCharges: 1,
        cooldownTime: 0,
        ultPointsRequired: 5,
        description: 'Channel a containment dome that slows and weakens all enemies inside.',
        iconType: 'lockdown',
      },
    ],
  },
  LUMEN: {
    id: 'LUMEN',
    name: 'Lumen',
    role: 'INITIATOR',
    description: 'Support agent capable of recon pulses, tactical healing bursts, and battlefield resurrection.',
    primaryColor: '#10b981',
    accentColor: '#047857',
    abilities: [
      {
        id: 'HEALING_BURST',
        name: 'Healing Burst',
        keySlot: 'E',
        isUltimate: false,
        cost: 200,
        maxCharges: 2,
        cooldownTime: 12,
        description: 'Channel rejuvenating nanites to heal yourself and nearby allies for +60 HP.',
        iconType: 'heal',
      },
      {
        id: 'RECON_PULSE',
        name: 'Recon Pulse',
        keySlot: 'Q',
        isUltimate: false,
        cost: 250,
        maxCharges: 1,
        cooldownTime: 16,
        description: 'Fire a sonar pulse revealing nearby enemies on the radar.',
        iconType: 'recon',
      },
      {
        id: 'GRAVITY_ORB',
        name: 'Gravity Orb',
        keySlot: 'C',
        isUltimate: false,
        cost: 200,
        maxCharges: 1,
        cooldownTime: 14,
        description: 'Launch a vortex orb that slows and damages enemies caught inside.',
        iconType: 'gravity',
      },
      {
        id: 'RESURGENCE',
        name: 'Resurgence',
        keySlot: 'X',
        isUltimate: true,
        cost: 0,
        maxCharges: 1,
        cooldownTime: 0,
        ultPointsRequired: 6,
        description: 'Channel cellular resurrection to revive a fallen teammate with 100 HP.',
        iconType: 'revive',
      },
    ],
  },
};

export const BUY_PHASE_DURATION = 15; // seconds
export const ROUND_LIVE_DURATION = 100; // seconds
export const SPIKE_PLANT_DURATION = 4.0; // seconds to plant
export const SPIKE_DEFUSE_DURATION = 5.0; // seconds to defuse
export const SPIKE_DETONATION_TIME = 45.0; // seconds fuse
export const ROUND_END_DURATION = 5.0; // seconds post-round
export const ROUNDS_TO_WIN = 13;
export const HALF_TIME_ROUND = 12; // Swap sides after round 12

// === REAL-TIME MULTIPLAYER & SOCIAL TYPES ===

export type OnlinePresenceStatus = 'ONLINE' | 'IN_LOBBY' | 'IN_MATCH' | 'OFFLINE';

export interface FriendEntry {
  username: string;
  status: OnlinePresenceStatus;
  roomCode?: string | null;
  agentId?: string;
}

export interface RoomInviteEntry {
  id: string;
  fromUsername: string;
  roomCode: string;
  mode: MatchMode;
  timestamp: number;
}

export interface RoomMember {
  username: string;
  team: TeamSide;
  agentId: string;
  ready: boolean;
  isHost: boolean;
  online: boolean;
}

export interface CustomRoomState {
  code: string;
  name: string;
  hostUsername: string;
  mode: MatchMode;
  botDifficulty: BotDifficulty;
  fillBots: boolean;
  isPublic: boolean;
  inMatch: boolean;
  members: RoomMember[];
}

export interface RemotePlayerSync {
  username: string;
  team: TeamSide;
  agentId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  crouch: boolean;
  weaponId: string;
  hp: number;
  armor: number;
  alive: boolean;
}
