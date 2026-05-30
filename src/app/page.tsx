"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, FileCheck, Building2, ChevronRight, ClipboardList, ListChecks, Sparkles } from "lucide-react";
import { Sidebar, LOAN_TYPES, type LoanType } from "@/components/Sidebar";
import { ContextStrip } from "@/components/ContextStrip";
import { AnalysisResults } from "@/components/completeness/AnalysisResults";
import { GuidedReviewWizard } from "@/components/completeness/GuidedReviewWizard";
import { EMPTY_DEAL_FORM } from "@/types/deal";
import type { AnalysisResult } from "@/types/wizard";

const DEFAULT_AGENCIES = [
  { id: "hpd", name: "HPD (NYC)", checked: false },
  { id: "hdc", name: "HDC (NYC)", checked: false },
  { id: "hcr", name: "HCR (NYS)", checked: true },
  { id: "esd", name: "ESD (NYS)", checked: false },
  { id: "hud", name: "HUD (Federal)", checked: false },
  { id: "fannie", name: "Fannie/Freddie", checked: false },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<"completeness" | "chatbot">("completeness");
  const [agencies, setAgencies] = useState(DEFAULT_AGENCIES);
  const [loanType, setLoanType] = useState<LoanType>(LOAN_TYPES[0]);
  const [formData, setFormData] = useState({ ...EMPTY_DEAL_FORM });
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const toggleAgency = (id: string) => {
    setAgencies(prev => prev.map(a => a.id === id ? { ...a, checked: !a.checked } : a));
  };

  const selectedAgencies = agencies.filter(a => a.checked).map(a => a.id);
  const selectedAgencyNames = agencies.filter(a => a.checked).map(a => a.name);

  return (
    <div className="flex h-full w-full bg-background">
      <Sidebar
        agencies={agencies}
        onToggleAgency={toggleAgency}
        loanType={loanType}
        onLoanTypeChange={setLoanType}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <header className="bg-white border-b border-border-subtle px-8 pt-6 shadow-sm">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs font-semibold text-brand uppercase tracking-wider mb-1">LISC NY</p>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Underwriting Assistant</h1>
          </div>
        </div>
        <div className="flex gap-6">
          <button 
            onClick={() => setActiveTab("completeness")}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "completeness" 
                ? "border-brand text-brand" 
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              Completeness Check
            </div>
          </button>
          <button 
            onClick={() => setActiveTab("chatbot")}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "chatbot" 
                ? "border-brand text-brand" 
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Policy Chatbot
            </div>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto mb-6">
          <ContextStrip
            loanType={loanType}
            selectedAgencyIds={selectedAgencies}
            selectedAgencyNames={selectedAgencyNames}
            modeLabel={
              activeTab === "completeness" ? "Completeness Check" : "Policy Chatbot"
            }
          />
        </div>
        {activeTab === "completeness"
          ? <CompletenessCheckTab
              selectedAgencies={selectedAgencies}
              loanType={loanType}
              formData={formData}
              setFormData={setFormData}
              analysisResult={analysisResult}
              setAnalysisResult={setAnalysisResult}
            />
          : <PolicyChatbotTab selectedAgencies={selectedAgencies} selectedAgencyNames={selectedAgencyNames} />
        }
      </div>
      </div>
    </div>
  );
}

const EMPTY_FORM = EMPTY_DEAL_FORM;

type CheckMode = "quick" | "guided";

interface CompletenessCheckTabProps {
  selectedAgencies: string[];
  loanType: string;
  formData: typeof EMPTY_FORM;
  setFormData: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  analysisResult: AnalysisResult | null;
  setAnalysisResult: React.Dispatch<React.SetStateAction<AnalysisResult | null>>;
}

function CompletenessCheckTab({
  selectedAgencies,
  loanType,
  formData,
  setFormData,
  analysisResult,
  setAnalysisResult,
}: CompletenessCheckTabProps) {
  const [checkMode, setCheckMode] = useState<CheckMode>("quick");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleModeChange = (mode: CheckMode) => {
    setCheckMode(mode);
    setAnalysisResult(null);
    setErrorMessage("");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-1 bg-white rounded-xl border border-border-subtle p-1 w-fit shadow-sm">
        <button
          type="button"
          onClick={() => handleModeChange("quick")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            checkMode === "quick"
              ? "bg-[#0d6e52] text-white shadow-sm"
              : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <ListChecks className="w-4 h-4" />
          Quick Check
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("guided")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            checkMode === "guided"
              ? "bg-[#0d6e52] text-white shadow-sm"
              : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Guided Review
        </button>
      </div>

      {checkMode === "guided" ? (
        <GuidedReviewWizard
          selectedAgencies={selectedAgencies}
          loanType={loanType}
          analysisResult={analysisResult}
          setAnalysisResult={setAnalysisResult}
        />
      ) : (
        <QuickCheckForm
          selectedAgencies={selectedAgencies}
          loanType={loanType}
          formData={formData}
          setFormData={setFormData}
          analysisResult={analysisResult}
          setAnalysisResult={setAnalysisResult}
          isAnalyzing={isAnalyzing}
          setIsAnalyzing={setIsAnalyzing}
          errorMessage={errorMessage}
          setErrorMessage={setErrorMessage}
        />
      )}
    </div>
  );
}

interface QuickCheckFormProps {
  selectedAgencies: string[];
  loanType: string;
  formData: typeof EMPTY_FORM;
  setFormData: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  analysisResult: AnalysisResult | null;
  setAnalysisResult: React.Dispatch<React.SetStateAction<AnalysisResult | null>>;
  isAnalyzing: boolean;
  setIsAnalyzing: React.Dispatch<React.SetStateAction<boolean>>;
  errorMessage: string;
  setErrorMessage: React.Dispatch<React.SetStateAction<string>>;
}

function QuickCheckForm({
  selectedAgencies,
  loanType,
  formData,
  setFormData,
  analysisResult,
  setAnalysisResult,
  isAnalyzing,
  setIsAnalyzing,
  errorMessage,
  setErrorMessage,
}: QuickCheckFormProps) {

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleReset = () => {
    setFormData({ ...EMPTY_FORM });
    setAnalysisResult(null);
    setErrorMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedAgencies.length === 0) {
      setErrorMessage("Please select at least one target agency in the sidebar before running the check.");
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage("");
    setAnalysisResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: { ...formData, loanType }, agencies: selectedAgencies }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setAnalysisResult(data.analysis);
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
    <div className="space-y-8">

      {/* Deal Data Entry Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-border-subtle shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-brand" />
              Deal Data Entry
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Enter all deal details at once. No documents are uploaded.</p>
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
          {/* Section: Project Basics */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Project Basics</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Project Name" name="projectName" value={formData.projectName} onChange={handleChange} placeholder="e.g. Mott Haven Senior Housing" />
              <Field label="Developer / Sponsor" name="developerName" value={formData.developerName} onChange={handleChange} placeholder="e.g. Acme Community Development" />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Loan Type</label>
                <div className="w-full border border-slate-100 bg-slate-50 rounded-lg px-3 py-2.5 text-sm text-slate-500 italic">
                  {loanType} <span className="text-xs not-italic text-slate-400">(set in sidebar)</span>
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

          {/* Section: Unit Mix */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Unit Mix</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Total Units" name="totalUnits" value={formData.totalUnits} onChange={handleChange} placeholder="e.g. 80" type="number" />
              <Field label="Affordable Units" name="affordableUnits" value={formData.affordableUnits} onChange={handleChange} placeholder="e.g. 80" type="number" />
              <Field label="AMI Targets" name="targetAMI" value={formData.targetAMI} onChange={handleChange} placeholder="e.g. 30%, 60%, 80%" />
            </div>
          </div>

          {/* Section: Financials */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Financials</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Total Development Cost" name="totalDevelopmentCost" value={formData.totalDevelopmentCost} onChange={handleChange} placeholder="e.g. $24,500,000" />
              <Field label="Requested Loan Amount" name="requestedLoanAmount" value={formData.requestedLoanAmount} onChange={handleChange} placeholder="e.g. $6,000,000" />
              <Field label="Loan-to-Value (LTV %)" name="ltv" value={formData.ltv} onChange={handleChange} placeholder="e.g. 75" type="number" />
              <Field label="Debt Service Coverage Ratio (DSCR)" name="dscr" value={formData.dscr} onChange={handleChange} placeholder="e.g. 1.20" type="number" />
            </div>
          </div>

          {/* Section: Additional */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Additional</p>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Other Funding Sources" name="otherFundingSources" value={formData.otherFundingSources} onChange={handleChange} placeholder="e.g. HPD loan, LIHTC equity, HCR subordinate" />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Additional Notes</label>
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
                Run Completeness Check
              </>
            )}
          </button>
          {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
        </div>
      </form>

      <AnalysisResults
        analysisResult={analysisResult}
        emptyMessage="Fill in deal details and run the check."
      />
    </div>
  );
}

function Field({
  label, name, value, onChange, placeholder, type = "text"
}: {
  label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; type?: string;
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
  label, name, value, onChange, options
}: {
  label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: string[];
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
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function PolicyChatbotTab({ selectedAgencies, selectedAgencyNames }: { selectedAgencies: string[], selectedAgencyNames: string[] }) {
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const prevAgenciesRef = useRef<string>(selectedAgencies.join(','));
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const agencyNamesString = selectedAgencyNames.length > 0 
    ? selectedAgencyNames.join(", ") 
    : "no agencies selected";

  const noAgenciesSelected = selectedAgencies.length === 0;

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Reset chat history when the selected agencies change
  useEffect(() => {
    const current = selectedAgencies.join(',');
    if (current !== prevAgenciesRef.current) {
      setMessages([]);
      prevAgenciesRef.current = current;
    }
  }, [selectedAgencies]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const newMessages = [...messages, { role: 'user' as const, content: input.trim() }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          agencies: selectedAgencies,
          agencyNames: selectedAgencyNames
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessages(prev => [...prev, data.response]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error || 'Failed to get response'}` }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Error connecting to the chat service." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col bg-white rounded-xl border border-border-subtle shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <h3 className="font-semibold text-slate-800">Policy Research Assistant</h3>
        <p className="text-xs text-slate-500 mt-1">Ask questions constrained to your selected rulebooks.</p>
      </div>
      
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0 ring-1 ring-brand/20">
            <Building2 className="w-4 h-4 text-brand" />
          </div>
          <div className="bg-slate-100 rounded-2xl rounded-tl-none px-5 py-3 text-sm text-slate-700 max-w-[80%]">
            {selectedAgencyNames.length > 0 ? (
              <>This assistant is currently searching the <strong>{agencyNamesString}</strong> rulebook{selectedAgencyNames.length > 1 ? 's' : ''}. Please enter your question below.</>
            ) : (
              <>No target agencies are selected. Please select one or more agencies from the sidebar to begin.</>
            )}
          </div>
        </div>

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0 ring-1 ring-brand/20">
                <Building2 className="w-4 h-4 text-brand" />
              </div>
            )}
            <div className={`rounded-2xl px-5 py-3 text-sm max-w-[80%] whitespace-pre-wrap ${
              msg.role === 'user' 
                ? 'bg-brand text-white rounded-tr-none shadow-sm' 
                : 'bg-slate-100 text-slate-700 rounded-tl-none'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0 ring-1 ring-brand/20">
              <Building2 className="w-4 h-4 text-brand" />
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-none px-5 py-3 text-sm text-slate-700 max-w-[80%] flex gap-1">
              <span className="animate-bounce">.</span><span className="animate-bounce" style={{animationDelay: '150ms'}}>.</span><span className="animate-bounce" style={{animationDelay: '300ms'}}>.</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={noAgenciesSelected ? "Select an agency in the sidebar to begin..." : "Ask about AMI limits, LTV caps, zoning..."}
            className="w-full bg-slate-50 border border-slate-200 rounded-full pl-5 pr-12 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/30 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isLoading || noAgenciesSelected}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading || noAgenciesSelected}
            className="absolute right-2 top-2 p-1.5 bg-brand text-white rounded-full hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
