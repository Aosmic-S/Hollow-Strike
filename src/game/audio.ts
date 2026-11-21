/**
 * Hollow Strike - Hybrid Web Audio Engine
 * Combines real weapon firing/reload & announcer MP3 sample playback
 * with zero-latency procedural Web Audio synthesizers as instant fallback.
 */

import { WeaponCategory } from './types';

export type AnnouncerEvent =
  | 'ace'
  | 'attackersWin'
  | 'clutch'
  | 'defendersWin'
  | 'flawless'
  | 'quadraKill'
  | 'spikeDefused'
  | 'spikePlanted'
  | 'tenSecondsLeft'
  | 'thrifty'
  | 'tripleKill'
  | 'victory';

interface WeaponAudioSpec {
  folder: string;
  prefix: string;
  hasSpray: boolean;
}

const WEAPON_AUDIO_MAP: Record<string, WeaponAudioSpec> = {
  // Sidearms (Pistol)
  KADENCE: { folder: 'Pistol', prefix: 'Kadence', hasSpray: true },
  THORN: { folder: 'Pistol', prefix: 'Thorn', hasSpray: true },
  FURY: { folder: 'Pistol', prefix: 'Fury', hasSpray: true },
  FRENKY: { folder: 'Pistol', prefix: 'Frenky', hasSpray: true },
  HANGMAN: { folder: 'Pistol', prefix: 'Hangman', hasSpray: true },
  // SMGs
  MANTIS: { folder: 'smg', prefix: 'Mantis', hasSpray: true },
  STINGRAY: { folder: 'smg', prefix: 'Stingray', hasSpray: true },
  // Shotguns
  JACKAL: { folder: 'shotgun', prefix: 'Jackal', hasSpray: true },
  SLUG: { folder: 'shotgun', prefix: 'Slug', hasSpray: true },
  // Rifles (Note: Veil only has Veil_Tap.mp3 & Veil_Reload.mp3)
  REAPER: { folder: 'assault_rifle', prefix: 'Reaper', hasSpray: true },
  ECLIPSE: { folder: 'assault_rifle', prefix: 'Eclipse', hasSpray: true },
  VEIL: { folder: 'assault_rifle', prefix: 'Veil', hasSpray: false },
  TUSK: { folder: 'assault_rifle', prefix: 'Tusk', hasSpray: true },
  // Snipers
  BOLT: { folder: 'sniper', prefix: 'Bolt', hasSpray: true },
  ORACLE: { folder: 'sniper', prefix: 'Oracle', hasSpray: true },
  // Machine Guns
  STORM: { folder: 'machine_gun', prefix: 'Storm', hasSpray: true },
  THOR: { folder: 'machine_gun', prefix: 'Thor', hasSpray: true },
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = 0.7;
  private muted: boolean = false;
  private bufferCache = new Map<string, AudioBuffer>();
  private inFlightUrls = new Set<string>();
  private failedUrls = new Set<string>();

  public init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Pre-decode common weapon and round announcement MP3s in the background
    this.prewarmCommonAudio();
  }

  private prewarmCommonAudio(): void {
    const urls = [
      '/Assests/Weapon_sound/Pistol/Kadence_Tap.mp3',
      '/Assests/Weapon_sound/Pistol/Kadence_Reload.mp3',
      '/Assests/Weapon_sound/assault_rifle/Reaper_Tap.mp3',
      '/Assests/Weapon_sound/assault_rifle/Reaper_Spray.mp3',
      '/Assests/Weapon_sound/assault_rifle/Reaper_Reload.mp3',
      '/Assests/Sound%20effects/spikePlanted.mp3',
      '/Assests/Sound%20effects/spikeDefused.mp3',
      '/Assests/Sound%20effects/tenSecondsLeft.mp3',
      '/Assests/Sound%20effects/attackersWin.mp3',
      '/Assests/Sound%20effects/defendersWin.mp3',
    ];
    for (const url of urls) {
      void this.loadBuffer(url);
    }
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    if (!this.ctx || this.failedUrls.has(url)) return null;
    const cached = this.bufferCache.get(url);
    if (cached) return cached;
    if (this.inFlightUrls.has(url)) return null;

    this.inFlightUrls.add(url);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        this.failedUrls.add(url);
        return null;
      }
      const arr = await res.arrayBuffer();
      if (!this.ctx) return null;
      const decoded = await this.ctx.decodeAudioData(arr);
      this.bufferCache.set(url, decoded);
      return decoded;
    } catch {
      this.failedUrls.add(url);
      return null;
    } finally {
      this.inFlightUrls.delete(url);
    }
  }

  private playBuffer(buffer: AudioBuffer, gainScale = 0.85, rateJitter = 0): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    if (rateJitter > 0) {
      src.playbackRate.value = 1 - rateJitter * 0.5 + Math.random() * rateJitter;
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainScale, this.ctx.currentTime);
    src.connect(g);
    g.connect(this.masterGain);
    src.start(this.ctx.currentTime);
  }

  public setVolume(val: number): void {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  // --- Real MP3 Weapon & Announcer Playback ---

  public playWeaponShot(
    weaponId: string,
    category: WeaponCategory,
    isSpray = false,
    gainScale = 0.72
  ): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    if (weaponId === 'HOLLOW_BLADE' || category === 'MELEE') {
      this.playGunshot('MELEE');
      return;
    }

    const spec = WEAPON_AUDIO_MAP[weaponId];
    if (!spec) {
      this.playGunshot(category);
      return;
    }

    const variant = isSpray && spec.hasSpray ? 'Spray' : 'Tap';
    const url = `/Assests/Weapon_sound/${spec.folder}/${spec.prefix}_${variant}.mp3`;
    const cached = this.bufferCache.get(url);
    if (cached) {
      this.playBuffer(cached, gainScale, 0.06);
      return;
    }

    // Begin decoding for subsequent shots and fire instant procedural transient now
    void this.loadBuffer(url);
    this.playGunshot(category);
  }

  public playWeaponReload(weaponId: string, gainScale = 0.75): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    if (weaponId === 'HOLLOW_BLADE') {
      this.playReload();
      return;
    }

    const spec = WEAPON_AUDIO_MAP[weaponId];
    if (!spec) {
      this.playReload();
      return;
    }

    const url = `/Assests/Weapon_sound/${spec.folder}/${spec.prefix}_Reload.mp3`;
    const cached = this.bufferCache.get(url);
    if (cached) {
      this.playBuffer(cached, gainScale, 0.02);
      return;
    }

    void this.loadBuffer(url);
    this.playReload();
  }

  public playAnnouncer(event: AnnouncerEvent, gainScale = 0.85): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const url = `/Assests/Sound%20effects/${event}.mp3`;
    const cached = this.bufferCache.get(url);
    if (cached) {
      this.playBuffer(cached, gainScale, 0);
      return;
    }

    void this.loadBuffer(url).then((buf) => {
      if (buf && !this.muted) {
        this.playBuffer(buf, gainScale, 0);
      }
    });
  }

  // --- Weapon Synthesizers (Melee + Instant Fallback) ---

  public playGunshot(category: WeaponCategory): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    switch (category) {
      case 'SIDEARM': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        const noise = this.createNoiseBuffer(0.06);
        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = noise;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(2200, now);
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

        osc.connect(gain);
        gain.connect(this.masterGain);
        noiseNode.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.13);
        noiseNode.start(now);
        break;
      }

      case 'SMG': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.09);

        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

        const noise = this.createNoiseBuffer(0.05);
        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = noise;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.35, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

        osc.connect(gain);
        gain.connect(this.masterGain);
        noiseNode.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.1);
        noiseNode.start(now);
        break;
      }

      case 'RIFLE': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.22);

        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        const noise = this.createNoiseBuffer(0.18);
        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = noise;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, now);
        filter.frequency.exponentialRampToValueAtTime(300, now + 0.18);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.6, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.masterGain);
        noiseNode.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.23);
        noiseNode.start(now);
        break;
      }

      case 'SNIPER': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.45);

        gain.gain.setValueAtTime(1.0, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        const noise = this.createNoiseBuffer(0.35);
        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = noise;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(150, now + 0.35);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.85, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.masterGain);
        noiseNode.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.46);
        noiseNode.start(now);
        break;
      }

      case 'SHOTGUN': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(34, now + 0.30);
        gain.gain.setValueAtTime(0.95, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);

        const noise = this.createNoiseBuffer(0.28);
        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = noise;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1900, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.28);
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(this.masterGain);
        noiseNode.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.31);
        noiseNode.start(now);
        break;
      }

      case 'MACHINE_GUN': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(155, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);
        gain.gain.setValueAtTime(0.65, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        const noise = this.createNoiseBuffer(0.14);
        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = noise;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1100, now);
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.55, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        osc.connect(gain);
        gain.connect(this.masterGain);
        noiseNode.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.17);
        noiseNode.start(now);
        break;
      }

      case 'MELEE': {
        const noise = this.createNoiseBuffer(0.16);
        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = noise;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(3200, now);
        filter.frequency.exponentialRampToValueAtTime(650, now + 0.16);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        noiseNode.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noiseNode.start(now);
        break;
      }
    }
  }

  public playReload(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    this.playMechanicalClick(now, 1200, 0.04);
    this.playMechanicalClick(now + 0.45, 800, 0.05);
    this.playMechanicalClick(now + 0.85, 1400, 0.06);
  }

  private playMechanicalClick(time: number, freq: number, dur: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, time + dur);
    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + dur);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + dur);
  }

  public playHitmarker(isHeadshot: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';

    if (isHeadshot) {
      osc.frequency.setValueAtTime(3200, now);
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.12);
      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    } else {
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.06);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playFootstep(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const noise = this.createNoiseBuffer(0.04);
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = noise;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350 + Math.random() * 80, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noiseNode.start(now);
  }

  public playPlayerHurt(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);

    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  // --- Spike Audio ---

  public playSpikeBeep(urgencyFraction: number): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';

    const freq = 900 + urgencyFraction * 900;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playSpikePlant(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  public playSpikeDefused(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0.3, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.32);
    });
  }

  public playSpikeExplosion(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(25, now + 1.2);
    subGain.gain.setValueAtTime(1.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    const noise = this.createNoiseBuffer(1.4);
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(60, now + 1.4);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

    sub.connect(subGain);
    subGain.connect(this.masterGain);
    noiseNode.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    sub.start(now);
    sub.stop(now + 1.25);
    noiseNode.start(now);
  }

  // --- Ability & Match Feedback ---

  public playAbility(type: 'SMOKE' | 'FLASH' | 'WALL' | 'HEAL' | 'DASH' | 'ULT'): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    switch (type) {
      case 'SMOKE': {
        const noise = this.createNoiseBuffer(0.6);
        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = noise;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.6);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

        noiseNode.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noiseNode.start(now);
        break;
      }
      case 'FLASH': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.16);
        break;
      }
      case 'WALL': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.linearRampToValueAtTime(240, now + 0.4);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.42);
        break;
      }
      case 'HEAL': {
        const freqs = [440, 554, 659];
        freqs.forEach((f, idx) => {
          if (!this.ctx || !this.masterGain) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + idx * 0.08);
          gain.gain.setValueAtTime(0.3, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.26);
        });
        break;
      }
      case 'DASH': {
        const noise = this.createNoiseBuffer(0.2);
        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = noise;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.2);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        noiseNode.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noiseNode.start(now);
        break;
      }
      case 'ULT': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.5);
        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.52);
        break;
      }
    }
  }

  public playRoundStart(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(220, now);
    osc1.frequency.setValueAtTime(330, now + 0.25);
    osc2.frequency.setValueAtTime(221, now);
    osc2.frequency.setValueAtTime(331, now + 0.25);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.setValueAtTime(0.6, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.85);
    osc2.stop(now + 0.85);
  }

  public playRoundEnd(won: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    if (won) {
      [392, 523, 659].forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.4, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.5);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.55);
      });
    } else {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.6);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.65);
    }
  }

  private createNoiseBuffer(duration: number): AudioBuffer {
    const ctx = this.ctx!;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}

export const soundEngine = new SoundEngine();
