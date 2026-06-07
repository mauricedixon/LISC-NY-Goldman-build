import { countItemsByTier, filterSectionsByTier } from "@/lib/term-sheet-guide-utils";
import type { TermSheetGuideResult } from "@/types/term-sheet-guide";

/** Optional suffix for Guided Review opening when a term sheet guide is cached. */
export function buildGuideOpeningSuffix(guide: TermSheetGuideResult): string {
  const { essential } = countItemsByTier(guide.sections);
  if (essential === 0) return "";
  const itemLabel = essential === 1 ? "item" : "items";
  return ` Your term sheet guide flagged ${essential} essential checklist ${itemLabel} — we'll capture deal context for those.`;
}

/** Plain-text context block for synthesis prompts. */
export function buildGuideContextForSynthesize(guide: TermSheetGuideResult): string {
  const essentialSections = filterSectionsByTier(guide.sections, "essential");
  const lines = [
    "TERM SHEET GUIDE CONTEXT (essential tier)",
    guide.summary.trim(),
    "",
  ];

  if (guide.keyThresholds.length > 0) {
    lines.push("Key thresholds:");
    for (const row of guide.keyThresholds) {
      lines.push(`- ${row.label}: ${row.value}`);
    }
    lines.push("");
  }

  for (const section of essentialSections) {
    lines.push(`${section.title}:`);
    for (const item of section.items) {
      lines.push(`- ${item.item}: ${item.requirement}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}
