"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { buildTermSheetGuideFingerprint } from "@/lib/term-sheet-guide";
import { formatFundingPrograms } from "@/types/deal";
import type { TermSheetGuideResult } from "@/types/term-sheet-guide";
import { FormattedCitationText } from "@/utils/format-citations";

interface TermSheetGuideSectionProps {
  loanType: string;
  selectedAgencies: string[];
  selectedAgencyNames: string[];
  fundingPrograms: string[];
}

function GuideItemList({
  items,
}: {
  items: TermSheetGuideResult["sections"][number]["items"];
}) {
  return (
    <ul className="space-y-3">
      {items.map((item, idx) => (
        <li
          key={`${item.item}-${idx}`}
          className="rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">{item.item}</p>
            {item.programs && item.programs.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.programs.map((program) => (
                  <span
                    key={program}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100"
                  >
                    {program}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
            {item.requirement}
          </p>
          {item.citation && (
            <p className="text-xs text-slate-500 mt-2 leading-snug border-l-2 border-brand/30 pl-3">
              <FormattedCitationText text={item.citation} />
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function CollapsibleGuideSection({
  title,
  itemCount,
  defaultOpen,
  children,
}: {
  title: string;
  itemCount: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-slate-800">
          {title}
          <span className="text-slate-400 font-normal ml-1.5">({itemCount})</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

export function TermSheetGuideSection({
  loanType,
  selectedAgencies,
  selectedAgencyNames,
  fundingPrograms,
}: TermSheetGuideSectionProps) {
  const [guide, setGuide] = useState<TermSheetGuideResult | null>(null);
  const [guideBaseline, setGuideBaseline] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const currentFingerprint = buildTermSheetGuideFingerprint(
    loanType,
    selectedAgencies,
    fundingPrograms
  );
  const isStale =
    !!guide && !!guideBaseline && currentFingerprint !== guideBaseline;

  const canGenerate = selectedAgencies.length > 0 && fundingPrograms.length > 0;

  const handleGenerate = async () => {
    if (!canGenerate) {
      setErrorMessage(
        "Select at least one funding program and one target agency in the sidebar."
      );
      return;
    }

    setIsGenerating(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/term-sheet-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanType,
          agencies: selectedAgencies,
          fundingPrograms,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setGuide(data.guide);
        setGuideBaseline(currentFingerprint);
        setTimeout(() => {
          document
            .getElementById("term-sheet-guide-results")
            ?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else {
        setErrorMessage(data.error || "Failed to generate term sheet guide.");
      }
    } catch {
      setErrorMessage("Failed to connect to term sheet guide service.");
    } finally {
      setIsGenerating(false);
    }
  };

  const totalItems =
    guide?.sections.reduce((sum, section) => sum + section.items.length, 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border-2 border-brand/20 shadow-sm overflow-hidden ring-1 ring-brand/10">
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 to-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand" />
                Term Sheet Guide
              </h2>
              <p className="text-sm text-slate-500 mt-1 max-w-xl">
                Structured checklist from your selected funding programs and agency
                rulebooks — LTV, DSCR, equity, closing, and program requirements.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !canGenerate}
              className="flex items-center gap-2 bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-md shadow-brand/20 shrink-0"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating guide...
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4" />
                  Generate Term Sheet Guide
                </>
              )}
            </button>
          </div>
          {!canGenerate && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
              Select funding programs and target agencies in the sidebar to generate a
              guide.
            </p>
          )}
          {errorMessage && (
            <p className="text-sm text-red-500 mt-3">{errorMessage}</p>
          )}
        </div>

        {guide && (
          <div id="term-sheet-guide-results" className="px-6 py-5 space-y-4">
            {isStale && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Programs or agencies changed since this guide was generated. Re-run to
                refresh.
              </p>
            )}

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
                {loanType}
              </span>
              {fundingPrograms.map((program) => (
                <span
                  key={program}
                  className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium"
                >
                  {program}
                </span>
              ))}
              {selectedAgencyNames.map((name) => (
                <span
                  key={name}
                  className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200 font-medium"
                >
                  {name}
                </span>
              ))}
            </div>

            {guide.summary && (
              <p className="text-sm text-slate-600 leading-relaxed border-l-2 border-brand/40 pl-4">
                {guide.summary}
              </p>
            )}

            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              {totalItems} checklist items across {guide.sections.length} sections
            </p>

            <div className="space-y-3">
              {guide.sections.map((section, idx) => (
                <CollapsibleGuideSection
                  key={`${section.title}-${idx}`}
                  title={section.title}
                  itemCount={section.items.length}
                  defaultOpen={idx === 0}
                >
                  <GuideItemList items={section.items} />
                </CollapsibleGuideSection>
              ))}
            </div>
          </div>
        )}

        {!guide && !isGenerating && (
          <div className="px-6 py-4 text-sm text-slate-500">
            Programs: {formatFundingPrograms(fundingPrograms)} · Agencies:{" "}
            {selectedAgencyNames.length > 0
              ? selectedAgencyNames.join(", ")
              : "none selected"}
          </div>
        )}
      </div>
    </div>
  );
}
