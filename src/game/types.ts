/**
 * Hollow Strike - Game Types and Constants
 */

export type TeamSide = 'ATTACKERS' | 'DEFENDERS';

export type MatchMode = 'COMPETITIVE' | 'SKIRMISH' | 'PRACTICE';

export type RoundPhase =
  | 'BUY_PHASE'       // Buy time, barrier up
  | 'ROUND_LIVE'      // 100s live round
  | 'SPIKE_PLANTED'   // 45s spike detonation countdown
  | 'ROUND_END'       // 5s round wrap-up & score update
  | 'MATCH_OVER';     // First to 13 rounds won

export type BotDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type GraphicsPreset = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';

export type ControlMode = 'AUTO' | 'TOUCH' | 'DESKTOP';

export interface WeaponDef {
  id: string;
  name: string;
  category: 'SIDEARM' | 'SMG' | 'RIFLE' | 'SNIPER';
  cost: number;
  damageHead: number;
  damageBody: number;
  damageLeg: number;
  fireRate: number;      // rounds per second
  magazineSize: number;
  reserveAmmo: number;
  reloadTime: number;    // seconds
  spreadBase: number;    // radians/degrees
  spreadRun: number;
  recoilPerShot: number;
  firstShotAccurate: boolean;
  canADS: boolean;
  adsZoom: number;       // FOV multiplier (e.g. 0.65 or 0.35 for sniper)
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

export const WEAPON_REGISTRY: Record<string, WeaponDef> = {
  APEX_9: {
    id: 'APEX_9',
    name: 'Apex-9',
    category: 'SIDEARM',
    cost: 0,
    damageHead: 105,
    damageBody: 38,
    damageLeg: 28,
    fireRate: 5.0,
    magazineSize: 12,
    reserveAmmo: 36,
    reloadTime: 1.4,
    spreadBase: 0.008,
    spreadRun: 0.045,
    recoilPerShot: 0.015,
    firstShotAccurate: true,
    canADS: false,
    adsZoom: 1.0,
    description: 'High mobility semi-automatic tactical sidearm.',
  },
  VIPER_9: {
    id: 'VIPER_9',
    name: 'Viper-9',
    category: 'SMG',
    cost: 1600,
    damageHead: 78,
    damageBody: 27,
    damageLeg: 20,
    fireRate: 14.0,
    magazineSize: 30,
    reserveAmmo: 90,
    reloadTime: 1.9,
    spreadBase: 0.02,
    spreadRun: 0.06,
    recoilPerShot: 0.022,
    firstShotAccurate: false,
    canADS: true,
    adsZoom: 0.85,
    description: 'Rapid-cycling submachine gun optimized for entry sweeps.',
  },
  PHANTOM_V: {
    id: 'PHANTOM_V',
    name: 'Phantom-V',
    category: 'RIFLE',
    cost: 2900,
    damageHead: 156,
    damageBody: 40,
    damageLeg: 32,
    fireRate: 9.5,
    magazineSize: 25,
    reserveAmmo: 75,
    reloadTime: 2.2,
    spreadBase: 0.005,
    spreadRun: 0.08,
    recoilPerShot: 0.035,
    firstShotAccurate: true,
    canADS: true,
    adsZoom: 0.75,
    description: 'Premier assault rifle with 1-tap lethal headshot potential.',
  },
  VOID_LANCE: {
    id: 'VOID_LANCE',
    name: 'Void-Lance',
    category: 'SNIPER',
    cost: 4700,
    damageHead: 255,
    damageBody: 150,
    damageLeg: 120,
    fireRate: 0.75,
    magazineSize: 5,
    reserveAmmo: 15,
    reloadTime: 3.2,
    spreadBase: 0.001,
    spreadRun: 0.22,
    recoilPerShot: 0.12,
    firstShotAccurate: true,
    canADS: true,
    adsZoom: 0.35,
    description: 'High-caliber anti-material cannon with devastating kinetic punch.',
  },
  ION_PISTOL: {
    id: 'ION_PISTOL',
    name: 'Ion-X',
    category: 'SIDEARM',
    cost: 500,
    damageHead: 125,
    damageBody: 46,
    damageLeg: 34,
    fireRate: 3.8,
    magazineSize: 8,
    reserveAmmo: 32,
    reloadTime: 1.5,
    spreadBase: 0.006,
    spreadRun: 0.04,
    recoilPerShot: 0.022,
    firstShotAccurate: true,
    canADS: true,
    adsZoom: 0.9,
    description: 'High-caliber sci-fi energy sidearm from the Ion Armory pack.',
  },
  VALKYRIE_RIFLE: {
    id: 'VALKYRIE_RIFLE',
    name: 'Valkyrie-R',
    category: 'RIFLE',
    cost: 2400,
    damageHead: 132,
    damageBody: 36,
    damageLeg: 28,
    fireRate: 10.5,
    magazineSize: 28,
    reserveAmmo: 84,
    reloadTime: 2.0,
    spreadBase: 0.007,
    spreadRun: 0.07,
    recoilPerShot: 0.028,
    firstShotAccurate: true,
    canADS: true,
    adsZoom: 0.78,
    description: 'Lightweight sci-fi pulse carbine tuned for rapid accurate bursts.',
  },
  HONEY_BADGER: {
    id: 'HONEY_BADGER',
    name: 'Badger-300',
    category: 'RIFLE',
    cost: 2700,
    damageHead: 144,
    damageBody: 38,
    damageLeg: 30,
    fireRate: 10.0,
    magazineSize: 30,
    reserveAmmo: 90,
    reloadTime: 2.1,
    spreadBase: 0.006,
    spreadRun: 0.065,
    recoilPerShot: 0.026,
    firstShotAccurate: true,
    canADS: true,
    adsZoom: 0.75,
    description: 'Integrally suppressed tactical carbine with tight close-to-mid grouping.',
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
