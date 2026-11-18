import { Info } from 'lucide-react';
import { useState } from 'react';
import { ForecastChart } from '../../components/finance/FinanceCharts';
import { ErrorBox, PageHeading, Spinner } from '../../components/UI';
import { financeApi } from '../../services/financeApi';
import { formatDate, formatMoney } from '../../utils/formatters';
import { useAsync } from '../../utils/useAsync';
import { DepartmentSelect } from './FinanceQueuePage';

export default function ForecastPage() {
  const [departmentId, setDepartmentId] = useState('');
  const departments = useAsync(() => financeApi.departments(), []);
  const forecast = useAsync(() => financeApi.forecast(departmentId || null), [departmentId]);
  if ((forecast.loading && !forecast.data) || (departments.loading && !departments.data)) return <Spinner />;
  if (departments.error) return <ErrorBox message={departments.error} retry={departments.reload} />;
  const data = forecast.data;
  const totalForecast = data ? data.weeks.reduce((sum, week) => sum + Number(week.predicted), 0) : 0;
  const baselineTotal = data ? Number(data.baseline_last_week) * 4 : 0;
  const difference = baselineTotal ? (totalForecast - baselineTotal) / baselineTotal * 100 : 0;
  const scope = departmentId ? departments.data.find((entry) => entry.id === Number(departmentId))?.name : 'All departments';
  return <div className="dashboard-bento">
    <PageHeading eyebrow="FORECAST" title="The next four weeks." description="Expected weekly spend per department, from the forecasting model. Weeks run Sunday to Saturday." />
    <div className="bento-grid">
      <section className="card bento-panel lg:col-span-8">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="bento-title" dir="auto">{scope}</h2><p className="mt-1.5 text-[11px] text-zinc-400">Last 8 weeks actual · next 4 weeks forecast</p></div><DepartmentSelect departments={departments.data} value={departmentId} onChange={setDepartmentId} /></div>
        {forecast.error ? <ErrorBox message={forecast.error} retry={forecast.reload} /> : <ForecastChart forecast={data} />}
      </section>
      <section className="card bento-panel lg:col-span-4">
        <h2 className="bento-title mb-1">Forecast by week</h2>
        <p className="mb-4 text-[11px] text-zinc-400">Compared with the last-week baseline</p>
        {data && <>
          <dl className="divide-y divide-zinc-100">
            {data.weeks.map((week, index) => {
              const change = Number(data.baseline_last_week) ? (Number(week.predicted) - Number(data.baseline_last_week)) / Number(data.baseline_last_week) * 100 : 0;
              return <div key={week.week_start} className="flex items-center justify-between gap-3 py-3">
                <dt className="text-xs text-zinc-500">Week {index + 1}<span className="ml-2 tabular-nums text-zinc-400">{formatDate(week.week_start, { year: undefined })}</span></dt>
                <dd className="text-right"><span className="text-sm font-medium tabular-nums">{formatMoney(week.predicted)}</span><span className={`ml-2 text-[10px] tabular-nums ${change > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{change > 0 ? '+' : ''}{change.toFixed(0)}%</span></dd>
              </div>;
            })}
          </dl>
          <div className="mt-4 rounded-2xl bg-[#F6F6F4] p-4">
            <p className="text-[11px] text-zinc-500">Next 4 weeks</p>
            <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{formatMoney(totalForecast)}</p>
            <p className="mt-1 text-[11px] text-zinc-500"><span className="tabular-nums">{difference > 0 ? '+' : ''}{difference.toFixed(1)}%</span> vs. repeating last week (<span className="tabular-nums">{formatMoney(data.baseline_last_week)}</span>/week)</p>
          </div>
        </>}
        <p className="mt-4 flex gap-2 text-[11px] leading-5 text-zinc-400"><Info size={14} className="mt-0.5 shrink-0" />Forecasts are estimates for planning, not commitments. The baseline simply repeats last week’s total, so the model is useful only when it beats it.</p>
      </section>
    </div>
  </div>;
}
