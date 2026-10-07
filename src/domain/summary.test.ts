import { describe, it, expect } from 'vitest';
import type { Task } from '@/db/types';
import { deriveSections } from './sections';
import { formatDaySummary } from './summary';

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
    position: `a${seq}`,
    memo: null,
    parentId: null,
    recurrenceId: null,
    createdAt: `2026-09-28T00:00:0${seq % 10}`,
    updatedAt: '2026-09-28T00:00:00',
    deletedAt: null,
    ...partial,
  };
}

const TODAY = '2026-09-28';
const sectionsOf = (tasks: Task[]) => deriveSections(tasks, TODAY, TODAY);

describe('formatDaySummary', () => {
  it('단일 블록: 머리글 + 넘어옴→할 일→완료 순, 제목 접두 없음', () => {
    const sections = sectionsOf([
      makeTask({ title: '우유 사기', dueDate: '2026-09-26' }), // 넘어옴(2일 지남)
      makeTask({ title: '회의 준비', dueDate: TODAY }), // 할 일
      makeTask({ title: '메일 보내기', dueDate: TODAY, completedAt: '2026-09-28T10:00:00' }), // 완료
    ]);
    const text = formatDaySummary('9월 28일 (월)', [{ sections }]);
    expect(text).toBe(
      [
        '9월 28일 (월) · 1/3 완료',
        '- [ ] 우유 사기 (2일 지남)',
        '- [ ] 회의 준비',
        '- [x] 메일 보내기',
      ].join('\n')
    );
  });

  it('다중 블록: 각 블록 앞에 "# 공간명"을 붙이고 빈 줄로 띄운다', () => {
    const personal = sectionsOf([makeTask({ title: '개인 일', dueDate: TODAY })]);
    const work = sectionsOf([
      makeTask({ title: '회사 일', dueDate: TODAY, completedAt: '2026-09-28T09:00:00' }),
    ]);
    const text = formatDaySummary('9월 28일 (월)', [
      { title: '개인', sections: personal },
      { title: '회사', sections: work },
    ]);
    expect(text).toBe(
      [
        '9월 28일 (월) · 1/2 완료',
        '',
        '# 개인',
        '- [ ] 개인 일',
        '',
        '# 회사',
        '- [x] 회사 일',
      ].join('\n')
    );
  });

  it('넘어옴에는 (N일 지남) 주석을 붙인다', () => {
    const sections = sectionsOf([makeTask({ title: '밀린 일', dueDate: '2026-09-20' })]);
    const text = formatDaySummary('9월 28일 (월)', [{ sections }]);
    expect(text).toContain('- [ ] 밀린 일 (8일 지남)');
  });

  it('취소 섹션은 빼고, 카운트에도 넣지 않는다 (취소 중립)', () => {
    const sections = sectionsOf([
      makeTask({ title: '남은 일', dueDate: TODAY }),
      makeTask({ title: '취소한 일', dueDate: TODAY, cancelledAt: '2026-09-28T11:00:00' }),
    ]);
    const text = formatDaySummary('9월 28일 (월)', [{ sections }]);
    expect(text).not.toContain('취소한 일');
    expect(text).toBe(['9월 28일 (월) · 0/1 완료', '- [ ] 남은 일'].join('\n'));
  });

  it('다중 블록에서 보여 줄 게 없는 블록은 제목째로 생략한다', () => {
    const personal = sectionsOf([makeTask({ title: '개인 일', dueDate: TODAY })]);
    const emptyWork = sectionsOf([]);
    const text = formatDaySummary('9월 28일 (월)', [
      { title: '개인', sections: personal },
      { title: '회사', sections: emptyWork },
    ]);
    expect(text).toContain('# 개인');
    expect(text).not.toContain('# 회사');
  });

  it('빈 입력은 머리글만 (0/0 완료, 크래시 없음)', () => {
    expect(formatDaySummary('9월 28일 (월)', [{ sections: sectionsOf([]) }])).toBe(
      '9월 28일 (월) · 0/0 완료'
    );
    expect(formatDaySummary('9월 28일 (월)', [])).toBe('9월 28일 (월) · 0/0 완료');
  });
});
