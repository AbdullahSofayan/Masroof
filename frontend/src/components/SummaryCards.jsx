import { useState } from 'react';
import { CURRENCY, STATUS, TIME_ZONE } from '../utils/constants';
import { today } from '../utils/formatters';
import CountUp from './reactbits/CountUp';
import SpotlightCard from './reactbits/SpotlightCard';

const calendarDay = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

export default function SummaryCards({ expenses = [], title = 'Total spend' }) {
  const [timeframe, setTimeframe] = useState('All time');
  const currentDay = today();
  const weekStart = new Date(`${currentDay}T00:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const firstDay = weekStart.toISOString().slice(0, 10);
  const visibleExpenses = timeframe === 'All time' ? expenses : expenses.filter((expense) => {
    const value = expense.date || expense.created_at;
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const day = calendarDay.format(date);
    return timeframe === 'Daily' ? day === currentDay : day >= firstDay && day <= currentDay;
  });
  const sum = (items) => items.reduce((total, expense) => total + (Number(expense.amount) || 0), 0);
  const approved = visibleExpenses.filter((expense) => expense.status === STATUS.APPROVED);
  const pending = visibleExpenses.filter((expense) => [STATUS.PENDING_MANAGER, STATUS.PENDING_FINANCE].includes(expense.status));
  const changes = visibleExpenses.filter((expense) => expense.status === STATUS.NEEDS_CHANGES);
  const total = sum(visibleExpenses);
  const approvedTotal = sum(approved);
  const pendingTotal = sum(pending);
  const segments = [
    { label: 'Approved', amount: approvedTotal, className: 'bg-[#DCEACB]' },
    { label: 'Pending', amount: pendingTotal, className: 'bg-[#9FB699]' },
    { label: 'Remaining', amount: Math.max(0, total - approvedTotal - pendingTotal), className: 'bg-white/25' },
  ];
  const metrics = [
    { label: 'Approved', amount: approvedTotal, count: approved.length },
    { label: 'Pending', amount: pendingTotal, count: pending.length },
    { label: 'Needs changes', amount: sum(changes), count: changes.length },
    { label: 'Approval rate', amount: visibleExpenses.length ? approved.length / visibleExpenses.length * 100 : 0, percent: true },
  ];
  return <SpotlightCard as="section" theme="dark" spotlightColor="rgba(220, 234, 203, 0.12)" borderGlow={0.2}
    className="spend-hero h-full" aria-label={title}>
    <div className="relative z-10 flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-white/80">{title}</h2>
        <div className="hero-timeframes" role="group" aria-label="Spend timeframe">
          {['Daily', 'Weekly', 'All time'].map((value) => <button key={value} type="button" aria-pressed={timeframe === value} onClick={() => setTimeframe(value)}>{value}</button>)}
        </div>
      </div>
      <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-medium tracking-tight tabular-nums">
        <span className="text-lg text-white/60">{CURRENCY}</span>
        <CountUp to={total} decimals={2} separator="," duration={0.9} trigger="load" className="hero-number leading-none" />
      </p>
      <p className="hero-request-count mt-3 text-xs text-white/55"><span className="tabular-nums">{visibleExpenses.length}</span> {visibleExpenses.length === 1 ? 'request' : 'requests'} · {timeframe === 'All time' ? 'Your complete expense picture' : timeframe === 'Daily' ? 'Today' : 'Last 7 days'}</p>
      <div className="mt-7">
        <div className="hero-allocation flex h-2.5 gap-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
          {segments.map((segment) => <span key={segment.label} className={`h-full rounded-full ${segment.className}`} style={{ width: `${total > 0 ? segment.amount / total * 100 : 0}%` }} />)}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-white/70">
          {segments.map((segment) => <span key={segment.label} className="inline-flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${segment.className}`} aria-hidden="true" />{segment.label}
            <span className="tabular-nums text-white">{total > 0 ? Math.round(segment.amount / total * 100) : 0}%</span>
          </span>)}
        </div>
        <p className="sr-only">Remaining includes requests needing changes and rejected requests.</p>
      </div>
      <dl className="hero-metrics mt-auto grid grid-cols-2 gap-x-4 gap-y-5 border-t border-white/15 pt-5 xl:grid-cols-4">
        {metrics.map((metric) => <div key={metric.label} className="min-w-0">
          <dt className="text-[10px] text-white/60">{metric.label}</dt>
          <dd className="mt-2 text-sm font-medium tabular-nums sm:text-base">
            {!metric.percent && <span className="mr-1 text-[10px] text-white/55">{CURRENCY}</span>}
            <CountUp to={metric.amount} decimals={metric.percent ? 0 : 2} separator="," suffix={metric.percent ? '%' : ''} duration={0.75} trigger="load" />
          </dd>
          <dd className="mt-1 text-[10px] text-white/45">{metric.percent ? 'of all requests' : <><span className="tabular-nums">{metric.count}</span> {metric.count === 1 ? 'request' : 'requests'}</>}</dd>
        </div>)}
      </dl>
    </div>
  </SpotlightCard>;
}
