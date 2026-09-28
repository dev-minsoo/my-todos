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
