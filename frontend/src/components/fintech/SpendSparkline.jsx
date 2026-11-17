import { useId, useMemo } from 'react';
import { motion } from 'motion/react';
import { CURRENCY } from '../../utils/constants';
import { formatDate, formatMoney } from '../../utils/formatters';
import { sparklineGeometry, weeklyApprovedSpend } from './spendData';
import { canMeasureSvgPath, useFintechMotion } from './useFintechMotion';

export default function SpendSparkline({ expenses, endDate, className = '' }) {
  const { enabled } = useFintechMotion();
  const id = `spend-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const weeks = useMemo(() => weeklyApprovedSpend(expenses, endDate), [expenses, endDate]);
  const { line, area, end, maximum } = sparklineGeometry(weeks.map((week) => week.amount));
  const draw = enabled && canMeasureSvgPath();
  const Path = draw ? motion.path : 'path';
  const Dot = draw ? motion.circle : 'circle';
  return (
    <figure className={className}>
      <figcaption className="mb-3 flex flex-wrap justify-between gap-2 text-[11px] text-slate-400">
        <span>Spend velocity</span><span>Approved expenses · Last 6 weeks</span>
      </figcaption>
      <svg viewBox="0 0 180 48" className="h-12 w-full overflow-visible" role="img" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>Weekly approved spend in {CURRENCY}</title>
        <desc id={`${id}-description`}>{weeks.map((week) => `Week of ${week.date}: ${formatMoney(week.amount)}`).join('; ') || 'No recent expenses.'}</desc>
        <defs><linearGradient id={`${id}-gradient`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(16, 185, 129, 0.14)" /><stop offset="100%" stopColor="rgba(16, 185, 129, 0)" /></linearGradient></defs>
        {area && <path d={area} fill={`url(#${id}-gradient)`} />}
        {line && <Path d={line} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          {...(draw ? { initial: { pathLength: 0, opacity: 0.4 }, animate: { pathLength: 1, opacity: 1 }, transition: { duration: 0.85, ease: 'easeOut' } } : {})} />}
        {end && <Dot cx={end.x} cy={end.y} r="2.5" fill="#10b981" stroke="white" strokeWidth="1.5"
          {...(draw ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 0.85, duration: 0.18 } } : {})} />}
      </svg>
      {weeks.length > 0 && <div aria-hidden="true" className="mt-2 flex justify-between text-[10px] tabular-nums text-slate-400"><span>{formatDate(weeks[0].date, { year: undefined })}</span><span>{formatDate(weeks.at(-1).date, { year: undefined })}</span></div>}
      {maximum === 0 && <p className="mt-2 text-xs text-slate-400">No approved spend in this period.</p>}
    </figure>
  );
}
