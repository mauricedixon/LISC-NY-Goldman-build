"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
  HelpCircle,
  XCircle,
} from "lucide-react";
import type { AnalysisResult } from "@/types/wizard";
import { EmptyState } from "@/components/ui/EmptyState";

interface AnalysisResultsProps {
  analysisResult: AnalysisResult | null;
  emptyMessage?: string;
  emptySteps?: string[];
}

function computeSummary(analysis: AnalysisResult) {
  const checklist = analysis.completenessChecklist ?? [];
  const flags = analysis.complianceFlags ?? [];

  const provided = checklist.filter((i) => i.status === "provided").length;
  const missing = checklist.filter((i) => i.status === "missing").length;
  const needsClarification = checklist.filter((i) => i.status === "needs_clarification").length;
  const highFlags = flags.filter((f) => f.severity === "High").length;

  return { provided, missing, needsClarification, flagCount: flags.length, highFlags };
}

export function AnalysisResults({
  analysisResult,
  emptyMessage,
  emptySteps,
}: AnalysisResultsProps) {
  const statusIcon = (status: string) => {
    if (status === "provided") return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (status === "missing") return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
    return <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />;
  };

  const statusColor = (status: string) => {
    if (status === "provided") return "text-emerald-700";
    if (status === "missing") return "text-red-600";
    return "text-amber-700";
  };

  const summary = analysisResult ? computeSummary(analysisResult) : null;

  const severityBorder = (severity: string) => {
    if (severity === "High") return "border-l-red-500";
    if (severity === "Medium") return "border-l-amber-400";
    return "border-l-slate-300";
  };

  const severityBadge = (severity: string) => {
    const base = "text-xs font-semibold px-2 py-0.5 rounded-full shrink-0";
    if (severity === "High") return <span className={`${base} bg-red-100 text-red-700`}>High</span>;
    if (severity === "Medium") return <span className={`${base} bg-amber-100 text-amber-700`}>Medium</span>;
    return <span className={`${base} bg-slate-100 text-slate-600`}>Low</span>;
  };

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-border-subtle px-4 py-3 shadow-sm">
            <p className="text-2xl font-bold text-emerald-600">{summary.provided}</p>
            <p className="text-xs text-slate-500 mt-0.5">Provided</p>
          </div>
          <div className="bg-white rounded-xl border border-border-subtle px-4 py-3 shadow-sm">
            <p className="text-2xl font-bold text-red-500">{summary.missing}</p>
            <p className="text-xs text-slate-500 mt-0.5">Missing</p>
          </div>
          <div className="bg-white rounded-xl border border-border-subtle px-4 py-3 shadow-sm">
            <p className="text-2xl font-bold text-amber-500">{summary.needsClarification}</p>
            <p className="text-xs text-slate-500 mt-0.5">Needs clarification</p>
          </div>
          <div className="bg-white rounded-xl border border-border-subtle px-4 py-3 shadow-sm">
            <p className="text-2xl font-bold text-slate-700">
              {summary.flagCount}
              {summary.highFlags > 0 && (
                <span className="text-sm font-normal text-red-500 ml-1">({summary.highFlags} high)</span>
              )}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Compliance flags</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-border-subtle shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand" />
              Completeness Checklist
            </h3>
          </div>
          <div className="p-6 flex-1 flex flex-col">
            {!analysisResult ? (
              <EmptyState
                icon={ClipboardList}
                title={emptyMessage ?? "Run the check to see results."}
                steps={
                  emptySteps ?? [
                    "Select loan type and agencies in the sidebar",
                    "Enter deal details or start a guided review",
                    "Run the check to generate your report",
                  ]
                }
              />
            ) : (
              <div className="space-y-1">
                {(analysisResult.completenessChecklist || []).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    {statusIcon(item.status)}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${statusColor(item.status)}`}>{item.field}</p>
                      {item.note && <p className="text-xs text-slate-500 mt-0.5">{item.note}</p>}
                    </div>
                    <span
                      className={`text-xs capitalize shrink-0 px-2 py-0.5 rounded-full bg-slate-50 ${statusColor(item.status)}`}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border-subtle shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Compliance Flags
            </h3>
          </div>
          <div className="p-6 flex-1 flex flex-col">
            {!analysisResult ? (
              <EmptyState
                icon={CheckCircle2}
                title={emptyMessage ?? "No flags yet."}
                message="Compliance issues will appear here after analysis."
              />
            ) : analysisResult.complianceFlags && analysisResult.complianceFlags.length > 0 ? (
              <div className="space-y-3">
                {analysisResult.complianceFlags.map((flag, idx) => (
                  <div
                    key={idx}
                    className={`bg-white border border-slate-200 border-l-4 ${severityBorder(flag.severity)} rounded-lg p-4 shadow-sm`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      {severityBadge(flag.severity)}
                      <p className="text-sm font-medium text-slate-800 leading-snug">{flag.issue}</p>
                    </div>
                    <div className="pl-1 border-t border-slate-100 pt-2 mt-2">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Citation
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed">{flag.citation}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-emerald-600 min-h-[200px]">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
                <p className="text-sm font-medium">No compliance issues found!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
