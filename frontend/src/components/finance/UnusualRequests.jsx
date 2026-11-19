// "Unusual requests" — the AI summary on the Finance dashboard (ML contract C9, D2, D4, D6).
// Shows counts by risk level, flagged share per department and the top reasons.
// Never shows a score or a percentage per request: the score only ranks requests.
import { Info } from 'lucide-react';

export const RISK = {
  high: { en: 'High risk', ar: 'خطر مرتفع', bar: '#E24B4A', text: 'text-rose-700', chip: 'bg-rose-50 text-rose-700' },
  medium: { en: 'Medium risk', ar: 'خطر متوسط', bar: '#EF9F27', text: 'text-amber-700', chip: 'bg-amber-50 text-amber-700' },
  low: { en: 'Low risk', ar: 'خطر منخفض', bar: '#1F5C3B', text: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-700' },
  not_scored: { en: 'Not analyzed yet', ar: 'لم يُحلَّل بعد', bar: '#D4D4D8', text: 'text-zinc-500', chip: 'bg-zinc-100 text-zinc-600' },
};

function RiskCounts({ counts }) {
  const levels = ['high', 'medium', 'low', 'not_scored'];
  const total = levels.reduce((sum, level) => sum + counts[level], 0);
  const maximum = Math.max(1, ...levels.map((level) => counts[level]));
  return <div>
    <h3 className="mb-1 text-xs font-medium text-zinc-700">Requests by risk</h3>
    <p className="mb-4 text-[11px] text-zinc-500"><span className="tabular-nums">{total}</span> requests this month</p>
    <ul className="space-y-3" aria-label="Requests by risk level">
      {levels.map((level) => <li key={level}>
        <div className="mb-1.5 flex items-center justify-between text-[11px]"><span className={`rounded-full px-2 py-0.5 font-medium ${RISK[level].chip}`}>{RISK[level].en}</span><span className="font-medium tabular-nums text-zinc-900">{counts[level]}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true"><div className="h-full rounded-full" style={{ width: `${counts[level] / maximum * 100}%`, background: RISK[level].bar }} /></div>
      </li>)}
    </ul>
  </div>;
}

function FlaggedByDepartment({ rows }) {
  return <div>
    <h3 className="mb-1 text-xs font-medium text-zinc-700">Flagged share by department</h3>
    <p className="mb-4 text-[11px] text-zinc-500">Medium or high risk, out of analyzed requests</p>
    {rows.length ? <ul className="space-y-3">
      {rows.map((row) => <li key={row.department_id}>
        <div className="mb-1.5 flex items-start justify-between gap-3 text-[11px]"><span className="truncate text-zinc-600" dir="auto">{row.department_name}</span><span className="shrink-0 tabular-nums"><span className="font-medium text-zinc-900">{row.flagged_percent.toFixed(0)}%</span><span className="ml-1 text-zinc-500">({row.flagged} of {row.total})</span></span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true"><div className="h-full rounded-full" style={{ width: `${Math.min(100, row.flagged_percent)}%`, background: RISK.medium.bar }} /></div>
      </li>)}
    </ul> : <p className="py-4 text-sm text-zinc-500">No analyzed requests this month.</p>}
  </div>;
}

function TopReasons({ reasons }) {
  return <div>
    <h3 className="mb-1 text-xs font-medium text-zinc-700">Top reasons</h3>
    <p className="mb-4 text-[11px] text-zinc-500">Among flagged requests</p>
    {reasons.length ? <ol className="space-y-3">
      {reasons.map((item, index) => <li key={item.code} className="flex gap-3 text-xs">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-medium tabular-nums text-zinc-600">{index + 1}</span>
        <span className="min-w-0 flex-1"><span className="block leading-5 text-zinc-700">{item.text_en}</span><span className="block text-[11px] leading-5 text-zinc-500" dir="rtl" lang="ar">{item.text_ar}</span></span>
        <span className="shrink-0 font-medium tabular-nums text-zinc-900">{item.count}</span>
      </li>)}
    </ol> : <p className="py-4 text-sm text-zinc-500">No flagged requests this month.</p>}
  </div>;
}

export default function UnusualRequests({ summary }) {
  return <section className="card bento-panel" aria-labelledby="unusual-requests-title">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="unusual-requests-title" className="bento-title">Unusual requests <span className="ml-1 font-normal text-zinc-500" lang="ar">· الطلبات غير المعتادة</span></h2><p className="mt-1.5 text-[11px] text-zinc-500">AI risk check · This month</p></div>
    </div>
    <div className="grid gap-8 md:grid-cols-3">
      <RiskCounts counts={summary.counts} />
      <FlaggedByDepartment rows={summary.by_department} />
      <TopReasons reasons={summary.top_reasons} />
    </div>
    <p className="mt-6 flex gap-2 border-t border-zinc-100 pt-4 text-[11px] leading-5 text-zinc-500"><Info size={14} className="mt-0.5 shrink-0" />This is an automatic hint to help the review. It is not a decision. Department managers review and decide each request.</p>
  </section>;
}
