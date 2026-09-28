import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  parseISO,
  startOfMonth,
  startOfWeek,
  subWeeks,
} from 'date-fns';
import type { Task } from '@/db/types';
import { addDaysStr, completionDay, toDateStr } from './dayBoundary';
import { completionCount, deriveSections } from './sections';

/**
 * 회고(달력) 뷰의 순수 함수들.
 * 데이터는 하루 화면과 동일한 deriveSections/completionCount로 계산해,
 * 달력 셀의 완료율이 그날 하루 화면과 정확히 일치하게 만든다.
 */

/** 주 시작 요일 (0 = 일요일). '하루 시작 시각' 설정(v0.2)과는 별개의 상수. */
export const WEEK_STARTS_ON = 0 as const;

/** 그 달을 포함하는 주 시작~끝(주 단위로 채운 격자)의 'YYYY-MM-DD' 배열 */
export function monthGridDays(monthAnchor: string): string[] {
  const anchor = parseISO(monthAnchor);
  const gridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: WEEK_STARTS_ON });
  const gridEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn: WEEK_STARTS_ON });
  return eachDayOfInterval({ start: gridStart, end: gridEnd }).map(toDateStr);
}

/** 기준일이 속한 주 7일의 'YYYY-MM-DD' 배열 */
export function weekGridDays(anchor: string): string[] {
  const d = parseISO(anchor);
  const start = startOfWeek(d, { weekStartsOn: WEEK_STARTS_ON });
  const end = endOfWeek(d, { weekStartsOn: WEEK_STARTS_ON });
  return eachDayOfInterval({ start, end }).map(toDateStr);
}

/** 달 이동: 그 달 1일 기준으로 delta개월 이동한 날짜 문자열 */
export function shiftMonth(anchor: string, delta: number): string {
  return toDateStr(addMonths(startOfMonth(parseISO(anchor)), delta));
}

/** 주 이동: delta주(7일 단위) 이동한 날짜 문자열 */
export function shiftWeek(anchor: string, delta: number): string {
  return addDaysStr(anchor, delta * 7);
}

export type DayStat = { total: number; done: number; rate: number };

/**
 * 그 날짜를 하루 화면으로 봤을 때의 완료 카운트(하루 화면과 동일).
 * rate = done / total (total 0이면 0).
 */
export function dayStat(tasks: Task[], dateStr: string, today: string): DayStat {
  const { total, done } = completionCount(deriveSections(tasks, dateStr, today));
  return { total, done, rate: total > 0 ? done / total : 0 };
}

/**
 * 그날 '완료'가 있었던 공간 id 목록 (완료 시각 기준 귀속, 중복 제거).
 * 반환 순서는 tasks 순서를 따르므로, 표시할 땐 공간 정렬 순서로 다시 맞춘다.
 */
export function completedSpaceIds(tasks: Task[], dateStr: string): string[] {
  const ids = new Set<string>();
  for (const t of tasks) {
    if (t.completedAt && completionDay(t.completedAt) === dateStr) ids.add(t.spaceId);
  }
  return [...ids];
}

/** 그날 어떤 공간에 무엇이 있었는지: 완료(done)가 있었나, 할 일(todo)이 있었나 */
export type DaySpaceState = { spaceId: string; done: boolean; todo: boolean };

/**
 * 그 날짜를 하루 화면으로 봤을 때, 공간별로 '완료가 있었는지 / 할 일이 있었는지'를 계산한다.
 * - done: 그날 완료(completed 섹션)가 하나라도 있는 공간
 * - todo: 그날 미완료(open + 넘어옴 carried)가 하나라도 있는 공간
 *   (carried는 하루 화면 규칙상 viewedDate === today일 때만 채워진다)
 * 한 공간이 done·todo를 동시에 가질 수 있다. 반환 순서·중복 정리는 호출부(공간 정렬)에서 한다.
 */
export function daySpaceStates(tasks: Task[], dateStr: string, today: string): DaySpaceState[] {
  const { carried, open, completed } = deriveSections(tasks, dateStr, today);
  const doneSet = new Set<string>();
  const todoSet = new Set<string>();
  for (const t of completed) doneSet.add(t.spaceId);
  for (const t of open) todoSet.add(t.spaceId);
  for (const t of carried) todoSet.add(t.spaceId);
  const ids = new Set<string>([...doneSet, ...todoSet]);
  return [...ids].map((spaceId) => ({
    spaceId,
    done: doneSet.has(spaceId),
    todo: todoSet.has(spaceId),
  }));
}

/** 잔디(기여 그래프) 한 주 = 일요일부터 7일. 최근 N주를 열로 나열한다. */
export function grassGridWeeks(anchorToday: string, weeks: number): string[][] {
  const d = parseISO(anchorToday);
  const start = startOfWeek(subWeeks(d, weeks - 1), { weekStartsOn: WEEK_STARTS_ON });
  const end = endOfWeek(d, { weekStartsOn: WEEK_STARTS_ON });
  const all = eachDayOfInterval({ start, end }).map(toDateStr);
  const cols: string[][] = [];
  for (let i = 0; i < all.length; i += 7) cols.push(all.slice(i, i + 7));
  return cols;
}
