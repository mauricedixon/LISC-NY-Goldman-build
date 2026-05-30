export const AGENCY_STYLES: Record<
  string,
  { dot: string; ring: string; badge: string; accent: string; progress: string }
> = {
  hpd: {
    dot: "bg-sky-400",
    ring: "ring-sky-400/30",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    accent: "text-sky-600",
    progress: "bg-sky-500",
  },
  hdc: {
    dot: "bg-violet-400",
    ring: "ring-violet-400/30",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    accent: "text-violet-600",
    progress: "bg-violet-500",
  },
  hcr: {
    dot: "bg-emerald-400",
    ring: "ring-emerald-400/30",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    accent: "text-emerald-600",
    progress: "bg-emerald-500",
  },
  esd: {
    dot: "bg-amber-400",
    ring: "ring-amber-400/30",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    accent: "text-amber-700",
    progress: "bg-amber-500",
  },
  hud: {
    dot: "bg-indigo-400",
    ring: "ring-indigo-400/30",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    accent: "text-indigo-600",
    progress: "bg-indigo-500",
  },
  fannie: {
    dot: "bg-rose-400",
    ring: "ring-rose-400/30",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    accent: "text-rose-600",
    progress: "bg-rose-500",
  },
};

export const DEFAULT_AGENCY_STYLE = AGENCY_STYLES.hcr;

export function getAgencyStyle(agencyId: string) {
  return AGENCY_STYLES[agencyId] ?? DEFAULT_AGENCY_STYLE;
}

/** When multiple agencies selected, use brand green; single agency uses its accent */
export function getAccentStyle(selectedAgencyIds: string[]) {
  if (selectedAgencyIds.length === 1) {
    return getAgencyStyle(selectedAgencyIds[0]);
  }
  return {
    dot: "bg-brand",
    ring: "ring-brand/30",
    badge: "bg-emerald-50 text-brand border-emerald-200",
    accent: "text-brand",
    progress: "bg-brand",
  };
}

export const CATEGORY_STYLES: Record<string, string> = {
  "Project Basics": "bg-sky-50 text-sky-700 border-sky-200",
  "Unit Mix": "bg-violet-50 text-violet-700 border-violet-200",
  Financials: "bg-amber-50 text-amber-800 border-amber-200",
  Compliance: "bg-red-50 text-red-700 border-red-200",
  Additional: "bg-slate-50 text-slate-600 border-slate-200",
  General: "bg-slate-50 text-slate-600 border-slate-200",
};

export function getCategoryStyle(category: string) {
  return CATEGORY_STYLES[category] ?? CATEGORY_STYLES.General;
}
