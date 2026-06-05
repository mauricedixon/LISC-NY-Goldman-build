export type TermSheetItemPriority = "required" | "conditional" | "informational";

export interface TermSheetKeyThreshold {
  label: string;
  value: string;
  citation?: string;
}

export interface TermSheetChecklistItem {
  item: string;
  requirement: string;
  citation?: string;
  programs?: string[];
  priority?: TermSheetItemPriority;
}

export interface TermSheetGuideSection {
  title: string;
  items: TermSheetChecklistItem[];
}

export interface TermSheetGuideResult {
  summary: string;
  keyThresholds: TermSheetKeyThreshold[];
  sections: TermSheetGuideSection[];
}
