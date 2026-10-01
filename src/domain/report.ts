// 리포트(분석) 도메인 — 순수 함수. 저장된 필드만으로 특정 기간의 지표를 계산한다.
// 마이그레이션 없음: completed_at / due_date / created_at / space_id / group_id / title /
// recurrences(rule·start_date·recurrence_id)만 쓴다. 소프트 삭제라 지난 기간도 재구성된다.
//
// 지표별 기준(base set)을 명시한다 — 습관(반복 출신)과 일반 할 일을 섞지 않는다:
//  · 활동량(완료수·추이·분포)   = 이 기간에 완료한 "모든" 항목(습관 체크 포함).
//  · 마감분 이행률/미수행/밀림   = 이 기간에 마감이 걸린 "일반 할 일"(반복 제외).
//  · 자주 등록(빈도)            = 이 기간에 등록한 "일반 할 일"(반복 제외).
//  · 습관 이행률(E)             = 반복 규칙 기준(occursOn 재계산 ↔ 실체화된 완료). 취소한 발생일은 분모에서 뺀다.
import { parseISO } from 'date-fns';
import type { Group, Recurrence, Space, Task } from '@/db/types';
import { daysBetween, toDateStr } from './dayBoundary';
import { occursOn, ruleLabel } from './recurrence';
import { NO_GROUP_NAME } from './sections';
import { daysOf, inRange, type DateRange } from './period';

export type ReportInput = {
  tasks: Task[]; // 살아있는 것만(deleted_at IS NULL). 완료 포함.
  recurrences: Recurrence[]; // 살아있는 반복 규칙
  spaces: Space[];
  groups: Group[];
  range: DateRange; // 반열림 [start, end)
  today: string; // 'YYYY-MM-DD' (오늘까지만 습관 발생 인정)
};

export type ReportSummary = {
  completed: number; // completed_at ∈ range (습관 포함)
  registered: number; // created_at ∈ range
  dueTotal: number; // 일반 할 일 중 due_date ∈ range
  dueDone: number; // 그중 기간 종료까지 완료
  missed: number; // 그중 기간 종료까지 미완료
  adherenceRate: number; // dueDone / dueTotal (0~1). dueTotal===0이면 0
  avgLateDays: number; // 기간 내 완료한 일반 할 일 중 늦게 끝낸 것들의 평균 밀림(일). 없으면 0
};

export type DayBucket = { date: string; completed: number };

export type DistributionItem = {
  id: string | null; // spaceId / groupId (null = 미분류)
  name: string;
  color?: string;
  count: number; // 기간 내 완료 수
};

export type FrequencyItem = { title: string; count: number };

export type HabitAdherence = {
  id: string;
  title: string;
  ruleLabel: string;
  occurrences: number; // 기간 내(오늘까지) 발생 예정일 수
  done: number; // 그중 실제 완료한 날 수
  rate: number; // done / occurrences (0~1). occurrences===0이면 0
};

export type ReportResult = {
  range: DateRange;
  summary: ReportSummary;
  activity: DayBucket[]; // 날짜별 완료 수(구간의 모든 날, 0 포함)
  bySpace: DistributionItem[]; // 공간별 완료 분포(내림차순, 완료 0 제외)
  byGroup: DistributionItem[]; // 그룹별 완료 분포(내림차순, 완료 0 제외)
  frequency: FrequencyItem[]; // 자주 등록 Top N(2회 이상)
  habits: HabitAdherence[]; // 습관 이행률(기간 내 발생 있는 것만)
};

const FREQUENCY_TOP_N = 12;
const FREQUENCY_MIN_COUNT = 2;

/** ISO 시각 → 로컬 '날'('YYYY-MM-DD'). completed_at·created_at 공용. */
function dayOf(iso: string): string {
  return toDateStr(parseISO(iso));
}

/** 등록 빈도 집계용 제목 정규화: 앞뒤 공백 제거·연속 공백 1칸·소문자. */
export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** 기간·데이터 → 리포트 지표. 전부 순수 계산(입력을 변형하지 않음). */
export function buildReport(input: ReportInput): ReportResult {
  const { recurrences, spaces, groups, range, today } = input;
  const tasks = input.tasks.filter((t) => t.deletedAt == null);

  const spaceById = new Map(spaces.map((s) => [s.id, s]));
  const groupById = new Map(groups.map((g) => [g.id, g]));

  const summary = buildSummary(tasks, range);
  const activity = buildActivity(tasks, range);
  const bySpace = buildBySpace(tasks, range, spaceById);
  const byGroup = buildByGroup(tasks, range, groupById, spaceById);
  const frequency = buildFrequency(tasks, range);
  const habits = buildHabits(tasks, recurrences, range, today);

  return { range, summary, activity, bySpace, byGroup, frequency, habits };
}

function buildSummary(tasks: Task[], range: DateRange): ReportSummary {
  let completed = 0;
  let registered = 0;
  let dueTotal = 0;
  let dueDone = 0;
  const lateDays: number[] = [];

  for (const t of tasks) {
    const done = t.completedAt != null;
    const doneDay = done ? dayOf(t.completedAt as string) : null;

    if (doneDay != null && inRange(doneDay, range)) completed += 1;
    if (inRange(dayOf(t.createdAt), range)) registered += 1;

    // 마감분(이행률·미수행·밀림)은 일반 할 일만. 습관은 E에서 따로 본다.
    // 취소한 할 일은 "미이행"이 아니므로 분모(dueTotal)에서 뺀다(완료도 미수행도 아닌 '닫힘').
    const isHabit = t.recurrenceId != null;
    if (!isHabit && t.cancelledAt == null && inRange(t.dueDate, range)) {
      dueTotal += 1;
      // 기간 종료까지 완료 = 완료일이 end 이전(반열림). early 완료도 이행으로 인정.
      if (doneDay != null && doneDay < range.end) {
        dueDone += 1;
      }
    }
    // 밀림: 기간 내 완료한 일반 할 일 중 마감보다 늦게 끝낸 것.
    if (!isHabit && doneDay != null && inRange(doneDay, range)) {
      const late = daysBetween(t.dueDate, doneDay);
      if (late > 0) lateDays.push(late);
    }
  }

  const missed = dueTotal - dueDone;
  const adherenceRate = dueTotal > 0 ? dueDone / dueTotal : 0;
  const avgLateDays =
    lateDays.length > 0 ? lateDays.reduce((a, b) => a + b, 0) / lateDays.length : 0;

  return { completed, registered, dueTotal, dueDone, missed, adherenceRate, avgLateDays };
}

function buildActivity(tasks: Task[], range: DateRange): DayBucket[] {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.completedAt == null) continue;
    const day = dayOf(t.completedAt);
    if (inRange(day, range)) counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return daysOf(range).map((date) => ({ date, completed: counts.get(date) ?? 0 }));
}

/** 완료(습관 포함)를 spaceId로 집계. 사라진 공간 참조는 제외. */
function buildBySpace(
  tasks: Task[],
  range: DateRange,
  spaceById: Map<string, Space>
): DistributionItem[] {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.completedAt == null || !inRange(dayOf(t.completedAt), range)) continue;
    counts.set(t.spaceId, (counts.get(t.spaceId) ?? 0) + 1);
  }
  const items: DistributionItem[] = [];
  for (const [id, count] of counts) {
    const space = spaceById.get(id);
    if (!space) continue; // 삭제된(하드) 공간 참조 방어
    items.push({ id, name: space.name, color: space.color, count });
  }
  return items.sort((a, b) => b.count - a.count);
}

/** 완료(습관 포함)를 groupId로 집계(null = 미분류). 색은 그룹이 속한 공간 색. */
function buildByGroup(
  tasks: Task[],
  range: DateRange,
  groupById: Map<string, Group>,
  spaceById: Map<string, Space>
): DistributionItem[] {
  const counts = new Map<string, number>(); // key: groupId or '' (미분류)
  for (const t of tasks) {
    if (t.completedAt == null || !inRange(dayOf(t.completedAt), range)) continue;
    const key = t.groupId ?? '';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const items: DistributionItem[] = [];
  for (const [key, count] of counts) {
    if (key === '') {
      items.push({ id: null, name: NO_GROUP_NAME, count });
      continue;
    }
    const group = groupById.get(key);
    if (!group) continue;
    const color = spaceById.get(group.spaceId)?.color;
    items.push({ id: key, name: group.name, color, count });
  }
  return items.sort((a, b) => b.count - a.count);
}

/** 이 기간에 등록한 일반 할 일(반복 제외)을 제목 정규화 기준으로 묶어 빈도 Top N. */
function buildFrequency(tasks: Task[], range: DateRange): FrequencyItem[] {
  const acc = new Map<string, { title: string; count: number }>();
  for (const t of tasks) {
    if (t.recurrenceId != null) continue; // 습관은 E에서
    if (!inRange(dayOf(t.createdAt), range)) continue;
    const key = normalizeTitle(t.title);
    if (key === '') continue;
    const cur = acc.get(key);
    if (cur) cur.count += 1;
    else acc.set(key, { title: t.title.trim(), count: 1 }); // 첫 등장 원문(trim)으로 표시
  }
  return [...acc.values()]
    .filter((x) => x.count >= FREQUENCY_MIN_COUNT)
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .slice(0, FREQUENCY_TOP_N);
}

/**
 * 습관 이행률(E). 반복 규칙으로 기간 내(오늘까지) 발생 예정일을 재계산하고,
 * 실체화되어 완료된 날과 대조한다.
 * 취소한 발생일(실체화 후 cancelled_at)은 발생(분모)에서 뺀다 — 완료도 미이행도 아닌 '닫힘'.
 * 한계: 규칙 버전이 없어 규칙을 바꾸면 과거 발생일도 "현재 규칙"으로 재계산된다(문서화된 절충).
 */
function buildHabits(
  tasks: Task[],
  recurrences: Recurrence[],
  range: DateRange,
  today: string
): HabitAdherence[] {
  const days = daysOf(range).filter((d) => d <= today); // 미래는 아직 판정하지 않음

  // 반복별 실체화된 행을 due_date로 모은다: 완료한 날 / 취소한 날.
  // 취소는 "하기로 했지만 흐지부지 닫은" 것 → 미이행이 아니므로 발생(분모)에서 뺀다(일반 할 일과 대칭).
  const doneByRec = new Map<string, Set<string>>();
  const cancelledByRec = new Map<string, Set<string>>();
  for (const t of tasks) {
    if (t.recurrenceId == null) continue;
    if (t.completedAt != null) {
      let set = doneByRec.get(t.recurrenceId);
      if (!set) doneByRec.set(t.recurrenceId, (set = new Set()));
      set.add(t.dueDate);
    } else if (t.cancelledAt != null) {
      let set = cancelledByRec.get(t.recurrenceId);
      if (!set) cancelledByRec.set(t.recurrenceId, (set = new Set()));
      set.add(t.dueDate);
    }
  }

  const out: HabitAdherence[] = [];
  for (const rec of recurrences) {
    if (rec.deletedAt != null) continue;
    const cancelled = cancelledByRec.get(rec.id);
    // 취소한 발생일은 분모에서 제외(완료도 미이행도 아닌 '닫힘').
    const occDays = days.filter((d) => occursOn(rec, d) && !cancelled?.has(d));
    if (occDays.length === 0) continue; // 기간 내 (취소 제외) 발생 없음 → 표시 안 함
    const done = doneByRec.get(rec.id);
    const doneCount = done ? occDays.filter((d) => done.has(d)).length : 0;
    out.push({
      id: rec.id,
      title: rec.title,
      ruleLabel: ruleLabel(rec.rule),
      occurrences: occDays.length,
      done: doneCount,
      rate: doneCount / occDays.length,
    });
  }
  // 발생 많은 순 → 제목 순
  return out.sort((a, b) => b.occurrences - a.occurrences || a.title.localeCompare(b.title));
}
