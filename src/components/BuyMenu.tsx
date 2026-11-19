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
  canBuy?: boolean;
  onBuyWeapon: (weaponId: string) => void;
  onBuyShield: (shieldId: 'LIGHT_SHIELD' | 'HEAVY_SHIELD') => void;
  onClose: () => void;
}

export const BuyMenu: React.FC<BuyMenuProps> = ({
  credits,
  currentWeaponId,
  currentArmor,
  agent,
  canBuy = true,
  onBuyWeapon,
  onBuyShield,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0F1923]/80 backdrop-blur-sm p-4 select-none">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col border border-[#ECE8E1]/20 bg-[#18232E] p-6 shadow-2xl overflow-y-auto clip-val-panel">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#ECE8E1]/15 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rotate-45 ${canBuy ? 'bg-[#17E5B8]' : 'bg-[#FF4655]'}`} />
              <h2 className="font-display text-2xl font-extrabold uppercase tracking-[0.16em] text-[#ECE8E1]">
                {canBuy ? 'ARMORY · BUY PHASE' : 'ARMORY · ROUND ACTIVE'}
              </h2>
            </div>
            <p className="font-mono text-xs text-[#8B978F]">
              {canBuy
                ? 'Select weaponry and tactical armor for the round'
                : 'Purchases are allowed during Buy Phase or Practice Range'}
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#8B978F]">Available Credits</span>
              <div className="font-mono text-2xl font-black text-[#17E5B8] tabular-nums">
                ${credits.toLocaleString()}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="bg-[#FF4655] px-4 py-2 font-display text-xs font-extrabold uppercase tracking-widest text-[#ECE8E1] hover:bg-[#ff5a68] transition cursor-pointer clip-val-btn"
              >
                ← BACK
              </button>
              <button
                onClick={onClose}
                className="border border-[#ECE8E1]/20 bg-[#0F1923] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-[#ECE8E1] hover:border-[#FF4655] hover:text-[#FF4655] transition cursor-pointer clip-val-card"
              >
                Close [B]
              </button>
            </div>
          </div>
        </div>

        {/* Weapons Grid */}
        <div className="mt-4">
          <h3 className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#FF4655] mb-2.5">
            Firearms
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {Object.values(WEAPON_REGISTRY).map((w: WeaponDef) => {
              const isEquipped = currentWeaponId === w.id;
              const canAfford = credits >= w.cost;

              return (
                <div
                  key={w.id}
                  data-testid={`buy-weapon-${w.id}`}
                  className={`flex flex-col justify-between border p-3 transition clip-val-card ${
                    isEquipped
                      ? 'border-[#17E5B8] bg-[#17E5B8]/10'
                      : canAfford
                      ? 'border-[#ECE8E1]/15 bg-[#0F1923]/85 hover:border-[#ECE8E1]/40'
                      : 'border-[#ECE8E1]/10 bg-[#0F1923]/45 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-[#8B978F]">{w.category}</span>
                        <h4 className="font-display text-base font-extrabold uppercase tracking-wide text-[#ECE8E1]">
                          {w.name}
                        </h4>
                      </div>
                      <span className="font-mono text-xs font-bold text-[#17E5B8]">
                        {w.cost === 0 ? 'FREE' : `$${w.cost}`}
                      </span>
                    </div>

                    <p className="mt-1 text-[10px] text-[#8B978F] leading-tight">{w.description}</p>

                    <div className="mt-2.5 space-y-1 border-t border-[#ECE8E1]/10 pt-2 text-[10px] font-mono text-[#ECE8E1]">
                      <div className="flex justify-between">
                        <span className="text-[#8B978F]">Head / Body / Leg:</span>
                        <span className="font-bold">{w.damageHead} / {w.damageBody} / {w.damageLeg}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8B978F]">Fire Rate:</span>
                        <span>{w.fireRate} rps</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8B978F]">Magazine:</span>
                        <span>{w.magazineSize} / {w.reserveAmmo}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    data-testid={`buy-weapon-${w.id}`}
                    disabled={isEquipped || !canAfford || !canBuy}
                    onClick={() => onBuyWeapon(w.id)}
                    className={`mt-3 w-full py-1.5 font-display text-xs font-extrabold uppercase tracking-widest transition cursor-pointer clip-val-card ${
                      isEquipped
                        ? 'border border-[#17E5B8]/50 bg-[#17E5B8]/20 text-[#17E5B8] cursor-default'
                        : canBuy && canAfford
                        ? 'bg-[#FF4655] text-[#ECE8E1] hover:bg-[#ff5e6b]'
                        : 'bg-[#18232E] text-[#8B978F] cursor-not-allowed'
                    }`}
                  >
                    {isEquipped ? 'EQUIPPED' : !canBuy ? 'BUY PHASE ONLY' : canAfford ? 'PURCHASE' : 'LOCKED'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Armor & Abilities Section */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#FF4655] mb-3">
              Tactical Shields
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(SHIELD_REGISTRY).map((s: ShieldDef) => {
                const isEquipped = currentArmor >= s.armorPoints;
                const canAfford = credits >= s.cost;

                return (
                  <div
                    key={s.id}
                    className={`flex flex-col justify-between border p-4 clip-val-card ${
                      isEquipped
                        ? 'border-[#17E5B8] bg-[#17E5B8]/10'
                        : canAfford
                        ? 'border-[#ECE8E1]/15 bg-[#0F1923]/85'
                        : 'border-[#ECE8E1]/10 bg-[#0F1923]/45 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <h4 className="font-display text-base font-extrabold uppercase text-[#ECE8E1]">{s.name}</h4>
                        <span className="font-mono text-xs font-bold text-[#17E5B8]">${s.cost}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#8B978F]">{s.description}</p>
                    </div>

                    <button
                      disabled={isEquipped || !canAfford || !canBuy}
                      onClick={() => onBuyShield(s.id)}
                      className={`mt-3 w-full py-1.5 font-display text-xs font-extrabold uppercase tracking-wider transition cursor-pointer clip-val-card ${
                        isEquipped
                          ? 'border border-[#17E5B8]/50 bg-[#17E5B8]/20 text-[#17E5B8] cursor-default'
                          : canBuy && canAfford
                          ? 'bg-[#17E5B8] text-[#0F1923] hover:opacity-90'
                          : 'bg-[#18232E] text-[#8B978F] cursor-not-allowed'
                      }`}
                    >
                      {isEquipped ? 'EQUIPPED' : !canBuy ? 'BUY PHASE ONLY' : canAfford ? 'BUY' : 'LOCKED'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#FF4655] mb-3">
              Agent Abilities ({agent.name})
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {agent.abilities.map((ab) => (
                <div key={ab.id} className="border border-[#ECE8E1]/15 bg-[#0F1923]/75 p-2.5 clip-val-card">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#17E5B8]">[{ab.keySlot}]</span>
                    <span className="text-[10px] font-mono text-[#8B978F]">
                      {ab.isUltimate ? 'ULTIMATE' : 'SIGNATURE'}
                    </span>
                  </div>
                  <div className="mt-1 font-display text-sm font-bold uppercase text-[#ECE8E1]">{ab.name}</div>
                  <div className="mt-0.5 text-[10px] text-[#8B978F] leading-tight">{ab.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
