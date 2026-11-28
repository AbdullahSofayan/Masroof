import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import useChat from "./useChat";
import ChatPanel from "./ChatPanel";

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const inputRef = useRef(null);
  const chat = useChat(user?.id);

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  if (!user || import.meta.env.VITE_AI_CHAT_ENABLED === "false") return null;

  return (
    <>
      {open && <ChatPanel user={user} chat={chat} inputRef={inputRef} onClose={() => {
        setOpen(false);
        buttonRef.current?.focus();
      }} />}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
        className="fixed bottom-6 right-6 z-[61] grid h-14 w-14 place-items-center rounded-full bg-emerald-600 text-white shadow-lg transition hover:scale-105 hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-300 motion-reduce:transition-none"
      >
        {open ? <X size={23} /> : <MessageCircle size={23} />}
      </button>
    </>
  );
}
