"use client";

import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import {
  buildDealIdentityLine,
  computeAnalysisSummary,
  parameterStatusLabel,
  parameterStatusTone,
} from "@/lib/compliance-snapshot";
import type { DealFormData } from "@/types/deal";
import type { AnalysisResult, CompletenessChecklistItem } from "@/types/wizard";

interface DealSnapshotPanelProps {
  analysis: AnalysisResult;
  formData: DealFormData;
  loanType: string;
  selectedAgencyNames: string[];
  isStale?: boolean;
}

function ParameterIcon({ status }: { status: CompletenessChecklistItem["status"] }) {
  if (status === "provided")
    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  if (status === "missing") return <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
  return <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
}

export function DealSnapshotPanel({
  analysis,
  formData,
  loanType,
  selectedAgencyNames,
  isStale = false,
}: DealSnapshotPanelProps) {
  const metrics = computeAnalysisSummary(analysis);
  const identity = buildDealIdentityLine(formData, loanType, selectedAgencyNames);
  const checklist = analysis.completenessChecklist ?? [];
  const topHighFlag = (analysis.complianceFlags ?? []).find((f) => f.severity === "High");

  const needsAttention = checklist.filter(
    (i) => i.status === "missing" || i.status === "needs_clarification"
  );
  const parametersToShow = [
    ...needsAttention,
    ...checklist.filter((i) => i.status === "provided"),
  ].slice(0, 8);

  const verdictParts: string[] = [];
  if (metrics.highFlags > 0) {
    verdictParts.push(
      `${metrics.highFlags} high-severity flag${metrics.highFlags > 1 ? "s" : ""}`
    );
  }
  if (metrics.missing > 0) {
    verdictParts.push(`${metrics.missing} missing`);
  }
  if (metrics.needsClarification > 0) {
    verdictParts.push(`${metrics.needsClarification} need clarification`);
  }
  const verdict =
    verdictParts.length > 0
      ? verdictParts.join(" · ")
      : metrics.flagCount === 0
        ? "No compliance flags raised"
        : `${metrics.flagCount} flag${metrics.flagCount > 1 ? "s" : ""} to review`;

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
        isStale ? "border-amber-300 ring-1 ring-amber-200" : "border-border-subtle"
      }`}
    >
      <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-800">Deal Snapshot</h3>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl">{identity}</p>
          </div>
          <p className="text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
            {verdict}
          </p>
        </div>
        {isStale && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
            Deal inputs changed since this analysis. Re-run the check to refresh this snapshot.
          </p>
        )}
      </div>

      <div className="px-6 py-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <MetricBadge label="Provided" value={metrics.provided} tone="emerald" />
          <MetricBadge label="Missing" value={metrics.missing} tone="red" />
          <MetricBadge label="Clarify" value={metrics.needsClarification} tone="amber" />
          <MetricBadge
            label="Flags"
            value={metrics.flagCount}
            suffix={metrics.highFlags > 0 ? ` (${metrics.highFlags} high)` : undefined}
            tone="slate"
          />
        </div>

        {analysis.executiveSummary && (
          <p className="text-sm text-slate-600 leading-relaxed border-l-2 border-brand/40 pl-4">
            {analysis.executiveSummary}
          </p>
        )}

        {topHighFlag && (
          <div className="flex gap-2 items-start bg-red-50/80 border border-red-100 rounded-lg px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-800 leading-snug">
              <span className="font-semibold">Top concern: </span>
              {topHighFlag.issue}
            </p>
          </div>
        )}

        {parametersToShow.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Compliance parameters
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {parametersToShow.map((item, idx) => (
                <li
                  key={`${item.field}-${idx}`}
                  className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
                >
                  <ParameterIcon status={item.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-slate-800">{item.field}</span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${parameterStatusTone(item.status)}`}
                      >
                        {parameterStatusLabel(item.status)}
                      </span>
                    </div>
                    {item.note && (
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{item.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {checklist.length > parametersToShow.length && (
              <p className="text-[11px] text-slate-400 mt-2">
                +{checklist.length - parametersToShow.length} more in the deal checklist below
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricBadge({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone: "emerald" | "red" | "amber" | "slate";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    red: "bg-red-50 text-red-700 border-red-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  };

  return (
    <span
      className={`inline-flex items-baseline gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${tones[tone]}`}
    >
      <span className="text-base font-bold tabular-nums">{value}</span>
      {label}
      {suffix && <span className="font-normal opacity-80">{suffix}</span>}
    </span>
  );
}
