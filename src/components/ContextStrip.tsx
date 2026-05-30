"use client";

import { getAccentStyle, getAgencyStyle } from "@/lib/agencies";

interface ContextStripProps {
  loanType: string;
  selectedAgencyIds: string[];
  selectedAgencyNames: string[];
  modeLabel?: string;
}

export function ContextStrip({
  loanType,
  selectedAgencyIds,
  selectedAgencyNames,
  modeLabel,
}: ContextStripProps) {
  const accent = getAccentStyle(selectedAgencyIds);

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-border-subtle rounded-xl text-sm shadow-sm">
      <span className="text-slate-400 font-medium">Reviewing</span>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 font-medium">
        {loanType}
      </span>
      {selectedAgencyNames.length > 0 ? (
        selectedAgencyIds.map((id, i) => {
          const style = getAgencyStyle(id);
          return (
            <span
              key={id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-medium ${style.badge}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
              {selectedAgencyNames[i]}
            </span>
          );
        })
      ) : (
        <span className="text-amber-600 font-medium">No agencies selected</span>
      )}
      {modeLabel && (
        <>
          <span className="text-slate-300 hidden sm:inline">·</span>
          <span className={`font-medium ${accent.accent}`}>{modeLabel}</span>
        </>
      )}
    </div>
  );
}
