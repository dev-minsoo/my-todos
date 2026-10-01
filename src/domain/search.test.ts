import { describe, it, expect } from 'vitest';
import type { Task } from '@/db/types';
import { searchTasks } from './search';

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
    cancelledAt: null,
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

describe('searchTasks', () => {
  it('제목 부분 일치로 거른다', () => {
    const tasks = [
      makeTask({ title: '보험 서류 제출' }),
      makeTask({ title: '치과 예약 전화' }),
      makeTask({ title: '장보기' }),
    ];
    const r = searchTasks(tasks, '예약');
    expect(r.map((t) => t.title)).toEqual(['치과 예약 전화']);
  });

  it('대소문자를 무시한다', () => {
    const tasks = [makeTask({ title: 'Review PR' }), makeTask({ title: '장보기' })];
    expect(searchTasks(tasks, 'review')).toHaveLength(1);
    expect(searchTasks(tasks, 'PR')).toHaveLength(1);
    expect(searchTasks(tasks, 'pr')).toHaveLength(1);
  });

  it('앞뒤 공백을 무시한다', () => {
    const tasks = [makeTask({ title: '장보기' })];
    expect(searchTasks(tasks, '  장보기  ')).toHaveLength(1);
  });

  it('공백으로 나눈 여러 단어는 AND 매칭 (순서 무관)', () => {
    const tasks = [
      makeTask({ title: '치과 예약 전화' }),
      makeTask({ title: '치과 결제' }),
      makeTask({ title: '예약 확인' }),
    ];
    const r = searchTasks(tasks, '치과 전화');
    expect(r.map((t) => t.title)).toEqual(['치과 예약 전화']);
    // 순서를 바꿔도 같은 결과
    expect(searchTasks(tasks, '전화 치과').map((t) => t.title)).toEqual(['치과 예약 전화']);
  });

  it('빈 쿼리(공백만)는 빈 결과', () => {
    const tasks = [makeTask({ title: '장보기' })];
    expect(searchTasks(tasks, '')).toEqual([]);
    expect(searchTasks(tasks, '   ')).toEqual([]);
  });

  it('일치하는 항목이 없으면 빈 배열', () => {
    const tasks = [makeTask({ title: '장보기' })];
    expect(searchTasks(tasks, '없는단어')).toEqual([]);
  });

  it('공간·날짜와 무관하게 전체에서 찾는다', () => {
    const tasks = [
      makeTask({ title: '회의 준비', spaceId: 's-work', dueDate: '2026-08-01' }),
      makeTask({ title: '회의록 정리', spaceId: 's-home', dueDate: '2026-10-15' }),
    ];
    expect(searchTasks(tasks, '회의')).toHaveLength(2);
  });

  it('결과를 dueDate 내림차순으로 정렬한다 (최근 날짜 먼저)', () => {
    const tasks = [
      makeTask({ title: '회의 1', dueDate: '2026-09-01' }),
      makeTask({ title: '회의 2', dueDate: '2026-09-30' }),
      makeTask({ title: '회의 3', dueDate: '2026-09-15' }),
    ];
    expect(searchTasks(tasks, '회의').map((t) => t.dueDate)).toEqual([
      '2026-09-30',
      '2026-09-15',
      '2026-09-01',
    ]);
  });

  it('같은 dueDate면 createdAt 내림차순으로 정렬한다', () => {
    const tasks = [
      makeTask({ title: '회의 A', dueDate: '2026-09-10', createdAt: '2026-09-10T08:00:00' }),
      makeTask({ title: '회의 B', dueDate: '2026-09-10', createdAt: '2026-09-10T20:00:00' }),
    ];
    expect(searchTasks(tasks, '회의').map((t) => t.title)).toEqual(['회의 B', '회의 A']);
  });

  it('완료된 항목도 검색된다 (completedAt 무관)', () => {
    const tasks = [
      makeTask({ title: '보고서', completedAt: '2026-09-28T10:00:00' }),
      makeTask({ title: '보고서 초안' }),
    ];
    expect(searchTasks(tasks, '보고서')).toHaveLength(2);
  });

  it('입력 배열을 변형하지 않는다', () => {
    const tasks = [
      makeTask({ title: '회의 1', dueDate: '2026-09-01' }),
      makeTask({ title: '회의 2', dueDate: '2026-09-30' }),
    ];
    const before = tasks.map((t) => t.id);
    searchTasks(tasks, '회의');
    expect(tasks.map((t) => t.id)).toEqual(before);
  });
});
