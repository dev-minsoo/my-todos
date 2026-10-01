import { describe, it, expect } from 'vitest';
import type { Task } from '@/db/types';
import { somedayTasks } from './someday';

let seq = 0;
function makeTask(partial: Partial<Task>): Task {
  seq += 1;
  return {
    id: `t${seq}`,
    userId: 'u1',
    spaceId: 's1',
    groupId: null,
    title: `task ${seq}`,
    dueDate: null, // 이 파일은 '날짜 미정'이 기본 — 날짜 있는 항목은 명시로 넣는다
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

describe("somedayTasks ('나중에' = 날짜 미정 + 열림)", () => {
  it('dueDate가 null이고 미완료·미취소인 항목만 추린다', () => {
    const open1 = makeTask({ title: '언젠가 할 일 1' });
    const open2 = makeTask({ title: '언젠가 할 일 2' });
    const r = somedayTasks([open1, open2]);
    expect(r.map((t) => t.title)).toEqual(['언젠가 할 일 1', '언젠가 할 일 2']);
  });

  it('날짜가 있는 항목은 제외한다 (하루 화면이 담당)', () => {
    const tasks = [
      makeTask({ title: '날짜 미정' }),
      makeTask({ title: '오늘 할 일', dueDate: '2026-09-28' }),
    ];
    expect(somedayTasks(tasks).map((t) => t.title)).toEqual(['날짜 미정']);
  });

  it('완료한 날짜 미정 항목은 제외한다 (그날 완료 섹션으로 귀속)', () => {
    const tasks = [
      makeTask({ title: '열림' }),
      makeTask({ title: '완료함', completedAt: '2026-09-28T10:00:00' }),
    ];
    expect(somedayTasks(tasks).map((t) => t.title)).toEqual(['열림']);
  });

  it('취소한 날짜 미정 항목은 제외한다 (그날 취소 섹션으로 귀속)', () => {
    const tasks = [
      makeTask({ title: '열림' }),
      makeTask({ title: '취소함', cancelledAt: '2026-09-28T11:00:00' }),
    ];
    expect(somedayTasks(tasks).map((t) => t.title)).toEqual(['열림']);
  });

  it('소프트 삭제된 항목은 제외한다', () => {
    const tasks = [
      makeTask({ title: '살아있음' }),
      makeTask({ title: '삭제됨', deletedAt: '2026-09-28T00:00:00' }),
    ];
    expect(somedayTasks(tasks).map((t) => t.title)).toEqual(['살아있음']);
  });

  it('position 사전식 오름차순으로 정렬한다', () => {
    const tasks = [
      makeTask({ title: 'C', position: 'c0' }),
      makeTask({ title: 'A', position: 'a0' }),
      makeTask({ title: 'B', position: 'b0' }),
    ];
    expect(somedayTasks(tasks).map((t) => t.title)).toEqual(['A', 'B', 'C']);
  });

  it('position이 같으면 created_at 오름차순으로 폴백한다', () => {
    const tasks = [
      makeTask({ title: '나중', position: 'a0', createdAt: '2026-09-28T20:00:00' }),
      makeTask({ title: '먼저', position: 'a0', createdAt: '2026-09-28T08:00:00' }),
    ];
    expect(somedayTasks(tasks).map((t) => t.title)).toEqual(['먼저', '나중']);
  });

  it('입력 배열을 변형하지 않는다', () => {
    const tasks = [
      makeTask({ title: 'C', position: 'c0' }),
      makeTask({ title: 'A', position: 'a0' }),
    ];
    const before = tasks.map((t) => t.id);
    somedayTasks(tasks);
    expect(tasks.map((t) => t.id)).toEqual(before);
  });

  it('빈 입력은 빈 배열', () => {
    expect(somedayTasks([])).toEqual([]);
  });
});
