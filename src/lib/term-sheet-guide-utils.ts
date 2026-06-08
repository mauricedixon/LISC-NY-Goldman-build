import type {
  TermSheetChecklistItem,
  TermSheetGuideSection,
  TermSheetItemTier,
} from "@/types/term-sheet-guide";

export function resolveItemTier(item: TermSheetChecklistItem): TermSheetItemTier {
  if (item.tier === "essential" || item.tier === "extended") {
    return item.tier;
  }
  return item.priority === "required" ? "essential" : "extended";
}

export function filterSectionsByTier(
  sections: TermSheetGuideSection[],
  tier: TermSheetItemTier | "all"
): TermSheetGuideSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (tier === "all") return true;
        return resolveItemTier(item) === tier;
      }),
    }))
    .filter((section) => section.items.length > 0);
}

export function countItemsByTier(sections: TermSheetGuideSection[]): {
  essential: number;
  extended: number;
  total: number;
} {
  let essential = 0;
  let extended = 0;

  for (const section of sections) {
    for (const item of section.items) {
      if (resolveItemTier(item) === "essential") {
        essential += 1;
      } else {
        extended += 1;
      }
    }
  }

  return { essential, extended, total: essential + extended };
}

export function normalizeGuideSections(
  sections: TermSheetGuideSection[]
): TermSheetGuideSection[] {
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      tier: resolveItemTier(item),
    })),
  }));
}

/** Merge essential and extended section lists by section title. */
export function mergeGuideSections(
  essentialSections: TermSheetGuideSection[],
  extendedSections: TermSheetGuideSection[]
): TermSheetGuideSection[] {
  const order: string[] = [];
  const byTitle = new Map<string, TermSheetChecklistItem[]>();

  const append = (sections: TermSheetGuideSection[]) => {
    for (const section of sections) {
      if (!byTitle.has(section.title)) {
        order.push(section.title);
        byTitle.set(section.title, []);
      }
      byTitle.get(section.title)!.push(...section.items);
    }
  };

  append(essentialSections);
  append(extendedSections);

  return order
    .map((title) => ({
      title,
      items: byTitle.get(title) ?? [],
    }))
    .filter((section) => section.items.length > 0);
}

export function hasExtendedGuideItems(sections: TermSheetGuideSection[]): boolean {
  return countItemsByTier(sections).extended > 0;
}
