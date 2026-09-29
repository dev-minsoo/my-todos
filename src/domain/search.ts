import type { Task } from '@/db/types';

/**
 * 제목으로 할 일을 검색한다 — 날짜·공간과 무관하게 전체에서 거른다.
 *
 * - 대소문자 무시, 앞뒤 공백 제거.
 * - 공백으로 나눈 여러 단어는 AND 매칭: 모든 단어가 제목에 들어 있어야 맞는다.
 * - 빈 쿼리(공백만)면 빈 결과 — 검색어를 넣기 전에는 아무것도 보여 주지 않는다.
 * - 결과는 dueDate 내림차순(최근 날짜 먼저), 같으면 createdAt 내림차순.
 *
 * 순수 함수: 입력 배열을 변형하지 않는다(filter→sort로 새 배열을 만든다).
 * 소프트 삭제 필터는 호출부(useTasks)가 이미 `deleted_at IS NULL`로 처리한다.
 */
export function searchTasks(tasks: Task[], query: string): Task[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  return tasks
    .filter((t) => {
      const title = t.title.toLowerCase();
      return terms.every((term) => title.includes(term));
    })
    .sort(byDueDateDesc);
}

/** dueDate 내림차순 → 같으면 createdAt 내림차순 (둘 다 정렬 가능한 문자열) */
function byDueDateDesc(a: Task, b: Task): number {
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? 1 : -1;
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}
