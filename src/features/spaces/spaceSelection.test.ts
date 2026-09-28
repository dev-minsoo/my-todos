import { describe, expect, it } from 'vitest';
import { ALL_TAB, type Space } from '@/db/types';
import { nextSpacePosition, resolveActiveTab, targetSpaceId } from './spaceSelection';

function makeSpace(partial: Partial<Space> & { id: string }): Space {
  return {
    userId: 'u1',
    name: '공간',
    color: '#000',
    position: '0000000001',
    createdAt: '2026-09-28T00:00:00Z',
    updatedAt: '2026-09-28T00:00:00Z',
    deletedAt: null,
    ...partial,
  };
}

const personal = makeSpace({ id: 'p', name: '개인', position: '0000000001' });
const work = makeSpace({ id: 'w', name: '회사', position: '0000000002' });

describe('resolveActiveTab', () => {
  it('공간이 2개 이상이면 전체를 그대로 둔다', () => {
    expect(resolveActiveTab(ALL_TAB, [personal, work])).toBe(ALL_TAB);
  });

  it('공간이 1개면 전체 대신 그 공간을 고른다', () => {
    expect(resolveActiveTab(ALL_TAB, [personal])).toBe('p');
  });

  it('존재하지 않는 공간 id는 폴백한다', () => {
    expect(resolveActiveTab('stub-old', [personal, work])).toBe(ALL_TAB);
    expect(resolveActiveTab('stub-old', [personal])).toBe('p');
  });

  it('유효한 공간 id는 유지한다', () => {
    expect(resolveActiveTab('w', [personal, work])).toBe('w');
  });

  it('공간이 없으면 전체로 폴백', () => {
    expect(resolveActiveTab('x', [])).toBe(ALL_TAB);
  });
});

describe('targetSpaceId', () => {
  it('특정 공간 탭이면 그 공간', () => {
    expect(targetSpaceId('w', [personal, work], null)).toBe('w');
  });

  it('전체 탭이면 마지막 사용 공간 우선', () => {
    expect(targetSpaceId(ALL_TAB, [personal, work], 'w')).toBe('w');
  });

  it('전체 탭 + 마지막 공간이 없거나 무효면 첫 공간', () => {
    expect(targetSpaceId(ALL_TAB, [personal, work], null)).toBe('p');
    expect(targetSpaceId(ALL_TAB, [personal, work], 'gone')).toBe('p');
  });

  it('공간이 없으면 null', () => {
    expect(targetSpaceId(ALL_TAB, [], null)).toBeNull();
  });
});

describe('nextSpacePosition', () => {
  it('현재 최대 position + 1을 0-패딩으로', () => {
    expect(nextSpacePosition([personal, work])).toBe('0000000003');
  });

  it('공간이 없으면 1', () => {
    expect(nextSpacePosition([])).toBe('0000000001');
  });
});
