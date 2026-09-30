// 리포트 기간(프리셋 → 날짜 구간) — 순수 함수. 로컬 자정 기준, 반열림 [start, end).
// start·end는 'YYYY-MM-DD'이고 end는 "마지막 날 다음 날"(제외). 날짜 문자열 비교로 판정한다.
import { addDays, addMonths, parseISO, startOfMonth, startOfWeek, subMonths, subWeeks } from 'date-fns';
import { toDateStr } from './dayBoundary';

/** 주 시작 요일 (0 = 일요일). calendar.ts와 동일 규칙. */
export const WEEK_STARTS_ON = 0;

export type DateRange = { start: string; end: string };
export type PeriodPreset = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth';

export const PERIOD_PRESETS: PeriodPreset[] = ['thisWeek', 'lastWeek', 'thisMonth', 'lastMonth'];

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  thisWeek: '이번 주',
  lastWeek: '지난 주',
  thisMonth: '이번 달',
  lastMonth: '지난 달',
};

function weekRange(d: Date): DateRange {
  const s = startOfWeek(d, { weekStartsOn: WEEK_STARTS_ON });
  return { start: toDateStr(s), end: toDateStr(addDays(s, 7)) };
}

function monthRange(d: Date): DateRange {
  const s = startOfMonth(d);
  return { start: toDateStr(s), end: toDateStr(addMonths(s, 1)) };
}

/** 프리셋 → 반열림 날짜 구간. today는 'YYYY-MM-DD'. */
export function periodRange(preset: PeriodPreset, today: string): DateRange {
  const d = parseISO(today);
  switch (preset) {
    case 'thisWeek':
      return weekRange(d);
    case 'lastWeek':
      return weekRange(subWeeks(d, 1));
    case 'thisMonth':
      return monthRange(d);
    case 'lastMonth':
      return monthRange(subMonths(d, 1));
  }
}

/** 'YYYY-MM-DD'가 구간에 속하는가 (반열림 [start, end)). */
export function inRange(day: string, r: DateRange): boolean {
  return day >= r.start && day < r.end;
}

/** 구간 안의 날짜 배열 [start, end) — 활동 추이 버킷의 뼈대. */
export function daysOf(r: DateRange): string[] {
  const out: string[] = [];
  const end = parseISO(r.end);
  let d = parseISO(r.start);
  while (d < end) {
    out.push(toDateStr(d));
    d = addDays(d, 1);
  }
  return out;
}
