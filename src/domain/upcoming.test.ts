import { describe, it, expect } from 'vitest';
import type { Recurrence, Task } from '@/db/types';
import { upcomingDays } from './upcoming';

const TODAY = '2026-10-08';
const USER = 'u1';

let seq = 0;
function makeTask(partial: Partial<Task>): Task {
  seq += 1;
  return {
    id: `t${seq}`,
    userId: USER,
    spaceId: 's1',
    groupId: null,
    title: `task ${seq}`,
    dueDate: null,
    completedAt: null,
    cancelledAt: null,
    position: `a${seq}`,
    memo: null,
    parentId: null,
    recurrenceId: null,
    createdAt: `2026-10-01T00:00:0${seq % 10}`,
    updatedAt: '2026-10-01T00:00:00',
    deletedAt: null,
    ...partial,
  };
}

let rseq = 0;
function makeRec(partial: Partial<Recurrence>): Recurrence {
  rseq += 1;
  return {
    id: `r${rseq}`,
    userId: USER,
    spaceId: 's1',
    groupId: null,
    title: `rec ${rseq}`,
    rule: { type: 'daily' },
    startDate: '2026-10-01',
    position: `a${rseq}`,
    createdAt: '2026-10-01T00:00:00',
    updatedAt: '2026-10-01T00:00:00',
    deletedAt: null,
    ...partial,
  };
}

function run(tasks: Task[], span: number, recurrences: Recurrence[] = [], recurrenceSkips: Task[] = []) {
  return upcomingDays({ tasks, recurrences, recurrenceSkips, today: TODAY, span, userId: USER });
}

describe('upcomingDays', () => {
  it('미래 dueDate를 날짜별로 묶고 오름차순 정렬한다', () => {
    const tasks = [
      makeTask({ title: 'A', dueDate: '2026-10-11' }),
      makeTask({ title: 'B', dueDate: '2026-10-09', position: 'a1' }),
      makeTask({ title: 'C', dueDate: '2026-10-09', position: 'a2' }),
    ];
    const r = run(tasks, 7);
    expect(r.map((g) => g.date)).toEqual(['2026-10-09', '2026-10-11']);
    expect(r[0].items.map((t) => t.title)).toEqual(['B', 'C']); // position 순
    expect(r[1].items.map((t) => t.title)).toEqual(['A']);
  });

  it('오늘·과거 dueDate는 제외한다', () => {
    const tasks = [
      makeTask({ title: '과거', dueDate: '2026-10-07' }),
      makeTask({ title: '오늘', dueDate: TODAY }),
      makeTask({ title: '미래', dueDate: '2026-10-10' }),
    ];
    const r = run(tasks, 7);
    expect(r.map((g) => g.date)).toEqual(['2026-10-10']);
    expect(r[0].items.map((t) => t.title)).toEqual(['미래']);
  });

  it('완료·취소된 미래 할 일은 제외한다', () => {
    const tasks = [
      makeTask({ title: '열림', dueDate: '2026-10-10' }),
      makeTask({ title: '완료', dueDate: '2026-10-10', completedAt: '2026-10-09T10:00:00' }),
      makeTask({ title: '취소', dueDate: '2026-10-10', cancelledAt: '2026-10-09T10:00:00' }),
    ];
    const r = run(tasks, 7);
    expect(r.map((g) => g.date)).toEqual(['2026-10-10']);
    expect(r[0].items.map((t) => t.title)).toEqual(['열림']);
  });

  it('날짜 미정(dueDate null)은 어떤 날에도 안 걸린다', () => {
    const tasks = [
      makeTask({ title: '나중에', dueDate: null }),
      makeTask({ title: '미래', dueDate: '2026-10-10' }),
    ];
    const r = run(tasks, 7);
    expect(r.map((g) => g.date)).toEqual(['2026-10-10']);
  });

  it('빈 날짜는 결과에서 뺀다 (예정 전무면 빈 배열)', () => {
    expect(run([], 7)).toEqual([]);
    expect(run([makeTask({ dueDate: TODAY })], 7)).toEqual([]);
  });

  it('반복(daily)은 미래 각 날짜에 가상 발생분으로 뜬다', () => {
    const recs = [makeRec({ title: '운동', rule: { type: 'daily' }, startDate: '2026-10-01' })];
    const r = run([], 3, recs);
    expect(r.map((g) => g.date)).toEqual(['2026-10-09', '2026-10-10', '2026-10-11']);
    for (const g of r) {
      expect(g.items.map((t) => t.title)).toEqual(['운동']);
    }
  });

  it('그날 실체화된 실제 행이 있으면 가상분이 중복되지 않는다', () => {
    const recs = [makeRec({ id: 'rX', title: '운동', rule: { type: 'daily' }, startDate: '2026-10-01' })];
    const real = makeTask({ title: '운동(실체)', dueDate: '2026-10-10', recurrenceId: 'rX' });
    const r = run([real], 3, recs);
    const oct10 = r.find((g) => g.date === '2026-10-10');
    expect(oct10?.items.map((t) => t.title)).toEqual(['운동(실체)']); // 가상 중복 없음
  });

  it('span 경계: 마지막 날은 포함, 그다음 날은 제외 (반열림)', () => {
    const tasks = [
      makeTask({ title: '경계안', dueDate: '2026-10-15' }), // today+7 → 포함
      makeTask({ title: '경계밖', dueDate: '2026-10-16' }), // today+8 → 제외
    ];
    const r = run(tasks, 7);
    expect(r.map((g) => g.date)).toEqual(['2026-10-15']);
  });

  it('입력 배열을 변형하지 않는다', () => {
    const tasks = [makeTask({ dueDate: '2026-10-10' }), makeTask({ dueDate: '2026-10-11' })];
    const before = tasks.map((t) => t.id);
    run(tasks, 7);
    expect(tasks.map((t) => t.id)).toEqual(before);
  });
});
