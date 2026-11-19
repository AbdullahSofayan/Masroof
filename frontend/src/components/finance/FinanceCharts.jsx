import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CURRENCY } from "../../utils/constants";
import { formatDate, formatMoney } from "../../utils/formatters";

// Colours from the Masroof design system: stone history, forest-emerald current/active.
export const CHART = {
  history: "#DFDFDA",
  current: "#1F5C3B",
  grid: "#F0F0ED",
  axis: "#A1A1AA",
  baseline: "#A1A1AA",
  forecast: "#1F5C3B",
  actual: "#52525B",
};
const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 10, fill: CHART.axis },
};
const compact = (value) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
const monthName = (year, month) =>
  new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[11px] shadow-sm">
      <p className="mb-1 font-medium text-zinc-700">{label}</p>
      {payload
        .filter(
          (entry) =>
            entry.value !== null &&
            entry.value !== undefined &&
            !(
              entry.dataKey === "predicted" &&
              entry.payload.actual !== null &&
              entry.payload.actual !== undefined
            ),
        )
        .map((entry) => (
          <p key={entry.dataKey} className="tabular-nums text-zinc-500">
            <span
              className="mr-1.5 inline-block size-1.5 rounded-full align-middle"
              style={{ background: entry.color }}
            />
            {entry.name}:{" "}
            <span className="font-medium text-zinc-900">
              {formatMoney(entry.value)}
            </span>
          </p>
        ))}
    </div>
  );
}

/** Approved spend per month; the current month is highlighted. */
export function MonthlySpendChart({ monthly, months = 6 }) {
  const data = monthly.slice(-months).map((entry) => ({
    label: monthName(entry.year, entry.month),
    total: Number(entry.total),
  }));
  return (
    <figure>
      <div
        className="h-52"
        role="img"
        aria-label={`Approved spend per month in ${CURRENCY}: ${data.map((entry) => `${entry.label} ${formatMoney(entry.total)}`).join("; ")}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke={CHART.grid}
              strokeDasharray="3 5"
            />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={compact} />
            <Tooltip content={<MoneyTooltip />} cursor={{ fill: "#F6F6F4" }} />
            <Bar
              dataKey="total"
              name="Approved"
              radius={[7, 7, 7, 7]}
              maxBarSize={52}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.label}
                  fill={
                    index === data.length - 1 ? CHART.current : CHART.history
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** Eight weeks of actual spend, then four forecast weeks, with the last-week baseline. */
export function ForecastChart({ forecast }) {
  const baseline = Number(forecast.baseline_last_week);
  const lastActual = forecast.history.at(-1);
  const data = [
    ...forecast.history.map((entry) => ({
      label: formatDate(entry.week_start, { year: undefined }),
      actual: Number(entry.actual),
      predicted: entry === lastActual ? Number(entry.actual) : null,
      baseline: null,
    })),
    ...forecast.weeks.map((entry) => ({
      label: formatDate(entry.week_start, { year: undefined }),
      actual: null,
      predicted: Number(entry.predicted),
      baseline,
    })),
  ];
  return (
    <div
      className="h-72"
      role="img"
      aria-label={`Weekly spend: last 8 weeks actual and next 4 weeks forecast. ${forecast.weeks.map((entry) => `Week of ${entry.week_start}: ${formatMoney(entry.predicted)}`).join("; ")}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke={CHART.grid}
            strokeDasharray="3 5"
          />
          <XAxis dataKey="label" {...axisProps} interval={0} />
          <YAxis {...axisProps} width={48} tickFormatter={compact} />
          <Tooltip content={<MoneyTooltip />} cursor={{ fill: "#F6F6F4" }} />
          <Legend
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => (
              <span style={{ color: "#71717a" }}>{value}</span>
            )}
          />
          <Bar
            dataKey="actual"
            name="Actual"
            fill={CHART.history}
            radius={[6, 6, 6, 6]}
            maxBarSize={34}
          />
          <Line
            dataKey="predicted"
            name="Forecast"
            stroke={CHART.forecast}
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: CHART.forecast }}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="baseline"
            name="Last-week baseline"
            stroke={CHART.baseline}
            strokeDasharray="5 5"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Simple ranked bars, used for spend by department / category / employee. */
export function RankedBars({
  rows,
  emptyText = "Nothing to show yet.",
  onSelect,
  selectedKey,
}) {
  const maximum = Math.max(0, ...rows.map((row) => row.amount));
  if (!rows.length)
    return <p className="py-5 text-sm text-zinc-500">{emptyText}</p>;
  return (
    <div className="space-y-1">
      {rows.map((row) => {
        const width = maximum > 0 ? (row.amount / maximum) * 100 : 0;
        const content = (
          <>
            <div className="mb-2 flex items-start justify-between gap-3 text-[11px]">
              <span className="min-w-0 truncate text-zinc-600" dir="auto">
                {row.label}
              </span>
              <span className="shrink-0 text-right font-medium tabular-nums text-zinc-900">
                {formatMoney(row.amount)}
                {row.note && (
                  <span className="ml-1 text-[10px] font-normal text-zinc-500">
                    {row.note}
                  </span>
                )}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-zinc-100"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${width}%`,
                  background: row.highlight ? CHART.current : "#18181b",
                }}
              />
            </div>
          </>
        );
        return onSelect ? (
          <div
            key={row.key}
            className="category-row"
            role="button"
            tabIndex={0}
            aria-pressed={selectedKey === row.key}
            aria-label={`Filter by ${row.label}`}
            onClick={() => onSelect(row)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(row);
              }
            }}
          >
            {content}
          </div>
        ) : (
          <div key={row.key} className="px-0 py-2">
            {content}
          </div>
        );
      })}
    </div>
  );
}
