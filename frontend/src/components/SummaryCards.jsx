import { CURRENCY, STATUS_META } from '../utils/constants';
import CountUp from './reactbits/CountUp';
import SpotlightCard from './reactbits/SpotlightCard';

export default function SummaryCards({ expenses }) {
  return (
    <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {Object.entries(STATUS_META).map(([status, meta]) => {
        const items = expenses.filter((expense) => expense.status === status);
        const total = items.reduce((sum, expense) => sum + Number(expense.amount), 0);
        return (
          <SpotlightCard key={status} role="group" aria-label={meta.label}
            theme="light" spotlightColor="rgba(16, 185, 129, 0.12)"
            spotlightSize={260} borderGlow={0.5} proximity={64}
            className="card p-4 transition-shadow duration-200 hover:shadow-md">
            <div className="mb-4 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">{meta.label}</span>
              <span className={`size-2 rounded-full border ${meta.className}`} />
            </div>
            <p className="whitespace-nowrap text-xl font-semibold tracking-tight tabular-nums">
              {CURRENCY}{' '}<CountUp to={total} from={0} decimals={2} separator="," duration={0.8} trigger="load" className="tabular-nums" />
            </p>
            <p className="mt-2 text-xs tabular-nums text-slate-400">
              <CountUp to={items.length} from={0} decimals={0} duration={0.7} trigger="load" className="tabular-nums" />{' '}
              {items.length === 1 ? 'request' : 'requests'}
            </p>
          </SpotlightCard>
        );
      })}
    </div>
  );
}
