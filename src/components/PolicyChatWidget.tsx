"use client";

import { Building2, MessageSquare, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FormattedCitationText } from "@/utils/format-citations";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface PolicyChatWidgetProps {
  selectedAgencies: string[];
  selectedAgencyNames: string[];
}

export function PolicyChatWidget({
  selectedAgencies,
  selectedAgencyNames,
}: PolicyChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const prevAgenciesRef = useRef(selectedAgencies.join(","));
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const agencyNamesString =
    selectedAgencyNames.length > 0
      ? selectedAgencyNames.join(", ")
      : "no agencies selected";
  const noAgenciesSelected = selectedAgencies.length === 0;

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    const current = selectedAgencies.join(",");
    if (current !== prevAgenciesRef.current) {
      setMessages([]);
      prevAgenciesRef.current = current;
    }
  }, [selectedAgencies]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: input.trim() },
    ];
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
          agencyNames: selectedAgencyNames,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessages((prev) => [...prev, data.response]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Error: ${data.error || "Failed to get response"}`,
          },
        ]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error connecting to the chat service." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[min(100vw-3rem,400px)] h-[min(70vh,520px)] flex flex-col bg-white rounded-2xl border border-border-subtle shadow-2xl overflow-hidden"
          role="dialog"
          aria-label="Policy chatbot"
        >
          <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Policy Research</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Ask about your selected rulebooks</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 min-h-0">
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0 ring-1 ring-brand/20">
                <Building2 className="w-3.5 h-3.5 text-brand" />
              </div>
              <div className="bg-slate-100 rounded-2xl rounded-tl-none px-4 py-2.5 text-xs text-slate-700 max-w-[85%] leading-relaxed">
                {selectedAgencyNames.length > 0 ? (
                  <>
                    Searching{" "}
                    <strong>{agencyNamesString}</strong> rulebook
                    {selectedAgencyNames.length > 1 ? "s" : ""}. Ask your question below.
                  </>
                ) : (
                  <>Select agencies in the sidebar to begin.</>
                )}
              </div>
            </div>

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0 ring-1 ring-brand/20">
                    <Building2 className="w-3.5 h-3.5 text-brand" />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-2.5 text-xs max-w-[85%] whitespace-pre-wrap leading-relaxed ${
                    msg.role === "user"
                      ? "bg-brand text-white rounded-tr-none shadow-sm"
                      : "bg-slate-100 text-slate-700 rounded-tl-none"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <FormattedCitationText text={msg.content} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0 ring-1 ring-brand/20">
                  <Building2 className="w-3.5 h-3.5 text-brand" />
                </div>
                <div className="bg-slate-100 rounded-2xl rounded-tl-none px-4 py-2.5 text-xs text-slate-600 flex gap-1">
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>
                    .
                  </span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>
                    .
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-slate-100 bg-white shrink-0">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  noAgenciesSelected
                    ? "Select an agency first..."
                    : "AMI limits, LTV caps, zoning..."
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-full pl-4 pr-11 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-60"
                disabled={isLoading || noAgenciesSelected}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || isLoading || noAgenciesSelected}
                className="absolute right-1.5 top-1.5 p-1.5 bg-brand text-white rounded-full hover:bg-brand-hover transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-brand hover:bg-brand-hover text-white pl-4 pr-5 py-3 rounded-full shadow-lg shadow-brand/25 transition-colors"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close policy chat" : "Open policy chat"}
      >
        <MessageSquare className="w-5 h-5" />
        <span className="text-sm font-medium">Policy Chat</span>
      </button>
    </>
  );
}
