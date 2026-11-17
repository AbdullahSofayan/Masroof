import { useId, useMemo } from 'react';
import { motion } from 'motion/react';
import { CURRENCY } from '../../utils/constants';
import { formatDate, formatMoney } from '../../utils/formatters';
import { weeklyApprovedSpend } from './spendData';
import { useFintechMotion } from './useFintechMotion';

export default function SpendSparkline({ expenses, endDate, className = '' }) {
  const { enabled } = useFintechMotion();
  const id = `spend-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const weeks = useMemo(() => weeklyApprovedSpend(expenses, endDate), [expenses, endDate]);
  const maximum = Math.max(0, ...weeks.map((week) => week.amount));
  const total = weeks.reduce((sum, week) => sum + week.amount, 0);
  const Bar = enabled ? motion.rect : 'rect';
  return <figure className={className}>
    <figcaption className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="bento-title">Spend velocity</h2><p className="mt-1.5 text-[11px] text-zinc-400">Approved expenses · Last 6 weeks</p></div>
      <p className="text-lg font-semibold tracking-tight tabular-nums text-zinc-900">{formatMoney(total)}</p>
    </figcaption>
    <svg viewBox="0 0 600 155" className="block w-full" role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>Weekly approved spend in {CURRENCY}</title>
      <desc id={`${id}-description`}>{weeks.map((week) => `Week of ${week.date}: ${formatMoney(week.amount)}`).join('; ') || 'No recent expenses.'}</desc>
      {[20, 80, 140].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#F0F0ED" strokeDasharray="3 5" aria-hidden="true" />)}
      {weeks.map((week, index) => {
        const current = index === weeks.length - 1;
        // A zero-spend current week gets a small baseline marker, never a fabricated full-height total.
        const height = Math.max(current ? 4 : 0, maximum > 0 ? week.amount / maximum * 125 : 0);
        const x = index * 100 + 24;
        return <g key={week.date}>
          <Bar data-spend-bar="" data-current={current ? 'true' : undefined} className={current ? 'spend-bar-current' : 'spend-bar-history'} x={x} y={140 - height} width="52" height={height} rx="7" fill={current ? '#1F5C3B' : '#DFDFDA'}
            {...(enabled ? { initial: { attrY: 140, height: 0 }, animate: { attrY: 140 - height, height }, transition: { duration: 0.7, delay: index * 0.04, ease: 'easeOut' } } : {})}>
            <title>{formatDate(week.date, { year: undefined })}: {formatMoney(week.amount)}</title>
          </Bar>
        </g>;
      })}
    </svg>
    <div className="grid grid-cols-6 text-center text-[9px] tabular-nums text-zinc-400 sm:text-[10px]" aria-hidden="true">{weeks.map((week, index) => <span key={week.date} className={index === weeks.length - 1 ? 'font-medium text-[#1F5C3B]' : ''}>{formatDate(week.date, { year: undefined })}</span>)}</div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-400"><span>Weekly totals · {CURRENCY}</span><span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[#1F5C3B]" />Current week</span></div>
    {maximum === 0 && <p className="mt-3 text-xs text-zinc-400">No approved spend in this period.</p>}
  </figure>;
}
