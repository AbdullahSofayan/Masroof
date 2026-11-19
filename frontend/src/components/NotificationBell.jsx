import { Bell } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { DECISION_STATUS, STATUS, STATUS_META } from "../utils/constants";
import { formatDate, formatMoney } from "../utils/formatters";
import {
  getUserPreferences,
  PREFERENCES_UPDATED_EVENT,
} from "../utils/preferences";
import {
  isDepartmentExpense,
  isOwnExpense,
  loadSpendExpenses,
} from "../utils/spendExpenses";

const MAX_NOTIFICATIONS = 10;
const HIGH_VALUE_AMOUNT = 2000;
const timestamp = (date) => Date.parse(date) || 0;
// Keep user-entered Arabic and English text in its own direction within the alert sentence.
const isolate = (value) => `\u2068${value}\u2069`;

function expenseNotification(expense, user) {
  const { id, amount, status, approvals } = expense;
  const title = isolate(expense.title || `Expense #${id}`);
  const name = isolate(expense.employeeName || "An employee");
  const money = formatMoney(amount);
  const statusLabel = STATUS_META[status].label;
  let date = expense.createdAt || expense.date;
  let heading;
  let message;
  let targetRoute;

  if (user.role === "employee") {
    const decision = approvals
      .filter(({ decision }) => {
        const value = String(decision).toLowerCase();
        return (DECISION_STATUS[value] || value) === status;
      })
      .sort((a, b) =>
        (b.created_at || "").localeCompare(a.created_at || ""),
      )[0];
    const note = decision?.note || expense.note;
    date = decision?.created_at || expense.updatedAt || date;
    heading = `Expense ${statusLabel.toLowerCase()}`;
    message = `Your expense “${title}” (${money}) was ${statusLabel.toLowerCase()}.${note ? ` ${isolate(note)}` : ""}`;
    targetRoute = `/employee/expenses?expense=${encodeURIComponent(id)}`;
  } else if (
    status === STATUS.PENDING &&
    (user.role === "manager" || user.role === "admin")
  ) {
    const reviewable =
      !isOwnExpense(expense, user) && isDepartmentExpense(expense, user);
    heading = reviewable ? "Expense awaiting review" : "Pending expense";
    message = `${name} submitted “${title}” (${money}) under ${expense.category}.`;
    targetRoute = reviewable
      ? `/manager/expenses/${encodeURIComponent(id)}`
      : "/finance/dashboard";
  } else {
    heading =
      amount >= HIGH_VALUE_AMOUNT ? "High-value expense" : "Recent expense";
    message = `${name} submitted “${title}” (${money}) under ${expense.category}. ${statusLabel}.`;
    targetRoute = "/finance/dashboard";
  }

  return {
    id: `${id}:${status}`,
    title: heading,
    message,
    status,
    amount,
    date,
    targetRoute,
  };
}

function deriveNotifications(expenses, user) {
  const pending = expenses.filter(
    (expense) => expense.status === STATUS.PENDING,
  );
  let selected;
  if (user.role === "employee") {
    selected = expenses.filter((expense) => expense.status !== STATUS.PENDING);
  } else if (user.role === "manager") {
    selected = pending.filter((expense) => !isOwnExpense(expense, user));
  } else {
    const spend = expenses.filter(
      (expense) => expense.status !== STATUS.REJECTED,
    );
    const highValue = spend.filter(
      (expense) => expense.amount >= HIGH_VALUE_AMOUNT,
    );
    const alerts = highValue.length ? highValue : spend;
    selected = user.role === "admin" ? [...pending, ...alerts] : alerts;
  }

  const uniqueExpenses = new Map(
    selected.map((expense) => [String(expense.id), expense]),
  );
  return [...uniqueExpenses.values()]
    .map((expense) => expenseNotification(expense, user))
    .sort((a, b) => timestamp(b.date) - timestamp(a.date))
    .slice(0, MAX_NOTIFICATIONS);
}

function readNotificationIds(storageKey) {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey));
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

export default function NotificationBell() {
  const { user } = useAuth();
  const { key: routeKey } = useLocation();
  const popoverId = useId();
  const container = useRef(null);
  const trigger = useRef(null);
  const popover = useRef(null);
  const storageKey = `masroof_read_notifications_${user.id || "guest"}`;
  const [isOpen, setIsOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [feed, setFeed] = useState(null);
  const [error, setError] = useState(false);
  const [readIds, setReadIds] = useState(() => readNotificationIds(storageKey));
  const [showBadge, setShowBadge] = useState(
    () => getUserPreferences(user.id).showNotificationBadge,
  );
  const notifications = (feed || []).map((item) => ({
    ...item,
    isRead: readIds.has(item.id),
  }));
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const displayCount = unreadCount > 0 && showBadge;

  useEffect(() => {
    let active = true;
    let inFlight = false;
    async function refresh() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const expenses = await loadSpendExpenses(user);
        if (!active) return;
        setFeed(deriveNotifications(expenses, user));
        setError(false);
      } catch {
        if (active) setError(true);
      } finally {
        inFlight = false;
      }
    }
    refresh();
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [routeKey, user, openCount]);

  useEffect(() => {
    function updatePreferences({ detail }) {
      if (detail?.userId === user.id)
        setShowBadge(detail.preferences.showNotificationBadge);
    }
    function updateReadIds(event) {
      if (event.key === storageKey || event.key === null)
        setReadIds(readNotificationIds(storageKey));
    }
    window.addEventListener(PREFERENCES_UPDATED_EVENT, updatePreferences);
    window.addEventListener("storage", updateReadIds);
    return () => {
      window.removeEventListener(PREFERENCES_UPDATED_EVENT, updatePreferences);
      window.removeEventListener("storage", updateReadIds);
    };
  }, [storageKey, user.id]);

  useEffect(() => {
    if (!isOpen) return;
    popover.current?.focus();
    function closeOutside(event) {
      if (!container.current?.contains(event.target)) setIsOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  function markRead(ids) {
    const nextReadIds = new Set([
      ...readNotificationIds(storageKey),
      ...readIds,
      ...ids,
    ]);
    setReadIds(nextReadIds);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...nextReadIds]));
    } catch {
      // The feed still updates when storage is unavailable.
    }
  }

  return (
    <div ref={container} className="shrink-0 sm:relative">
      <button
        ref={trigger}
        type="button"
        className="icon-button relative"
        aria-label="Notifications"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls={isOpen ? popoverId : undefined}
        aria-describedby={displayCount ? `${popoverId}-count` : undefined}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setOpenCount((count) => count + 1);
        }}
      >
        <Bell size={17} aria-hidden="true" />
        {displayCount && (
          <>
            <span
              aria-hidden="true"
              className="absolute -top-1.5 -right-1.5 min-w-4 rounded-full bg-emerald-600 px-1 text-[10px] leading-4 font-semibold text-white ring-2 ring-white"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
            <span id={`${popoverId}-count`} className="sr-only">
              {unreadCount} unread notifications
            </span>
          </>
        )}
      </button>
      {isOpen && (
        <section
          ref={popover}
          id={popoverId}
          role="dialog"
          aria-labelledby={`${popoverId}-title`}
          tabIndex={-1}
          className="card absolute inset-x-4 top-full z-50 mt-2 ml-auto max-w-80 overflow-hidden shadow-xl outline-none sm:right-0 sm:left-auto sm:mt-3 sm:w-96 sm:max-w-96"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3.5 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={`${popoverId}-title`} className="text-sm font-semibold">
                Notifications
              </h2>
              <span
                aria-live="polite"
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600"
              >
                {unreadCount} unread
              </span>
            </div>
            <button
              type="button"
              disabled={unreadCount === 0}
              className="text-xs font-semibold text-emerald-700 hover:underline"
              onClick={() => markRead(notifications.map(({ id }) => id))}
            >
              Mark all as read
            </button>
          </div>
          <div className="max-h-[min(24rem,calc(100dvh-10rem))] overflow-y-auto overscroll-contain">
            {error && (
              <p
                role="status"
                className="px-4 py-3 text-center text-xs text-zinc-600"
              >
                Notifications couldn’t be refreshed.
              </p>
            )}
            {notifications.length > 0 ? (
              <ul className="divide-y divide-zinc-100">
                {notifications.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={item.targetRoute}
                      onClick={() => {
                        markRead([item.id]);
                        setIsOpen(false);
                      }}
                      className={`block px-4 py-3.5 hover:bg-zinc-50 focus-visible:-outline-offset-2 sm:px-5 ${item.isRead ? "" : "bg-emerald-50/65"}`}
                    >
                      <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span className="flex items-center gap-2 text-xs font-semibold">
                          {!item.isRead && (
                            <span
                              aria-label="Unread"
                              className="size-1.5 rounded-full bg-emerald-600"
                            />
                          )}
                          {item.title}
                        </span>
                        <time className="text-[11px] text-zinc-500">
                          {formatDate(item.date)}
                        </time>
                      </span>
                      <p className="mt-1.5 text-xs leading-5 wrap-anywhere text-zinc-600">
                        {item.message}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              !error && (
                <p
                  className="px-5 py-8 text-center text-sm text-zinc-600"
                  role="status"
                >
                  {feed
                    ? "You're all caught up — no notifications right now."
                    : "Loading notifications…"}
                </p>
              )
            )}
          </div>
        </section>
      )}
    </div>
  );
}
