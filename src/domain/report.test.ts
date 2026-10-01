import { describe, it, expect } from 'vitest';
import type { Group, Recurrence, Space, Task } from '@/db/types';
import { buildReport, normalizeTitle, type ReportInput } from './report';
import type { DateRange } from './period';

// 기준: 2026년 9월(이번 달) = [2026-09-01, 2026-10-01), 오늘 = 2026-09-30.
const RANGE: DateRange = { start: '2026-09-01', end: '2026-10-01' };
const TODAY = '2026-09-30';

function space(over: Partial<Space> = {}): Space {
  return {
    id: 's1',
    userId: 'u',
    name: '개인',
    color: '#2f6df6',
    position: '1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...over,
  };
}

function group(over: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    userId: 'u',
    spaceId: 's1',
    name: '건강',
    position: '1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...over,
  };
}

function recurrence(over: Partial<Recurrence> = {}): Recurrence {
  return {
    id: 'r1',
    userId: 'u',
    spaceId: 's1',
    groupId: null,
    title: '매일 운동',
    rule: { type: 'daily' },
    startDate: '2026-09-05',
    position: '1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...over,
  };
}

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't',
    userId: 'u',
    spaceId: 's1',
    groupId: null,
    title: '할 일',
    dueDate: '2026-09-15',
    completedAt: null,
    cancelledAt: null,
    position: '1',
    memo: null,
    parentId: null,
    recurrenceId: null,
    createdAt: '2026-09-15T08:00:00.000Z',
    updatedAt: '2026-09-15T08:00:00.000Z',
    deletedAt: null,
    ...over,
  };
}

const SPACES = [space({ id: 's1', name: '개인', color: '#p' }), space({ id: 's2', name: '회사', color: '#c' })];
const GROUPS = [group({ id: 'g1', spaceId: 's1', name: '건강' })];

/** 대표 시나리오 데이터 */
function scenarioTasks(): Task[] {
  return [
    // 정시 완료 (s1/g1)
    task({ id: 't1', title: 'A', spaceId: 's1', groupId: 'g1', dueDate: '2026-09-10', completedAt: '2026-09-10T09:00:00.000Z', createdAt: '2026-09-10T08:00:00.000Z' }),
    // 늦은 완료 5일 (s1)
    task({ id: 't2', title: 'B', spaceId: 's1', dueDate: '2026-09-20', completedAt: '2026-09-25T09:00:00.000Z', createdAt: '2026-09-20T08:00:00.000Z' }),
    // 미수행 (s2)
    task({ id: 't3', title: 'C', spaceId: 's2', dueDate: '2026-09-15', completedAt: null, createdAt: '2026-09-15T08:00:00.000Z' }),
    // 마감은 기간 밖(8월)인데 이 기간에 완료 → 완료/밀림엔 잡히고 마감분엔 안 잡힘
    task({ id: 't4', title: 'D', spaceId: 's1', dueDate: '2026-08-20', completedAt: '2026-09-05T09:00:00.000Z', createdAt: '2026-08-20T08:00:00.000Z' }),
    // 습관(반복 출신) 완료 → 완료/추이엔 포함, 마감분엔 제외
    task({ id: 'ht', title: '운동', spaceId: 's1', groupId: 'g1', recurrenceId: 'r1', dueDate: '2026-09-07', completedAt: '2026-09-07T09:00:00.000Z', createdAt: '2026-09-07T08:00:00.000Z' }),
    // 빈도: 정규화하면 같은 제목 2개
    task({ id: 'f1', title: '물 마시기', spaceId: 's1', dueDate: '2026-09-02', createdAt: '2026-09-02T08:00:00.000Z' }),
    task({ id: 'f2', title: '  물   마시기 ', spaceId: 's1', dueDate: '2026-09-03', createdAt: '2026-09-03T08:00:00.000Z' }),
    // 빈도: 1회뿐 → 제외
    task({ id: 'f3', title: '산책', spaceId: 's1', dueDate: '2026-09-04', createdAt: '2026-09-04T08:00:00.000Z' }),
  ];
}

function run(over: Partial<ReportInput> = {}) {
  return buildReport({
    tasks: scenarioTasks(),
    recurrences: [],
    spaces: SPACES,
    groups: GROUPS,
    range: RANGE,
    today: TODAY,
    ...over,
  });
}

describe('normalizeTitle', () => {
  it('앞뒤·연속 공백을 정리하고 소문자로', () => {
    expect(normalizeTitle('  물   마시기 ')).toBe('물 마시기');
    expect(normalizeTitle('Read Book')).toBe('read book');
  });
});

describe('buildReport summary', () => {
  it('완료수는 습관 포함 모든 기간 내 완료', () => {
    // t1, t2, t4, ht = 4 (t3 미완료, f* 미완료)
    expect(run().summary.completed).toBe(4);
  });

  it('등록수는 기간 내 생성된 모든 항목(8월 생성 t4 제외)', () => {
    // t1,t2,t3,ht,f1,f2,f3 = 7
    expect(run().summary.registered).toBe(7);
  });

  it('마감분 이행률/미수행은 일반 할 일만(습관 제외)', () => {
    const s = run().summary;
    // due ∈ range & 반복 아님: t1,t2,t3,f1,f2,f3 = 6 (t4는 마감 8월, ht는 습관)
    expect(s.dueTotal).toBe(6);
    expect(s.dueDone).toBe(2); // t1,t2만 완료
    expect(s.missed).toBe(4); // t3,f1,f2,f3
    expect(s.adherenceRate).toBeCloseTo(2 / 6, 5);
  });

  it('평균 밀림은 기간 내 완료한 일반 할 일 중 늦은 것들의 평균', () => {
    // t2: 5일 늦음, t4: 16일 늦음, t1: 0(정시). 습관 제외 → (5+16)/2 = 10.5
    expect(run().summary.avgLateDays).toBeCloseTo(10.5, 5);
  });

  it('마감분이 없으면 이행률 0', () => {
    const r = buildReport({ tasks: [], recurrences: [], spaces: SPACES, groups: GROUPS, range: RANGE, today: TODAY });
    expect(r.summary.dueTotal).toBe(0);
    expect(r.summary.adherenceRate).toBe(0);
    expect(r.summary.avgLateDays).toBe(0);
  });

  it('취소한 할 일은 마감분(분모)·미수행에서 빠진다 (미이행이 아님)', () => {
    // 기간 내 마감 일반 할 일 2개: 하나는 미완료, 하나는 취소.
    const tasks = [
      task({ id: 'm1', dueDate: '2026-09-10', completedAt: null }), // 미수행
      task({ id: 'm2', dueDate: '2026-09-11', completedAt: null, cancelledAt: '2026-09-12T09:00:00.000Z' }), // 취소 → 분모 밖
    ];
    const s = run({ tasks }).summary;
    expect(s.dueTotal).toBe(1); // m1만
    expect(s.dueDone).toBe(0);
    expect(s.missed).toBe(1); // 취소는 미수행에 안 들어간다
  });
});

describe('buildReport activity', () => {
  it('구간의 모든 날 버킷을 만들고 완료를 해당 날에 센다', () => {
    const a = run().activity;
    expect(a).toHaveLength(30); // 9월 30일
    const at = (d: string) => a.find((x) => x.date === d)!.completed;
    expect(at('2026-09-05')).toBe(1); // t4
    expect(at('2026-09-07')).toBe(1); // ht(습관도 활동에 포함)
    expect(at('2026-09-10')).toBe(1); // t1
    expect(at('2026-09-25')).toBe(1); // t2
    expect(at('2026-09-15')).toBe(0); // t3 미완료
    expect(a.reduce((sum, x) => sum + x.completed, 0)).toBe(4); // 합 = 완료수
  });
});

describe('buildReport 분포', () => {
  it('공간별 완료 분포(완료 0인 공간 제외, 내림차순)', () => {
    const bs = run().bySpace;
    expect(bs).toHaveLength(1); // s2는 완료 0
    expect(bs[0]).toMatchObject({ id: 's1', name: '개인', color: '#p', count: 4 });
  });

  it('그룹별 완료 분포(null은 미분류 버킷)', () => {
    const bg = run().byGroup;
    const g1 = bg.find((x) => x.id === 'g1')!;
    const none = bg.find((x) => x.id === null)!;
    expect(g1).toMatchObject({ name: '건강', count: 2 }); // t1, ht
    expect(none).toMatchObject({ name: '미분류', count: 2 }); // t2, t4
  });
});

describe('buildReport frequency', () => {
  it('정규화 기준 2회 이상만, 첫 등장 원문으로 표시', () => {
    const f = run().frequency;
    expect(f).toHaveLength(1);
    expect(f[0]).toEqual({ title: '물 마시기', count: 2 });
  });

  it('습관(반복 출신)은 빈도에서 제외', () => {
    // 같은 제목 습관 2개를 넣어도 빈도에 안 잡힌다
    const tasks = [
      task({ id: 'h1', title: '스트레칭', recurrenceId: 'r1', dueDate: '2026-09-02', createdAt: '2026-09-02T08:00:00.000Z' }),
      task({ id: 'h2', title: '스트레칭', recurrenceId: 'r1', dueDate: '2026-09-03', createdAt: '2026-09-03T08:00:00.000Z' }),
    ];
    expect(run({ tasks }).frequency).toHaveLength(0);
  });
});

describe('buildReport habits (E)', () => {
  it('규칙으로 발생일을 재계산하고 완료한 날과 대조한다', () => {
    const r = run({
      tasks: scenarioTasks(),
      recurrences: [recurrence({ id: 'r1', rule: { type: 'daily' }, startDate: '2026-09-05' })],
    });
    expect(r.habits).toHaveLength(1);
    // 매일, 09-05~09-30 = 26일. ht(due 09-07)만 완료 → 1/26
    expect(r.habits[0]).toMatchObject({ id: 'r1', ruleLabel: '매일', occurrences: 26, done: 1 });
    expect(r.habits[0].rate).toBeCloseTo(1 / 26, 5);
  });

  it('매주 규칙은 해당 요일만 발생으로 센다', () => {
    const r = buildReport({
      tasks: [],
      recurrences: [recurrence({ id: 'rw', title: '월요일 회의', rule: { type: 'weekly', weekdays: [1] }, startDate: '2026-09-01' })],
      spaces: SPACES,
      groups: GROUPS,
      range: RANGE,
      today: TODAY,
    });
    // 2026년 9월 월요일: 07,14,21,28 = 4회
    expect(r.habits[0]).toMatchObject({ occurrences: 4, done: 0, ruleLabel: '월' });
  });

  it('미래 날짜는 아직 발생으로 세지 않는다(today까지만)', () => {
    const r = buildReport({
      tasks: [],
      recurrences: [recurrence({ id: 'rd', rule: { type: 'daily' }, startDate: '2026-09-01' })],
      spaces: SPACES,
      groups: GROUPS,
      range: RANGE,
      today: '2026-09-10', // 오늘을 앞당김
    });
    // 09-01~09-10 = 10일까지만
    expect(r.habits[0].occurrences).toBe(10);
  });
});
