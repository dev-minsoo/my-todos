import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarRange, CheckCircle2, PlusCircle, Repeat, Target, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { PERIOD_LABELS, PERIOD_PRESETS, type PeriodPreset } from '@/domain/period';
import type { DistributionItem, HabitAdherence } from '@/domain/report';
import { useReport } from '@/features/report/useReport';

const CARD = 'rounded-2xl border border-border bg-surface p-5 shadow-card';

function pct(rate: number): number {
  return Math.round(rate * 100);
}

/** 'YYYY-MM-DD' → 일(숫자) 문자열 (차트 x축용) */
function dayTick(date: string): string {
  return String(Number(date.slice(8, 10)));
}

export default function ReportPage() {
  const { preset, setPreset, report, isLoading } = useReport();
  const { summary, activity, bySpace, byGroup, frequency, habits } = report;

  const hasActivity = summary.completed > 0;
  // 막대가 많으면 x축 눈금을 솎는다(달 = 30여 개).
  const tickInterval = activity.length > 14 ? Math.floor(activity.length / 10) : 0;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="리포트" description="기간별로 얼마나 해냈는지 돌아봐요." />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          <PeriodPicker preset={preset} onPick={setPreset} />

          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted">불러오는 중…</p>
          ) : (
            <>
              {/* A. 요약 */}
              <section className={CARD}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Metric icon={CheckCircle2} label="완료" value={summary.completed} tone="accent" />
                  <Metric icon={PlusCircle} label="등록" value={summary.registered} />
                  <Metric icon={Target} label="마감 이행률" value={`${pct(summary.adherenceRate)}%`} />
                  <Metric icon={XCircle} label="미수행" value={summary.missed} tone={summary.missed > 0 ? 'warn' : 'muted'} />
                </div>
                <p className="mt-3 text-xs text-muted">
                  마감이 걸린 일반 할 일 {summary.dueTotal}개 중 {summary.dueDone}개를 기간 안에 끝냈어요
                  {summary.avgLateDays > 0 && (
                    <> · 늦게 끝낸 건 평균 {summary.avgLateDays.toFixed(1)}일 밀렸어요</>
                  )}
                  .
                </p>
              </section>

              {/* B. 완료 활동 추이 */}
              <section className={CARD}>
                <SectionTitle icon={CalendarRange} title="완료 활동 추이" />
                {hasActivity ? (
                  <div className="mt-3 h-48 w-full text-accent">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activity} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                        <XAxis
                          dataKey="date"
                          tickFormatter={dayTick}
                          interval={tickInterval}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.55 }}
                        />
                        <YAxis
                          allowDecimals={false}
                          width={32}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.55 }}
                        />
                        <Tooltip
                          cursor={{ fill: 'currentColor', opacity: 0.08 }}
                          content={<ActivityTooltip />}
                        />
                        <Bar dataKey="completed" fill="currentColor" radius={[3, 3, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Empty>이 기간에 완료한 일이 없어요.</Empty>
                )}
              </section>

              {/* C. 분포 */}
              <div className="grid gap-4 md:grid-cols-2">
                <section className={CARD}>
                  <SectionTitle title="공간별 완료" />
                  <Distribution items={bySpace} empty="완료한 일이 없어요." />
                </section>
                <section className={CARD}>
                  <SectionTitle title="그룹별 완료" />
                  <Distribution items={byGroup} empty="완료한 일이 없어요." />
                </section>
              </div>

              {/* D. 자주 등록 */}
              <section className={CARD}>
                <SectionTitle icon={PlusCircle} title="자주 등록한 일" />
                {frequency.length > 0 ? (
                  <ul className="mt-3 space-y-1.5">
                    {frequency.map((f) => (
                      <li key={f.title} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate">{f.title}</span>
                        <span className="shrink-0 rounded-full bg-accentSoft px-2 py-0.5 text-xs font-medium text-accent">
                          {f.count}회
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>이 기간에 반복해서 등록한 일이 없어요.</Empty>
                )}
              </section>

              {/* E. 습관 이행률 */}
              <section className={CARD}>
                <SectionTitle icon={Repeat} title="습관 이행률" />
                {habits.length > 0 ? (
                  <ul className="mt-3 space-y-3">
                    {habits.map((h) => (
                      <HabitRow key={h.id} habit={h} />
                    ))}
                  </ul>
                ) : (
                  <Empty>이 기간에 해당하는 습관이 없어요.</Empty>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PeriodPicker({ preset, onPick }: { preset: PeriodPreset; onPick: (p: PeriodPreset) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-surface2 p-1">
      {PERIOD_PRESETS.map((p) => {
        const active = preset === p;
        return (
          <button
            key={p}
            onClick={() => onPick(p)}
            aria-pressed={active}
            className={cn(
              'rounded-lg px-2 py-2 text-sm transition',
              active ? 'bg-surface font-medium text-text shadow-soft' : 'text-muted hover:text-text'
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        );
      })}
    </div>
  );
}

type MetricTone = 'accent' | 'warn' | 'muted' | 'default';

function Metric({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string | number;
  tone?: MetricTone;
}) {
  const valueTone =
    tone === 'accent' ? 'text-accent' : tone === 'warn' ? 'text-red-500' : 'text-text';
  return (
    <div className="rounded-xl bg-surface2 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className={cn('mt-1 text-2xl font-semibold tabular-nums', valueTone)}>{value}</div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon?: typeof CheckCircle2; title: string }) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon className="size-4 text-accent" />}
      <h2 className="text-sm font-medium">{title}</h2>
    </div>
  );
}

function Distribution({ items, empty }: { items: DistributionItem[]; empty: string }) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  const localMax = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="mt-3 space-y-2.5">
      {items.map((item) => (
        <li key={item.id ?? '__none__'}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{item.name}</span>
            <span className="shrink-0 tabular-nums text-muted">{item.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface2">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(item.count / localMax) * 100}%`,
                backgroundColor: item.color ?? 'var(--accent)',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function HabitRow({ habit }: { habit: HabitAdherence }) {
  return (
    <li>
      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{habit.title}</span>
          <span className="shrink-0 rounded-full bg-surface2 px-1.5 py-0.5 text-[11px] text-muted">
            {habit.ruleLabel}
          </span>
        </span>
        <span className="shrink-0 tabular-nums text-muted">
          {habit.done}/{habit.occurrences} · {pct(habit.rate)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct(habit.rate)}%` }} />
      </div>
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted">{children}</p>;
}

type TooltipProps = {
  active?: boolean;
  payload?: { payload: { date: string; completed: number } }[];
};

function ActivityTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const { date, completed } = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-card">
      <div className="font-medium">{date}</div>
      <div className="text-muted">완료 {completed}개</div>
    </div>
  );
}
