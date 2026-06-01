"use client";

import { Building2, ChevronDown, CheckSquare } from "lucide-react";
import { getAgencyStyle } from "@/lib/agencies";

export interface Agency {
  id: string;
  name: string;
  checked: boolean;
}

export const LOAN_TYPES = [
  "New Construction",
  "Preservation / Rehab",
  "Supportive Housing",
  "Acquisition / Rehab",
  "Refinancing",
] as const;

export type LoanType = typeof LOAN_TYPES[number];

interface SidebarProps {
  agencies: Agency[];
  onToggleAgency: (id: string) => void;
  loanType: LoanType;
  onLoanTypeChange: (value: LoanType) => void;
}

export function Sidebar({ agencies, onToggleAgency, loanType, onLoanTypeChange }: SidebarProps) {
  const selected = agencies.filter((a) => a.checked);
  const selectedCount = selected.length;

  return (
    <div className="w-72 bg-[#152420] text-slate-100 flex flex-col h-screen border-r border-[#1e332c]">
      <div className="p-6 border-b border-[#1e332c]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand/20 flex items-center justify-center ring-1 ring-brand/30">
            <Building2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-white">LISC NY</h1>
            <p className="text-[11px] text-emerald-400/70 font-medium tracking-wide uppercase">
              Public Data Engine
            </p>
          </div>
        </div>
      </div>

      {/* Active context */}
      <div className="px-4 pt-4">
        <div className="rounded-lg bg-[#1a2e28] border border-[#243d35] p-3 space-y-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Active context
          </p>
          <p className="text-sm font-medium text-slate-200 leading-snug">{loanType}</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedCount > 0 ? (
              selected.map((agency) => {
                const style = getAgencyStyle(agency.id);
                return (
                  <span
                    key={agency.id}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#243d35] text-slate-300"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                    {agency.name.split(" ")[0]}
                  </span>
                );
              })
            ) : (
              <span className="text-[11px] text-amber-400/80">Select an agency</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pt-5 space-y-7">
        <div className="space-y-3 px-1">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loan Type</h2>
          <div className="relative">
            <select
              value={loanType}
              onChange={(e) => onLoanTypeChange(e.target.value as LoanType)}
              className="w-full bg-[#1a2e28] border border-[#243d35] text-sm rounded-lg px-3 py-2.5 appearance-none focus:outline-none focus:ring-2 focus:ring-brand/50 text-slate-100"
            >
              {LOAN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-slate-500 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-3 px-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Target Agencies
            </h2>
            <span className="text-[10px] bg-brand/20 text-emerald-300 px-2 py-0.5 rounded-full font-semibold">
              {selectedCount} selected
            </span>
          </div>
          <p className="text-xs text-slate-500">Select rulebooks to constrain AI search.</p>

          <div className="space-y-1">
            {agencies.map((agency) => {
              const style = getAgencyStyle(agency.id);
              return (
                <label
                  key={agency.id}
                  className={`flex items-center gap-3 group cursor-pointer px-2 py-2 rounded-lg transition-colors ${
                    agency.checked ? "bg-[#1a2e28]" : "hover:bg-[#1a2e28]/60"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                      agency.checked
                        ? "bg-brand border-brand"
                        : "border-slate-600 group-hover:border-slate-500"
                    }`}
                  >
                    {agency.checked && <CheckSquare className="w-3 h-3 text-white" />}
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={agency.checked}
                    onChange={() => onToggleAgency(agency.id)}
                  />
                  <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                  <span
                    className={`text-sm ${
                      agency.checked ? "text-slate-100" : "text-slate-400 group-hover:text-slate-300"
                    }`}
                  >
                    {agency.name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-[#1e332c]">
        <p className="text-[10px] text-slate-600 text-center">
          Affordable housing compliance assistant
        </p>
      </div>
    </div>
  );
}
