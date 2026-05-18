"use client";

import { useState, useEffect, useRef } from "react";
import { UploadCloud, FileText, AlertTriangle, CheckCircle2, MessageSquare, Send, FileCheck, Building2 } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"completeness" | "chatbot">("completeness");
  const [selectedAgencies, setSelectedAgencies] = useState([
    { id: "hpd", name: "HPD (NYC)", checked: false },
    { id: "hdc", name: "HDC (NYC)", checked: false },
    { id: "hcr", name: "HCR (NYS)", checked: true },
    { id: "esd", name: "ESD (NYS)", checked: false },
    { id: "hud", name: "HUD (Federal)", checked: false },
    { id: "fannie", name: "Fannie/Freddie", checked: false },
  ]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      {/* Header / Tabs */}
      <header className="bg-white border-b border-slate-200 px-8 pt-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Underwriting Assistant</h1>
        <div className="flex gap-6">
          <button 
            onClick={() => setActiveTab("completeness")}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "completeness" 
                ? "border-blue-600 text-blue-600" 
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
                ? "border-blue-600 text-blue-600" 
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

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        {activeTab === "completeness" ? <CompletenessCheckTab selectedAgencies={selectedAgencies.filter(a => a.checked).map(a => a.id)} /> : <PolicyChatbotTab selectedAgencies={selectedAgencies.filter(a => a.checked).map(a => a.id)} selectedAgencyNames={selectedAgencies.filter(a => a.checked).map(a => a.name)} />}
      </div>
    </div>
  );
}

function CompletenessCheckTab({ selectedAgencies }: { selectedAgencies: string[] }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadMessage("Uploading & Parsing Document (this may take up to 30s)...");
    setAnalysisResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // 1. Upload and Parse
      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok || uploadData.warning) {
        setUploadMessage(`Error during upload/parse: ${uploadData.error || uploadData.warning}`);
        setIsUploading(false);
        return;
      }

      setUploadMessage("Parsing complete! Analyzing compliance against rulebooks...");

      // 2. Analyze (RAG Pipeline)
      // We pass the parsed markdown and the currently selected agencies from the sidebar
      const analyzeResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown: uploadData.markdown || "MOCK_MARKDOWN_CONTENT_FOR_NOW", 
          agencies: selectedAgencies
        }),
      });

      const analyzeData = await analyzeResponse.json();

      if (analyzeResponse.ok) {
        setUploadMessage("Analysis complete!");
        setAnalysisResult(analyzeData.analysis);
      } else {
        setUploadMessage(`Analysis Error: ${analyzeData.error}`);
      }

    } catch (error) {
      console.error("Process failed", error);
      setUploadMessage("Process failed. Check console.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* File Dropzone */}
      <div className="bg-white rounded-xl border border-slate-200 border-dashed p-10 flex flex-col items-center justify-center text-center relative">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
          <UploadCloud className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Upload Draft Deal Memo</h3>
        <p className="text-slate-500 text-sm max-w-md mb-6">
          Drop your Word Document or PDF here. The engine will parse the details and cross-reference against the selected target agencies.
        </p>
        
        <div className="relative">
          <input 
            type="file" 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileChange}
            disabled={isUploading}
            accept=".pdf,.doc,.docx,.md"
          />
          <button 
            className={`bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-md font-medium text-sm transition-colors shadow-sm ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isUploading ? "Processing..." : "Browse Files"}
          </button>
        </div>
        
        {uploadMessage && (
          <p className={`mt-4 text-sm ${uploadMessage.startsWith("Error") ? "text-red-500" : "text-blue-600 font-medium"}`}>
            {uploadMessage}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Underwriting Questionnaire */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              Underwriting Questionnaire
            </h3>
          </div>
          <div className="p-6 flex-1 flex flex-col">
            {!analysisResult ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[200px]">
                <FileText className="w-12 h-12 mb-3 text-slate-200" />
                <p className="text-sm">Upload a memo to auto-fill data points.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(analysisResult.questionnaire || {}).map(([key, value]) => (
                  <div key={key} className="border-b border-slate-100 pb-3 last:border-0">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                    <p className="text-sm text-slate-800 font-medium">
                      {(value as string) || <span className="text-slate-400 italic">Not found in memo</span>}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Compliance Flags */}
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
                <p className="text-sm">No flags yet. Upload a memo to begin.</p>
              </div>
            ) : analysisResult.complianceFlags && analysisResult.complianceFlags.length > 0 ? (
              <div className="space-y-4">
                {analysisResult.complianceFlags.map((flag: any, idx: number) => (
                  <div key={idx} className="bg-red-50 border border-red-100 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-900 mb-1">{flag.issue}</p>
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
    </div>
  );
}

function PolicyChatbotTab({ selectedAgencies, selectedAgencyNames }: { selectedAgencies: string[], selectedAgencyNames: string[] }) {
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const prevAgenciesRef = useRef<string>(selectedAgencies.join(','));

  const agencyNamesString = selectedAgencyNames.length > 0 
    ? selectedAgencyNames.join(", ") 
    : "no agencies selected";

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
    <div className="max-w-4xl mx-auto h-full flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <h3 className="font-semibold text-slate-800">Policy Research Assistant</h3>
        <p className="text-xs text-slate-500 mt-1">Ask questions constrained to your selected rulebooks.</p>
      </div>
      
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-blue-600" />
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
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-blue-600" />
              </div>
            )}
            <div className={`rounded-2xl px-5 py-3 text-sm max-w-[80%] whitespace-pre-wrap ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-slate-100 text-slate-700 rounded-tl-none'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-none px-5 py-3 text-sm text-slate-700 max-w-[80%] flex gap-1">
              <span className="animate-bounce">.</span><span className="animate-bounce" style={{animationDelay: '150ms'}}>.</span><span className="animate-bounce" style={{animationDelay: '300ms'}}>.</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about AMI limits, LTV caps, zoning..." 
            className="w-full bg-slate-50 border border-slate-200 rounded-full pl-5 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
