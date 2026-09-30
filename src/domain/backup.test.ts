import { describe, it, expect } from 'vitest';
import type { Group, Recurrence, Space, Task } from '@/db/types';
import {
  BACKUP_APP,
  BACKUP_VERSION,
  buildBackup,
  parseBackup,
  remapForImport,
  type BackupData,
} from './backup';

// ---- 픽스처 헬퍼(도메인 객체 직접 구성) ----

function space(over: Partial<Space> = {}): Space {
  return {
    id: 's1',
    userId: 'old-user',
    name: '개인',
    color: '#2f6df6',
    position: '0000000001',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...over,
  };
}

function group(over: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    userId: 'old-user',
    spaceId: 's1',
    name: '건강',
    position: '0000000001',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...over,
  };
}

function recurrence(over: Partial<Recurrence> = {}): Recurrence {
  return {
    id: 'r1',
    userId: 'old-user',
    spaceId: 's1',
    groupId: 'g1',
    title: '매일 운동',
    rule: { type: 'daily' },
    startDate: '2026-01-01',
    position: '0000000001',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...over,
  };
}

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    userId: 'old-user',
    spaceId: 's1',
    groupId: null,
    title: '할 일',
    dueDate: '2026-09-30',
    completedAt: null,
    position: '0000000001',
    memo: null,
    parentId: null,
    recurrenceId: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    deletedAt: null,
    ...over,
  };
}

/** 결정적 id 생성기(테스트에서 매핑을 예측 가능하게) */
function counter(): () => string {
  let n = 0;
  return () => `new-${++n}`;
}

describe('buildBackup', () => {
  it('앱·버전 봉투를 씌우고 데이터를 그대로 담는다', () => {
    const data: BackupData = { spaces: [space()], groups: [], recurrences: [], tasks: [] };
    const file = buildBackup(data);
    expect(file.app).toBe(BACKUP_APP);
    expect(file.version).toBe(BACKUP_VERSION);
    expect(typeof file.exportedAt).toBe('string');
    expect(Number.isNaN(Date.parse(file.exportedAt))).toBe(false);
    expect(file.data).toBe(data);
  });
});

describe('parseBackup', () => {
  const validFile = () => ({
    app: BACKUP_APP,
    version: 1,
    exportedAt: '2026-09-30T00:00:00.000Z',
    data: {
      spaces: [space()],
      groups: [group()],
      recurrences: [recurrence()],
      tasks: [task()],
    },
  });

  it('정상 파일을 파싱해 4개 배열을 돌려준다', () => {
    const data = parseBackup(validFile());
    expect(data.spaces).toHaveLength(1);
    expect(data.groups).toHaveLength(1);
    expect(data.recurrences).toHaveLength(1);
    expect(data.tasks).toHaveLength(1);
    expect(data.spaces[0].name).toBe('개인');
    expect(data.tasks[0].dueDate).toBe('2026-09-30');
  });

  it('불량 rule은 매일로 폴백한다', () => {
    const raw = validFile();
    raw.data.recurrences[0].rule = { type: 'garbage' } as never;
    const data = parseBackup(raw);
    expect(data.recurrences[0].rule).toEqual({ type: 'daily' });
  });

  it('객체가 아니면 형식 오류를 던진다', () => {
    expect(() => parseBackup(null)).toThrow('백업 파일 형식이 올바르지 않아요.');
    expect(() => parseBackup(42)).toThrow('백업 파일 형식이 올바르지 않아요.');
    expect(() => parseBackup([])).toThrow('백업 파일 형식이 올바르지 않아요.');
  });

  it('다른 앱 백업은 거절한다', () => {
    expect(() => parseBackup({ ...validFile(), app: 'other' })).toThrow(
      'My Todos 백업 파일이 아니에요.'
    );
  });

  it('지원하지 않는 버전은 거절한다', () => {
    expect(() => parseBackup({ ...validFile(), version: 2 })).toThrow(
      '지원하지 않는 백업 버전이에요.'
    );
  });

  it('data의 배열이 빠지면 형식 오류를 던진다', () => {
    const raw = validFile() as Record<string, unknown>;
    (raw.data as Record<string, unknown>).tasks = 'nope';
    expect(() => parseBackup(raw)).toThrow('백업 파일 형식이 올바르지 않아요.');
  });

  it('필수 필드가 없는 행은 형식 오류를 던진다', () => {
    const raw = validFile();
    delete (raw.data.tasks[0] as { title?: string }).title;
    expect(() => parseBackup(raw)).toThrow('백업 파일 형식이 올바르지 않아요.');
  });
});

describe('remapForImport', () => {
  const userId = 'current-user';

  function fixture(): BackupData {
    return {
      spaces: [space({ id: 's1' })],
      groups: [group({ id: 'g1', spaceId: 's1' })],
      recurrences: [recurrence({ id: 'r1', spaceId: 's1', groupId: 'g1' })],
      tasks: [
        task({ id: 't1', spaceId: 's1', groupId: 'g1', completedAt: '2026-09-10T00:00:00.000Z' }),
        task({ id: 't2', spaceId: 's1', groupId: 'g-missing', title: 't2' }),
        task({ id: 't3', spaceId: 's-missing', title: 't3' }), // 공간 없음 → 드롭
        task({ id: 't4', spaceId: 's1', recurrenceId: 'r1', title: 't4' }),
      ],
    };
  }

  it('모든 id를 새로 부여하고 서로 겹치지 않는다', () => {
    const out = remapForImport(fixture(), counter(), userId);
    const ids = [
      ...out.spaces.map((s) => s.id),
      ...out.groups.map((g) => g.id),
      ...out.recurrences.map((r) => r.id),
      ...out.tasks.map((t) => t.id),
    ];
    expect(new Set(ids).size).toBe(ids.length); // 전부 유일
    // 원본 id가 하나도 남지 않았다
    expect(ids).not.toContain('s1');
    expect(ids).not.toContain('g1');
    expect(ids).not.toContain('r1');
    expect(ids).not.toContain('t1');
  });

  it('user_id를 현재 유저로 스탬프하고 deleted_at은 null이다', () => {
    const out = remapForImport(fixture(), counter(), userId);
    for (const row of [...out.spaces, ...out.groups, ...out.recurrences, ...out.tasks]) {
      expect(row.user_id).toBe(userId);
      expect(row.deleted_at).toBeNull();
    }
  });

  it('공간이 없는 행(그룹/반복/할 일)은 드롭한다', () => {
    const out = remapForImport(fixture(), counter(), userId);
    expect(out.spaces).toHaveLength(1);
    expect(out.groups).toHaveLength(1);
    expect(out.recurrences).toHaveLength(1);
    expect(out.tasks).toHaveLength(3); // t3(공간 없음) 제외
    expect(out.tasks.map((t) => t.title)).not.toContain('t3');
  });

  it('FK를 새 id로 다시 잇는다', () => {
    const out = remapForImport(fixture(), counter(), userId);
    const spaceId = out.spaces[0].id;
    const groupId = out.groups[0].id;
    const recId = out.recurrences[0].id;

    expect(out.groups[0].space_id).toBe(spaceId);
    expect(out.recurrences[0].space_id).toBe(spaceId);
    expect(out.recurrences[0].group_id).toBe(groupId);

    const t1 = out.tasks.find((t) => t.title === '할 일')!;
    expect(t1.space_id).toBe(spaceId);
    expect(t1.group_id).toBe(groupId);

    const t4 = out.tasks.find((t) => t.title === 't4')!;
    expect(t4.recurrence_id).toBe(recId);
  });

  it('매핑에 없는 group/recurrence 참조는 null로 만든다', () => {
    const out = remapForImport(fixture(), counter(), userId);
    const t2 = out.tasks.find((t) => t.title === 't2')!;
    expect(t2.group_id).toBeNull(); // g-missing → null
    expect(t2.recurrence_id).toBeNull();
  });

  it('completed_at·due_date를 보존한다', () => {
    const out = remapForImport(fixture(), counter(), userId);
    const t1 = out.tasks.find((t) => t.title === '할 일')!;
    expect(t1.completed_at).toBe('2026-09-10T00:00:00.000Z');
    expect(t1.due_date).toBe('2026-09-30');
  });

  it('서브태스크의 parent_id를 부모의 새 id로 다시 잇고 memo를 보존한다', () => {
    const data: BackupData = {
      spaces: [space({ id: 's1' })],
      groups: [],
      recurrences: [],
      tasks: [
        task({ id: 'p1', spaceId: 's1', title: '부모', memo: '메모 내용' }),
        task({ id: 'c1', spaceId: 's1', parentId: 'p1', title: '자식' }),
      ],
    };
    const out = remapForImport(data, counter(), userId);
    const parent = out.tasks.find((t) => t.title === '부모')!;
    const child = out.tasks.find((t) => t.title === '자식')!;
    expect(parent.parent_id).toBeNull();
    expect(parent.memo).toBe('메모 내용');
    expect(child.parent_id).toBe(parent.id); // 새 부모 id로 재매핑
    expect(child.parent_id).not.toBe('p1'); // 원본 id는 남지 않는다
  });

  it('부모가 없는(참조가 깨진) 서브태스크는 최상위로 승격한다(parent_id=null)', () => {
    const data: BackupData = {
      spaces: [space({ id: 's1' })],
      groups: [],
      recurrences: [],
      tasks: [task({ id: 'c1', spaceId: 's1', parentId: 'ghost', title: '고아' })],
    };
    const out = remapForImport(data, counter(), userId);
    expect(out.tasks).toHaveLength(1);
    expect(out.tasks[0].parent_id).toBeNull();
  });
});
