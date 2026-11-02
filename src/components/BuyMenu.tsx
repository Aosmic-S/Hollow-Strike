/**
 * Hollow Strike - Buy Menu
 * Tactical shop interface accessible during the 20-second Buy Phase.
 */

import React from 'react';
import { WEAPON_REGISTRY, SHIELD_REGISTRY, WeaponDef, ShieldDef, AgentDef } from '../game/types';

interface BuyMenuProps {
  credits: number;
  currentWeaponId: string;
  currentArmor: number;
  agent: AgentDef;
  onBuyWeapon: (weaponId: string) => void;
  onBuyShield: (shieldId: 'LIGHT_SHIELD' | 'HEAVY_SHIELD') => void;
  onClose: () => void;
}

export const BuyMenu: React.FC<BuyMenuProps> = ({
  credits,
  currentWeaponId,
  currentArmor,
  agent,
  onBuyWeapon,
  onBuyShield,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 select-none">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-slate-700 bg-slate-950/95 p-6 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              <h2 className="text-xl font-black uppercase tracking-widest text-white">ARMORY · BUY PHASE</h2>
            </div>
            <p className="text-xs text-slate-400">Select weaponry and tactical armor for the round</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Available Credits</span>
              <div className="font-mono text-2xl font-black text-emerald-400 tabular-nums">
                ${credits.toLocaleString()}
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 hover:bg-slate-700 hover:text-white transition cursor-pointer"
            >
              Close [B]
            </button>
          </div>
        </div>

        {/* Weapons Grid */}
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3">Firearms</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.values(WEAPON_REGISTRY).map((w: WeaponDef) => {
              const isEquipped = currentWeaponId === w.id;
              const canAfford = credits >= w.cost;

              return (
                <div
                  key={w.id}
                  className={`flex flex-col justify-between rounded-lg border p-4 transition ${
                    isEquipped
                      ? 'border-cyan-500 bg-cyan-950/30'
                      : canAfford
                      ? 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                      : 'border-slate-900 bg-slate-950 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-slate-400">{w.category}</span>
                        <h4 className="text-base font-black text-white">{w.name}</h4>
                      </div>
                      <span className="font-mono text-sm font-bold text-emerald-400">
                        {w.cost === 0 ? 'FREE' : `$${w.cost}`}
                      </span>
                    </div>

                    <p className="mt-2 text-[11px] text-slate-400 leading-tight">{w.description}</p>

                    {/* Stats */}
                    <div className="mt-3 space-y-1.5 border-t border-slate-800 pt-2 text-[10px] font-mono text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Head / Body / Leg:</span>
                        <span className="text-white font-bold">{w.damageHead} / {w.damageBody} / {w.damageLeg}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Fire Rate:</span>
                        <span className="text-white">{w.fireRate} rps</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Magazine:</span>
                        <span className="text-white">{w.magazineSize} / {w.reserveAmmo}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={isEquipped || !canAfford}
                    onClick={() => onBuyWeapon(w.id)}
                    className={`mt-4 w-full rounded py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      isEquipped
                        ? 'border border-cyan-500/40 bg-cyan-500/20 text-cyan-300 cursor-default'
                        : canAfford
                        ? 'bg-cyan-600 text-white hover:bg-cyan-500'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isEquipped ? 'EQUIPPED' : canAfford ? 'PURCHASE' : 'LOCKED'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Armor & Abilities Section */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Shields */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3">Tactical Shields</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(SHIELD_REGISTRY).map((s: ShieldDef) => {
                const isEquipped = currentArmor >= s.armorPoints;
                const canAfford = credits >= s.cost;

                return (
                  <div
                    key={s.id}
                    className={`flex flex-col justify-between rounded-lg border p-4 ${
                      isEquipped
                        ? 'border-blue-500 bg-blue-950/30'
                        : canAfford
                        ? 'border-slate-800 bg-slate-900/60'
                        : 'border-slate-900 bg-slate-950 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <h4 className="text-sm font-bold text-white">{s.name}</h4>
                        <span className="font-mono text-xs font-bold text-emerald-400">${s.cost}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">{s.description}</p>
                    </div>

                    <button
                      disabled={isEquipped || !canAfford}
                      onClick={() => onBuyShield(s.id)}
                      className={`mt-3 w-full rounded py-1.5 text-xs font-bold uppercase transition cursor-pointer ${
                        isEquipped
                          ? 'border border-blue-500/40 bg-blue-500/20 text-blue-300 cursor-default'
                          : canAfford
                          ? 'bg-blue-600 text-white hover:bg-blue-500'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {isEquipped ? 'EQUIPPED' : canAfford ? 'BUY' : 'LOCKED'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Abilities Overview */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3">Agent Abilities ({agent.name})</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {agent.abilities.map((ab) => (
                <div key={ab.id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-cyan-400">[{ab.keySlot}]</span>
                    <span className="text-[10px] text-slate-400">{ab.isUltimate ? 'ULTIMATE' : 'SIGNATURE'}</span>
                  </div>
                  <div className="mt-1 font-bold text-slate-200">{ab.name}</div>
                  <div className="mt-0.5 text-[10px] text-slate-400 leading-tight">{ab.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
