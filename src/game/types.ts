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
  KAEL: {
    id: 'KAEL',
    name: 'Kael',
    role: 'DUELIST',
    description: 'Gravity-bending Duelist who warps into sites with Rift Surge and pulls foes into Singularity.',
    primaryColor: '#8b5cf6',
    accentColor: '#5b21b6',
    abilities: [
      {
        id: 'RIFT_SURGE',
        name: 'Rift Surge',
        keySlot: 'E',
        isUltimate: false,
        cost: 150,
        maxCharges: 2,
        cooldownTime: 9,
        description: 'Directional dash with brief low-gravity hang time for aggressive entry angles.',
        iconType: 'dash',
      },
      {
        id: 'GRAVITY_WELL',
        name: 'Gravity Well',
        keySlot: 'Q',
        isUltimate: false,
        cost: 200,
        maxCharges: 2,
        cooldownTime: 12,
        description: 'Pulls nearby enemies inward and slows their movement.',
        iconType: 'gravity',
      },
      {
        id: 'PHASE_STEP',
        name: 'Phase Step',
        keySlot: 'C',
        isUltimate: false,
        cost: 200,
        maxCharges: 1,
        cooldownTime: 14,
        description: 'Places a void anchor to snap back to within 10s.',
        iconType: 'beacon',
      },
      {
        id: 'SINGULARITY',
        name: 'Singularity',
        keySlot: 'X',
        isUltimate: true,
        cost: 0,
        maxCharges: 1,
        cooldownTime: 0,
        ultPointsRequired: 5,
        description: 'Localized zero-gravity vortex that lifts and damages enemies caught inside.',
        iconType: 'blackout',
      },
    ],
  },
  ZED: {
    id: 'ZED',
    name: 'Zed',
    role: 'DUELIST',
    description: 'Cyber-blade assassin with hyper-reflex dashes, recon shurikens, and lethal Blade Storm knives.',
    primaryColor: '#f97316',
    accentColor: '#c2410c',
    abilities: [
      {
        id: 'BLINK_SLASH',
        name: 'Blink Slash',
        keySlot: 'E',
        isUltimate: false,
        cost: 150,
        maxCharges: 2,
        cooldownTime: 8,
        description: 'Fast linear dash; slicing an enemy resets weapon draw speed.',
        iconType: 'dash',
      },
      {
        id: 'RICOCHET_SHURIKEN',
        name: 'Ricochet Shuriken',
        keySlot: 'Q',
        isUltimate: false,
        cost: 200,
        maxCharges: 2,
        cooldownTime: 11,
        description: 'Bouncing energy blade that pings nearby enemies and deals chip damage.',
        iconType: 'recon',
      },
      {
        id: 'SMOKE_VEIL',
        name: 'Smoke Veil',
        keySlot: 'C',
        isUltimate: false,
        cost: 150,
        maxCharges: 2,
        cooldownTime: 10,
        description: 'Instant compact nano-smoke for entries or retreats.',
        iconType: 'smoke',
      },
      {
        id: 'BLADE_STORM',
        name: 'Blade Storm',
        keySlot: 'X',
        isUltimate: true,
        cost: 0,
        maxCharges: 1,
        cooldownTime: 0,
        ultPointsRequired: 5,
        description: 'Equips 5 accurate cyber-overdrive blades: +35% speed, +30% fire rate, heal on kill.',
        iconType: 'overdrive',
      },
    ],
  },
  KORA: {
    id: 'KORA',
    name: 'Kora',
    role: 'CONTROLLER',
    description: 'Astral Controller commanding Nebula Domes, gravitational wells, and Cosmic Divide barriers.',
    primaryColor: '#06b6d4',
    accentColor: '#0e7490',
    abilities: [
      {
        id: 'NEBULA_DOME',
        name: 'Nebula Dome',
        keySlot: 'E',
        isUltimate: false,
        cost: 150,
        maxCharges: 2,
        cooldownTime: 10,
        description: 'Places up to 2 dense cosmic smokes across key chokepoints.',
        iconType: 'smoke',
      },
      {
        id: 'STARLIGHT_PULL',
        name: 'Starlight Pull',
        keySlot: 'Q',
        isUltimate: false,
        cost: 200,
        maxCharges: 1,
        cooldownTime: 14,
        description: 'Remotely activates a floor star to pull and slow enemies inward.',
        iconType: 'gravity',
      },
      {
        id: 'NOVA_BURST',
        name: 'Nova Burst',
        keySlot: 'C',
        isUltimate: false,
        cost: 200,
        maxCharges: 1,
        cooldownTime: 15,
        description: 'Detonates a placed star to concuss and blind nearby enemies.',
        iconType: 'flash',
      },
      {
        id: 'COSMIC_DIVIDE',
        name: 'Cosmic Divide',
        keySlot: 'X',
        isUltimate: true,
        cost: 0,
        maxCharges: 1,
        cooldownTime: 0,
        ultPointsRequired: 5,
        description: 'Raises a massive astral energy wall blocking bullets and splitting sites.',
        iconType: 'wall',
      },
    ],
  },
  SOREN: {
    id: 'SOREN',
    name: 'Soren',
    role: 'INITIATOR',
    description: 'Solar Initiator who breaches entrenched defenders with Prism Beams, flares, and Zenith Strikes.',
    primaryColor: '#eab308',
    accentColor: '#a16207',
    abilities: [
      {
        id: 'PRISM_BEAM',
        name: 'Prism Beam',
        keySlot: 'E',
        isUltimate: false,
        cost: 250,
        maxCharges: 1,
        cooldownTime: 14,
        description: 'Wall-piercing light beam that concusses and reveals enemies.',
        iconType: 'recon',
      },
      {
        id: 'SOLAR_FLARE',
        name: 'Solar Flare',
        keySlot: 'Q',
        isUltimate: false,
        cost: 250,
        maxCharges: 2,
        cooldownTime: 11,
        description: 'Controllable light orb that flashes enemies on detonation.',
        iconType: 'flash',
      },
      {
        id: 'MIRAGE_STEP',
        name: 'Mirage Step',
        keySlot: 'C',
        isUltimate: false,
        cost: 200,
        maxCharges: 1,
        cooldownTime: 16,
        description: 'Deploys a radiant hard-light stim decoy that boosts fire rate & baits fire.',
        iconType: 'beacon',
      },
      {
        id: 'ZENITH_STRIKE',
        name: 'Zenith Strike',
        keySlot: 'X',
        isUltimate: true,
        cost: 0,
        maxCharges: 1,
        cooldownTime: 0,
        ultPointsRequired: 6,
        description: 'Sweeping pillar of sunlight that damages, reveals, and clears defensive angles.',
        iconType: 'blackout',
      },
    ],
  },
  PULSE: {
    id: 'PULSE',
    name: 'Pulse',
    role: 'INITIATOR',
    description: 'Bio-electric recon specialist equipped with Arc Scanners, curving sparks, and Neural Storms.',
    primaryColor: '#10b981',
    accentColor: '#047857',
    abilities: [
      {
        id: 'ARC_SCANNER',
        name: 'Arc Scanner',
        keySlot: 'E',
        isUltimate: false,
        cost: 250,
        maxCharges: 1,
        cooldownTime: 14,
        description: 'Wall-sticking bolt emitting enemy-revealing sonar pulses across rooms.',
        iconType: 'recon',
      },
      {
        id: 'STATIC_FLASH',
        name: 'Static Flash',
        keySlot: 'Q',
        isUltimate: false,
        cost: 250,
        maxCharges: 2,
        cooldownTime: 11,
        description: 'Corner-curving electric spark that blinds enemies cleanly around cover.',
        iconType: 'flash',
      },
      {
        id: 'SURGE_DRONE',
        name: 'Surge Drone',
        keySlot: 'C',
        isUltimate: false,
        cost: 250,
        maxCharges: 1,
        cooldownTime: 16,
        description: 'Deploys an autonomous recon crawler that shocks and reveals locked targets.',
        iconType: 'turret',
      },
      {
        id: 'NEURAL_STORM',
        name: 'Neural Storm',
        keySlot: 'X',
        isUltimate: true,
        cost: 0,
        maxCharges: 1,
        cooldownTime: 0,
        ultPointsRequired: 6,
        description: 'Wide electromagnetic wave through walls that concusses, slows, and reveals foes.',
        iconType: 'lockdown',
      },
    ],
  },
  AEGIS: {
    id: 'AEGIS',
    name: 'Aegis',
    role: 'SENTINEL',
    description: 'Hard-light defensive Sentinel fortifying sites with Bastion Walls, Stasis Mines, and Fortress Domes.',
    primaryColor: '#3b82f6',
    accentColor: '#1d4ed8',
    abilities: [
      {
        id: 'BASTION_WALL',
        name: 'Bastion Wall',
        keySlot: 'E',
        isUltimate: false,
        cost: 350,
        maxCharges: 1,
        cooldownTime: 20,
        description: 'One-way energy barrier blocking enemy fire and passage.',
        iconType: 'wall',
      },
      {
        id: 'STASIS_MINE',
        name: 'Stasis Mine',
        keySlot: 'Q',
        isUltimate: false,
        cost: 200,
        maxCharges: 2,
        cooldownTime: 14,
        description: 'Concealed floor trap that tethers and reveals intruders.',
        iconType: 'tripwire',
      },
      {
        id: 'NANO_REPAIR',
        name: 'Nano-Repair',
        keySlot: 'C',
        isUltimate: false,
        cost: 200,
        maxCharges: 2,
        cooldownTime: 12,
        description: 'Field beacon that regenerates health and armor for yourself and nearby allies.',
        iconType: 'heal',
      },
      {
        id: 'FORTRESS_PROTOCOL',
        name: 'Fortress Protocol',
        keySlot: 'X',
        isUltimate: true,
        cost: 0,
        maxCharges: 1,
        cooldownTime: 0,
        ultPointsRequired: 5,
        description: '8-second protective containment dome blocking pushes and regenerating squad armor.',
        iconType: 'lockdown',
      },
    ],
  },
  ROOK: {
    id: 'ROOK',
    name: 'Rook',
    role: 'SENTINEL',
    description: 'Heavy-tech trapper securing flanks with automated Sentry Turrets, Shock Wires, and Lockdown Grids.',
    primaryColor: '#ef4444',
    accentColor: '#b91c1c',
    abilities: [
      {
        id: 'SENTRY_TURRET',
        name: 'Sentry Turret',
        keySlot: 'E',
        isUltimate: false,
        cost: 250,
        maxCharges: 1,
        cooldownTime: 20,
        description: '180-degree automated turret for flank alerts and sustained chip damage.',
        iconType: 'turret',
      },
      {
        id: 'SHOCK_WIRE',
        name: 'Shock Wire',
        keySlot: 'Q',
        isUltimate: false,
        cost: 200,
        maxCharges: 2,
        cooldownTime: 13,
        description: 'Laser tripwire field that tethers, reveals, and shocks enemies.',
        iconType: 'tripwire',
      },
      {
        id: 'BLAST_PACK',
        name: 'Blast Pack',
        keySlot: 'C',
        isUltimate: false,
        cost: 200,
        maxCharges: 2,
        cooldownTime: 14,
        description: 'Remote breach charge that knocks enemies back, damages, and breaks utility.',
        iconType: 'mine',
      },
      {
        id: 'LOCKDOWN_GRID',
        name: 'Lockdown Grid',
        keySlot: 'X',
        isUltimate: true,
        cost: 0,
        maxCharges: 1,
        cooldownTime: 0,
        ultPointsRequired: 5,
        description: 'Heavy beacon that slows and detains all enemies caught inside its perimeter.',
        iconType: 'lockdown',
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
  mapId?: string;
  tdmTeamSize?: 1 | 2;
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

export interface MapDef {
  id: string;
  name: string;
  sector: string;
  tagline: string;
  description: string;
  modelUrl: string | 'procedural';
  scaleXZ: number;
  scaleY: number;
  rotationY?: number;
  halfExtent: number;
  skyColor: number;
  fogColor: number;
  tags: string[];
  accentColor: string;
  spawnAttackers: { x: number; y: number; z: number };
  spawnDefenders: { x: number; y: number; z: number };
  siteA: { x: number; y: number; z: number; radius: number; name: string };
  siteB: { x: number; y: number; z: number; radius: number; name: string };
  barrierAttZ: number;
  barrierDefZ: number;
  supportsSpike?: boolean;
  isTdmOnly?: boolean;
  maxTeamSize?: number;
  allowedTeamSizes?: number[];
  isTrainingMap?: boolean;
}

export const MAP_REGISTRY: Record<string, MapDef> = {
  WAREHOUSE: {
    id: 'WAREHOUSE',
    name: 'Warehouse',
    sector: 'SECTOR 04 // 1v1 & 2v2 TDM',
    tagline: '1v1 / 2v2 TDM Only · Close-quarters cargo duel',
    description: 'High-ceiling cargo bay tuned exclusively for fast 1v1 and 2v2 Team Deathmatch duels. No Spike plants — pure gunplay and rotations.',
    modelUrl: '/models/Map/Warehouse.glb',
    scaleXZ: 1.85,
    scaleY: 1.35,
    halfExtent: 32,
    skyColor: 0x0d1526,
    fogColor: 0x10192d,
    tags: ['1v1 / 2v2 TDM', 'No Spike', 'Warehouse GLB'],
    accentColor: '#FF4655',
    spawnAttackers: { x: -13, y: 0, z: -18 },
    spawnDefenders: { x: 2, y: 0, z: 16.5 },
    siteA: { x: -19, y: 0, z: 1.5, radius: 4.5, name: 'Site A' },
    siteB: { x: 11, y: 0, z: -4.0, radius: 4.2, name: 'Site B' },
    barrierAttZ: -15.5,
    barrierDefZ: 12.5,
    supportsSpike: false,
    isTdmOnly: true,
    maxTeamSize: 2,
    allowedTeamSizes: [1, 2],
  },
  COURTYARD: {
    id: 'COURTYARD',
    name: 'Courtyard',
    sector: 'SECTOR 02 // VANGUARD CITADEL',
    tagline: 'Open mid duel · Dual citadel sites',
    description: 'Symmetric open-air tactical plaza with twin flanked avenues, elevated mid sightlines, and stone perimeter forts.',
    modelUrl: '/api/maps/courtyard.glb',
    scaleXZ: 0.72,
    scaleY: 0.85,
    rotationY: Math.PI,
    halfExtent: 46,
    skyColor: 0x16263d,
    fogColor: 0x1a2c47,
    tags: ['5v5 Standard', 'Classic Courtyard', 'Mid Control'],
    accentColor: '#17E5B8',
    spawnAttackers: { x: 0, y: 0, z: -26 },
    spawnDefenders: { x: 0, y: 0, z: 26 },
    siteA: { x: -18, y: 0, z: 11.5, radius: 4.6, name: 'Site A' },
    siteB: { x: 18, y: 0, z: 11.5, radius: 4.6, name: 'Site B' },
    barrierAttZ: -17.5,
    barrierDefZ: 18.5,
    supportsSpike: true,
    isTdmOnly: false,
    maxTeamSize: 5,
  },
  PROVING_GRID: {
    id: 'PROVING_GRID',
    name: 'Proving Grid',
    sector: 'SECTOR 01 // TACTICAL SANDBOX',
    tagline: 'Instant load · High-FPS competitive grid',
    description: 'Zero-download crisp architectural complex engineered for rapid tactical rotations, clear sightlines, and locked 60FPS combat.',
    modelUrl: 'procedural',
    scaleXZ: 1.0,
    scaleY: 1.0,
    halfExtent: 34,
    skyColor: 0x15243b,
    fogColor: 0x1a2c47,
    tags: ['Instant Load', 'Symmetrical', 'Low-Spec Friendly'],
    accentColor: '#fbbf24',
    spawnAttackers: { x: 0, y: 0, z: -28 },
    spawnDefenders: { x: 0, y: 0, z: 28 },
    siteA: { x: -18, y: 0, z: 2, radius: 4.5, name: 'Site A' },
    siteB: { x: 18, y: 0, z: 2, radius: 4.5, name: 'Site B' },
    barrierAttZ: -20,
    barrierDefZ: 20,
    supportsSpike: true,
    isTdmOnly: false,
    maxTeamSize: 5,
  },
  TRAINING_GROUND: {
    id: 'TRAINING_GROUND',
    name: 'The Range',
    sector: 'SECTOR 00 // VALKYRIE TRAINING RANGE',
    tagline: 'Shooting gallery · Plant & Defuse drills · Open island',
    description: 'Multi-level island training compound with live target boards (10m/18m/26m), speed/streak trials, Temple Plant & Dock Defuse modules, and full walkway access.',
    modelUrl: '/api/maps/training_ground.glb',
    scaleXZ: 1.0,
    scaleY: 1.0,
    halfExtent: 58,
    skyColor: 0x162b42,
    fogColor: 0x1d3652,
    tags: ['Training Area', 'All Guns Free', 'Drills & Bots'],
    accentColor: '#38bdf8',
    spawnAttackers: { x: -2, y: 8.05, z: 2 },
    spawnDefenders: { x: 24, y: 12.05, z: -8 },
    siteA: { x: -26, y: 12.3, z: -13, radius: 5.0, name: 'Temple Plant' },
    siteB: { x: 24, y: 5.05, z: 20, radius: 5.0, name: 'Dock Defuse' },
    barrierAttZ: -999,
    barrierDefZ: 999,
    supportsSpike: true,
    isTdmOnly: false,
    isTrainingMap: true,
    maxTeamSize: 5,
  },
};

export const DEFAULT_MAP_ID = 'WAREHOUSE';

export type TrainingDrillMode =
  | 'PRACTICE'
  | 'SPEED_30'
  | 'STREAK_50'
  | 'STRAFE'
  | 'PLANT_DRILL'
  | 'DEFUSE_DRILL'
  | 'FREE_ROAM';

export type TrainingZoneId =
  | 'PLAZA'
  | 'GALLERY'
  | 'PIT'
  | 'TEMPLE'
  | 'DOCK'
  | 'VILLAGE'
  | 'BUNKER'
  | 'ISLAND';

export interface TrainingZoneDef {
  id: TrainingZoneId;
  label: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export const TRAINING_ZONES: TrainingZoneDef[] = [
  { id: 'PLAZA', label: 'Plaza', x: -2, y: 8.05, z: 2, yaw: 0 },
  { id: 'GALLERY', label: 'Range', x: 24, y: 12.05, z: -6, yaw: 0 },
  { id: 'PIT', label: 'Mid Pit', x: 22, y: 8.6, z: 1, yaw: Math.PI / 2 },
  { id: 'TEMPLE', label: 'Temple', x: -26, y: 12.35, z: -13, yaw: 0 },
  { id: 'DOCK', label: 'Dock', x: 24, y: 5.1, z: 18, yaw: Math.PI },
  { id: 'VILLAGE', label: 'Village', x: 0, y: 12.5, z: -24, yaw: Math.PI },
  { id: 'BUNKER', label: 'Bunker', x: -16, y: 17.05, z: -28, yaw: Math.PI * 0.75 },
  { id: 'ISLAND', label: 'Sky Isle', x: 0, y: 47.6, z: -25, yaw: 0 },
];

export interface TrainingSessionState {
  drillMode: TrainingDrillMode;
  botArmor: boolean;
  botsStrafe: boolean;
  infiniteMag: boolean;
  activeTargetDistance: 10 | 18 | 26;
  trialStatus: 'IDLE' | 'RUNNING' | 'COMPLETE';
  trialTimeElapsed: number;
  trialKills: number;
  trialTarget: number;
  shotsFired: number;
  shotsHit: number;
  headshots: number;
  bestSpeedTime: number | null;
  bestStreakScore: number;
  spikeObjectiveActive: boolean;
  spikeObjectiveLabel: string;
  spikeObjectiveTimer: number;
}

export function getAvailableMaps(customFilenames: string[] = []): MapDef[] {
  const base = [
    MAP_REGISTRY.WAREHOUSE,
    MAP_REGISTRY.COURTYARD,
    MAP_REGISTRY.PROVING_GRID,
    MAP_REGISTRY.TRAINING_GROUND,
  ];
  const extras: MapDef[] = [];
  for (const file of customFilenames) {
    const clean = file.trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (lower === 'warehouse.glb' || lower === 'training_ground_map_under25mb.glb') continue;
    const baseName = clean.replace(/\.(glb|gltf)$/i, '').replace(/[_-]+/g, ' ');
    const id = `CUSTOM_${clean.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
    extras.push({
      ...MAP_REGISTRY.COURTYARD,
      id,
      name: baseName.toUpperCase(),
      sector: 'CUSTOM ARENA // LOCAL GLB',
      tagline: `Loaded from /models/Map/${clean}`,
      description: `Custom 3D tactical arena model (${clean}) with automated structural collision slicing.`,
      modelUrl: `/models/Map/${clean}`,
      tags: ['Custom GLB', 'Auto-Collider'],
      accentColor: '#38bdf8',
    });
  }
  return [...base, ...extras];
}

// === REAL-TIME TEXT CHAT & WEBRTC VOICE CHAT TYPES ===

export type ChatChannel = 'ROOM' | 'TEAM' | 'GLOBAL';

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  fromUsername: string;
  team?: TeamSide;
  text: string;
  timestamp: number;
}

export interface VoicePeerState {
  username: string;
  active: boolean;
  muted: boolean;
  speaking: boolean;
}

export interface VoiceSignalPayload {
  kind: 'offer' | 'answer' | 'ice';
  fromUsername: string;
  targetUsername: string;
  sdp?: { type: string; sdp?: string };
  candidate?: {
    candidate?: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
  };
}
