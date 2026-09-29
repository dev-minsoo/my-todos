import type { Task } from '@/db/types';
import { completionDay, daysBetween } from './dayBoundary';

/** 넘어옴 항목: 며칠 밀렸는지(overdueDays)를 함께 계산해 둔다 */
export type CarriedTask = Task & { overdueDays: number };

export type DaySections = {
  /** 넘어옴 — 오늘 화면에서만 채워진다 (지난 날 미완료가 계산으로 이월) */
  carried: CarriedTask[];
  /** 그날(dueDate)에 잡힌 미완료 항목 */
  open: Task[];
  /** 그날 완료한 항목 (완료 시각의 날짜에 남는다) */
  completed: Task[];
};

const alive = (t: Task) => t.deletedAt == null;

const byCreatedAsc = (a: Task, b: Task) =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;

/**
 * 표시 순서: position 사전식 오름차순. position이 없거나(빈 문자열) 동률이면 created_at 폴백.
 * (position은 fractional index — 드래그 리오더로 두 이웃 사이 키만 바꾼다. §order.ts)
 */
const byPosition = (a: Task, b: Task) => {
  const ap = a.position ?? '';
  const bp = b.position ?? '';
  if (ap !== '' && bp !== '' && ap !== bp) return ap < bp ? -1 : 1;
  return byCreatedAsc(a, b);
};

const byCompletedDesc = (a: Task, b: Task) => {
  const ac = a.completedAt ?? '';
  const bc = b.completedAt ?? '';
  return ac < bc ? 1 : ac > bc ? -1 : 0;
};

/**
 * 보고 있는 날짜(viewedDate)에 대해 화면 섹션을 계산한다.
 * - open: dueDate === viewedDate && 미완료
 * - carried: viewedDate === today일 때만, dueDate < today && 미완료 (실제 dueDate는 바꾸지 않음)
 * - completed: 완료 시각의 날짜 === viewedDate
 *
 * 규칙상 세 섹션은 서로 겹치지 않는다.
 *
 * 반복(습관형): recurrenceId가 있는 항목은 carried에서 제외한다. 실체화 후 다시 체크
 * 해제해도 과거 미완료 행이 오늘로 넘어오지 않게 하는 가드 — "월요일 안 한 운동은
 * 월요일로 끝나고 화요일엔 새 운동만 뜬다"는 습관형 규칙을 여기서 명시적으로 고정한다.
 */
export function deriveSections(tasks: Task[], viewedDate: string, today: string): DaySections {
  const items = tasks.filter(alive);
  const isToday = viewedDate === today;

  const open = items
    .filter((t) => t.completedAt == null && t.dueDate === viewedDate)
    .sort(byPosition);

  const carried: CarriedTask[] = isToday
    ? items
        .filter((t) => t.completedAt == null && t.dueDate < today && t.recurrenceId == null)
        .map((t) => ({ ...t, overdueDays: daysBetween(t.dueDate, today) }))
        .sort(byPosition)
    : [];

  const completed = items
    .filter((t) => t.completedAt != null && completionDay(t.completedAt) === viewedDate)
    .sort(byCompletedDesc);

  return { carried, open, completed };
}

export type CompletionCount = { total: number; done: number };

/** 하단 완료 카운트: "N개 중 M개 완료" */
export function completionCount(s: DaySections): CompletionCount {
  const total = s.carried.length + s.open.length + s.completed.length;
  return { total, done: s.completed.length };
}

/** 전체 탭에서 공간별로 묶은 한 덩어리 (SPEC §82) */
export type SpaceGroup = {
  spaceId: string;
  name: string;
  color: string;
  sections: DaySections;
  count: CompletionCount;
};

/** 그룹 계산에 필요한 공간 메타(전체 Space 중 일부만 받는다) */
type SpaceMeta = { id: string; name: string; color: string };

/**
 * "전체" 탭 화면: 공간별로 묶어서 각각 섹션과 완료 카운트를 계산한다 (SPEC §82, §160).
 * - 공간 순서는 넘겨받은 spaces 순서를 그대로 따른다.
 * - 넘어옴·완료 카운트는 공간마다 따로 계산된다 (회사 화면에 개인 일이 섞이지 않는다).
 * - 그날 보여 줄 항목이 하나도 없는 공간은 결과에서 제외한다.
 */
export function groupSectionsBySpace(
  tasks: Task[],
  spaces: SpaceMeta[],
  viewedDate: string,
  today: string
): SpaceGroup[] {
  const groups: SpaceGroup[] = [];
  for (const sp of spaces) {
    const sections = deriveSections(
      tasks.filter((t) => t.spaceId === sp.id),
      viewedDate,
      today
    );
    const count = completionCount(sections);
    if (count.total === 0) continue;
    groups.push({ spaceId: sp.id, name: sp.name, color: sp.color, sections, count });
  }
  return groups;
}

/** 그룹에 속하지 않은 항목 버킷의 표시 이름 (컴포넌트·팝오버가 공유) */
export const NO_GROUP_NAME = '미분류';

/** 한 공간 안을 그룹별로 묶은 한 덩어리. groupId === null 은 "그룹 없음". */
export type GroupBucket = {
  groupId: string | null;
  name: string;
  sections: DaySections;
  count: CompletionCount;
};

/** 그룹 계산에 필요한 메타(살아있는 그룹만, position 순으로 넘긴다) */
type GroupMeta = { id: string; name: string };

/**
 * 특정 공간 화면: 그 공간의 tasks를 그룹별로 묶어 각각 섹션과 완료 카운트를 계산한다.
 * groupSectionsBySpace와 대칭 구조.
 * - 입력 `tasks`는 이미 한 공간으로 필터된 배열이어야 한다.
 * - 그룹 순서는 넘겨받은 groups 순서를 따른다.
 * - 마지막에 "그룹 없음" 버킷을 항상 덧붙인다: groupId가 없거나, 살아있지 않은(소프트 삭제된)
 *   그룹을 가리키는 항목들.
 * - 빈 그룹도 버킷을 반환한다(count.total === 0). 어떤 빈 버킷을 숨길지는 호출부가 정한다
 *   (오늘=모든 그룹 노출, 지난 날=항목이 있는 그룹만).
 */
export function groupSectionsByGroup(
  tasks: Task[],
  groups: GroupMeta[],
  viewedDate: string,
  today: string
): GroupBucket[] {
  const liveIds = new Set(groups.map((g) => g.id));
  const buckets: GroupBucket[] = [];

  for (const g of groups) {
    const sections = deriveSections(
      tasks.filter((t) => t.groupId === g.id),
      viewedDate,
      today
    );
    buckets.push({ groupId: g.id, name: g.name, sections, count: completionCount(sections) });
  }

  const ungrouped = deriveSections(
    tasks.filter((t) => t.groupId == null || !liveIds.has(t.groupId)),
    viewedDate,
    today
  );
  buckets.push({
    groupId: null,
    name: NO_GROUP_NAME,
    sections: ungrouped,
    count: completionCount(ungrouped),
  });

  return buckets;
}
