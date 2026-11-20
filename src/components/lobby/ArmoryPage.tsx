/**
 * Hollow Strike - Dedicated Armory Page
 * Full 18-weapon & tactical shield showcase organized across all 7 categories,
 * with live 3D WebGL model inspection and proportional ballistic stat bars.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  SHIELD_REGISTRY,
  WEAPON_REGISTRY,
  WeaponCategory,
  WeaponDef,
} from '../../game/types';
import { createWeaponModel } from '../../game/weaponModels';

type ArmoryFilter = 'ALL' | WeaponCategory;

const ARMORY_CATEGORIES: { id: ArmoryFilter; label: string }[] = [
  { id: 'ALL', label: 'ALL (18)' },
  { id: 'SIDEARM', label: 'SIDEARMS' },
  { id: 'SMG', label: 'SMGs' },
  { id: 'SHOTGUN', label: 'SHOTGUNS' },
  { id: 'RIFLE', label: 'RIFLES' },
  { id: 'SNIPER', label: 'SNIPERS' },
  { id: 'MACHINE_GUN', label: 'LMGs' },
  { id: 'MELEE', label: 'MELEE' },
];

export const ArmoryPage: React.FC = () => {
  const weapons = Object.values(WEAPON_REGISTRY);
  const shields = Object.values(SHIELD_REGISTRY);
  const [filter, setFilter] = useState<ArmoryFilter>('ALL');
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>('REAPER');
  const previewMountRef = useRef<HTMLDivElement | null>(null);

  const visibleWeapons =
    filter === 'ALL' ? weapons : weapons.filter((w) => w.category === filter);
  const selected: WeaponDef = WEAPON_REGISTRY[selectedWeaponId] || WEAPON_REGISTRY.KADENCE;

  // Lightweight 3D WebGL weapon showcase
  useEffect(() => {
    const container = previewMountRef.current;
    if (!container) return;

    const width = Math.max(240, container.clientWidth || 360);
    const height = Math.max(150, container.clientHeight || 190);

    let renderer: THREE.WebGLRenderer | null = null;
    let rafId = 0;

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 20);
    camera.position.set(0.32, 0.16, 0.72);
    camera.lookAt(0, 0.02, -0.05);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(2, 3, 2);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x17e5b8, 1.4);
    rimLight.position.set(-2, 1.5, -2);
    scene.add(rimLight);

    const fillLight = new THREE.AmbientLight(0xece8e1, 0.9);
    scene.add(fillLight);

    const weaponGroup = createWeaponModel(selected.id);
    // Rotate model so barrel presents hero 3/4 profile nicely inside preview
    const pivot = new THREE.Group();
    weaponGroup.rotation.y = Math.PI * 0.45;
    pivot.add(weaponGroup);
    scene.add(pivot);

    let disposed = false;
    const animate = () => {
      if (disposed || !renderer) return;
      rafId = window.requestAnimationFrame(animate);
      pivot.rotation.y += 0.008;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      renderer?.dispose();
      if (container) container.innerHTML = '';
    };
  }, [selected.id]);

  const statBars = [
    {
      label: selected.pellets ? `Headshot (${selected.pellets} Pellets)` : 'Headshot Lethality',
      value: selected.damageHead * (selected.pellets ?? 1),
      max: 260,
      text: selected.pellets
        ? `${selected.pellets}×${selected.damageHead} (${selected.pellets * selected.damageHead})`
        : `${selected.damageHead} DMG`,
      color: 'bg-[#FF4655]',
    },
    {
      label: selected.pellets ? `Body (${selected.pellets} Pellets)` : 'Body Damage',
      value: selected.damageBody * (selected.pellets ?? 1),
      max: 160,
      text: selected.pellets
        ? `${selected.pellets}×${selected.damageBody} (${selected.pellets * selected.damageBody})`
        : `${selected.damageBody} DMG`,
      color: 'bg-[#17E5B8]',
    },
    {
      label: selected.isMelee ? 'Swing Speed' : 'Fire Rate',
      value: selected.fireRate,
      max: 15,
      text: `${selected.fireRate.toFixed(1)} /s`,
      color: 'bg-[#ECE8E1]',
    },
    {
      label: 'Base Precision',
      value: selected.isMelee ? 0.03 : Math.max(0.001, 0.03 - selected.spreadBase),
      max: 0.03,
      text: selected.isMelee
        ? 'MELEE ARC'
        : selected.firstShotAccurate
          ? 'FIRST-SHOT ACCURATE'
          : `${selected.spreadBase.toFixed(3)} RAD`,
      color: 'bg-[#fbbf24]',
    },
  ];

  return (
    <div className="relative z-10 flex flex-1 flex-col lg:flex-row overflow-y-auto px-4 sm:px-6 py-4 gap-5">
      {/* Left: Weapons + Shields Catalog */}
      <div className="lg:w-96 shrink-0 space-y-4">
        <div>
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8B978F] mb-2">
            Arsenal ({weapons.length} Weapons)
          </div>

          <div className="flex flex-wrap gap-1 mb-2.5">
            {ARMORY_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFilter(cat.id)}
                className={`border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider cursor-pointer transition ${
                  filter === cat.id
                    ? 'border-[#FF4655] bg-[#FF4655] text-[#ECE8E1]'
                    : 'border-[#ECE8E1]/15 bg-[#0F1923] text-[#8B978F] hover:border-[#17E5B8] hover:text-[#17E5B8]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-[360px] lg:max-h-[420px] overflow-y-auto pr-1">
            {visibleWeapons.map((w) => {
              const active = w.id === selected.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedWeaponId(w.id)}
                  className={`flex items-center justify-between border-l-2 border p-3 text-left transition cursor-pointer clip-val-card ${
                    active
                      ? 'border-l-[#FF4655] border-[#FF4655]/55 bg-[#18232E] text-[#ECE8E1]'
                      : 'border-l-transparent border-[#ECE8E1]/10 bg-[#18232E]/45 text-[#8B978F] hover:border-[#ECE8E1]/30 hover:text-[#ECE8E1]'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="font-mono text-[9px] font-bold uppercase text-[#17E5B8] truncate">
                      {w.category.replace('_', ' ')}
                    </div>
                    <div className="font-display text-sm font-extrabold uppercase tracking-wide text-[#ECE8E1] truncate">
                      {w.name}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] font-bold tabular-nums text-[#17E5B8] shrink-0">
                    {w.cost === 0 ? 'FREE' : `$${w.cost.toLocaleString()}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8B978F] mb-2">
            Ballistic Armor
          </div>
          <div className="grid grid-cols-2 gap-2">
            {shields.map((s) => (
              <div
                key={s.id}
                className="border border-[#ECE8E1]/15 bg-[#18232E]/85 p-3 clip-val-card"
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="font-display text-xs font-extrabold uppercase text-[#ECE8E1]">{s.name}</span>
                  <span className="text-[11px] font-bold text-[#17E5B8]">+{s.armorPoints} AP</span>
                </div>
                <div className="mt-1 font-mono text-[10px] font-bold text-[#8B978F]">
                  Cost: ${s.cost.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: 3D Weapon Preview + Ballistic Telemetry */}
      <div className="flex-1 border border-[#ECE8E1]/15 bg-[#18232E]/90 p-5 sm:p-6 flex flex-col justify-between clip-val-panel">
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center border-b border-[#ECE8E1]/15 pb-4">
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#FF4655]">
                {selected.category.replace('_', ' ')} · BUY COST {selected.cost === 0 ? 'FREE' : `$${selected.cost.toLocaleString()}`}
              </span>
              <h2 className="mt-1 font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-wide text-[#ECE8E1]">
                {selected.name}
              </h2>
              <p className="mt-1 text-sm text-[#8B978F]">{selected.description}</p>
            </div>

            <div
              ref={previewMountRef}
              data-testid="armory-weapon-preview"
              className="h-44 w-full border border-[#ECE8E1]/15 bg-gradient-to-br from-[#0F1923] to-[#18232E] clip-val-card overflow-hidden"
            />
          </div>

          {/* Ballistic Stat Bars */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {statBars.map((bar) => {
              const pct = Math.max(6, Math.min(100, Math.round((bar.value / bar.max) * 100)));
              return (
                <div key={bar.label} className="border border-[#ECE8E1]/15 bg-[#0F1923]/80 p-3.5 clip-val-card">
                  <div className="flex items-center justify-between font-mono text-xs mb-2">
                    <span className="text-[#8B978F] uppercase font-bold">{bar.label}</span>
                    <span className="text-[#ECE8E1] font-bold tabular-nums">{bar.text}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden bg-[#18232E]">
                    <div className={`h-full ${bar.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mechanical Specification Grid */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="border border-[#ECE8E1]/15 bg-[#0F1923]/75 p-3.5 clip-val-card">
              <div className="text-[10px] uppercase text-[#8B978F]">Head / Body / Leg</div>
              <div className="mt-1 text-base font-bold text-[#FF4655] tabular-nums">
                {selected.damageHead} / {selected.damageBody} / {selected.damageLeg}
              </div>
            </div>

            <div className="border border-[#ECE8E1]/15 bg-[#0F1923]/75 p-3.5 clip-val-card">
              <div className="text-[10px] uppercase text-[#8B978F]">Capacity</div>
              <div className="mt-1 text-base font-bold text-[#ECE8E1] tabular-nums">
                {selected.isMelee ? 'INFINITE [3]' : `${selected.magazineSize} / ${selected.reserveAmmo}`}
              </div>
            </div>

            <div className="border border-[#ECE8E1]/15 bg-[#0F1923]/75 p-3.5 clip-val-card">
              <div className="text-[10px] uppercase text-[#8B978F]">
                {selected.isMelee ? 'Reach' : 'Reload Time'}
              </div>
              <div className="mt-1 text-base font-bold text-[#ECE8E1] tabular-nums">
                {selected.isMelee ? `${selected.range ?? 2.8}m` : `${selected.reloadTime.toFixed(1)}s`}
              </div>
            </div>

            <div className="border border-[#ECE8E1]/15 bg-[#0F1923]/75 p-3.5 clip-val-card">
              <div className="text-[10px] uppercase text-[#8B978F]">Optic Zoom</div>
              <div className="mt-1 text-base font-bold text-[#17E5B8] tabular-nums">
                {selected.canADS ? `${(1 / selected.adsZoom).toFixed(2)}× ADS` : selected.isMelee ? 'SLASH ARC' : 'IRON SIGHTS'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 border border-[#ECE8E1]/15 bg-[#0F1923]/65 p-3.5 font-mono text-xs text-[#8B978F] clip-val-card">
          {selected.isMelee
            ? 'Equipping Hollow Blade [3] maximizes tactical sprint speed across lanes and delivers silent 55/110 DMG strikes.'
            : `Moving adds ${selected.spreadRun.toFixed(2)} rad run inaccuracy. Counter-strafing, crouching, and ADS stabilize sprays.`}
        </div>
      </div>
    </div>
  );
};
