// "앞으로 N일" 미리보기 — 순수 함수. 저장하지 않는 파생 뷰다.
// 넘어옴·반복과 같은 compute-on-view 사상으로, 내일부터 span일을 날짜별로 돌며
// 그날 예정된(미완·미취소) 할 일 + 반복 가상 발생분을 모은다. 빈 날짜는 버린다.
import type { Recurrence, Task } from '@/db/types';
import { addDaysStr } from './dayBoundary';
import { daysOf } from './period';
import { deriveSections } from './sections';
import { virtualOccurrences } from './recurrence';

/** 한 날짜의 예정 묶음. items는 position 순(deriveSections.open 정렬). */
export type UpcomingDay = { date: string; items: Task[] };

/**
 * 오늘 이후 span일(내일부터)의 예정을 날짜별로 묶는다.
 *
 * - 범위: 반열림 [내일, 내일+span) = 내일부터 span일. 오늘은 하루 화면이 담당하므로 제외한다.
 * - 각 날짜 d: deriveSections(실제 할 일 + 그날 반복 가상분, d, today).open
 *   → dueDate === d 이고 미완·미취소인 것만. 미래 날짜라 넘어옴(carried)은 비고, 완료/취소는 자연 제외된다.
 * - 날짜 미정('나중에', dueDate null)은 구간이 없어 애초에 어떤 날에도 안 걸린다 → someday 페이지 담당.
 * - 빈 날짜는 결과에서 뺀다.
 *
 * 순수 함수: 입력을 변형하지 않는다. 공간 스코프는 호출부가 미리 걸러 tasks·recurrences로 넘긴다.
 * recurrenceSkips(소프트 삭제된 건너뜀 표식)는 가상분 중복 방지 판정에만 쓴다(virtualOccurrences).
 */
export function upcomingDays(opts: {
  tasks: Task[];
  recurrences: Recurrence[];
  recurrenceSkips: Task[];
  today: string;
  span: number;
  userId: string;
}): UpcomingDay[] {
  const { tasks, recurrences, recurrenceSkips, today, span, userId } = opts;
  const days = daysOf({ start: addDaysStr(today, 1), end: addDaysStr(today, span + 1) });
  const detect = [...tasks, ...recurrenceSkips];

  const out: UpcomingDay[] = [];
  for (const d of days) {
    const withVirtual = [...tasks, ...virtualOccurrences(recurrences, detect, d, { userId })];
    const items = deriveSections(withVirtual, d, today).open;
    if (items.length > 0) out.push({ date: d, items });
  }
  return out;
}
