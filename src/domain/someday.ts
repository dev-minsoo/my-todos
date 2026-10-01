import type { Task } from '@/db/types';

// '나중에'(someday) 도메인 — 순수 함수. "날짜 미정 + 열림" 집합을 한곳에 고정한다.
//
// '나중에' = 날짜의 부재(dueDate == null) + 아직 안 닫힌(미완료·미취소) 할 일.
// 날짜 미정 항목을 완료/취소하면 completedAt/cancelledAt 이 찍혀 그 '날'의 기록으로
// 자연 귀속되므로(sections.ts의 completed/cancelled 섹션), 이 목록에서는 빠진다.
// 즉 이 전용 목록은 "언젠가 할 일"을 담는 깔끔한 인박스다.

const alive = (t: Task) => t.deletedAt == null;

const byCreatedAsc = (a: Task, b: Task) =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;

/** 표시 순서: position 사전식 오름차순, 없거나 동률이면 created_at 폴백 (sections.ts와 동일 규칙). */
const byPosition = (a: Task, b: Task) => {
  const ap = a.position ?? '';
  const bp = b.position ?? '';
  if (ap !== '' && bp !== '' && ap !== bp) return ap < bp ? -1 : 1;
  return byCreatedAsc(a, b);
};

/**
 * 날짜 미정 + 열림(미완료·미취소) 할 일만 추려 표시 순으로 돌려준다.
 * - 소프트 삭제 필터는 호출부(useTasks)가 이미 처리하지만 순수 함수로서 방어적으로 한 번 더 거른다.
 * - 공간/그룹 스코프는 호출부가 책임진다(sections.ts와 대칭).
 */
export function somedayTasks(tasks: Task[]): Task[] {
  return tasks
    .filter(
      (t) => alive(t) && t.dueDate == null && t.completedAt == null && t.cancelledAt == null
    )
    .sort(byPosition);
}
