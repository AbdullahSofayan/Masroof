import { useEffect, useRef, useState } from "react";
import { RotateCcw, SendHorizontal, Sparkles, Trash2, X } from "lucide-react";
import ChatMessage from "./ChatMessage";

const SUGGESTIONS = {
  employee: ["What is my pending total?", "What's the limit for Travel?"],
  manager: ["Show high-risk requests in my department", "How much budget is left this month?"],
  finance_admin: ["Which department is closest to its budget?", "Summarize spending by category"],
  finance: ["Which department is closest to its budget?", "Summarize spending by category"],
};

export default function ChatPanel({ user, chat, onClose, inputRef }) {
  const [draft, setDraft] = useState("");
  const listRef = useRef(null);
  const suggestions = SUGGESTIONS[user?.role] || SUGGESTIONS.employee;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages, chat.loading]);

  function submit(value = draft) {
    const text = value.trim();
    if (!text || chat.loading || text.length > 1000) return;
    setDraft("");
    chat.send(text);
  }

  return (
    <section
      role="dialog"
      aria-label="Masroof assistant"
      className="fixed bottom-24 right-6 z-[60] flex h-[min(560px,80vh)] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl max-sm:inset-x-3 max-sm:bottom-20 max-sm:w-auto"
    >
      <header className="flex items-center gap-2 bg-emerald-600 px-4 py-3.5 text-white">
        <Sparkles size={18} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Masroof Assistant</h2>
          <p className="text-[11px] text-emerald-50">Ask about your expenses and budgets</p>
        </div>
        <button className="rounded-lg p-2 hover:bg-emerald-700" aria-label="Clear conversation" title="Clear conversation" onClick={() => {
          if (window.confirm("Clear this conversation?")) chat.clear();
        }}>
          <Trash2 size={16} />
        </button>
        <button className="rounded-lg p-2 hover:bg-emerald-700" aria-label="Close assistant" onClick={onClose}>
          <X size={17} />
        </button>
      </header>

      <div ref={listRef} aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3.5 py-4">
        {chat.messages.length === 0 && (
          <div className="my-auto">
            <p className="mb-3 text-center text-sm text-slate-500">What would you like to know?</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((suggestion) => (
                <button key={suggestion} onClick={() => submit(suggestion)} className="rounded-full border border-emerald-200 px-3 py-2 text-left text-xs text-emerald-800 hover:bg-emerald-50">
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.messages.map((message, index) => <ChatMessage key={`${index}-${message.role}`} message={message} />)}
        {chat.loading && (
          <div className="flex items-center gap-1 rounded-2xl bg-slate-100 px-4 py-3" aria-label="Assistant is responding">
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
          </div>
        )}
        {chat.error && (
          <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            <p>{chat.error}</p>
            <button onClick={chat.retry} className="mt-2 inline-flex items-center gap-1.5 font-medium">
              <RotateCcw size={13} /> Retry
            </button>
          </div>
        )}
      </div>

      <form className="border-t border-slate-100 p-3" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, 1000))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder="Ask Masroof..."
            aria-label="Message the assistant"
            className="max-h-28 min-h-10 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <button type="submit" disabled={chat.loading || !draft.trim()} aria-label="Send message" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
            <SendHorizontal size={17} />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-slate-400">Read-only assistant. It can make mistakes and cannot submit or approve expenses.</p>
      </form>
    </section>
  );
}
