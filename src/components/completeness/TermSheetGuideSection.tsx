"use client";

import { Fragment, useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { buildTermSheetGuideFingerprint } from "@/lib/term-sheet-guide";
import {
  countItemsByTier,
  filterSectionsByTier,
} from "@/lib/term-sheet-guide-utils";
import {
  fetchTermSheetGuideEssential,
  fetchTermSheetGuideExtended,
  getCachedTermSheetGuide,
  hasCachedExtendedGuide,
  isTermSheetGuideExtendedLoading,
  isTermSheetGuidePrefetching,
  prefetchTermSheetGuide,
} from "@/lib/term-sheet-guide-cache";
import { formatFundingPrograms } from "@/types/deal";
import type {
  TermSheetChecklistItem,
  TermSheetGuideResult,
  TermSheetItemPriority,
  TermSheetKeyThreshold,
} from "@/types/term-sheet-guide";
import { FormattedCitationText } from "@/utils/format-citations";

interface TermSheetGuideSectionProps {
  loanType: string;
  selectedAgencies: string[];
  selectedAgencyNames: string[];
  fundingPrograms: string[];
}

const PRIORITY_ORDER: TermSheetItemPriority[] = [
  "required",
  "conditional",
  "informational",
];

const PRIORITY_STYLES: Record<TermSheetItemPriority, string> = {
  required: "bg-red-50 text-red-700 border-red-100",
  conditional: "bg-amber-50 text-amber-700 border-amber-100",
  informational: "bg-slate-50 text-slate-600 border-slate-200",
};

const PRIORITY_LABELS: Record<TermSheetItemPriority, string> = {
  required: "Required",
  conditional: "Conditional",
  informational: "Info",
};

function sortByPriority(items: TermSheetChecklistItem[]): TermSheetChecklistItem[] {
  return [...items].sort((a, b) => {
    const aIdx = PRIORITY_ORDER.indexOf(a.priority ?? "informational");
    const bIdx = PRIORITY_ORDER.indexOf(b.priority ?? "informational");
    return aIdx - bIdx;
  });
}

function KeyThresholdsTable({ thresholds }: { thresholds: TermSheetKeyThreshold[] }) {
  const [expandedCitation, setExpandedCitation] = useState<number | null>(null);

  if (thresholds.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
        Key thresholds
      </p>
      <div className="rounded-lg border border-brand/20 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-emerald-50/80 text-left">
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 w-2/5">
                Metric
              </th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-600">Requirement</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 w-20" />
            </tr>
          </thead>
          <tbody>
            {thresholds.map((row, idx) => (
              <Fragment key={`${row.label}-${idx}`}>
                <tr className="border-t border-slate-100 bg-white">
                  <td className="px-4 py-3 font-semibold text-slate-800 align-top">
                    {row.label}
                  </td>
                  <td className="px-4 py-3 text-slate-700 align-top">{row.value}</td>
                  <td className="px-4 py-3 align-top">
                    {row.citation && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCitation(expandedCitation === idx ? null : idx)
                        }
                        className="text-[11px] text-brand hover:text-brand-hover font-medium whitespace-nowrap"
                      >
                        {expandedCitation === idx ? "Hide" : "Source"}
                      </button>
                    )}
                  </td>
                </tr>
                {row.citation && expandedCitation === idx && (
                  <tr className="bg-slate-50/50">
                    <td colSpan={3} className="px-4 py-2 text-xs text-slate-500 border-t border-slate-100">
                      <FormattedCitationText text={row.citation} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GuideItemCard({
  item,
  showProgramTags,
}: {
  item: TermSheetChecklistItem;
  showProgramTags: boolean;
}) {
  const [showCitation, setShowCitation] = useState(false);
  const priority = item.priority ?? "informational";

  return (
    <li className="rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <p className="text-sm font-semibold text-slate-800">{item.item}</p>
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${PRIORITY_STYLES[priority]}`}
          >
            {PRIORITY_LABELS[priority]}
          </span>
        </div>
        {showProgramTags && item.programs && item.programs.length > 0 && (
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
      <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{item.requirement}</p>
      {item.citation && (
        <button
          type="button"
          onClick={() => setShowCitation((v) => !v)}
          className="text-[11px] text-brand hover:text-brand-hover font-medium mt-2"
        >
          {showCitation ? "Hide source" : "View source"}
        </button>
      )}
      {showCitation && item.citation && (
        <p className="text-xs text-slate-500 mt-1.5 leading-snug border-l-2 border-brand/30 pl-3">
          <FormattedCitationText text={item.citation} />
        </p>
      )}
    </li>
  );
}

function GuideItemList({
  items,
  showProgramTags,
}: {
  items: TermSheetChecklistItem[];
  showProgramTags: boolean;
}) {
  const sorted = sortByPriority(items);

  return (
    <ul className="space-y-3">
      {sorted.map((item, idx) => (
        <GuideItemCard
          key={`${item.item}-${idx}`}
          item={item}
          showProgramTags={showProgramTags}
        />
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
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [showFullChecklist, setShowFullChecklist] = useState(false);
  const [isLoadingExtended, setIsLoadingExtended] = useState(false);
  const [extendedError, setExtendedError] = useState("");

  const currentFingerprint = buildTermSheetGuideFingerprint(
    loanType,
    selectedAgencies,
    fundingPrograms
  );
  const isStale =
    !!guide && !!guideBaseline && currentFingerprint !== guideBaseline;

  const canGenerate = selectedAgencies.length > 0 && fundingPrograms.length > 0;
  const isCached = canGenerate && !!getCachedTermSheetGuide(
    loanType,
    selectedAgencies,
    fundingPrograms
  );
  const showProgramTags = fundingPrograms.length > 1;

  useEffect(() => {
    if (!canGenerate) {
      setIsPrefetching(false);
      return;
    }

    prefetchTermSheetGuide(loanType, selectedAgencies, fundingPrograms);

    const checkPrefetch = () => {
      setIsPrefetching(
        isTermSheetGuidePrefetching(loanType, selectedAgencies, fundingPrograms)
      );
    };

    checkPrefetch();
    const interval = setInterval(checkPrefetch, 400);
    return () => clearInterval(interval);
  }, [loanType, selectedAgencies, fundingPrograms, canGenerate]);

  const loadGuide = async () => {
    const result = await fetchTermSheetGuideEssential(
      loanType,
      selectedAgencies,
      fundingPrograms
    );
    setGuide(result);
    setGuideBaseline(currentFingerprint);
    setShowFullChecklist(false);
    setExtendedError("");
    setTimeout(() => {
      document
        .getElementById("term-sheet-guide-results")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const loadExtendedChecklist = async () => {
    setIsLoadingExtended(true);
    setExtendedError("");
    try {
      const result = await fetchTermSheetGuideExtended(
        loanType,
        selectedAgencies,
        fundingPrograms
      );
      setGuide(result);
      setShowFullChecklist(true);
    } catch {
      setExtendedError("Failed to load full checklist. Please try again.");
    } finally {
      setIsLoadingExtended(false);
    }
  };

  const handleToggleChecklist = async () => {
    if (showFullChecklist) {
      setShowFullChecklist(false);
      return;
    }

    const extendedReady = hasCachedExtendedGuide(
      loanType,
      selectedAgencies,
      fundingPrograms
    );
    if (extendedReady) {
      setShowFullChecklist(true);
      return;
    }

    await loadExtendedChecklist();
  };

  const handleGenerate = async () => {
    if (!canGenerate) {
      setErrorMessage(
        "Select at least one funding program and one rulebook in the sidebar."
      );
      return;
    }

    setIsGenerating(true);
    setErrorMessage("");

    try {
      await loadGuide();
    } catch {
      setErrorMessage("Failed to connect to term sheet guide service.");
    } finally {
      setIsGenerating(false);
    }
  };

  const tierCounts = guide ? countItemsByTier(guide.sections) : null;
  const visibleSections = guide
    ? filterSectionsByTier(guide.sections, showFullChecklist ? "all" : "essential")
    : [];
  const extendedLoaded = guide
    ? hasCachedExtendedGuide(loanType, selectedAgencies, fundingPrograms)
    : false;
  const hasExtendedItems = extendedLoaded && (tierCounts?.extended ?? 0) > 0;
  const showExtendedToggle = !!guide;

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
                Key thresholds and checklist from your funding programs and agency
                rulebooks.
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
                  {isCached ? "Loading guide..." : "Generating guide..."}
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4" />
                  Generate Term Sheet Guide
                </>
              )}
            </button>
          </div>

          {canGenerate && isCached && !guide && !isGenerating && (
            <p className="text-xs text-emerald-600 font-medium mt-3">
              Guide ready — click to load instantly.
            </p>
          )}
          {canGenerate && isPrefetching && !isCached && !guide && (
            <p className="text-xs text-slate-500 mt-3">
              Preparing guide in the background…
            </p>
          )}
          {!canGenerate && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
              Select funding programs and rulebooks in the sidebar to generate a guide.
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

            <KeyThresholdsTable thresholds={guide.keyThresholds ?? []} />

            {tierCounts && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {showFullChecklist
                    ? `${tierCounts.total} checklist items across ${visibleSections.length} sections`
                    : `${tierCounts.essential} essential items across ${visibleSections.length} sections`}
                  {!showFullChecklist && extendedLoaded && hasExtendedItems && (
                    <span className="normal-case font-normal text-slate-400">
                      {" "}
                      · +{tierCounts.extended} in full checklist
                    </span>
                  )}
                  {!showFullChecklist && !extendedLoaded && (
                    <span className="normal-case font-normal text-slate-400">
                      {" "}
                      · full checklist loads on demand
                    </span>
                  )}
                </p>
                {showFullChecklist && (
                  <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                    Full checklist
                  </span>
                )}
              </div>
            )}

            <div className="space-y-3">
              {visibleSections.map((section, idx) => (
                <CollapsibleGuideSection
                  key={`${section.title}-${idx}`}
                  title={section.title}
                  itemCount={section.items.length}
                  defaultOpen={idx === 0}
                >
                  <GuideItemList
                    items={section.items}
                    showProgramTags={showProgramTags}
                  />
                </CollapsibleGuideSection>
              ))}
            </div>

            {showExtendedToggle && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <button
                  type="button"
                  onClick={handleToggleChecklist}
                  disabled={isLoadingExtended || isTermSheetGuideExtendedLoading(
                    loanType,
                    selectedAgencies,
                    fundingPrograms
                  )}
                  className="flex items-center gap-2 text-sm text-brand hover:text-brand-hover font-medium disabled:opacity-50"
                >
                  {(isLoadingExtended ||
                    isTermSheetGuideExtendedLoading(
                      loanType,
                      selectedAgencies,
                      fundingPrograms
                    )) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {showFullChecklist
                    ? "Back to summary view"
                    : extendedLoaded && hasExtendedItems
                      ? `Show full checklist (+${tierCounts?.extended ?? 0} items)`
                      : "Show full checklist"}
                </button>
                {extendedError && (
                  <p className="text-sm text-red-500">{extendedError}</p>
                )}
              </div>
            )}
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
