/**
 * Hollow Strike - Mobile-Friendly Tactical Armory & Buy Menu
 * Full 18-weapon armory across all 7 categories + dedicated Shield & Agent Kit tab,
 * sticky credits/armor/close header, horizontally scrollable category pills, and >=44px touch targets.
 */

import React, { useState } from 'react';
import {
  AGENT_REGISTRY,
  AgentDef,
  SHIELD_REGISTRY,
  ShieldDef,
  WEAPON_REGISTRY,
  WeaponCategory,
  WeaponDef,
} from '../game/types';

interface BuyMenuProps {
  credits: number;
  currentWeaponId: string;
  currentArmor: number;
  agent: AgentDef;
  canBuy?: boolean;
  isFreeMode?: boolean;
  isTdmMode?: boolean;
  onBuyWeapon: (weaponId: string) => void;
  onBuyShield: (shieldId: 'LIGHT_SHIELD' | 'HEAVY_SHIELD') => void;
  onClose: () => void;
}

type CategoryFilter = 'ALL' | 'SHIELD_KIT' | WeaponCategory;

const CATEGORY_TABS: { id: CategoryFilter; label: string }[] = [
  { id: 'ALL', label: 'ALL (18)' },
  { id: 'SHIELD_KIT', label: 'SHIELD & KIT' },
  { id: 'RIFLE', label: 'RIFLES' },
  { id: 'SMG', label: 'SMGs' },
  { id: 'SIDEARM', label: 'SIDEARMS' },
  { id: 'SHOTGUN', label: 'SHOTGUNS' },
  { id: 'SNIPER', label: 'SNIPERS' },
  { id: 'MACHINE_GUN', label: 'HEAVY' },
  { id: 'MELEE', label: 'MELEE' },
];

export const BuyMenu: React.FC<BuyMenuProps> = ({
  credits,
  currentWeaponId,
  currentArmor,
  agent,
  canBuy = true,
  isFreeMode = false,
  isTdmMode = false,
  onBuyWeapon,
  onBuyShield,
  onClose,
}) => {
  const [filter, setFilter] = useState<CategoryFilter>('ALL');

  const allWeapons = Object.values(WEAPON_REGISTRY);
  const filteredWeapons =
    filter === 'ALL'
      ? allWeapons
      : filter === 'SHIELD_KIT'
        ? []
        : allWeapons.filter((w) => w.category === filter);

  const showShieldsSection = filter === 'ALL' || filter === 'SHIELD_KIT';
  const effectiveCanBuy = isFreeMode || canBuy;

  return (
    <div
      data-testid="buy-menu-modal"
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#0F1923]/92 p-1.5 sm:p-4 select-none"
    >
      <div className="relative flex max-h-[96dvh] w-full max-w-5xl flex-col border border-[#ECE8E1]/20 bg-[#18232E] shadow-2xl overflow-hidden clip-val-panel">
        {/* Sticky Mobile-Friendly Header */}
        <div className="shrink-0 bg-[#18232E] border-b border-[#ECE8E1]/15 px-3 py-2.5 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rotate-45 ${effectiveCanBuy ? 'bg-[#17E5B8]' : 'bg-[#FF4655]'}`} />
                <h2 className="font-display text-base sm:text-2xl font-extrabold uppercase tracking-[0.14em] text-[#ECE8E1] truncate">
                  {isFreeMode
                    ? 'THE RANGE · ALL GUNS FREE'
                    : isTdmMode && effectiveCanBuy
                      ? 'TDM ARMORY · FREE SWAP'
                      : effectiveCanBuy
                        ? 'ARMORY · BUY PHASE'
                        : 'ARMORY · ROUND ACTIVE'}
                </h2>
              </div>
              <p className="hidden sm:block font-mono text-[11px] text-[#8B978F]">
                {isFreeMode
                  ? 'Every firearm, sniper, shotgun & shield is unlocked free at any time in The Range'
                  : effectiveCanBuy
                    ? 'Equip your Sidearm, Primary firearm, Hollow Blade & tactical armor'
                    : 'Purchases are allowed during Buy Phase or Practice Range'}
              </p>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-5 shrink-0">
              <div className="flex items-center gap-2.5 border border-[#ECE8E1]/15 bg-[#0F1923] px-2.5 py-1.5 font-mono clip-val-card">
                <div className="text-right">
                  <div className="text-[8px] uppercase text-[#8B978F] leading-none">CREDITS</div>
                  <div className="text-sm sm:text-lg font-black text-[#17E5B8] tabular-nums leading-tight">
                    ${credits.toLocaleString()}
                  </div>
                </div>
                <div className="h-6 w-px bg-[#ECE8E1]/15" />
                <div className="text-right">
                  <div className="text-[8px] uppercase text-[#8B978F] leading-none">ARMOR</div>
                  <div className="text-sm sm:text-lg font-black text-[#ECE8E1] tabular-nums leading-tight">
                    {currentArmor}
                  </div>
                </div>
              </div>

              <button
                type="button"
                data-testid="buy-menu-close-btn"
                onClick={onClose}
                className="min-h-[44px] min-w-[78px] bg-[#FF4655] px-4 py-2 font-display text-xs sm:text-sm font-extrabold uppercase tracking-widest text-[#ECE8E1] hover:bg-[#ff5a68] active:scale-[0.98] transition cursor-pointer clip-val-btn"
              >
                DONE
              </button>
            </div>
          </div>

          {/* Horizontal Scrollable Touch-Friendly Category Filter Pills */}
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {CATEGORY_TABS.map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`buy-tab-${tab.id}`}
                  onClick={() => setFilter(tab.id)}
                  className={`shrink-0 min-h-[38px] sm:min-h-[34px] border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition cursor-pointer clip-val-card ${
                    active
                      ? 'border-[#FF4655] bg-[#FF4655] text-[#ECE8E1]'
                      : tab.id === 'SHIELD_KIT'
                        ? 'border-[#17E5B8]/40 bg-[#17E5B8]/10 text-[#17E5B8] hover:border-[#17E5B8]'
                        : 'border-[#ECE8E1]/15 bg-[#0F1923] text-[#8B978F] hover:border-[#17E5B8] hover:text-[#17E5B8]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Armory Body */}
        <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-6 sm:py-4 space-y-4">
          {/* Quick Shield & Kit Strip on Mobile when in SHIELD_KIT or Top of ALL on narrow phones */}
          {filter === 'SHIELD_KIT' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.values(SHIELD_REGISTRY).map((s: ShieldDef) => {
                const isEquipped = currentArmor >= s.armorPoints;
                const canAfford = isFreeMode || isTdmMode || credits >= s.cost;
                return (
                  <div
                    key={s.id}
                    className={`flex flex-col justify-between border p-3.5 clip-val-card ${
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
                        <span className="font-mono text-sm font-bold text-[#17E5B8]">
                          {isFreeMode ? 'FREE' : `$${s.cost}`}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#8B978F]">{s.description}</p>
                    </div>
                    <button
                      type="button"
                      disabled={isEquipped || !canAfford || !effectiveCanBuy}
                      onClick={() => onBuyShield(s.id)}
                      className={`mt-3 min-h-[44px] w-full py-2 font-display text-xs font-extrabold uppercase tracking-wider transition cursor-pointer clip-val-card ${
                        isEquipped
                          ? 'border border-[#17E5B8]/50 bg-[#17E5B8]/20 text-[#17E5B8] cursor-default'
                          : effectiveCanBuy && canAfford
                            ? 'bg-[#17E5B8] text-[#0F1923] hover:opacity-90'
                            : 'bg-[#18232E] text-[#8B978F] cursor-not-allowed'
                      }`}
                    >
                      {isEquipped
                        ? 'EQUIPPED'
                        : !effectiveCanBuy
                          ? 'BUY PHASE ONLY'
                          : canAfford
                            ? isFreeMode
                              ? 'EQUIP FREE'
                              : 'BUY SHIELD'
                            : 'LOCKED'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Weapons Grid — 2 columns on mobile landscape/portrait, 4 columns on desktop */}
          {filteredWeapons.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2.5">
              {filteredWeapons.map((w: WeaponDef) => {
                const isEquipped = currentWeaponId === w.id;
                const isWeaponFree = isFreeMode || isTdmMode || w.cost === 0;
                const canAfford = isWeaponFree || credits >= w.cost;
                const pelletsText = w.pellets && w.pellets > 1 ? `${w.pellets}× ` : '';

                return (
                  <div
                    key={w.id}
                    data-testid={`buy-card-${w.id}`}
                    className={`flex flex-col justify-between border p-2.5 sm:p-3 transition clip-val-card ${
                      isEquipped
                        ? 'border-[#17E5B8] bg-[#17E5B8]/10'
                        : canAfford
                          ? 'border-[#ECE8E1]/15 bg-[#0F1923]/85 hover:border-[#ECE8E1]/40'
                          : 'border-[#ECE8E1]/10 bg-[#0F1923]/45 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#8B978F]">
                            {w.category.replace('_', ' ')}
                          </span>
                          <h4 className="font-display text-sm sm:text-base font-extrabold uppercase tracking-wide text-[#ECE8E1] truncate">
                            {w.name}
                          </h4>
                        </div>
                        <span className="font-mono text-xs font-bold text-[#17E5B8] tabular-nums shrink-0">
                          {isWeaponFree ? 'FREE' : `$${w.cost.toLocaleString()}`}
                        </span>
                      </div>

                      <p className="hidden sm:block mt-1 text-[10px] text-[#8B978F] leading-tight line-clamp-2">
                        {w.description}
                      </p>

                      <div className="mt-2 space-y-0.5 border-t border-[#ECE8E1]/10 pt-1.5 text-[10px] font-mono text-[#ECE8E1]">
                        <div className="flex justify-between">
                          <span className="text-[#8B978F]">DMG:</span>
                          <span className="font-bold tabular-nums">
                            {pelletsText}
                            {w.damageHead}/{w.damageBody}/{w.damageLeg}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#8B978F]">MAG:</span>
                          <span className="tabular-nums">
                            {w.isMelee ? 'BLADE [3]' : `${w.magazineSize}/${w.reserveAmmo}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      data-testid={`buy-weapon-${w.id}`}
                      disabled={isEquipped || !canAfford || (!effectiveCanBuy && !w.isMelee)}
                      onClick={() => onBuyWeapon(w.id)}
                      className={`mt-2.5 min-h-[44px] w-full py-2 font-display text-xs font-extrabold uppercase tracking-widest transition cursor-pointer clip-val-card ${
                        isEquipped
                          ? 'border border-[#17E5B8]/50 bg-[#17E5B8]/20 text-[#17E5B8] cursor-default'
                          : (effectiveCanBuy || w.isMelee) && canAfford
                            ? 'bg-[#FF4655] text-[#ECE8E1] hover:bg-[#ff5e6b] active:scale-[0.98]'
                            : 'bg-[#18232E] text-[#8B978F] cursor-not-allowed'
                      }`}
                    >
                      {isEquipped
                        ? 'EQUIPPED'
                        : w.isMelee
                          ? 'EQUIP BLADE'
                          : !effectiveCanBuy
                            ? 'BUY PHASE ONLY'
                            : canAfford
                              ? isWeaponFree
                                ? 'EQUIP FREE'
                                : 'PURCHASE'
                              : 'LOCKED'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Armor & Agent Kit Section */}
          {showShieldsSection && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 border-t border-[#ECE8E1]/10 pt-3">
              {filter !== 'SHIELD_KIT' && (
                <div>
                  <h3 className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#FF4655] mb-2">
                    Tactical Shields
                  </h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    {Object.values(SHIELD_REGISTRY).map((s: ShieldDef) => {
                      const isEquipped = currentArmor >= s.armorPoints;
                      const canAfford = isFreeMode || isTdmMode || credits >= s.cost;

                      return (
                        <div
                          key={s.id}
                          className={`flex flex-col justify-between border p-3 clip-val-card ${
                            isEquipped
                              ? 'border-[#17E5B8] bg-[#17E5B8]/10'
                              : canAfford
                                ? 'border-[#ECE8E1]/15 bg-[#0F1923]/85'
                                : 'border-[#ECE8E1]/10 bg-[#0F1923]/45 opacity-60'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="font-display text-xs sm:text-sm font-extrabold uppercase text-[#ECE8E1]">{s.name}</h4>
                              <span className="font-mono text-xs font-bold text-[#17E5B8]">
                                {isFreeMode || isTdmMode ? 'FREE' : `$${s.cost}`}
                              </span>
                            </div>
                            <p className="mt-1 text-[10px] text-[#8B978F]">{s.description}</p>
                          </div>

                          <button
                            type="button"
                            disabled={isEquipped || !canAfford || !effectiveCanBuy}
                            onClick={() => onBuyShield(s.id)}
                            className={`mt-2.5 min-h-[44px] w-full py-2 font-display text-xs font-extrabold uppercase tracking-wider transition cursor-pointer clip-val-card ${
                              isEquipped
                                ? 'border border-[#17E5B8]/50 bg-[#17E5B8]/20 text-[#17E5B8] cursor-default'
                                : effectiveCanBuy && canAfford
                                  ? 'bg-[#17E5B8] text-[#0F1923] hover:opacity-90'
                                  : 'bg-[#18232E] text-[#8B978F] cursor-not-allowed'
                            }`}
                          >
                            {isEquipped
                              ? 'EQUIPPED'
                              : !effectiveCanBuy
                                ? 'BUY PHASE ONLY'
                                : canAfford
                                  ? isFreeMode || isTdmMode
                                    ? 'EQUIP FREE'
                                    : 'BUY'
                                  : 'LOCKED'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className={filter === 'SHIELD_KIT' ? 'md:col-span-2' : ''}>
                <h3 className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#FF4655] mb-2">
                  Agent Abilities ({AGENT_REGISTRY[agent.id]?.name ?? agent.name})
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
                      <div className="mt-1 font-display text-xs sm:text-sm font-bold uppercase text-[#ECE8E1]">{ab.name}</div>
                      <div className="mt-0.5 text-[10px] text-[#8B978F] leading-tight">{ab.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
