"use client";

import { useState, useEffect } from "react";
import { FileCheck, ChevronRight, ClipboardList, Sparkles } from "lucide-react";
import { Sidebar, LOAN_TYPES, type LoanType } from "@/components/Sidebar";
import { ContextStrip } from "@/components/ContextStrip";
import { PolicyChatWidget } from "@/components/PolicyChatWidget";
import { AnalysisResults } from "@/components/completeness/AnalysisResults";
import { GuidedReviewWizard } from "@/components/completeness/GuidedReviewWizard";
import { TermSheetGuideSection } from "@/components/completeness/TermSheetGuideSection";
import { buildAnalysisInputFingerprint } from "@/lib/compliance-snapshot";
import { applyWizardAnswersToFormData, type DealFieldKey } from "@/lib/wizard-form-sync";
import { EMPTY_DEAL_FORM } from "@/types/deal";
import type { AnalysisResult, WizardAnswer, WizardQuestion } from "@/types/wizard";

const DEFAULT_AGENCIES = [
  { id: "hpd", name: "HPD (NYC)", checked: false },
  { id: "hdc", name: "HDC (NYC)", checked: false },
  { id: "hcr", name: "HCR (NYS)", checked: true },
  { id: "esd", name: "ESD (NYS)", checked: false },
  { id: "hud", name: "HUD (Federal)", checked: false },
  { id: "fannie", name: "Fannie/Freddie", checked: false },
];

export default function Home() {
  const [agencies, setAgencies] = useState(DEFAULT_AGENCIES);
  const [loanType, setLoanType] = useState<LoanType>(LOAN_TYPES[0]);
  const [formData, setFormData] = useState({ ...EMPTY_DEAL_FORM });
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisBaseline, setAnalysisBaseline] = useState<string | null>(null);
  const [checkMode, setCheckMode] = useState<"manual" | "guided">("guided");

  const toggleAgency = (id: string) => {
    setAgencies((prev) =>
      prev.map((a) => (a.id === id ? { ...a, checked: !a.checked } : a))
    );
  };

  const toggleFundingProgram = (program: string) => {
    setFormData((prev) => ({
      ...prev,
      fundingPrograms: prev.fundingPrograms.includes(program)
        ? prev.fundingPrograms.filter((p) => p !== program)
        : [...prev.fundingPrograms, program],
    }));
  };

  const selectedAgencies = agencies.filter((a) => a.checked).map((a) => a.id);
  const selectedAgencyNames = agencies.filter((a) => a.checked).map((a) => a.name);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, loanType }));
  }, [loanType]);

  const currentInputFingerprint = buildAnalysisInputFingerprint(
    formData,
    loanType,
    selectedAgencies
  );
  const isAnalysisStale =
    !!analysisResult &&
    !!analysisBaseline &&
    currentInputFingerprint !== analysisBaseline;

  const recordAnalysisBaseline = () => {
    setAnalysisBaseline(
      buildAnalysisInputFingerprint(formData, loanType, selectedAgencies)
    );
  };

  const clearAnalysisBaseline = () => {
    setAnalysisBaseline(null);
  };

  const handleDealFieldSync = (field: DealFieldKey, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleWizardAnswersSync = (
    questions: WizardQuestion[],
    answers: WizardAnswer[]
  ) => {
    setFormData((prev) => ({
      ...prev,
      ...applyWizardAnswersToFormData(questions, answers, loanType),
    }));
  };

  const handleWizardReset = () => {
    setFormData((prev) => ({
      ...EMPTY_DEAL_FORM,
      loanType,
      fundingPrograms: prev.fundingPrograms,
    }));
  };

  const modeLabel =
    checkMode === "manual" ? "Manual Review" : "Guided Review";

  return (
    <div className="flex h-full w-full bg-background">
      <Sidebar
        agencies={agencies}
        onToggleAgency={toggleAgency}
        loanType={loanType}
        onLoanTypeChange={setLoanType}
        fundingPrograms={formData.fundingPrograms}
        onToggleFundingProgram={toggleFundingProgram}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="bg-white border-b border-border-subtle px-8 pt-6 pb-4 shadow-sm shrink-0">
          <p className="text-xs font-semibold text-brand uppercase tracking-wider mb-1">
            LISC NY
          </p>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <FileCheck className="w-7 h-7 text-brand" />
            Compliance Assistant
          </h1>
        </header>

        <div className="flex-1 overflow-y-auto p-8 pb-28">
          <div className="max-w-6xl mx-auto space-y-6">
            <ContextStrip
              loanType={loanType}
              selectedAgencyIds={selectedAgencies}
              selectedAgencyNames={selectedAgencyNames}
              fundingPrograms={formData.fundingPrograms}
              modeLabel={modeLabel}
            />

            <TermSheetGuideSection
              loanType={loanType}
              selectedAgencies={selectedAgencies}
              selectedAgencyNames={selectedAgencyNames}
              fundingPrograms={formData.fundingPrograms}
            />

            <div className="bg-white rounded-xl border border-border-subtle p-4 text-sm text-slate-600 space-y-2 shadow-sm">
              <p>
                <span className="font-semibold text-slate-800">Term Sheet Guide</span> — primary
                checklist from your funding programs and rulebooks (above)
              </p>
              <p>
                <span className="font-semibold text-slate-800">Guided Review</span> — quick
                conversational deal context (recommended)
              </p>
              <p>
                <span className="font-semibold text-slate-800">Policy Chat</span> — bottom-right
                widget for ad-hoc rulebook questions
              </p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <Sparkles className="w-4 h-4 text-brand" />
                Guided Review
              </div>
              <button
                type="button"
                onClick={() =>
                  setCheckMode((mode) => (mode === "guided" ? "manual" : "guided"))
                }
                className="text-xs text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
              >
                {checkMode === "guided" ? "Switch to manual entry" : "Back to Guided Review"}
              </button>
            </div>

            <div className={checkMode === "guided" ? "" : "hidden"}>
              <GuidedReviewWizard
                selectedAgencies={selectedAgencies}
                loanType={loanType}
                fundingPrograms={formData.fundingPrograms}
                setAnalysisResult={setAnalysisResult}
                onAnalysisComplete={recordAnalysisBaseline}
                onAnalysisCleared={clearAnalysisBaseline}
                onDealSync={handleDealFieldSync}
                onWizardAnswersSync={handleWizardAnswersSync}
                onWizardReset={handleWizardReset}
              />
            </div>

            <div className={checkMode === "manual" ? "" : "hidden"}>
              <ManualReviewForm
                selectedAgencies={selectedAgencies}
                loanType={loanType}
                formData={formData}
                setFormData={setFormData}
                setAnalysisResult={setAnalysisResult}
                onAnalysisComplete={recordAnalysisBaseline}
                onAnalysisCleared={clearAnalysisBaseline}
              />
            </div>

            <div id="completeness-results">
              <AnalysisResults
                analysisResult={analysisResult}
                formData={formData}
                loanType={loanType}
                selectedAgencyNames={selectedAgencyNames}
                isStale={isAnalysisStale}
                emptyMessage="Optional — check a deal in Guided or Manual Review to see results."
                emptySteps={[
                  "Start with the Term Sheet Guide above for program requirements",
                  "Use Guided or Manual Review for a deal-level rulebook check",
                  "Snapshot, flags, and action items appear below",
                ]}
              />
            </div>
          </div>
        </div>

        <PolicyChatWidget
          selectedAgencies={selectedAgencies}
          selectedAgencyNames={selectedAgencyNames}
        />
      </div>
    </div>
  );
}

interface ManualReviewFormProps {
  selectedAgencies: string[];
  loanType: string;
  formData: typeof EMPTY_DEAL_FORM;
  setFormData: React.Dispatch<React.SetStateAction<typeof EMPTY_DEAL_FORM>>;
  setAnalysisResult: React.Dispatch<React.SetStateAction<AnalysisResult | null>>;
  onAnalysisComplete: () => void;
  onAnalysisCleared: () => void;
}

function ManualReviewForm({
  selectedAgencies,
  loanType,
  formData,
  setFormData,
  setAnalysisResult,
  onAnalysisComplete,
  onAnalysisCleared,
}: ManualReviewFormProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleReset = () => {
    setFormData((prev) => ({
      ...EMPTY_DEAL_FORM,
      loanType,
      fundingPrograms: prev.fundingPrograms,
    }));
    setAnalysisResult(null);
    setErrorMessage("");
    onAnalysisCleared();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedAgencies.length === 0) {
      setErrorMessage(
        "Please select at least one rulebook in the sidebar before running the check."
      );
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage("");
    setAnalysisResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData: { ...formData, loanType },
          agencies: selectedAgencies,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setAnalysisResult(data.analysis);
        onAnalysisComplete();
        setTimeout(() => {
          document.getElementById("completeness-results")?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else {
        setErrorMessage(`Analysis error: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Analysis failed", err);
      setErrorMessage("Failed to connect to analysis service.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-border-subtle shadow-sm overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-brand" />
            Deal Data Entry
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter deal details at once. Funding programs are set in the sidebar.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Reset form
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Project Basics
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Project Name"
              name="projectName"
              value={formData.projectName}
              onChange={handleChange}
              placeholder="e.g. Mott Haven Senior Housing"
            />
            <Field
              label="Developer / Sponsor"
              name="developerName"
              value={formData.developerName}
              onChange={handleChange}
              placeholder="e.g. Acme Community Development"
            />
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Loan Type
              </label>
              <div className="w-full border border-slate-100 bg-slate-50 rounded-lg px-3 py-2.5 text-sm text-slate-500 italic">
                {loanType}{" "}
                <span className="text-xs not-italic text-slate-400">(set in sidebar)</span>
              </div>
            </div>
            <SelectField
              label="Borough"
              name="borough"
              value={formData.borough}
              onChange={handleChange}
              options={["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"]}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Unit Mix
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field
              label="Total Units"
              name="totalUnits"
              value={formData.totalUnits}
              onChange={handleChange}
              placeholder="e.g. 80"
              type="number"
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Financials
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Total Development Cost"
              name="totalDevelopmentCost"
              value={formData.totalDevelopmentCost}
              onChange={handleChange}
              placeholder="e.g. $24,500,000"
            />
            <Field
              label="Requested Loan Amount"
              name="requestedLoanAmount"
              value={formData.requestedLoanAmount}
              onChange={handleChange}
              placeholder="e.g. $6,000,000"
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Additional
          </p>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Additional Notes
              </label>
              <textarea
                name="additionalNotes"
                value={formData.additionalNotes}
                onChange={handleChange}
                rows={3}
                placeholder="Any other relevant deal characteristics..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/30 resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 flex items-center gap-4">
        <button
          type="submit"
          disabled={isAnalyzing}
          className="flex items-center gap-2 bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-md shadow-brand/20"
        >
          {isAnalyzing ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analyzing against rulebooks...
            </>
          ) : (
            <>
              <ChevronRight className="w-4 h-4" />
              Check deal against rulebooks
            </>
          )}
        </button>
        {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/30"
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/30"
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
