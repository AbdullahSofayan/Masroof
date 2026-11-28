import { API_URL, ApiError, getToken } from "../../services/api";

const errorText = {
  401: "Please sign in again.",
  429: "Too many messages. Try again in a minute.",
  503: "The assistant is temporarily unavailable.",
};

export async function sendChat(messages) {
  const token = getToken();
  if (!token) throw new ApiError("Please sign in again.", 401);
  let response;
  try {
    response = await fetch(`${API_URL.replace(/\/$/, "")}/agent/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messages.map(({ role, content }) => ({ role, content })),
      }),
      signal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    throw new ApiError(
      error.name === "TimeoutError"
        ? "The assistant took too long to respond. Please retry."
        : "Could not reach the assistant. Check your connection and retry.",
      0,
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      errorText[response.status] || data.detail || "The assistant request failed.",
      response.status,
    );
  }
  return response.json();
}
