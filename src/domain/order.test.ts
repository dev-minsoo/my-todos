import { describe, it, expect } from 'vitest';
import {
  INITIAL_POSITION,
  isValidPosition,
  positionAfter,
  positionBefore,
  positionBetween,
  maxValidPosition,
} from './order';

describe('INITIAL_POSITION', () => {
  it("빈 목록의 첫 키는 'a0'", () => {
    expect(INITIAL_POSITION).toBe('a0');
  });
});

describe('isValidPosition', () => {
  it('유효한 fractional 키는 true', () => {
    expect(isValidPosition('a0')).toBe(true);
    expect(isValidPosition('a1')).toBe(true);
    expect(isValidPosition('Zz')).toBe(true);
  });

  it('레거시/빈/누락 값은 false', () => {
    expect(isValidPosition(String(Date.now()))).toBe(false); // "1727..." 숫자 문자열
    expect(isValidPosition('0000000001')).toBe(false); // 0-패딩 정수
    expect(isValidPosition('')).toBe(false);
    expect(isValidPosition(null)).toBe(false);
    expect(isValidPosition(undefined)).toBe(false);
  });
});

describe('positionAfter (맨 끝 append)', () => {
  it('빈 목록이면 초기 키', () => {
    expect(positionAfter(null)).toBe(INITIAL_POSITION);
    expect(positionAfter(undefined)).toBe(INITIAL_POSITION);
  });

  it('마지막 뒤에 오는 더 큰 키', () => {
    const first = positionAfter(null); // a0
    const second = positionAfter(first);
    expect(second > first).toBe(true);
  });

  it('연속 append는 계속 오름차순', () => {
    const keys: string[] = [];
    let last: string | null = null;
    for (let i = 0; i < 20; i++) {
      last = positionAfter(last);
      keys.push(last);
    }
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted); // 이미 정렬돼 있어야 한다
    expect(new Set(keys).size).toBe(keys.length); // 중복 없음
  });

  it('레거시 마지막 키는 초기 키로 폴백(예외 없음)', () => {
    expect(positionAfter('1727598123456')).toBe(INITIAL_POSITION);
  });
});

describe('positionBefore (맨 앞 prepend)', () => {
  it('앞에 오는 더 작은 키', () => {
    const key = positionBefore('a0');
    expect(key < 'a0').toBe(true);
  });

  it('빈 목록이면 초기 키', () => {
    expect(positionBefore(null)).toBe(INITIAL_POSITION);
  });
});

describe('positionBetween (사이 삽입)', () => {
  it('두 키 사이의 값', () => {
    const a = 'a0';
    const b = positionAfter(a); // a1
    const mid = positionBetween(a, b);
    expect(a < mid).toBe(true);
    expect(mid < b).toBe(true);
  });

  it('양쪽이 열려 있으면 초기 키', () => {
    expect(positionBetween(null, null)).toBe(INITIAL_POSITION);
  });

  it('앞만 있으면 뒤에, 뒤만 있으면 앞에', () => {
    expect(positionBetween('a0', null) > 'a0').toBe(true);
    expect(positionBetween(null, 'a0') < 'a0').toBe(true);
  });

  it('반복 사이 삽입도 항상 두 값 사이를 유지', () => {
    let lo = 'a0';
    const hi = positionAfter('a0'); // a1
    for (let i = 0; i < 30; i++) {
      const mid = positionBetween(lo, hi);
      expect(lo < mid && mid < hi).toBe(true);
      lo = mid;
    }
  });

  it('유효하지 않은 이웃은 열린 경계로 취급', () => {
    // 앞이 레거시(무효) → null 취급 → after보다 작은 유효 키
    const key = positionBetween('1727598123456', 'a0');
    expect(isValidPosition(key)).toBe(true);
    expect(key < 'a0').toBe(true);
  });

  it('순서가 꼬이거나(before >= after) 같으면 before 뒤에 붙인다', () => {
    const a = 'a0';
    const b = positionAfter(a); // a1
    const flipped = positionBetween(b, a); // b > a
    expect(flipped > b).toBe(true);
    const same = positionBetween(a, a);
    expect(same > a).toBe(true);
  });
});

describe('maxValidPosition (목록 맨 끝 찾기)', () => {
  it('유효한 것 중 사전식 최대', () => {
    expect(maxValidPosition(['a0', 'a2', 'a1'])).toBe('a2');
  });

  it('레거시/무효 값은 무시', () => {
    expect(maxValidPosition(['1727598123456', 'a0', '0000000001'])).toBe('a0');
  });

  it('유효 값이 없으면 null', () => {
    expect(maxValidPosition([])).toBeNull();
    expect(maxValidPosition(['1727598123456', '', null, undefined])).toBeNull();
  });

  it('positionAfter(maxValidPosition(...))로 맨 끝 append', () => {
    const positions = ['a0', 'a1'];
    const next = positionAfter(maxValidPosition(positions));
    expect(positions.every((p) => p < next)).toBe(true);
  });
});
