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
 */
export function deriveSections(tasks: Task[], viewedDate: string, today: string): DaySections {
  const items = tasks.filter(alive);
  const isToday = viewedDate === today;

  const open = items
    .filter((t) => t.completedAt == null && t.dueDate === viewedDate)
    .sort(byCreatedAsc);

  const carried: CarriedTask[] = isToday
    ? items
        .filter((t) => t.completedAt == null && t.dueDate < today)
        .map((t) => ({ ...t, overdueDays: daysBetween(t.dueDate, today) }))
        .sort(byCreatedAsc)
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
