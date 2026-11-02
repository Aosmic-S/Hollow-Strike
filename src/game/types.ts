/**
 * Hollow Strike - Game Types and Constants
 */

export type TeamSide = 'ATTACKERS' | 'DEFENDERS';

export type RoundPhase = 
  | 'BUY_PHASE'       // 20s buy time, barrier up
  | 'ROUND_LIVE'      // 100s live round
  | 'SPIKE_PLANTED'   // 45s spike detonation countdown
  | 'ROUND_END'       // 5s round wrap-up & score update
  | 'MATCH_OVER';     // First to 13 rounds won

export type BotDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type GraphicsPreset = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';

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
  adsZoom: number;       // FOV multiplier (e.g. 0.65 or 0.3 for sniper)
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

export interface GameSettings {
  graphics: GraphicsPreset;
  fpsCap: 30 | 60 | 120 | 0; // 0 = unlimited
  showFps: boolean;
  mouseSensitivity: number;
  touchSensitivity: number;
  fov: number;
  volume: number;
  soundEnabled: boolean;
  autoFireMobile: boolean;
  aimAssistMobile: boolean;
  touchScale: number; // 0.8 - 1.2
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
    fireRate: 4.5,
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
    description: 'High-caliber anti-material sniper with devastating kinetic punch.',
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
        cooldownTime: 12,
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
        cooldownTime: 15,
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
        cooldownTime: 20,
        description: 'Place a combat beacon granting +20% fire rate and reduced recoil to allies.',
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
        ultPointsRequired: 7,
        description: 'Cast a massive blackout field across an entire site, deafening and blinding foes.',
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
        description: 'Cast an explosive flare around corners that blinds any combatant looking at it.',
        iconType: 'flash',
      },
      {
        id: 'KINETIC_DASH',
        name: 'Kinetic Dash',
        keySlot: 'Q',
        isUltimate: false,
        cost: 150,
        maxCharges: 1,
        cooldownTime: 12,
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
        cooldownTime: 18,
        description: 'Throw a shock grenade that concusses and disorients enemies in its radius.',
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
        ultPointsRequired: 6,
        description: 'Ignite kinetic servos for 16s: +30% speed, instant reloads, and full health on kill.',
        iconType: 'overdrive',
      },
    ],
  },
  BASTION: {
    id: 'BASTION',
    name: 'Bastion',
    role: 'SENTINEL',
    description: 'Defensive engineer who holds chokepoints with solid energy barriers and trip sensors.',
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
        cooldownTime: 30,
        description: 'Raise a 5-meter solid physical barrier wall blocking passage and bullets.',
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
        description: 'Deploy a covert laser sensor that alerts your team and anchors intruders.',
        iconType: 'tripwire',
      },
      {
        id: 'SENTINEL_TURRET',
        name: 'Sentinel Turret',
        keySlot: 'C',
        isUltimate: false,
        cost: 200,
        maxCharges: 1,
        cooldownTime: 25,
        description: 'Deploy an automated sentry turret that fires suppression bursts at spotted foes.',
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
        ultPointsRequired: 7,
        description: 'Channel an expanding containment field that disarms and slows all enemies caught in it.',
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
        cooldownTime: 15,
        description: 'Channel rejuvenating nanites to heal an ally or self for up to 60 HP over 3s.',
        iconType: 'heal',
      },
      {
        id: 'RECON_PULSE',
        name: 'Recon Pulse',
        keySlot: 'Q',
        isUltimate: false,
        cost: 250,
        maxCharges: 1,
        cooldownTime: 20,
        description: 'Fire a sonar dart that pulses twice, revealing enemies on the radar within line of sight.',
        iconType: 'recon',
      },
      {
        id: 'GRAVITY_ORB',
        name: 'Gravity Orb',
        keySlot: 'C',
        isUltimate: false,
        cost: 200,
        maxCharges: 1,
        cooldownTime: 16,
        description: 'Launch a vortex that draws enemies inward and restricts their movement velocity.',
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
        ultPointsRequired: 8,
        description: 'Channel cellular resurrection to revive a fallen teammate with 100 HP.',
        iconType: 'revive',
      },
    ],
  },
};

export const BUY_PHASE_DURATION = 20; // seconds
export const ROUND_LIVE_DURATION = 100; // seconds
export const SPIKE_PLANT_DURATION = 4.0; // seconds to plant
export const SPIKE_DEFUSE_DURATION = 5.0; // seconds to defuse
export const SPIKE_DETONATION_TIME = 45.0; // seconds fuse
export const ROUND_END_DURATION = 5.0; // seconds post-round
export const ROUNDS_TO_WIN = 13;
export const HALF_TIME_ROUND = 12; // Swap sides after round 12
