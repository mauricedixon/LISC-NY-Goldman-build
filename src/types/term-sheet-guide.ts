export interface TermSheetChecklistItem {
  item: string;
  requirement: string;
  citation?: string;
  programs?: string[];
}

export interface TermSheetGuideSection {
  title: string;
  items: TermSheetChecklistItem[];
}

export interface TermSheetGuideResult {
  summary: string;
  sections: TermSheetGuideSection[];
}
