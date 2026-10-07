import type { Task } from '@/db/types';
import { inRange, type DateRange } from './period';

/** 할 일의 종료 상태. completedAt·cancelledAt은 상호배타라(types.ts) 셋은 겹치지 않는다. */
export type TaskStatus = 'open' | 'done' | 'cancelled';

/**
 * 검색을 좁히는 선택 필터. 각 필드는 null/미지정이면 그 축으로 거르지 않는다(= 전체).
 * DB 쿼리가 아니라 이미 받아 둔 tasks를 클라이언트에서 더 거를 뿐이다(리포트와 동일 전략).
 */
export type SearchFilters = {
  spaceIds?: Set<string> | null; // null/빈 Set = 모든 공간
  range?: DateRange | null; // null = 날짜 무관
  status?: TaskStatus | null; // null = 모든 상태
};

/** task → 종료 상태. 취소가 완료보다 우선(취소 시 completedAt은 null로 되돌아감). */
export function taskStatus(t: Task): TaskStatus {
  return t.cancelledAt != null ? 'cancelled' : t.completedAt != null ? 'done' : 'open';
}

/**
 * 제목으로 할 일을 검색한다 — 기본은 날짜·공간과 무관하게 전체에서 거른다.
 *
 * - 대소문자 무시, 앞뒤 공백 제거.
 * - 공백으로 나눈 여러 단어는 AND 매칭: 모든 단어가 제목에 들어 있어야 맞는다.
 * - 빈 쿼리(공백만)면 빈 결과 — 검색어를 넣기 전에는 아무것도 보여 주지 않는다.
 *   필터만 지정하고 검색어가 없어도 마찬가지로 빈 결과다(필터는 검색어의 보조).
 * - filters로 공간·기간·상태를 추가로 좁힌다(모두 AND). 각 필드 null = 그 축 전체.
 * - 결과는 dueDate 내림차순(최근 날짜 먼저), 같으면 createdAt 내림차순.
 *
 * 순수 함수: 입력 배열을 변형하지 않는다(filter→sort로 새 배열을 만든다).
 * 소프트 삭제 필터는 호출부(useTasks)가 이미 `deleted_at IS NULL`로 처리한다.
 */
export function searchTasks(tasks: Task[], query: string, filters?: SearchFilters): Task[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const spaceIds = filters?.spaceIds;
  const hasSpaceFilter = spaceIds != null && spaceIds.size > 0;
  const range = filters?.range ?? null;
  const status = filters?.status ?? null;

  return tasks
    .filter((t) => {
      const title = t.title.toLowerCase();
      if (!terms.every((term) => title.includes(term))) return false;
      if (status != null && taskStatus(t) !== status) return false;
      if (hasSpaceFilter && !spaceIds.has(t.spaceId)) return false;
      // 기간 지정 시 날짜 미정('나중에', dueDate null)은 구간이 없으므로 제외한다.
      if (range != null && (t.dueDate == null || !inRange(t.dueDate, range))) return false;
      return true;
    })
    .sort(byDueDateDesc);
}

/**
 * dueDate 내림차순 → 같으면 createdAt 내림차순 (둘 다 정렬 가능한 문자열).
 * 날짜 미정(null)은 ''로 보정해 맨 뒤로 보낸다(내림차순에서 가장 작은 값).
 */
function byDueDateDesc(a: Task, b: Task): number {
  const ad = a.dueDate ?? '';
  const bd = b.dueDate ?? '';
  if (ad !== bd) return ad < bd ? 1 : -1;
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}
