"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
  HelpCircle,
  ListTodo,
  XCircle,
} from "lucide-react";
import type { DealFormData } from "@/types/deal";
import type { AnalysisResult, ComplianceFlag } from "@/types/wizard";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormattedCitationText } from "@/utils/format-citations";
import { DealSnapshotPanel } from "@/components/completeness/DealSnapshotPanel";

interface AnalysisResultsProps {
  analysisResult: AnalysisResult | null;
  formData: DealFormData;
  loanType: string;
  selectedAgencyNames: string[];
  isStale?: boolean;
  emptyMessage?: string;
  emptySteps?: string[];
}

function CollapsibleSection({
  title,
  count,
  defaultOpen,
  children,
  accentClass = "text-slate-800",
}: {
  title: string;
  count: number;
  defaultOpen: boolean;
  children: React.ReactNode;
  accentClass?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left"
      >
        <span className={`text-sm font-medium ${accentClass}`}>
          {title}
          <span className="text-slate-400 font-normal ml-1.5">({count})</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="px-2 py-1">{children}</div>}
    </div>
  );
}

const SEVERITY_ORDER: Array<ComplianceFlag["severity"]> = ["High", "Medium", "Low"];

const SEVERITY_DEFAULT_OPEN: Record<ComplianceFlag["severity"], boolean> = {
  High: true,
  Medium: false,
  Low: false,
};

export function AnalysisResults({
  analysisResult,
  formData,
  loanType,
  selectedAgencyNames,
  isStale = false,
  emptyMessage,
  emptySteps,
}: AnalysisResultsProps) {
  const statusIcon = (status: string) => {
    if (status === "provided")
      return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (status === "missing") return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
    return <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />;
  };

  const statusColor = (status: string) => {
    if (status === "provided") return "text-emerald-700";
    if (status === "missing") return "text-red-600";
    return "text-amber-700";
  };

  const severityBorder = (severity: string) => {
    if (severity === "High") return "border-l-red-500";
    if (severity === "Medium") return "border-l-amber-400";
    return "border-l-slate-300";
  };

  const severityBadge = (severity: string) => {
    const base = "text-xs font-semibold px-2 py-0.5 rounded-full shrink-0";
    if (severity === "High") return <span className={`${base} bg-red-100 text-red-700`}>High</span>;
    if (severity === "Medium")
      return <span className={`${base} bg-amber-100 text-amber-700`}>Medium</span>;
    return <span className={`${base} bg-slate-100 text-slate-600`}>Low</span>;
  };

  const priorityBadge = (priority?: string) => {
    const p = priority?.toLowerCase();
    const base = "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase shrink-0";
    if (p === "high") return <span className={`${base} bg-red-100 text-red-700`}>High</span>;
    if (p === "medium") return <span className={`${base} bg-amber-100 text-amber-700`}>Med</span>;
    return <span className={`${base} bg-slate-100 text-slate-600`}>Low</span>;
  };

  const checklist = analysisResult?.completenessChecklist ?? [];
  const flags = analysisResult?.complianceFlags ?? [];
  const needsAttention = checklist.filter(
    (i) => i.status === "missing" || i.status === "needs_clarification"
  );
  const providedItems = checklist.filter((i) => i.status === "provided");

  const renderChecklistItem = (
    item: (typeof checklist)[0],
    idx: number
  ) => (
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
  );

  const renderFlag = (flag: ComplianceFlag, idx: number) => (
    <div
      key={idx}
      className={`bg-white border border-slate-200 border-l-4 ${severityBorder(flag.severity)} rounded-lg p-4 shadow-sm mb-3 last:mb-0`}
    >
      <div className="flex items-start gap-2 mb-2">
        {severityBadge(flag.severity)}
        <p className="text-sm font-medium text-slate-800 leading-snug">{flag.issue}</p>
      </div>
      <div className="pl-1 border-t border-slate-100 pt-2 mt-2">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
          Citation
        </p>
        <p className="text-xs text-slate-600 leading-relaxed">
          <FormattedCitationText text={flag.citation} />
        </p>
      </div>
    </div>
  );

  if (!analysisResult) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-slate-600">Optional deal check</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-border-subtle shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand" />
                Deal Checklist
              </h3>
            </div>
            <div className="p-6">
              <EmptyState
                icon={ClipboardList}
                title={emptyMessage ?? "Run the check to see results."}
                steps={
                  emptySteps ?? [
                    "Select loan type, rulebooks, and funding programs in the sidebar",
                    "Use Guided or Manual Review when you want a deal-level check",
                    "Results appear here with a deal snapshot, flags, and action items",
                  ]
                }
              />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-border-subtle shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Compliance Flags
              </h3>
            </div>
            <div className="p-6">
              <EmptyState
                icon={CheckCircle2}
                title="No flags yet."
                message="Compliance issues will appear here after analysis."
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-600">Optional deal check</p>

      <DealSnapshotPanel
        analysis={analysisResult}
        formData={formData}
        loanType={loanType}
        selectedAgencyNames={selectedAgencyNames}
        isStale={isStale}
      />

      {analysisResult.actionItems && analysisResult.actionItems.length > 0 && (
        <div className="bg-white rounded-xl border border-border-subtle shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
              <ListTodo className="w-4 h-4 text-brand" />
              Action Items
            </h3>
          </div>
          <ul className="p-4 space-y-2">
            {analysisResult.actionItems.map((action, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 py-2 px-3 rounded-lg bg-slate-50/60 border border-slate-100"
              >
                <span className="text-xs font-bold text-slate-400 mt-0.5 w-5 shrink-0">
                  {idx + 1}.
                </span>
                {priorityBadge(action.priority)}
                <p className="text-sm text-slate-700 flex-1 leading-snug">{action.item}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-border-subtle shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand" />
              Deal Checklist
            </h3>
          </div>
          <div className="p-6 flex-1 flex flex-col">
            <div className="space-y-3">
              {needsAttention.length > 0 && (
                <CollapsibleSection
                  title="Needs attention"
                  count={needsAttention.length}
                  defaultOpen
                  accentClass="text-amber-800"
                >
                  {needsAttention.map(renderChecklistItem)}
                </CollapsibleSection>
              )}
              {providedItems.length > 0 && (
                <CollapsibleSection
                  title="Provided"
                  count={providedItems.length}
                  defaultOpen={needsAttention.length === 0}
                >
                  {providedItems.map(renderChecklistItem)}
                </CollapsibleSection>
              )}
              {checklist.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-6">No checklist items returned.</p>
              )}
            </div>
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
            {flags.length > 0 ? (
              <div className="space-y-3">
                {SEVERITY_ORDER.map((severity) => {
                  const group = flags.filter((f) => f.severity === severity);
                  if (group.length === 0) return null;
                  const accent =
                    severity === "High"
                      ? "text-red-700"
                      : severity === "Medium"
                        ? "text-amber-700"
                        : "text-slate-600";
                  return (
                    <CollapsibleSection
                      key={severity}
                      title={`${severity} severity`}
                      count={group.length}
                      defaultOpen={SEVERITY_DEFAULT_OPEN[severity]}
                      accentClass={accent}
                    >
                      {group.map(renderFlag)}
                    </CollapsibleSection>
                  );
                })}
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
