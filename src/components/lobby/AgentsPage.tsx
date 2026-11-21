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
  const inspected: AgentDef = AGENT_REGISTRY[inspectedId] || AGENT_REGISTRY.KAEL;
  const isActive = inspected.id === selectedAgentId;

  return (
    <div className="relative z-10 flex flex-1 flex-col lg:flex-row overflow-y-auto px-4 sm:px-6 py-4 gap-5">
      {/* Left Agent Roster List */}
      <div className="lg:w-72 shrink-0 flex flex-col gap-2.5">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8B978F] mb-1">
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
                className={`flex items-center justify-between border-l-2 border p-3.5 text-left transition cursor-pointer clip-val-card ${
                  selected
                    ? 'bg-[#18232E] text-[#ECE8E1] shadow-lg'
                    : 'border-[#ECE8E1]/10 bg-[#18232E]/45 text-[#8B978F] hover:border-[#ECE8E1]/30 hover:text-[#ECE8E1]'
                }`}
                style={selected ? { borderColor: ag.primaryColor, borderLeftColor: '#FF4655' } : undefined}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center border font-display text-xl font-extrabold clip-val-card"
                    style={{
                      borderColor: `${ag.primaryColor}88`,
                      backgroundColor: `${ag.primaryColor}1a`,
                      color: ag.primaryColor,
                    }}
                  >
                    {ag.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-base font-extrabold uppercase truncate text-[#ECE8E1] tracking-wide">
                      {ag.name}
                    </div>
                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: ag.primaryColor }}>
                      {ag.role}
                    </div>
                  </div>
                </div>

                {equipped && (
                  <span className="shrink-0 font-mono text-[10px] font-bold uppercase text-[#17E5B8]">
                    ACTIVE
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Full Agent Dossier */}
      <div className="flex-1 flex flex-col justify-between border border-[#ECE8E1]/15 bg-[#18232E]/90 p-5 sm:p-6 clip-val-panel">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#ECE8E1]/15 pb-5">
            <div className="flex items-center gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center border-2 font-display text-3xl font-extrabold clip-val-card"
                style={{
                  borderColor: inspected.primaryColor,
                  backgroundColor: `${inspected.primaryColor}20`,
                  color: inspected.primaryColor,
                }}
              >
                {inspected.name[0]}
              </div>
              <div>
                <div className="font-mono text-xs font-bold uppercase tracking-[0.2em]" style={{ color: inspected.primaryColor }}>
                  {inspected.role}
                </div>
                <h2 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-wider text-[#ECE8E1]">
                  {inspected.name}
                </h2>
                <p className="mt-1 text-sm text-[#8B978F] max-w-2xl leading-relaxed">
                  {inspected.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => onSelectAgent(inspected.id)}
                className={`px-5 py-2.5 font-display text-sm font-extrabold uppercase tracking-wider transition cursor-pointer clip-val-card ${
                  isActive
                    ? 'border border-[#17E5B8]/60 bg-[#17E5B8]/15 text-[#17E5B8]'
                    : 'text-[#0F1923] hover:opacity-90'
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
                className="bg-[#FF4655] px-6 py-2.5 font-display text-sm font-extrabold uppercase tracking-widest text-[#ECE8E1] hover:bg-[#ff5e6b] transition cursor-pointer clip-val-btn"
              >
                Deploy
              </button>
            </div>
          </div>

          <div className="mt-5">
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8B978F] mb-3">
              Combat Ability Kit
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {inspected.abilities.map((ab) => (
                <div
                  key={ab.id}
                  className="border border-[#ECE8E1]/15 bg-[#0F1923]/80 p-4 flex flex-col justify-between clip-val-card"
                >
                  <div>
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span
                        className="px-2 py-0.5 font-black"
                        style={{
                          backgroundColor: ab.isUltimate ? 'rgba(255, 70, 85, 0.2)' : `${inspected.primaryColor}22`,
                          color: ab.isUltimate ? '#FF4655' : inspected.primaryColor,
                        }}
                      >
                        KEY [{ab.keySlot}] {ab.isUltimate ? '· ULTIMATE' : ''}
                      </span>
                      <span className="text-[11px] text-[#8B978F]">
                        {ab.isUltimate
                          ? `${ab.ultPointsRequired} ULT PTS`
                          : `${ab.maxCharges}× · ${ab.cooldownTime}s COOLDOWN`}
                      </span>
                    </div>
                    <h3 className="mt-2.5 font-display text-lg font-extrabold text-[#ECE8E1] uppercase tracking-wide">
                      {ab.name}
                    </h3>
                    <p className="mt-1 text-xs text-[#8B978F] leading-relaxed">
                      {ab.description}
                    </p>
                  </div>

                  {!ab.isUltimate && (
                    <div className="mt-3 pt-2.5 border-t border-[#ECE8E1]/10 flex items-center justify-between font-mono text-[11px] text-[#8B978F]">
                      <span>Supply Cost</span>
                      <span className="text-[#17E5B8] font-bold">${ab.cost}</span>
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
