import { describe, it, expect } from 'vitest';
import {
  toDateStr,
  todayStr,
  completionDay,
  cancellationDay,
  daysBetween,
  addDaysStr,
} from './dayBoundary';

describe('dayBoundary', () => {
  it('toDateStr: Date를 로컬 YYYY-MM-DD로', () => {
    // 로컬 자정 기준 (월은 0-based)
    expect(toDateStr(new Date(2026, 8, 28))).toBe('2026-09-28');
  });

  it('todayStr: 주입한 now의 날짜', () => {
    expect(todayStr(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('completionDay: 시각을 그 날짜로 (오프셋 없는 ISO는 로컬 해석)', () => {
    expect(completionDay('2026-09-28T15:30:00')).toBe('2026-09-28');
    expect(completionDay('2026-09-28T00:01:00')).toBe('2026-09-28');
  });

  it('cancellationDay: 취소 시각을 그 날짜로 (completionDay와 대칭)', () => {
    expect(cancellationDay('2026-09-28T15:30:00')).toBe('2026-09-28');
    expect(cancellationDay('2026-09-28T00:01:00')).toBe('2026-09-28');
  });

  it('daysBetween: to - from 달력 일수', () => {
    expect(daysBetween('2026-09-26', '2026-09-28')).toBe(2);
    expect(daysBetween('2026-09-28', '2026-09-28')).toBe(0);
    expect(daysBetween('2026-09-28', '2026-09-26')).toBe(-2);
  });

  it('addDaysStr: 날짜 이동', () => {
    expect(addDaysStr('2026-09-28', 1)).toBe('2026-09-29');
    expect(addDaysStr('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDaysStr('2026-09-01', -1)).toBe('2026-08-31');
  });
});
