import { useMemo, useState } from 'react';
import { todayStr } from '@/domain/dayBoundary';
import { periodRange, type PeriodPreset } from '@/domain/period';
import { buildReport, type ReportResult } from '@/domain/report';
import { useTasks } from '@/features/tasks/useTasks';
import { useRecurrences } from '@/features/spaces/useRecurrences';
import { useSpaces } from '@/features/spaces/useSpaces';
import { useGroups } from '@/features/spaces/useGroups';

export type UseReport = {
  preset: PeriodPreset;
  setPreset: (p: PeriodPreset) => void;
  today: string;
  report: ReportResult;
  isLoading: boolean;
  error: unknown;
};

const DEFAULT_PRESET: PeriodPreset = 'thisMonth';

/**
 * 리포트 데이터 훅. 기존 살아있는 데이터(useTasks/useRecurrences/useSpaces/useGroups)를
 * 그대로 받아 domain/report에서 순수 계산한다. 서버 왕복은 이미 캐시된 쿼리를 재사용하므로
 * 리포트 진입 시 추가 로딩이 거의 없다(v1: 전체 로드 후 클라이언트 집계).
 */
export function useReport(): UseReport {
  const [preset, setPreset] = useState<PeriodPreset>(DEFAULT_PRESET);
  const { tasks, isLoading: lt, error: et } = useTasks();
  const { recurrences, isLoading: lr, error: er } = useRecurrences();
  const { spaces, isLoading: ls, error: es } = useSpaces();
  const { groups, isLoading: lg, error: eg } = useGroups();

  const today = todayStr();
  const range = useMemo(() => periodRange(preset, today), [preset, today]);

  const report = useMemo(
    () => buildReport({ tasks, recurrences, spaces, groups, range, today }),
    [tasks, recurrences, spaces, groups, range, today]
  );

  return {
    preset,
    setPreset,
    today,
    report,
    isLoading: lt || lr || ls || lg,
    error: et ?? er ?? es ?? eg,
  };
}
