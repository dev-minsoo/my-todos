import { describe, it, expect } from 'vitest';
import type { Task } from '@/db/types';
import { searchTasks, taskStatus } from './search';

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

  it('날짜 미정(dueDate null)은 내림차순에서 맨 뒤로 정렬한다', () => {
    const tasks = [
      makeTask({ title: '회의 미정', dueDate: null }),
      makeTask({ title: '회의 늦음', dueDate: '2026-09-30' }),
      makeTask({ title: '회의 이름', dueDate: '2026-09-01' }),
    ];
    expect(searchTasks(tasks, '회의').map((t) => t.title)).toEqual([
      '회의 늦음',
      '회의 이름',
      '회의 미정',
    ]);
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

  describe('filters', () => {
    it('status: open — 미완만 거른다', () => {
      const tasks = [
        makeTask({ title: '회의 미완' }),
        makeTask({ title: '회의 완료', completedAt: '2026-09-28T10:00:00' }),
        makeTask({ title: '회의 취소', cancelledAt: '2026-09-28T10:00:00' }),
      ];
      const r = searchTasks(tasks, '회의', { status: 'open' });
      expect(r.map((t) => t.title)).toEqual(['회의 미완']);
    });

    it('status: done — 완료만 거른다', () => {
      const tasks = [
        makeTask({ title: '회의 미완' }),
        makeTask({ title: '회의 완료', completedAt: '2026-09-28T10:00:00' }),
        makeTask({ title: '회의 취소', cancelledAt: '2026-09-28T10:00:00' }),
      ];
      const r = searchTasks(tasks, '회의', { status: 'done' });
      expect(r.map((t) => t.title)).toEqual(['회의 완료']);
    });

    it('status: cancelled — 취소만 거른다', () => {
      const tasks = [
        makeTask({ title: '회의 미완' }),
        makeTask({ title: '회의 완료', completedAt: '2026-09-28T10:00:00' }),
        makeTask({ title: '회의 취소', cancelledAt: '2026-09-28T10:00:00' }),
      ];
      const r = searchTasks(tasks, '회의', { status: 'cancelled' });
      expect(r.map((t) => t.title)).toEqual(['회의 취소']);
    });

    it('spaceIds — 지정한 공간만 거른다', () => {
      const tasks = [
        makeTask({ title: '회의 개인', spaceId: 's-home' }),
        makeTask({ title: '회의 회사', spaceId: 's-work' }),
      ];
      const r = searchTasks(tasks, '회의', { spaceIds: new Set(['s-work']) });
      expect(r.map((t) => t.title)).toEqual(['회의 회사']);
    });

    it('빈 spaceIds Set은 공간으로 거르지 않는다 (= 전체)', () => {
      const tasks = [
        makeTask({ title: '회의 개인', spaceId: 's-home' }),
        makeTask({ title: '회의 회사', spaceId: 's-work' }),
      ];
      expect(searchTasks(tasks, '회의', { spaceIds: new Set() })).toHaveLength(2);
    });

    it('range — 반열림 [start, end) 경계로 거르고, 날짜 미정은 제외한다', () => {
      const tasks = [
        makeTask({ title: '회의 전날', dueDate: '2026-08-31' }), // start 직전 → 제외
        makeTask({ title: '회의 시작일', dueDate: '2026-09-01' }), // 포함
        makeTask({ title: '회의 마지막날', dueDate: '2026-09-30' }), // 포함
        makeTask({ title: '회의 끝경계', dueDate: '2026-10-01' }), // end(제외)
        makeTask({ title: '회의 미정', dueDate: null }), // 날짜 미정 → 제외
      ];
      const r = searchTasks(tasks, '회의', {
        range: { start: '2026-09-01', end: '2026-10-01' },
      });
      expect(r.map((t) => t.title)).toEqual(['회의 마지막날', '회의 시작일']);
    });

    it('복합 — 쿼리 + 상태 + 공간을 모두 AND로 좁힌다', () => {
      const tasks = [
        makeTask({ title: '보고서 초안', spaceId: 's-work' }),
        makeTask({ title: '보고서 제출', spaceId: 's-work', completedAt: '2026-09-28T10:00:00' }),
        makeTask({ title: '보고서 개인', spaceId: 's-home', completedAt: '2026-09-28T10:00:00' }),
      ];
      const r = searchTasks(tasks, '보고서', {
        status: 'done',
        spaceIds: new Set(['s-work']),
      });
      expect(r.map((t) => t.title)).toEqual(['보고서 제출']);
    });

    it('filters 미전달·전 필드 null이면 기존 결과와 같다 (회귀)', () => {
      const tasks = [
        makeTask({ title: '회의 1', dueDate: '2026-09-01' }),
        makeTask({ title: '회의 2', dueDate: '2026-09-30' }),
      ];
      const base = searchTasks(tasks, '회의').map((t) => t.title);
      expect(searchTasks(tasks, '회의', {}).map((t) => t.title)).toEqual(base);
      expect(
        searchTasks(tasks, '회의', { status: null, spaceIds: null, range: null }).map((t) => t.title)
      ).toEqual(base);
    });

    it('빈 쿼리는 필터가 있어도 빈 결과', () => {
      const tasks = [makeTask({ title: '회의', spaceId: 's-work' })];
      expect(searchTasks(tasks, '', { status: 'open', spaceIds: new Set(['s-work']) })).toEqual([]);
    });
  });

  describe('taskStatus', () => {
    it('완료·취소 유무로 상태를 판정한다 (취소 우선)', () => {
      expect(taskStatus(makeTask({}))).toBe('open');
      expect(taskStatus(makeTask({ completedAt: '2026-09-28T10:00:00' }))).toBe('done');
      expect(taskStatus(makeTask({ cancelledAt: '2026-09-28T10:00:00' }))).toBe('cancelled');
    });
  });
});
