import { type ReactNode } from 'react';
import { getDay } from 'date-fns';
import { Repeat, Trash2 } from 'lucide-react';
import type { Recurrence, RecurrenceRule } from '@/db/types';
import { WEEKDAY_LABELS, ruleLabel } from '@/domain/recurrence';
import { PopoverMenu } from '@/components/PopoverMenu';
import { cn } from '@/lib/utils';

/**
 * 규칙 편집 컨트롤 — 입력칸 반복 칩과 관리 팝오버가 공유한다.
 * 매일/매주 모드 칩 + (매주일 때) 요일 토글. 요일을 전부 끄면 매일로 되돌린다.
 * defaultWeekday: 매주로 처음 전환할 때 씨앗이 될 요일(0=일..6=토). 기본은 오늘 요일.
 */
export function RuleControls({
  rule,
  onChange,
  defaultWeekday,
}: {
  /** null = 아직 아무 규칙도 아님(입력칸의 "반복 없음"). 이때 두 모드 칩 다 비활성. */
  rule: RecurrenceRule | null;
  onChange: (rule: RecurrenceRule) => void;
  defaultWeekday?: number;
}) {
  const seed = defaultWeekday ?? getDay(new Date());
  const isDaily = rule?.type === 'daily';
  const isWeekly = rule?.type === 'weekly';
  const days = rule?.type === 'weekly' ? rule.weekdays : [];

  function toggleDay(dow: number) {
    const next = days.includes(dow)
      ? days.filter((d) => d !== dow)
      : [...days, dow].sort((a, b) => a - b);
    // 마지막 요일까지 끄면 "매주 아무 요일 없음"은 죽은 규칙이라 매일로 폴백.
    onChange(next.length === 0 ? { type: 'daily' } : { type: 'weekly', weekdays: next });
  }

  return (
    <div className="px-2 py-1.5">
      <div className="flex gap-1">
        <ModeChip active={isDaily} onClick={() => onChange({ type: 'daily' })}>
          매일
        </ModeChip>
        <ModeChip
          active={isWeekly}
          onClick={() => {
            if (!isWeekly) onChange({ type: 'weekly', weekdays: [seed] });
          }}
        >
          매주
        </ModeChip>
      </div>

      {isWeekly && (
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
        'flex-1 rounded-lg px-3 py-1.5 text-sm transition',
        active ? 'bg-accent font-medium text-accentFg' : 'bg-surface2 text-muted hover:text-text'
      )}
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
