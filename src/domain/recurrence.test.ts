import { describe, it, expect } from 'vitest';
import type { Recurrence, Task } from '@/db/types';
import {
  parseRule,
  ruleLabel,
  occursOn,
  virtualOccurrences,
  isVirtualOccurrence,
  recurrenceIdOf,
  virtualId,
} from './recurrence';

let seq = 0;
function makeRec(partial: Partial<Recurrence>): Recurrence {
  seq += 1;
  return {
    id: `r${seq}`,
    userId: 'u1',
    spaceId: 's1',
    groupId: null,
    title: `반복 ${seq}`,
    rule: { type: 'daily' },
    startDate: '2026-09-01',
    position: 'a0',
    createdAt: '2026-09-01T00:00:00',
    updatedAt: '2026-09-01T00:00:00',
    deletedAt: null,
    ...partial,
  };
}

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
    createdAt: '2026-09-28T00:00:00',
    updatedAt: '2026-09-28T00:00:00',
    deletedAt: null,
    ...partial,
  };
}

// 요일 참고: 2026-09-28 = 월요일(getDay 1), 09-29 화, 09-30 수, 10-01 목, 10-02 금, 10-03 토, 10-04 일
const MON = '2026-09-28';
const TUE = '2026-09-29';
const WED = '2026-09-30';
const SUN = '2026-10-04';

describe('parseRule (jsonb 방어적 파싱)', () => {
  it('정상 daily', () => {
    expect(parseRule({ type: 'daily' })).toEqual({ type: 'daily' });
  });

  it('정상 weekly: 중복 제거·정렬', () => {
    expect(parseRule({ type: 'weekly', weekdays: [5, 1, 1, 3] })).toEqual({
      type: 'weekly',
      weekdays: [1, 3, 5],
    });
  });

  it('범위 밖·비정수 요일은 걸러낸다', () => {
    expect(parseRule({ type: 'weekly', weekdays: [1, 7, -1, 2.5, 'x', 6] })).toEqual({
      type: 'weekly',
      weekdays: [1, 6],
    });
  });

  it('유효 요일이 하나도 없는 weekly는 매일로 폴백', () => {
    expect(parseRule({ type: 'weekly', weekdays: [] })).toEqual({ type: 'daily' });
    expect(parseRule({ type: 'weekly', weekdays: [9, 'nope'] })).toEqual({ type: 'daily' });
  });

  it('불량/누락/미지원 입력은 매일로 폴백', () => {
    expect(parseRule(null)).toEqual({ type: 'daily' });
    expect(parseRule(undefined)).toEqual({ type: 'daily' });
    expect(parseRule('daily')).toEqual({ type: 'daily' });
    expect(parseRule({})).toEqual({ type: 'daily' });
    expect(parseRule({ type: 'monthly' })).toEqual({ type: 'daily' });
  });
});

describe('ruleLabel', () => {
  it('매일', () => {
    expect(ruleLabel({ type: 'daily' })).toBe('매일');
  });
  it('요일 나열(정렬)', () => {
    expect(ruleLabel({ type: 'weekly', weekdays: [5, 1, 3] })).toBe('월·수·금');
  });
  it('7요일 전부면 매일', () => {
    expect(ruleLabel({ type: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6] })).toBe('매일');
  });
});

describe('occursOn', () => {
  it('시작일 이전에는 안 뜬다', () => {
    const rec = makeRec({ rule: { type: 'daily' }, startDate: TUE });
    expect(occursOn(rec, MON)).toBe(false);
    expect(occursOn(rec, TUE)).toBe(true);
    expect(occursOn(rec, WED)).toBe(true);
  });

  it('매일: 시작일 이후 항상', () => {
    const rec = makeRec({ rule: { type: 'daily' }, startDate: '2026-09-01' });
    expect(occursOn(rec, MON)).toBe(true);
    expect(occursOn(rec, SUN)).toBe(true);
  });

  it('매주 특정 요일: 그 요일에만', () => {
    const rec = makeRec({ rule: { type: 'weekly', weekdays: [1, 3] }, startDate: '2026-09-01' }); // 월·수
    expect(occursOn(rec, MON)).toBe(true); // 월
    expect(occursOn(rec, TUE)).toBe(false); // 화
    expect(occursOn(rec, WED)).toBe(true); // 수
  });

  it('매주라도 시작일 경계는 지킨다', () => {
    const rec = makeRec({ rule: { type: 'weekly', weekdays: [1] }, startDate: TUE }); // 월 반복이지만 시작 화요일
    expect(occursOn(rec, MON)).toBe(false); // 시작 전
  });
});

describe('virtualOccurrences', () => {
  it('매칭 반복마다 가상 Task 1개, 필드 승계', () => {
    const rec = makeRec({
      id: 'rx',
      spaceId: 's2',
      groupId: 'g1',
      title: '운동',
      rule: { type: 'daily' },
      startDate: '2026-09-01',
      position: 'a5',
    });
    const virts = virtualOccurrences([rec], [], MON, { userId: 'u9' });
    expect(virts).toHaveLength(1);
    const v = virts[0];
    expect(v.id).toBe(virtualId('rx', MON));
    expect(v.spaceId).toBe('s2');
    expect(v.groupId).toBe('g1');
    expect(v.title).toBe('운동');
    expect(v.dueDate).toBe(MON);
    expect(v.completedAt).toBeNull();
    expect(v.cancelledAt).toBeNull(); // 가상분은 취소도 없음(실체화 전)
    expect(v.recurrenceId).toBe('rx');
    expect(v.position).toBe('a5');
    expect(v.userId).toBe('u9');
    expect(isVirtualOccurrence(v)).toBe(true);
  });

  it('이미 그날 실체화된 반복은 건너뛴다', () => {
    const rec = makeRec({ id: 'rx', rule: { type: 'daily' } });
    const real = makeTask({ recurrenceId: 'rx', dueDate: MON });
    const virts = virtualOccurrences([rec], [real], MON, { userId: 'u1' });
    expect(virts).toHaveLength(0);
  });

  it('다른 날짜에 실체화된 것은 그날 발생분을 막지 않는다', () => {
    const rec = makeRec({ id: 'rx', rule: { type: 'daily' } });
    const realTue = makeTask({ recurrenceId: 'rx', dueDate: TUE });
    const virts = virtualOccurrences([rec], [realTue], MON, { userId: 'u1' });
    expect(virts).toHaveLength(1); // 월요일 발생분은 여전히 나온다
  });

  it('그날 건너뜀(soft-deleted 실체 행)이면 가상분이 다시 뜨지 않는다', () => {
    // deleteTask(가상)가 남긴 삭제된 행 = "오늘은 건너뜀". 이 반복은 그날 처리 완료로 본다.
    const rec = makeRec({ id: 'rx', rule: { type: 'daily' } });
    const skipped = makeTask({ recurrenceId: 'rx', dueDate: MON, deletedAt: '2026-09-28T10:00:00' });
    const virts = virtualOccurrences([rec], [skipped], MON, { userId: 'u1' });
    expect(virts).toHaveLength(0);
  });

  it('시작일 이전 날짜에는 가상분이 없다', () => {
    const rec = makeRec({ id: 'rx', rule: { type: 'daily' }, startDate: TUE });
    expect(virtualOccurrences([rec], [], MON, { userId: 'u1' })).toHaveLength(0);
    expect(virtualOccurrences([rec], [], TUE, { userId: 'u1' })).toHaveLength(1);
  });

  it('요일이 안 맞으면 가상분이 없다', () => {
    const rec = makeRec({ id: 'rx', rule: { type: 'weekly', weekdays: [3] } }); // 수요일만
    expect(virtualOccurrences([rec], [], MON, { userId: 'u1' })).toHaveLength(0);
    expect(virtualOccurrences([rec], [], WED, { userId: 'u1' })).toHaveLength(1);
  });

  it('소프트 삭제된 반복 규칙은 발생분을 만들지 않는다', () => {
    const rec = makeRec({ id: 'rx', rule: { type: 'daily' }, deletedAt: '2026-09-20T00:00:00' });
    expect(virtualOccurrences([rec], [], MON, { userId: 'u1' })).toHaveLength(0);
  });

  it('id는 recId·date로 안정적(재계산해도 동일)', () => {
    const rec = makeRec({ id: 'rx', rule: { type: 'daily' } });
    const a = virtualOccurrences([rec], [], MON, { userId: 'u1' })[0];
    const b = virtualOccurrences([rec], [], MON, { userId: 'u1' })[0];
    expect(a.id).toBe(b.id);
  });
});

describe('isVirtualOccurrence / recurrenceIdOf', () => {
  it('가상분 판별', () => {
    expect(isVirtualOccurrence({ id: 'virt:rx:2026-09-28' })).toBe(true);
    expect(isVirtualOccurrence({ id: 'real-uuid' })).toBe(false);
  });
  it('recurrenceIdOf: 가상/실체 모두에서 추출, 일반은 null', () => {
    expect(recurrenceIdOf({ recurrenceId: 'rx' })).toBe('rx');
    expect(recurrenceIdOf({ recurrenceId: null })).toBeNull();
  });
});
