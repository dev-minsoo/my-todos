import { type ReactNode } from 'react';
import { getDate, getDay } from 'date-fns';
import { Minus, Plus, Repeat, Trash2 } from 'lucide-react';
import type { Recurrence, RecurrenceRule } from '@/db/types';
import { WEEKDAY_LABELS, ruleLabel } from '@/domain/recurrence';
import { PopoverMenu } from '@/components/PopoverMenu';
import { cn } from '@/lib/utils';

/**
 * 규칙 편집 컨트롤 — 입력칸 반복 칩과 관리 팝오버가 공유한다.
 * 매일/매주/매월/며칠마다 모드 칩 + 모드별 세부 컨트롤(요일 토글·주 간격·날짜·일 간격).
 * 요일을 전부 끄면 매일로 되돌린다.
 * defaultWeekday: 매주로 처음 전환할 때 씨앗 요일(0=일..6=토). 기본은 오늘 요일.
 * defaultDayOfMonth: 매월로 처음 전환할 때 씨앗 날짜(1~31). 기본은 오늘 날짜.
 */
export function RuleControls({
  rule,
  onChange,
  defaultWeekday,
  defaultDayOfMonth,
}: {
  /** null = 아직 아무 규칙도 아님(입력칸의 "반복 없음"). 이때 모든 모드 칩 비활성. */
  rule: RecurrenceRule | null;
  onChange: (rule: RecurrenceRule) => void;
  defaultWeekday?: number;
  defaultDayOfMonth?: number;
}) {
  const seedWeekday = defaultWeekday ?? getDay(new Date());
  const seedDay = defaultDayOfMonth ?? getDate(new Date());

  const days = rule?.type === 'weekly' ? rule.weekdays : [];
  const weekInterval = rule?.type === 'weekly' ? rule.interval ?? 1 : 1;

  /** 요일 집합 + 현재 주 간격으로 weekly 규칙을 만든다(간격 1은 키 생략). */
  function weekly(weekdays: number[], interval: number): RecurrenceRule {
    return interval > 1 ? { type: 'weekly', weekdays, interval } : { type: 'weekly', weekdays };
  }

  function toggleDay(dow: number) {
    const next = days.includes(dow)
      ? days.filter((d) => d !== dow)
      : [...days, dow].sort((a, b) => a - b);
    // 마지막 요일까지 끄면 "매주 아무 요일 없음"은 죽은 규칙이라 매일로 폴백.
    onChange(next.length === 0 ? { type: 'daily' } : weekly(next, weekInterval));
  }

  return (
    <div className="px-2 py-1.5">
      <div className="grid grid-cols-2 gap-1">
        <ModeChip active={rule?.type === 'daily'} onClick={() => onChange({ type: 'daily' })}>
          매일
        </ModeChip>
        <ModeChip
          active={rule?.type === 'weekly'}
          onClick={() => {
            if (rule?.type !== 'weekly') onChange({ type: 'weekly', weekdays: [seedWeekday] });
          }}
        >
          매주
        </ModeChip>
        <ModeChip
          active={rule?.type === 'monthly'}
          onClick={() => {
            if (rule?.type !== 'monthly') onChange({ type: 'monthly', day: seedDay });
          }}
        >
          매월
        </ModeChip>
        <ModeChip
          active={rule?.type === 'everyNDays'}
          onClick={() => {
            if (rule?.type !== 'everyNDays') onChange({ type: 'everyNDays', interval: 2 });
          }}
        >
          며칠마다
        </ModeChip>
      </div>

      {rule?.type === 'weekly' && (
        <>
          <div className="mt-2 flex gap-1">
            {WEEKDAY_LABELS.map((label, dow) => {
              const on = days.includes(dow);
              return (
                <button
                  key={dow}
                  type="button"
                  onClick={() => toggleDay(dow)}
                  aria-pressed={on}
                  aria-label={`${label}요일`}
                  className={cn(
                    'grid size-7 flex-1 place-items-center rounded-full text-xs transition',
                    on
                      ? 'bg-accent font-medium text-accentFg'
                      : cn('bg-surface2 hover:text-text', dow === 0 ? 'text-red-500' : 'text-muted')
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <StepperRow label="반복 간격">
            <Stepper
              value={weekInterval}
              min={1}
              max={8}
              suffix="주마다"
              onChange={(v) => onChange(weekly(days, v))}
            />
          </StepperRow>
        </>
      )}

      {rule?.type === 'monthly' && (
        <>
          <StepperRow label="매월">
            <Stepper
              value={rule.day}
              min={1}
              max={31}
              suffix="일"
              onChange={(v) => onChange({ type: 'monthly', day: v })}
            />
          </StepperRow>
          <p className="mt-1.5 px-0.5 text-[11px] leading-tight text-muted">
            그 달에 없는 날(31일 등)은 말일에 떠요.
          </p>
        </>
      )}

      {rule?.type === 'everyNDays' && (
        <StepperRow label="간격">
          <Stepper
            value={rule.interval}
            min={2}
            max={30}
            suffix="일마다"
            onChange={(v) => onChange({ type: 'everyNDays', interval: v })}
          />
        </StepperRow>
      )}
    </div>
  );
}

function ModeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-1.5 text-sm transition',
        active ? 'bg-accent font-medium text-accentFg' : 'bg-surface2 text-muted hover:text-text'
      )}
    >
      {children}
    </button>
  );
}

function StepperRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}

/** 숫자 조정 스테퍼(− 값 +). min/max로 범위를 가둔다. */
function Stepper({
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <StepperButton
        label="줄이기"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="size-3.5" />
      </StepperButton>
      <span className="min-w-[1.5rem] text-center text-sm font-medium tabular-nums">{value}</span>
      <StepperButton
        label="늘리기"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="size-3.5" />
      </StepperButton>
      <span className="ml-0.5 text-xs text-muted">{suffix}</span>
    </div>
  );
}

function StepperButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-6 place-items-center rounded-md bg-surface2 text-muted transition hover:text-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-muted"
    >
      {children}
    </button>
  );
}

/**
 * 반복 출신 항목 옆 아이콘 → 규칙 편집 + "반복 중단" 팝오버.
 * 제목 변경은 항목 인라인 수정(rename)이 시리즈로 전파하므로 여기선 다루지 않는다.
 */
export function RecurrencePopover({
  recurrence,
  onUpdate,
  onStop,
}: {
  recurrence: Recurrence;
  onUpdate: (input: { id: string; title?: string; rule?: RecurrenceRule }) => void;
  onStop: (rec: Recurrence) => void;
}) {
  return (
    <PopoverMenu
      trigger={<Repeat className="size-3.5" />}
      triggerLabel={`반복: ${ruleLabel(recurrence.rule)}`}
      triggerClassName="shrink-0 rounded-md p-1 text-muted transition hover:text-accent"
      align="end"
      width={240}
    >
      {(close) => (
        <>
          <p className="px-3 pb-0.5 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
            반복
          </p>
          <RuleControls
            rule={recurrence.rule}
            onChange={(rule) => onUpdate({ id: recurrence.id, rule })}
          />
          <div className="mt-1 border-t border-border pt-1">
            <button
              role="menuitem"
              onClick={() => {
                onStop(recurrence);
                close();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 transition hover:bg-red-500/10"
            >
              <Trash2 className="size-4 shrink-0" />
              <span>반복 중단</span>
            </button>
          </div>
        </>
      )}
    </PopoverMenu>
  );
}
