/**
 * Hollow Strike - Dedicated Armory Page
 * Full weapon & tactical shield showcase with proportional ballistic stat bars and mechanics readout.
 */

import React, { useState } from 'react';
import { SHIELD_REGISTRY, WEAPON_REGISTRY, WeaponDef } from '../../game/types';

export const ArmoryPage: React.FC = () => {
  const weapons = Object.values(WEAPON_REGISTRY);
  const shields = Object.values(SHIELD_REGISTRY);
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>('PHANTOM_V');
  const selected: WeaponDef = WEAPON_REGISTRY[selectedWeaponId] || WEAPON_REGISTRY.APEX_9;

  const statBars = [
    {
      label: 'Headshot Lethality',
      value: selected.damageHead,
      max: 260,
      text: `${selected.damageHead} DMG`,
      color: 'bg-[#FF4655]',
    },
    {
      label: 'Body Damage',
      value: selected.damageBody,
      max: 160,
      text: `${selected.damageBody} DMG`,
      color: 'bg-[#17E5B8]',
    },
    {
      label: 'Fire Rate',
      value: selected.fireRate,
      max: 15,
      text: `${selected.fireRate.toFixed(1)} RPS`,
      color: 'bg-[#ECE8E1]',
    },
    {
      label: 'Base Precision',
      value: Math.max(0.001, 0.03 - selected.spreadBase),
      max: 0.03,
      text: selected.firstShotAccurate ? 'FIRST-SHOT ACCURATE' : `${selected.spreadBase.toFixed(3)} RAD`,
      color: 'bg-[#fbbf24]',
    },
  ];

  return (
    <div className="relative z-10 flex flex-1 flex-col lg:flex-row overflow-y-auto px-4 sm:px-6 py-4 gap-5">
      {/* Left: Weapons + Shields Catalog */}
      <div className="lg:w-80 shrink-0 space-y-5">
        <div>
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8B978F] mb-2">
            Firearms ({weapons.length})
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
            {weapons.map((w) => {
              const active = w.id === selected.id;
              return (
                <button
                  key={w.id}
                  onClick={() => setSelectedWeaponId(w.id)}
                  className={`flex items-center justify-between border-l-2 border p-3.5 text-left transition cursor-pointer clip-val-card ${
                    active
                      ? 'border-l-[#FF4655] border-[#FF4655]/50 bg-[#18232E] text-[#ECE8E1]'
                      : 'border-l-transparent border-[#ECE8E1]/10 bg-[#18232E]/45 text-[#8B978F] hover:border-[#ECE8E1]/30 hover:text-[#ECE8E1]'
                  }`}
                >
                  <div>
                    <div className="font-mono text-[10px] font-bold uppercase text-[#17E5B8]">
                      {w.category}
                    </div>
                    <div className="font-display text-base font-extrabold uppercase tracking-wide text-[#ECE8E1]">
                      {w.name}
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold tabular-nums text-[#17E5B8]">
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
          <div className="space-y-2">
            {shields.map((s) => (
              <div
                key={s.id}
                className="border border-[#ECE8E1]/15 bg-[#18232E]/85 p-3.5 clip-val-card"
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="font-display text-sm font-extrabold uppercase text-[#ECE8E1]">{s.name}</span>
                  <span className="text-xs font-bold text-[#17E5B8]">+{s.armorPoints} AP</span>
                </div>
                <p className="mt-1 text-[11px] text-[#8B978F] leading-snug">{s.description}</p>
                <div className="mt-2 font-mono text-[11px] font-bold text-[#ECE8E1]">
                  Buy Cost: ${s.cost.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Weapon Telemetry & Ballistics Detail */}
      <div className="flex-1 border border-[#ECE8E1]/15 bg-[#18232E]/90 p-5 sm:p-6 flex flex-col justify-between clip-val-panel">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#ECE8E1]/15 pb-4">
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#FF4655]">
                {selected.category} · BUY COST {selected.cost === 0 ? 'FREE' : `$${selected.cost.toLocaleString()}`}
              </span>
              <h2 className="mt-1 font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-wide text-[#ECE8E1]">
                {selected.name}
              </h2>
              <p className="mt-1 text-sm text-[#8B978F]">{selected.description}</p>
            </div>
          </div>

          {/* Ballistic Stat Bars */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {statBars.map((bar) => {
              const pct = Math.max(6, Math.min(100, Math.round((bar.value / bar.max) * 100)));
              return (
                <div key={bar.label} className="border border-[#ECE8E1]/15 bg-[#0F1923]/80 p-4 clip-val-card">
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
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="border border-[#ECE8E1]/15 bg-[#0F1923]/75 p-3.5 clip-val-card">
              <div className="text-[10px] uppercase text-[#8B978F]">Head / Body / Leg</div>
              <div className="mt-1 text-base font-bold text-[#FF4655] tabular-nums">
                {selected.damageHead} / {selected.damageBody} / {selected.damageLeg}
              </div>
            </div>

            <div className="border border-[#ECE8E1]/15 bg-[#0F1923]/75 p-3.5 clip-val-card">
              <div className="text-[10px] uppercase text-[#8B978F]">Capacity</div>
              <div className="mt-1 text-base font-bold text-[#ECE8E1] tabular-nums">
                {selected.magazineSize} / {selected.reserveAmmo}
              </div>
            </div>

            <div className="border border-[#ECE8E1]/15 bg-[#0F1923]/75 p-3.5 clip-val-card">
              <div className="text-[10px] uppercase text-[#8B978F]">Reload Time</div>
              <div className="mt-1 text-base font-bold text-[#ECE8E1] tabular-nums">
                {selected.reloadTime.toFixed(1)}s
              </div>
            </div>

            <div className="border border-[#ECE8E1]/15 bg-[#0F1923]/75 p-3.5 clip-val-card">
              <div className="text-[10px] uppercase text-[#8B978F]">Optic Zoom</div>
              <div className="mt-1 text-base font-bold text-[#17E5B8] tabular-nums">
                {selected.canADS ? `${(1 / selected.adsZoom).toFixed(2)}× ADS` : 'IRON SIGHTS'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 border border-[#ECE8E1]/15 bg-[#0F1923]/65 p-4 font-mono text-xs text-[#8B978F] clip-val-card">
          Moving increases weapon inaccuracy ({selected.spreadRun.toFixed(2)} rad run error). Crouching and holding ADS tighten recoil dispersion during engagements.
        </div>
      </div>
    </div>
  );
};
