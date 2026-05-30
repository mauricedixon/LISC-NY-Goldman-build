"use client";

import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  steps?: string[];
  message?: string;
}

export function EmptyState({ icon: Icon, title, steps, message }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[200px] px-4">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-slate-200" />
      </div>
      <p className="text-sm font-medium text-slate-500 mb-3">{title}</p>
      {message && <p className="text-xs text-slate-400 text-center max-w-xs mb-3">{message}</p>}
      {steps && steps.length > 0 && (
        <ol className="text-xs text-slate-500 space-y-1.5 text-left">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-brand/10 text-brand text-[10px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
