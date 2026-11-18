/**
 * Hollow Strike - Dedicated Agents Page
 * Roster selector on left, tactical agent dossier & 4-slot ability kit breakdown on right.
 */

import React, { useState } from 'react';
import { AGENT_REGISTRY, AgentDef } from '../../game/types';

interface AgentsPageProps {
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
  onDeployNow: () => void;
}

export const AgentsPage: React.FC<AgentsPageProps> = ({
  selectedAgentId,
  onSelectAgent,
  onDeployNow,
}) => {
  const agents = Object.values(AGENT_REGISTRY);
  const [inspectedId, setInspectedId] = useState<string>(selectedAgentId);
  const inspected: AgentDef = AGENT_REGISTRY[inspectedId] || AGENT_REGISTRY.ZEPHYR;
  const isActive = inspected.id === selectedAgentId;

  return (
    <div className="relative z-10 flex flex-1 flex-col lg:flex-row overflow-y-auto px-4 sm:px-6 py-4 gap-5">
      {/* Left Agent Roster List */}
      <div className="lg:w-72 shrink-0 flex flex-col gap-2.5">
        <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
          Operative Roster ({agents.length})
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5">
          {agents.map((ag) => {
            const selected = ag.id === inspected.id;
            const equipped = ag.id === selectedAgentId;
            return (
              <button
                key={ag.id}
                onClick={() => setInspectedId(ag.id)}
                className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition cursor-pointer ${
                  selected
                    ? 'bg-slate-900/95 text-white shadow-lg'
                    : 'border-slate-800/80 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
                style={selected ? { borderColor: ag.primaryColor } : undefined}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border font-mono text-lg font-black"
                    style={{
                      borderColor: `${ag.primaryColor}88`,
                      backgroundColor: `${ag.primaryColor}1a`,
                      color: ag.primaryColor,
                    }}
                  >
                    {ag.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-black uppercase truncate text-white">
                      {ag.name}
                    </div>
                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: ag.primaryColor }}>
                      {ag.role}
                    </div>
                  </div>
                </div>

                {equipped && (
                  <span className="shrink-0 font-mono text-[10px] font-bold uppercase text-emerald-400">
                    ACTIVE
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Full Agent Dossier */}
      <div className="flex-1 flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/80 p-5 sm:p-6">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 font-mono text-3xl font-black"
                style={{
                  borderColor: inspected.primaryColor,
                  backgroundColor: `${inspected.primaryColor}20`,
                  color: inspected.primaryColor,
                }}
              >
                {inspected.name[0]}
              </div>
              <div>
                <div className="font-mono text-xs font-bold uppercase tracking-widest" style={{ color: inspected.primaryColor }}>
                  {inspected.role}
                </div>
                <h2 className="font-mono text-2xl sm:text-3xl font-black uppercase tracking-wide text-white">
                  {inspected.name}
                </h2>
                <p className="mt-1 text-sm text-slate-300 max-w-2xl leading-relaxed">
                  {inspected.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => onSelectAgent(inspected.id)}
                className={`rounded-xl px-5 py-2.5 font-mono text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                  isActive
                    ? 'border border-emerald-500/60 bg-emerald-950/50 text-emerald-300'
                    : 'text-slate-950 hover:opacity-90'
                }`}
                style={!isActive ? { backgroundColor: inspected.primaryColor } : undefined}
              >
                {isActive ? 'Equipped Operative' : `Select ${inspected.name}`}
              </button>

              <button
                onClick={() => {
                  onSelectAgent(inspected.id);
                  onDeployNow();
                }}
                className="rounded-xl border border-rose-500/50 bg-rose-600 px-5 py-2.5 font-mono text-xs font-black uppercase tracking-wider text-white hover:bg-rose-500 transition cursor-pointer"
              >
                Deploy
              </button>
            </div>
          </div>

          <div className="mt-5">
            <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Combat Ability Kit
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {inspected.abilities.map((ab) => (
                <div
                  key={ab.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span
                        className="rounded px-2 py-0.5 font-black"
                        style={{
                          backgroundColor: ab.isUltimate ? '#78350f' : `${inspected.primaryColor}22`,
                          color: ab.isUltimate ? '#fbbf24' : inspected.primaryColor,
                        }}
                      >
                        KEY [{ab.keySlot}] {ab.isUltimate ? '· ULTIMATE' : ''}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {ab.isUltimate
                          ? `${ab.ultPointsRequired} ULT PTS`
                          : `${ab.maxCharges}× · ${ab.cooldownTime}s COOLDOWN`}
                      </span>
                    </div>
                    <h3 className="mt-2.5 font-mono text-base font-black text-white uppercase">
                      {ab.name}
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                      {ab.description}
                    </p>
                  </div>

                  {!ab.isUltimate && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between font-mono text-[11px] text-slate-400">
                      <span>Supply Cost</span>
                      <span className="text-emerald-400 font-bold">${ab.cost}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
