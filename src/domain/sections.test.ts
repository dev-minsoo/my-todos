import { describe, it, expect } from 'vitest';
import type { Task } from '@/db/types';
import { deriveSections, completionCount } from './sections';

let seq = 0;
function makeTask(partial: Partial<Task>): Task {
  seq += 1;
  return {
    id: `t${seq}`,
    userId: 'u1',
    spaceId: 's1',
    title: `task ${seq}`,
    dueDate: '2026-09-28',
    completedAt: null,
    position: 'a0',
    createdAt: `2026-09-28T00:00:0${seq % 10}`,
    updatedAt: '2026-09-28T00:00:00',
    deletedAt: null,
    ...partial,
  };
}

const TODAY = '2026-09-28';

describe('deriveSections (오늘 화면)', () => {
  it('open: 오늘 dueDate 미완료만', () => {
    const tasks = [
      makeTask({ dueDate: TODAY }),
      makeTask({ dueDate: TODAY, completedAt: '2026-09-28T09:00:00' }),
      makeTask({ dueDate: '2026-09-29' }),
    ];
    const s = deriveSections(tasks, TODAY, TODAY);
    expect(s.open).toHaveLength(1);
  });

  it('carried: 지난 날 미완료가 넘어옴으로, overdueDays 계산', () => {
    const tasks = [
      makeTask({ dueDate: '2026-09-26' }), // 2일 전
      makeTask({ dueDate: '2026-09-27' }), // 1일 전
    ];
    const s = deriveSections(tasks, TODAY, TODAY);
    expect(s.carried).toHaveLength(2);
    expect(s.carried[0].overdueDays).toBe(2);
    expect(s.carried[1].overdueDays).toBe(1);
  });

  it('completed: 오늘 완료한 항목은 dueDate와 무관하게 완료 섹션', () => {
    const tasks = [
      makeTask({ dueDate: '2026-09-25', completedAt: '2026-09-28T10:00:00' }),
    ];
    const s = deriveSections(tasks, TODAY, TODAY);
    expect(s.completed).toHaveLength(1);
    expect(s.carried).toHaveLength(0); // 완료됐으니 넘어오지 않는다
  });

  it('소프트 삭제된 항목은 제외', () => {
    const tasks = [makeTask({ dueDate: TODAY, deletedAt: '2026-09-28T00:00:00' })];
    const s = deriveSections(tasks, TODAY, TODAY);
    expect(s.open).toHaveLength(0);
  });
});

describe('deriveSections (지난 날 화면)', () => {
  it('지난 날에는 carried가 없고, 그날 완료 항목만 완료 섹션', () => {
    const viewed = '2026-09-27';
    const tasks = [
      makeTask({ dueDate: '2026-09-26' }), // 미완료 과거 → 지난 날엔 carried 아님
      makeTask({ dueDate: '2026-09-27', completedAt: '2026-09-27T10:00:00' }),
    ];
    const s = deriveSections(tasks, viewed, TODAY);
    expect(s.carried).toHaveLength(0);
    expect(s.completed).toHaveLength(1);
  });
});

describe('completionCount', () => {
  it('total = carried + open + completed, done = completed', () => {
    const tasks = [
      makeTask({ dueDate: '2026-09-27' }), // carried
      makeTask({ dueDate: TODAY }), // open
      makeTask({ dueDate: TODAY, completedAt: '2026-09-28T10:00:00' }), // completed
    ];
    const s = deriveSections(tasks, TODAY, TODAY);
    expect(completionCount(s)).toEqual({ total: 3, done: 1 });
  });
});
