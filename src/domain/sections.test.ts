import { describe, it, expect } from 'vitest';
import type { Task } from '@/db/types';
import {
  deriveSections,
  completionCount,
  groupSectionsBySpace,
  groupSectionsByGroup,
  NO_GROUP_NAME,
} from './sections';

let seq = 0;
function makeTask(partial: Partial<Task>): Task {
  seq += 1;
  return {
    id: `t${seq}`,
    userId: 'u1',
    spaceId: 's1',
    groupId: null,
    title: `task ${seq}`,
    dueDate: '2026-09-28',
    completedAt: null,
    position: 'a0',
    memo: null,
    parentId: null,
    recurrenceId: null,
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

describe('deriveSections 반복 가드 (습관형: 안 넘어옴)', () => {
  it('반복 출신(recurrenceId 있음)의 과거 미완료 행은 carried에 안 잡힌다', () => {
    const tasks = [
      makeTask({ dueDate: '2026-09-26', recurrenceId: 'r1' }), // 실체화됐다 체크 해제된 과거 반복 행
      makeTask({ dueDate: '2026-09-26' }), // 일반 과거 미완료 (넘어옴)
    ];
    const s = deriveSections(tasks, TODAY, TODAY);
    expect(s.carried).toHaveLength(1); // 일반 항목만 넘어온다
    expect(s.carried[0].recurrenceId).toBeNull();
  });

  it('반복 출신도 open/completed에는 정상 포함된다', () => {
    const tasks = [
      makeTask({ dueDate: TODAY, recurrenceId: 'r1' }), // 오늘 발생분(실체화)
      makeTask({ dueDate: TODAY, recurrenceId: 'r2', completedAt: '2026-09-28T09:00:00' }), // 오늘 완료
    ];
    const s = deriveSections(tasks, TODAY, TODAY);
    expect(s.open).toHaveLength(1);
    expect(s.completed).toHaveLength(1);
  });
});

describe('deriveSections 정렬 (position 우선, created_at 폴백)', () => {
  it('open은 position 사전식 오름차순', () => {
    const tasks = [
      makeTask({ dueDate: TODAY, position: 'a2', title: '셋째' }),
      makeTask({ dueDate: TODAY, position: 'a0', title: '첫째' }),
      makeTask({ dueDate: TODAY, position: 'a1', title: '둘째' }),
    ];
    const s = deriveSections(tasks, TODAY, TODAY);
    expect(s.open.map((t) => t.title)).toEqual(['첫째', '둘째', '셋째']);
  });

  it('position이 동률이면 created_at 순으로 폴백', () => {
    const tasks = [
      makeTask({ dueDate: TODAY, position: 'a0', createdAt: '2026-09-28T00:00:05', title: '나중' }),
      makeTask({ dueDate: TODAY, position: 'a0', createdAt: '2026-09-28T00:00:01', title: '먼저' }),
    ];
    const s = deriveSections(tasks, TODAY, TODAY);
    expect(s.open.map((t) => t.title)).toEqual(['먼저', '나중']);
  });

  it('넘어옴도 position 순으로 정렬된다', () => {
    const tasks = [
      makeTask({ dueDate: '2026-09-26', position: 'a1', title: '뒤' }),
      makeTask({ dueDate: '2026-09-27', position: 'a0', title: '앞' }),
    ];
    const s = deriveSections(tasks, TODAY, TODAY);
    expect(s.carried.map((t) => t.title)).toEqual(['앞', '뒤']);
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

describe('groupSectionsBySpace (전체 탭)', () => {
  const SPACES = [
    { id: 's1', name: '개인', color: '#2f6df6' },
    { id: 's2', name: '회사', color: '#e0663b' },
  ];

  it('공간 순서대로 묶고, 카운트를 공간마다 따로 계산', () => {
    const tasks = [
      makeTask({ spaceId: 's1', dueDate: TODAY }), // 개인 open
      makeTask({ spaceId: 's1', dueDate: TODAY, completedAt: '2026-09-28T10:00:00' }), // 개인 completed
      makeTask({ spaceId: 's2', dueDate: TODAY }), // 회사 open
    ];
    const groups = groupSectionsBySpace(tasks, SPACES, TODAY, TODAY);
    expect(groups.map((g) => g.spaceId)).toEqual(['s1', 's2']);
    expect(groups[0].count).toEqual({ total: 2, done: 1 });
    expect(groups[1].count).toEqual({ total: 1, done: 0 });
  });

  it('항목이 없는 공간은 결과에서 제외', () => {
    const tasks = [makeTask({ spaceId: 's1', dueDate: TODAY })];
    const groups = groupSectionsBySpace(tasks, SPACES, TODAY, TODAY);
    expect(groups.map((g) => g.spaceId)).toEqual(['s1']);
  });

  it('회사 넘어옴이 개인 묶음에 섞이지 않는다', () => {
    const tasks = [
      makeTask({ spaceId: 's2', dueDate: '2026-09-26' }), // 회사 carried
      makeTask({ spaceId: 's1', dueDate: TODAY }), // 개인 open
    ];
    const groups = groupSectionsBySpace(tasks, SPACES, TODAY, TODAY);
    const personal = groups.find((g) => g.spaceId === 's1')!;
    const work = groups.find((g) => g.spaceId === 's2')!;
    expect(personal.sections.carried).toHaveLength(0);
    expect(work.sections.carried).toHaveLength(1);
  });
});

describe('groupSectionsByGroup (공간 안 그룹)', () => {
  // position 순으로 넘긴다고 가정 (호출부 책임)
  const GROUPS = [
    { id: 'g1', name: '건강' },
    { id: 'g2', name: '집안일' },
  ];

  it('그룹 순서대로 묶고, 맨 끝에 "그룹 없음" 버킷을 붙인다', () => {
    const tasks = [
      makeTask({ groupId: 'g1', dueDate: TODAY }),
      makeTask({ groupId: 'g2', dueDate: TODAY }),
      makeTask({ groupId: null, dueDate: TODAY }),
    ];
    const buckets = groupSectionsByGroup(tasks, GROUPS, TODAY, TODAY);
    expect(buckets.map((b) => b.groupId)).toEqual(['g1', 'g2', null]);
    expect(buckets[2].name).toBe(NO_GROUP_NAME);
  });

  it('빈 그룹도 버킷으로 반환한다(숨김은 호출부 몫)', () => {
    const tasks = [makeTask({ groupId: 'g1', dueDate: TODAY })];
    const buckets = groupSectionsByGroup(tasks, GROUPS, TODAY, TODAY);
    expect(buckets.map((b) => b.groupId)).toEqual(['g1', 'g2', null]);
    expect(buckets[1].count.total).toBe(0); // g2는 비어 있음
  });

  it('살아있는 그룹에 없는 group_id(소프트 삭제된 그룹)는 "그룹 없음"으로 떨어진다', () => {
    const tasks = [
      makeTask({ groupId: 'gone', dueDate: TODAY }), // GROUPS에 없는 id
      makeTask({ groupId: 'g1', dueDate: TODAY }),
    ];
    const buckets = groupSectionsByGroup(tasks, GROUPS, TODAY, TODAY);
    const none = buckets.find((b) => b.groupId === null)!;
    expect(none.count.total).toBe(1);
    expect(none.sections.open).toHaveLength(1);
  });

  it('그룹 카운트는 그룹마다 따로 계산된다(넘어옴 포함)', () => {
    const tasks = [
      makeTask({ groupId: 'g1', dueDate: '2026-09-26' }), // g1 carried
      makeTask({ groupId: 'g1', dueDate: TODAY, completedAt: '2026-09-28T10:00:00' }), // g1 completed
      makeTask({ groupId: 'g2', dueDate: TODAY }), // g2 open
    ];
    const buckets = groupSectionsByGroup(tasks, GROUPS, TODAY, TODAY);
    expect(buckets[0].count).toEqual({ total: 2, done: 1 }); // g1
    expect(buckets[1].count).toEqual({ total: 1, done: 0 }); // g2
  });

  it('그룹 안에서도 넘어옴은 오늘 화면에서만 잡힌다', () => {
    const tasks = [makeTask({ groupId: 'g1', dueDate: '2026-09-26' })];
    const onPast = groupSectionsByGroup(tasks, GROUPS, '2026-09-27', TODAY);
    expect(onPast[0].sections.carried).toHaveLength(0);
    const onToday = groupSectionsByGroup(tasks, GROUPS, TODAY, TODAY);
    expect(onToday[0].sections.carried).toHaveLength(1);
  });
});
