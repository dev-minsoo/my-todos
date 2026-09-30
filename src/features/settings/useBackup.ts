import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/features/auth/authContext';
import {
  toGroup,
  toRecurrence,
  toSpace,
  toTask,
  type GroupRow,
  type RecurrenceRow,
  type SpaceRow,
  type TaskRow,
} from '@/db/mappers';
import {
  buildBackup,
  parseBackup,
  remapForImport,
  type BackupData,
  type ImportPayload,
} from '@/domain/backup';

/** 살아있는 행만 position 순으로 가져온다(내보내기 범위 = deleted_at IS NULL). */
async function fetchAll(): Promise<BackupData> {
  const [spaces, groups, recurrences, tasks] = await Promise.all([
    selectLive('spaces'),
    selectLive('groups'),
    selectLive('recurrences'),
    selectLive('tasks'),
  ]);
  return {
    spaces: (spaces as SpaceRow[]).map(toSpace),
    groups: (groups as GroupRow[]).map(toGroup),
    recurrences: (recurrences as RecurrenceRow[]).map(toRecurrence),
    tasks: (tasks as TaskRow[]).map(toTask),
  };
}

async function selectLive(table: 'spaces' | 'groups' | 'recurrences' | 'tasks') {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .is('deleted_at', null)
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** payload 배열을 테이블에 삽입(빈 배열은 건너뜀). RLS가 user_id를 강제한다. */
async function insertRows(
  table: 'spaces' | 'groups' | 'recurrences' | 'tasks',
  rows: object[]
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw error;
}

function triggerDownload(filename: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/**
 * JSON 백업 내보내기/가져오기. 순수 로직은 domain/backup에 있고, 여기서는
 * Supabase I/O·파일·토스트만 담당한다. 가져오기는 "추가"(비파괴).
 */
export function useBackup() {
  const userId = useUserId();
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  async function exportBackup(): Promise<void> {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await fetchAll();
      const json = JSON.stringify(buildBackup(data), null, 2);
      triggerDownload(`my-todos-backup-${format(new Date(), 'yyyy-MM-dd')}.json`, json);
      const count = data.spaces.length + data.tasks.length;
      toast(count > 0 ? '백업 파일을 내려받았어요.' : '아직 내보낼 데이터가 없어요.');
    } catch (e) {
      toast.error(errMsg(e, '내보내기에 실패했어요.'));
    } finally {
      setExporting(false);
    }
  }

  async function importBackup(file: File): Promise<void> {
    if (importing) return;
    setImporting(true);
    try {
      const raw = parseJson(await file.text());
      const payload = remapForImport(parseBackup(raw), () => crypto.randomUUID(), userId);
      await applyImport(payload);
      await qc.invalidateQueries();
      toast(`공간 ${payload.spaces.length} · 할 일 ${payload.tasks.length}개를 가져왔어요.`);
    } catch (e) {
      toast.error(errMsg(e, '가져오기에 실패했어요.'));
    } finally {
      setImporting(false);
    }
  }

  return { exporting, importing, exportBackup, importBackup };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('JSON 파일을 읽지 못했어요. 파일이 손상됐는지 확인해 주세요.');
  }
}

/**
 * 의존 순서대로 삽입: spaces → (groups·recurrences) → tasks.
 * 클라이언트라 테이블 간 트랜잭션은 보장 못 한다(부분 삽입 가능) — MVP 한계.
 * FK를 지키기 위해 부모(spaces)를 먼저 넣고, tasks는 group/recurrence가 다 들어간 뒤 넣는다.
 */
async function applyImport(payload: ImportPayload): Promise<void> {
  await insertRows('spaces', payload.spaces);
  await Promise.all([
    insertRows('groups', payload.groups),
    insertRows('recurrences', payload.recurrences),
  ]);
  await insertRows('tasks', payload.tasks);
}
