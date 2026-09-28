import { differenceInCalendarDays, format, parseISO } from 'date-fns';

/**
 * 앱의 '하루 기준'은 로컬 자정이다.
 * 후일 "하루 시작 시각"(예: 새벽 4시) 설정이 생기면 이 파일만 고친다.
 */

/** Date → 'YYYY-MM-DD' (로컬) */
export function toDateStr(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** 오늘 날짜 문자열 (로컬). 테스트를 위해 now 주입 가능 */
export function todayStr(now: Date = new Date()): string {
  return toDateStr(now);
}

/** 완료 시각(ISO) → 완료된 '날' ('YYYY-MM-DD', 로컬) */
export function completionDay(completedAtISO: string): string {
  return toDateStr(parseISO(completedAtISO));
}

/** from → to 사이의 달력상 일수 (to - from). 인자는 'YYYY-MM-DD' */
export function daysBetween(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

/** 'YYYY-MM-DD'에 일수를 더한 새 날짜 문자열 */
export function addDaysStr(dateStr: string, delta: number): string {
  const d = parseISO(dateStr);
  d.setDate(d.getDate() + delta);
  return toDateStr(d);
}
