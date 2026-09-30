import { describe, it, expect } from 'vitest';
import { daysOf, inRange, periodRange, type DateRange } from './period';

// 기준일: 2026-09-30(수요일). 주 시작 = 일요일.
const TODAY = '2026-09-30';

describe('periodRange', () => {
  it('이번 주 = 일요일 시작, end는 다음 주 일요일(제외)', () => {
    // 2026-09-30(수) 이 속한 주: 일 2026-09-27 ~ 다음 일 2026-10-04
    expect(periodRange('thisWeek', TODAY)).toEqual<DateRange>({
      start: '2026-09-27',
      end: '2026-10-04',
    });
  });

  it('지난 주 = 이번 주의 한 주 전', () => {
    expect(periodRange('lastWeek', TODAY)).toEqual<DateRange>({
      start: '2026-09-20',
      end: '2026-09-27',
    });
  });

  it('이번 달 = 1일 시작, end는 다음 달 1일(제외)', () => {
    expect(periodRange('thisMonth', TODAY)).toEqual<DateRange>({
      start: '2026-09-01',
      end: '2026-10-01',
    });
  });

  it('지난 달 = 저번 달 1일 ~ 이번 달 1일(제외)', () => {
    expect(periodRange('lastMonth', TODAY)).toEqual<DateRange>({
      start: '2026-08-01',
      end: '2026-09-01',
    });
  });

  it('연말/연초 경계도 이번 달을 올바르게 넘긴다', () => {
    expect(periodRange('thisMonth', '2026-12-15')).toEqual<DateRange>({
      start: '2026-12-01',
      end: '2027-01-01',
    });
    expect(periodRange('lastMonth', '2027-01-10')).toEqual<DateRange>({
      start: '2026-12-01',
      end: '2027-01-01',
    });
  });
});

describe('inRange', () => {
  const r: DateRange = { start: '2026-09-27', end: '2026-10-04' };
  it('start는 포함, end는 제외(반열림)', () => {
    expect(inRange('2026-09-27', r)).toBe(true);
    expect(inRange('2026-10-03', r)).toBe(true);
    expect(inRange('2026-10-04', r)).toBe(false); // end 제외
    expect(inRange('2026-09-26', r)).toBe(false);
  });
});

describe('daysOf', () => {
  it('구간의 모든 날을 순서대로 돌려준다(반열림)', () => {
    const days = daysOf({ start: '2026-09-27', end: '2026-10-04' });
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-09-27');
    expect(days[6]).toBe('2026-10-03');
  });

  it('한 달 구간은 그 달의 일수만큼', () => {
    expect(daysOf({ start: '2026-09-01', end: '2026-10-01' })).toHaveLength(30);
    expect(daysOf({ start: '2026-02-01', end: '2026-03-01' })).toHaveLength(28);
  });
});
