"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, AnimatePresence } from "motion/react";

interface ChatOverlayProps {
  open: boolean;
  onClose: () => void;
}

const SUGGESTED_CHIPS = [
  "Who owes me?",
  "This month's spending",
  "Top friends",
  "My biggest bill",
];

export function ChatOverlay({ open, onClose }: ChatOverlayProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const transport = useMemo(() => new DefaultChatTransport({
    api: `${apiUrl}/api/ai/chat`,
    credentials: "include" as RequestCredentials,
  }), [apiUrl]);

  const { messages, sendMessage, status } = useChat({ transport });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isLoading = status === "streaming" || status === "submitted";

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const handleSend = (text: string) => {
    if (!text.trim() || isLoading) return;
    sendMessage({ text: text.trim() });
    setInput("");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30"
            onClick={onClose}
          />

          {/* Chat panel */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col rounded-t-3xl bg-cream shadow-2xl md:inset-x-auto md:right-6 md:bottom-6 md:h-[70vh] md:w-96 md:rounded-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-brand-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700">
                  <svg className="h-5 w-7 text-cream-light" viewBox="0 0 340 160" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <g transform="translate(170, 80)">
                      <path d="M -65 -8 C -60 -40, -20 -50, 25 -46 C 60 -42, 95 -28, 118 -6" strokeWidth="8" />
                      <path d="M -65 8 C -55 42, -5 55, 40 48 C 72 42, 98 26, 118 6" strokeWidth="7" />
                      <path d="M -65 -8 C -72 -4, -72 4, -65 8" strokeWidth="8" />
                      <path d="M 116 -4 C 138 -32, 158 -38, 170 -24" strokeWidth="8" />
                      <path d="M 116 4 C 138 32, 158 38, 170 24" strokeWidth="8" />
                      <path d="M -68 2 C -100 -8, -138 -4, -168 -14" strokeWidth="8" />
                      <path d="M -68 6 C -98 14, -135 18, -162 12" strokeWidth="6" />
                      <path d="M -66 9 C -88 28, -118 34, -150 36" strokeWidth="5" />
                      <circle cx="-35" cy="-6" r="8" fill="currentColor" stroke="none" />
                    </g>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-brand-700">PlaDuk Coach</p>
                  <p className="text-xs text-brand-300">{isLoading ? "Thinking..." : "Ask me anything"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-brand-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hidden">
              {messages.length === 0 ? (
                // Empty state with suggested chips
                <div className="flex h-full flex-col items-center justify-center gap-4">
                  <svg className="h-16 w-24 text-brand-200" viewBox="0 0 340 160" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                    <g transform="translate(170, 80)">
                      <path d="M -65 -8 C -60 -40, -20 -50, 25 -46 C 60 -42, 95 -28, 118 -6" strokeWidth="3.2" />
                      <path d="M -65 8 C -55 42, -5 55, 40 48 C 72 42, 98 26, 118 6" strokeWidth="2.8" />
                      <path d="M -65 -8 C -72 -4, -72 4, -65 8" strokeWidth="3" />
                      <path d="M 116 -4 C 138 -32, 158 -38, 170 -24" strokeWidth="3" />
                      <path d="M 116 4 C 138 32, 158 38, 170 24" strokeWidth="3" />
                      <path d="M -68 2 C -100 -8, -138 -4, -168 -14" strokeWidth="3.2" />
                      <path d="M -68 6 C -98 14, -135 18, -162 12" strokeWidth="2.5" />
                      <path d="M -66 9 C -88 28, -118 34, -150 36" strokeWidth="1.8" />
                      <circle cx="-35" cy="-6" r="6.5" fill="currentColor" stroke="none" />
                    </g>
                  </svg>
                  <p className="font-caveat text-lg text-brand-400">Ask me about your spending!</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGGESTED_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleSend(chip)}
                        className="rounded-full border border-brand-100 px-3 py-1.5 text-xs text-brand-400 transition-all hover:border-brand-300 hover:bg-cream-light"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                // Conversation
                <div className="flex flex-col gap-3">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                          m.role === "user"
                            ? "bg-brand-700 text-sm text-cream-light"
                            : "bg-cream-light text-sm"
                        }`}
                      >
                        {m.role === "assistant" ? (
                          <div className="animate-fade-in-text font-serif italic leading-relaxed text-brand-600">
                            {m.parts?.map((part, i) =>
                              part.type === "text" && part.text ? (
                                <span
                                  key={i}
                                  dangerouslySetInnerHTML={{
                                    __html: part.text
                                      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold not-italic">$1</strong>')
                                      .replace(/\n/g, "<br />"),
                                  }}
                                />
                              ) : part.type?.startsWith("tool-") ? (
                                <span
                                  key={i}
                                  className="mr-1 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs not-italic text-brand-400"
                                >
                                  {"state" in part &&
                                  (part.state === "output-available" || part.state === "done")
                                    ? "✓ Found data"
                                    : (
                                      <>
                                        <div className="h-2 w-2 animate-spin rounded-full border border-brand-300 border-t-brand-500" />
                                        Looking up...
                                      </>
                                    )}
                                </span>
                              ) : null
                            )}
                          </div>
                        ) : (
                          <span>{m.parts?.filter(p => p.type === "text").map(p => "text" in p ? p.text : "").join("")}</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <div className="flex justify-start">
                      <div className="flex gap-1 rounded-2xl bg-cream-light px-4 py-3">
                        <div className="h-2 w-2 animate-bounce rounded-full bg-brand-300" style={{ animationDelay: "0ms" }} />
                        <div className="h-2 w-2 animate-bounce rounded-full bg-brand-300" style={{ animationDelay: "150ms" }} />
                        <div className="h-2 w-2 animate-bounce rounded-full bg-brand-300" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-brand-100 px-4 py-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend(input);
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything..."
                  disabled={isLoading}
                  className="flex-1 rounded-2xl border border-brand-200 bg-cream-light px-4 py-2.5 text-sm text-brand-700 placeholder-brand-300 outline-none transition-all focus:border-brand-400 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-700 text-cream-light transition-all hover:bg-brand-800 active:scale-95 disabled:opacity-40"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" />
                  </svg>
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
