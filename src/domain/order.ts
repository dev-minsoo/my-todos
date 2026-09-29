// 순서(position) 계산 — fractional-indexing을 감싼 순수 헬퍼.
// position은 사전식으로 정렬 가능한 문자열 키다. 두 이웃 사이/맨 끝/맨 앞에
// 들어갈 키를 한 번의 update만으로 만들어 낸다(다른 행은 건드리지 않는다).
//
// v0.1 초기 데이터는 position에 레거시 값(예: Date.now() 문자열, 0-패딩 정수)이
// 들어 있을 수 있다. 이런 값은 fractional-indexing 키로 유효하지 않으므로,
// 아래 헬퍼들은 유효하지 않은 이웃을 "열린 경계(null)"로 취급해 예외 없이 동작한다.
import { generateKeyBetween } from 'fractional-indexing';

/** 목록이 비었을 때 첫 항목의 position. generateKeyBetween(null, null) === 'a0'. */
export const INITIAL_POSITION = generateKeyBetween(null, null);

/**
 * fractional-indexing 키로 유효한지 검사한다.
 * 라이브러리에 검증 함수가 없어 generateKeyBetween을 try/catch로 감싼다.
 * (유효한 키에는 항상 다음 키가 존재하므로 하한으로 넣어 형식만 확인한다.)
 */
export function isValidPosition(key: string | null | undefined): key is string {
  if (key == null || key === '') return false;
  try {
    generateKeyBetween(key, null);
    return true;
  } catch {
    return false;
  }
}

/** 유효한 position만 남긴다. */
function clean(key: string | null | undefined): string | null {
  return isValidPosition(key) ? key : null;
}

/** 목록 맨 끝(last 다음)에 붙일 키. last가 없거나 유효하지 않으면 초기 키('a0'). */
export function positionAfter(last: string | null | undefined): string {
  return generateKeyBetween(clean(last), null);
}

/** 목록 맨 앞(first 이전)에 붙일 키. first가 없거나 유효하지 않으면 초기 키. */
export function positionBefore(first: string | null | undefined): string {
  return generateKeyBetween(null, clean(first));
}

/**
 * 두 이웃(before < after) 사이에 들어갈 키.
 * - 유효하지 않은 이웃은 열린 경계로 취급한다.
 * - 순서가 꼬였거나(before >= after: 레거시 혼재 등) 같으면 안전하게 before 뒤에 붙인다.
 */
export function positionBetween(
  before: string | null | undefined,
  after: string | null | undefined
): string {
  const lo = clean(before);
  const hi = clean(after);
  if (lo != null && hi != null && lo >= hi) {
    return generateKeyBetween(lo, null);
  }
  return generateKeyBetween(lo, hi);
}

/**
 * 주어진 position들 중 사전식으로 가장 큰(=목록 맨 끝) 유효한 키를 고른다.
 * 유효한 값이 하나도 없으면 null. (positionAfter와 함께 "맨 끝에 append"에 쓴다.)
 */
export function maxValidPosition(positions: Array<string | null | undefined>): string | null {
  let max: string | null = null;
  for (const p of positions) {
    if (isValidPosition(p) && (max === null || p > max)) max = p;
  }
  return max;
}
