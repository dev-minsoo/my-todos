import { describe, expect, it } from 'vitest';
import { getDay, parseISO } from 'date-fns';
import type { Task } from '@/db/types';
import {
  completedSpaceIds,
  dayStat,
  monthGridDays,
  shiftMonth,
  shiftWeek,
  weekGridDays,
} from './calendar';

function mkTask(p: Partial<Task>): Task {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'u',
    spaceId: 's',
    title: 't',
    dueDate: '2026-09-10',
    completedAt: null,
    position: '1',
    createdAt: '2026-09-10T00:00:00',
    updatedAt: '2026-09-10T00:00:00',
    deletedAt: null,
    ...p,
  };
}

describe('monthGridDays', () => {
  it('주 단위(7의 배수)로 채운 격자를 만든다', () => {
    const days = monthGridDays('2026-09-15');
    expect(days.length % 7).toBe(0);
    expect(days.length).toBeGreaterThanOrEqual(28);
  });

  it('첫 칸은 일요일, 마지막 칸은 토요일이다', () => {
    const days = monthGridDays('2026-09-15');
    expect(getDay(parseISO(days[0]))).toBe(0);
    expect(getDay(parseISO(days[days.length - 1]))).toBe(6);
  });

  it('해당 달의 1일과 말일을 포함한다', () => {
    const days = monthGridDays('2026-09-15');
    expect(days).toContain('2026-09-01');
    expect(days).toContain('2026-09-30');
  });

  it('오름차순으로 연속된 날짜다', () => {
    const days = monthGridDays('2026-02-15');
    for (let i = 1; i < days.length; i++) {
      expect(days[i] > days[i - 1]).toBe(true);
    }
  });
});

describe('weekGridDays', () => {
  it('7일을 만든다', () => {
    expect(weekGridDays('2026-09-15')).toHaveLength(7);
  });

  it('첫 칸은 일요일이고 기준일을 포함한다', () => {
    const days = weekGridDays('2026-09-15');
    expect(getDay(parseISO(days[0]))).toBe(0);
    expect(days).toContain('2026-09-15');
  });

  it('연말을 걸친 주도 옳게 만든다', () => {
    const days = weekGridDays('2026-12-31');
    expect(days).toHaveLength(7);
    expect(getDay(parseISO(days[0]))).toBe(0);
    expect(days).toContain('2026-12-31');
    expect(days).toContain('2027-01-01');
    for (let i = 1; i < days.length; i++) expect(days[i] > days[i - 1]).toBe(true);
  });
});

describe('shiftMonth / shiftWeek', () => {
  it('shiftMonth는 그 달 1일 기준으로 이동한다', () => {
    expect(shiftMonth('2026-09-15', 1)).toBe('2026-10-01');
    expect(shiftMonth('2026-09-15', -1)).toBe('2026-08-01');
  });

  it('shiftMonth는 연말·연초 경계를 넘는다', () => {
    expect(shiftMonth('2026-12-15', 1)).toBe('2027-01-01');
    expect(shiftMonth('2026-01-10', -1)).toBe('2025-12-01');
  });

  it('shiftMonth는 말일 기준이어도 다음 달 1일로 정규화된다', () => {
    // 1/31 + 1개월이 2/28로 밀리는 흔한 함정을 피한다
    expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('shiftWeek는 7일 단위로 이동한다', () => {
    expect(shiftWeek('2026-09-15', 1)).toBe('2026-09-22');
    expect(shiftWeek('2026-09-15', -1)).toBe('2026-09-08');
  });

  it('shiftWeek는 월·연 경계를 넘는다', () => {
    expect(shiftWeek('2026-12-30', 1)).toBe('2027-01-06');
    expect(shiftWeek('2026-01-03', -1)).toBe('2025-12-27');
  });
});

describe('dayStat', () => {
  const today = '2026-09-28';

  it('빈 목록이면 0/0, rate 0', () => {
    expect(dayStat([], '2026-09-10', today)).toEqual({ total: 0, done: 0, rate: 0 });
  });

  it('그날 완료율을 하루 화면과 동일하게 계산한다', () => {
    const tasks = [
      mkTask({ dueDate: '2026-09-10' }), // 미완료(open)
      mkTask({ dueDate: '2026-09-10', completedAt: '2026-09-10T12:00:00' }), // 그날 완료
    ];
    const s = dayStat(tasks, '2026-09-10', today);
    expect(s.total).toBe(2);
    expect(s.done).toBe(1);
    expect(s.rate).toBeCloseTo(0.5);
  });

  it('완료 항목은 완료 시각의 날짜에 귀속된다(마감일이 아님)', () => {
    const tasks = [mkTask({ dueDate: '2026-09-05', completedAt: '2026-09-10T12:00:00' })];
    expect(dayStat(tasks, '2026-09-10', today).done).toBe(1);
    expect(dayStat(tasks, '2026-09-05', today).total).toBe(0);
  });

  it('삭제된 항목은 세지 않는다', () => {
    const tasks = [mkTask({ dueDate: '2026-09-10', deletedAt: '2026-09-11T00:00:00' })];
    expect(dayStat(tasks, '2026-09-10', today).total).toBe(0);
  });
});

describe('completedSpaceIds', () => {
  it('그날 완료된 공간 id만 중복 없이 모은다', () => {
    const tasks = [
      mkTask({ spaceId: 'a', completedAt: '2026-09-10T09:00:00' }),
      mkTask({ spaceId: 'a', completedAt: '2026-09-10T15:00:00' }), // 같은 공간 중복
      mkTask({ spaceId: 'b', completedAt: '2026-09-10T20:00:00' }),
      mkTask({ spaceId: 'c', completedAt: '2026-09-11T09:00:00' }), // 다른 날
      mkTask({ spaceId: 'd', completedAt: null }), // 미완료
    ];
    const ids = completedSpaceIds(tasks, '2026-09-10');
    expect(ids).toHaveLength(2);
    expect(new Set(ids)).toEqual(new Set(['a', 'b']));
  });

  it('완료가 없으면 빈 배열', () => {
    expect(completedSpaceIds([mkTask({ completedAt: null })], '2026-09-10')).toEqual([]);
  });
});
