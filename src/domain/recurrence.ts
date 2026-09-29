// 반복(recurring) 도메인 — 순수 함수. 넘어옴과 같은 compute-on-view 사상:
// 발생분(occurrence)은 저장하지 않고, "보는 날짜"에 규칙이 맞는 반복을 가상 Task로
// 계산해 tasks 배열에 섞는다. 과거 날짜분은 애초에 주입하지 않으므로 미완료가
// 넘어오지 않는다(습관형). 사용자가 건드리면 useTasks가 실제 행으로 실체화한다.
import { getDay, parseISO } from 'date-fns';
import type { Recurrence, RecurrenceRule, Task } from '@/db/types';

/** 가상 발생분 Task의 id 접두사. 실제 행과 구별하는 유일한 표식. */
export const VIRTUAL_PREFIX = 'virt:';

/** getDay(0=일 .. 6=토) 인덱스에 맞춘 요일 라벨 (규칙 편집 UI에서도 재사용) */
export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/**
 * jsonb `rule`을 방어적으로 파싱한다. DB에서 온 unknown을 신뢰하지 않는다.
 * - {type:'weekly', weekdays:[...]}: 0~6 정수만 남기고 중복 제거·정렬. 유효 요일이
 *   하나도 없으면 죽은 규칙이므로 매일로 폴백(사용자가 바로 알아채고 중단할 수 있게).
 * - 그 외(불량/누락/미지원 타입): 매일로 폴백.
 */
export function parseRule(raw: unknown): RecurrenceRule {
  if (raw && typeof raw === 'object') {
    const r = raw as { type?: unknown; weekdays?: unknown };
    if (r.type === 'weekly') {
      const weekdays = Array.isArray(r.weekdays)
        ? [...new Set(r.weekdays.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 6))].sort(
            (a, b) => a - b
          )
        : [];
      return weekdays.length > 0 ? { type: 'weekly', weekdays } : { type: 'daily' };
    }
    if (r.type === 'daily') return { type: 'daily' };
  }
  return { type: 'daily' };
}

/** 표시용 라벨: "매일" / "월·수·금". 매주 7요일 전부면 "매일". */
export function ruleLabel(rule: RecurrenceRule): string {
  if (rule.type === 'daily') return '매일';
  const days = [...rule.weekdays].sort((a, b) => a - b);
  if (days.length >= 7) return '매일';
  if (days.length === 0) return '반복';
  return days.map((d) => WEEKDAY_LABELS[d]).join('·');
}

/** occursOn/virtualOccurrences가 실제로 참조하는 최소 필드 */
type OccursInput = Pick<Recurrence, 'rule' | 'startDate'>;

/**
 * 주어진 날짜에 이 반복이 발생하는가.
 * - 시작일(startDate) 이전이면 안 뜬다.
 * - 매일: 시작일 이후 항상. 매주: 그 날의 요일(getDay)이 규칙에 포함될 때만.
 * ('YYYY-MM-DD' 문자열 비교는 사전식으로 날짜 순서와 일치한다.)
 */
export function occursOn(rec: OccursInput, date: string): boolean {
  if (date < rec.startDate) return false;
  if (rec.rule.type === 'daily') return true;
  const dow = getDay(parseISO(date)); // 0=일 .. 6=토
  return rec.rule.weekdays.includes(dow);
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
      position: rec.position,
      recurrenceId: rec.id,
      createdAt: rec.createdAt,
      updatedAt: rec.updatedAt,
      deletedAt: null,
    });
  }
  return out;
}
