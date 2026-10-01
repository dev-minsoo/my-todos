// 반복(recurring) 도메인 — 순수 함수. 넘어옴과 같은 compute-on-view 사상:
// 발생분(occurrence)은 저장하지 않고, "보는 날짜"에 규칙이 맞는 반복을 가상 Task로
// 계산해 tasks 배열에 섞는다. 과거 날짜분은 애초에 주입하지 않으므로 미완료가
// 넘어오지 않는다(습관형). 사용자가 건드리면 useTasks가 실제 행으로 실체화한다.
import {
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  getDate,
  getDay,
  getDaysInMonth,
  parseISO,
} from 'date-fns';
import type { Recurrence, RecurrenceRule, Task } from '@/db/types';

/** 가상 발생분 Task의 id 접두사. 실제 행과 구별하는 유일한 표식. */
export const VIRTUAL_PREFIX = 'virt:';

/** getDay(0=일 .. 6=토) 인덱스에 맞춘 요일 라벨 (규칙 편집 UI에서도 재사용) */
export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 정수인지 + [min, max] 범위인지. jsonb에서 온 unknown 숫자 검증용. */
function intInRange(v: unknown, min: number, max: number): v is number {
  return Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
}

/**
 * jsonb `rule`을 방어적으로 파싱한다. DB에서 온 unknown을 신뢰하지 않는다.
 * - weekly: 0~6 정수 요일만 남기고 중복 제거·정렬. 유효 요일이 하나도 없으면 죽은 규칙이라
 *   매일로 폴백. interval은 ≥2 정수만 보존(1·불량은 생략 → 매주).
 * - monthly: day가 1~31 정수일 때만. 아니면 매일로 폴백.
 * - everyNDays: interval이 ≥1 정수일 때만. 아니면 매일로 폴백.
 * - 그 외(불량/누락/미지원 타입): 매일로 폴백(사용자가 바로 알아채고 고칠 수 있게).
 */
export function parseRule(raw: unknown): RecurrenceRule {
  if (raw && typeof raw === 'object') {
    const r = raw as { type?: unknown; weekdays?: unknown; interval?: unknown; day?: unknown };
    if (r.type === 'weekly') {
      const weekdays = Array.isArray(r.weekdays)
        ? [...new Set(r.weekdays.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 6))].sort(
            (a, b) => a - b
          )
        : [];
      if (weekdays.length === 0) return { type: 'daily' };
      // interval 1(또는 불량)은 "매주"이므로 키 자체를 생략한다(기존 저장 데이터와 동일 형태 유지).
      return intInRange(r.interval, 2, 52)
        ? { type: 'weekly', weekdays, interval: r.interval }
        : { type: 'weekly', weekdays };
    }
    if (r.type === 'monthly') {
      return intInRange(r.day, 1, 31) ? { type: 'monthly', day: r.day } : { type: 'daily' };
    }
    if (r.type === 'everyNDays') {
      return intInRange(r.interval, 1, 365) ? { type: 'everyNDays', interval: r.interval } : { type: 'daily' };
    }
    if (r.type === 'daily') return { type: 'daily' };
  }
  return { type: 'daily' };
}

/** 표시용 라벨: "매일" / "월·수·금" / "격주 월" / "매월 15일" / "3일마다". */
export function ruleLabel(rule: RecurrenceRule): string {
  switch (rule.type) {
    case 'daily':
      return '매일';
    case 'weekly': {
      const days = [...rule.weekdays].sort((a, b) => a - b);
      const interval = rule.interval ?? 1;
      if (interval <= 1 && days.length >= 7) return '매일';
      if (days.length === 0) return '반복';
      const base = days.map((d) => WEEKDAY_LABELS[d]).join('·');
      if (interval <= 1) return base;
      return `${interval === 2 ? '격주' : `${interval}주마다`} ${base}`;
    }
    case 'monthly':
      return `매월 ${rule.day}일`;
    case 'everyNDays':
      return rule.interval <= 1 ? '매일' : `${rule.interval}일마다`;
  }
}

/** occursOn/virtualOccurrences가 실제로 참조하는 최소 필드 */
type OccursInput = Pick<Recurrence, 'rule' | 'startDate'>;

/**
 * 주어진 날짜에 이 반복이 발생하는가. ('YYYY-MM-DD' 문자열 비교는 사전식 = 날짜 순서.)
 * - 시작일(startDate) 이전이면 어떤 규칙이든 안 뜬다.
 * - daily: 시작일 이후 항상.
 * - weekly: 그 날 요일(getDay)이 규칙에 포함되고, interval이 있으면 시작 주 기준 그 간격의 주일 때만.
 *   주 간격은 월요일 시작으로 센다(한국 주 감각) — 시작일이 든 주가 0주차.
 * - monthly: 그 달의 day일. 그 달에 없는 날(31일 등)은 말일로 당긴다.
 * - everyNDays: 시작일로부터 지난 날수가 interval의 배수일 때.
 */
export function occursOn(rec: OccursInput, date: string): boolean {
  if (date < rec.startDate) return false;
  const rule = rec.rule;
  switch (rule.type) {
    case 'daily':
      return true;
    case 'weekly': {
      const d = parseISO(date);
      if (!rule.weekdays.includes(getDay(d))) return false; // 0=일 .. 6=토
      const interval = rule.interval ?? 1;
      if (interval <= 1) return true;
      const weeks = differenceInCalendarWeeks(d, parseISO(rec.startDate), { weekStartsOn: 1 });
      return weeks % interval === 0;
    }
    case 'monthly': {
      const d = parseISO(date);
      return getDate(d) === Math.min(rule.day, getDaysInMonth(d));
    }
    case 'everyNDays':
      return differenceInCalendarDays(parseISO(date), parseISO(rec.startDate)) % rule.interval === 0;
  }
}

/** 가상 발생분 Task의 id. recId·date로 안정적으로 결정된다(재계산해도 동일). */
export function virtualId(recId: string, date: string): string {
  return `${VIRTUAL_PREFIX}${recId}:${date}`;
}

/** 가상 발생분(아직 실체화되지 않은 반복)인가 */
export function isVirtualOccurrence(t: Pick<Task, 'id'>): boolean {
  return t.id.startsWith(VIRTUAL_PREFIX);
}

/** 반복 출신(가상이든 실체든)이면 그 반복 id, 아니면 null */
export function recurrenceIdOf(t: Pick<Task, 'recurrenceId'>): string | null {
  return t.recurrenceId ?? null;
}

/**
 * 그 날짜(date)의 가상 발생분을 만든다.
 * - realTasks 중 (recurrenceId===rec.id && dueDate===date)인 행이 있으면 그 반복은
 *   그날 이미 "처리됨"이므로 건너뛴다. 삭제 여부는 보지 않는다:
 *   완료(alive)든 건너뜀(soft-deleted)이든 가상분이 다시 떠선 안 된다.
 * - 나머지 매칭 반복마다 가상 Task 1개. dueDate=date, completedAt=null, recurrenceId=rec.id.
 *   spaceId/groupId/title/position은 반복 규칙에서 승계한다.
 */
export function virtualOccurrences(
  recs: Recurrence[],
  realTasks: Task[],
  date: string,
  ctx: { userId: string }
): Task[] {
  const materialized = new Set(
    realTasks
      .filter((t) => t.recurrenceId != null && t.dueDate === date)
      .map((t) => t.recurrenceId as string)
  );

  const out: Task[] = [];
  for (const rec of recs) {
    if (rec.deletedAt != null) continue;
    if (materialized.has(rec.id)) continue;
    if (!occursOn(rec, date)) continue;
    out.push({
      id: virtualId(rec.id, date),
      userId: ctx.userId,
      spaceId: rec.spaceId,
      groupId: rec.groupId,
      title: rec.title,
      dueDate: date,
      completedAt: null,
      cancelledAt: null,
      position: rec.position,
      memo: null,
      parentId: null,
      recurrenceId: rec.id,
      createdAt: rec.createdAt,
      updatedAt: rec.updatedAt,
      deletedAt: null,
    });
  }
  return out;
}
