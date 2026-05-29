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

interface AnalysisResultsProps {
  analysisResult: AnalysisResult | null;
  emptyMessage?: string;
}

export function AnalysisResults({ analysisResult, emptyMessage }: AnalysisResultsProps) {
  const statusIcon = (status: string) => {
    if (status === "provided") return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
    if (status === "missing") return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
    return <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />;
  };

  const statusColor = (status: string) => {
    if (status === "provided") return "text-green-700";
    if (status === "missing") return "text-red-600";
    return "text-amber-700";
  };

  const severityBadge = (severity: string) => {
    const base = "text-xs font-semibold px-2 py-0.5 rounded-full";
    if (severity === "High") return <span className={`${base} bg-red-100 text-red-700`}>High</span>;
    if (severity === "Medium") return <span className={`${base} bg-amber-100 text-amber-700`}>Medium</span>;
    return <span className={`${base} bg-slate-100 text-slate-600`}>Low</span>;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            Completeness Checklist
          </h3>
        </div>
        <div className="p-6 flex-1 flex flex-col">
          {!analysisResult ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[200px]">
              <ClipboardList className="w-12 h-12 mb-3 text-slate-200" />
              <p className="text-sm">{emptyMessage ?? "Run the check to see results."}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(analysisResult.completenessChecklist || []).map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                  {statusIcon(item.status)}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${statusColor(item.status)}`}>{item.field}</p>
                    {item.note && <p className="text-xs text-slate-500 mt-0.5">{item.note}</p>}
                  </div>
                  <span className={`text-xs capitalize shrink-0 ${statusColor(item.status)}`}>
                    {item.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Compliance Flags
          </h3>
        </div>
        <div className="p-6 flex-1 flex flex-col">
          {!analysisResult ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[200px]">
              <CheckCircle2 className="w-12 h-12 mb-3 text-slate-200" />
              <p className="text-sm">{emptyMessage ?? "No flags yet."}</p>
            </div>
          ) : analysisResult.complianceFlags && analysisResult.complianceFlags.length > 0 ? (
            <div className="space-y-4">
              {analysisResult.complianceFlags.map((flag, idx) => (
                <div key={idx} className="bg-red-50 border border-red-100 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {severityBadge(flag.severity)}
                        <p className="text-sm font-medium text-red-900">{flag.issue}</p>
                      </div>
                      <div className="bg-white/60 rounded p-2 text-xs text-red-800 border border-red-100 font-mono">
                        <span className="font-semibold block mb-1">Citation:</span>
                        {flag.citation}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-green-600 min-h-[200px]">
              <CheckCircle2 className="w-12 h-12 mb-3 text-green-200" />
              <p className="text-sm font-medium">No compliance issues found!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
