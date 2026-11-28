import { useCallback, useEffect, useState } from "react";
import { sendChat } from "./chatApi";

function readMessages(key) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.slice(-20) : [];
  } catch {
    return [];
  }
}

export default function useChat(userId) {
  const key = `masroof.chat.${userId}`;
  const [messages, setMessages] = useState(() => readMessages(key));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryText, setRetryText] = useState("");

  useEffect(() => {
    setMessages(readMessages(key));
    setError("");
    setRetryText("");
  }, [key]);

  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(messages.slice(-20))); }
    catch { /* Conversation remains usable if storage is disabled. */ }
  }, [key, messages]);

  const send = useCallback(async (text, retrying = false) => {
    const content = text.trim();
    if (!content || loading) return;
    const next = retrying ? messages : [...messages, { role: "user", content }];
    if (!retrying) setMessages(next);
    setLoading(true);
    setError("");
    setRetryText("");
    try {
      const result = await sendChat(next.slice(-10));
      setMessages([...next, { role: "assistant", content: result.reply }]);
    } catch (err) {
      setError(err.message || "The assistant request failed.");
      setRetryText(content);
    } finally {
      setLoading(false);
    }
  }, [loading, messages]);

  const retry = useCallback(() => {
    if (retryText) send(retryText, true);
  }, [retryText, send]);

  const clear = useCallback(() => {
    setMessages([]);
    setError("");
    setRetryText("");
    try { sessionStorage.removeItem(key); } catch { /* optional storage */ }
  }, [key]);

  return { messages, loading, error, send, clear, retry };
}
