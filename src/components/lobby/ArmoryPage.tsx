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
      color: 'bg-amber-400',
    },
    {
      label: 'Body Damage',
      value: selected.damageBody,
      max: 160,
      text: `${selected.damageBody} DMG`,
      color: 'bg-cyan-400',
    },
    {
      label: 'Fire Rate',
      value: selected.fireRate,
      max: 15,
      text: `${selected.fireRate.toFixed(1)} RPS`,
      color: 'bg-emerald-400',
    },
    {
      label: 'Base Precision',
      value: Math.max(0.001, 0.03 - selected.spreadBase),
      max: 0.03,
      text: selected.firstShotAccurate ? 'FIRST-SHOT ACCURATE' : `${selected.spreadBase.toFixed(3)} RAD`,
      color: 'bg-indigo-400',
    },
  ];

  return (
    <div className="relative z-10 flex flex-1 flex-col lg:flex-row overflow-y-auto px-4 sm:px-6 py-4 gap-5">
      {/* Left: Weapons + Shields Catalog */}
      <div className="lg:w-80 shrink-0 space-y-5">
        <div>
          <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Firearms ({weapons.length})
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
            {weapons.map((w) => {
              const active = w.id === selected.id;
              return (
                <button
                  key={w.id}
                  onClick={() => setSelectedWeaponId(w.id)}
                  className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition cursor-pointer ${
                    active
                      ? 'border-cyan-400 bg-slate-900 text-white'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div>
                    <div className="font-mono text-[10px] font-bold uppercase text-cyan-400">
                      {w.category}
                    </div>
                    <div className="font-mono text-sm font-black text-white">{w.name}</div>
                  </div>
                  <span className="font-mono text-xs font-bold tabular-nums text-emerald-400">
                    {w.cost === 0 ? 'FREE' : `$${w.cost.toLocaleString()}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Ballistic Armor
          </div>
          <div className="space-y-2">
            {shields.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5"
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="text-xs font-black text-white">{s.name}</span>
                  <span className="text-xs font-bold text-cyan-400">+{s.armorPoints} AP</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 leading-snug">{s.description}</p>
                <div className="mt-2 font-mono text-[11px] font-bold text-emerald-400">
                  Buy Cost: ${s.cost.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Weapon Telemetry & Ballistics Detail */}
      <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 sm:p-6 flex flex-col justify-between">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-cyan-400">
                {selected.category} · BUY COST {selected.cost === 0 ? 'FREE' : `$${selected.cost.toLocaleString()}`}
              </span>
              <h2 className="mt-1 font-mono text-2xl sm:text-3xl font-black uppercase text-white">
                {selected.name}
              </h2>
              <p className="mt-1 text-sm text-slate-300">{selected.description}</p>
            </div>
          </div>

          {/* Ballistic Stat Bars */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {statBars.map((bar) => {
              const pct = Math.max(6, Math.min(100, Math.round((bar.value / bar.max) * 100)));
              return (
                <div key={bar.label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <div className="flex items-center justify-between font-mono text-xs mb-2">
                    <span className="text-slate-400 uppercase font-bold">{bar.label}</span>
                    <span className="text-white font-black tabular-nums">{bar.text}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div className={`h-full ${bar.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mechanical Specification Grid */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5">
              <div className="text-[10px] uppercase text-slate-400">Head / Body / Leg</div>
              <div className="mt-1 text-base font-black text-amber-300 tabular-nums">
                {selected.damageHead} / {selected.damageBody} / {selected.damageLeg}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5">
              <div className="text-[10px] uppercase text-slate-400">Capacity</div>
              <div className="mt-1 text-base font-black text-white tabular-nums">
                {selected.magazineSize} / {selected.reserveAmmo}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5">
              <div className="text-[10px] uppercase text-slate-400">Reload Time</div>
              <div className="mt-1 text-base font-black text-white tabular-nums">
                {selected.reloadTime.toFixed(1)}s
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5">
              <div className="text-[10px] uppercase text-slate-400">Optic Zoom</div>
              <div className="mt-1 text-base font-black text-cyan-300 tabular-nums">
                {selected.canADS ? `${(1 / selected.adsZoom).toFixed(2)}× ADS` : 'IRON SIGHTS'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-800/80 bg-slate-900/30 p-4 font-mono text-xs text-slate-400">
          Moving increases weapon inaccuracy ({selected.spreadRun.toFixed(2)} rad run error). Crouching and holding ADS tighten recoil dispersion during engagements.
        </div>
      </div>
    </div>
  );
};
