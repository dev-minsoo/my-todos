import { completionCount, type DaySections } from './sections';

/**
 * 요약에 들어갈 한 덩어리. title이 있으면 그 블록 앞에 `# 제목`을 붙인다(공간명).
 * [전체] 탭은 공간별로 여러 블록, 특정 공간은 제목 없는 블록 하나.
 */
export type SummaryBlock = { title?: string; sections: DaySections };

/** `- [ ] 제목` / `- [x] 제목` 한 줄. carried는 뒤에 `(N일 지남)`을 덧붙인다. */
function line(title: string, done: boolean, overdueDays?: number): string {
  const box = done ? '[x]' : '[ ]';
  const suffix = overdueDays != null && overdueDays > 0 ? ` (${overdueDays}일 지남)` : '';
  return `- ${box} ${title}${suffix}`;
}

/** 한 블록(공간)의 본문 줄들. 넘어옴→할 일→완료 순서, 취소는 뺀다. 비면 빈 배열. */
function blockLines(sections: DaySections): string[] {
  const lines: string[] = [];
  for (const t of sections.carried) lines.push(line(t.title, false, t.overdueDays));
  for (const t of sections.open) lines.push(line(t.title, false));
  for (const t of sections.completed) lines.push(line(t.title, true));
  return lines;
}

/**
 * 보고 있는 날의 체크리스트를 공유용 텍스트로 만든다(순수 함수 — 클립보드 복사용).
 *
 * - 머리글: `${dateLabel} · ${done}/${total} 완료` (총계는 블록별 completionCount 합산 = 취소 제외).
 * - 블록이 1개면 제목 없이 평면, 2개 이상이면 각 블록 앞에 `# ${title}`.
 * - 각 줄: 넘어옴·할 일 `- [ ]`(넘어옴은 `(N일 지남)`), 완료 `- [x]`. **취소 섹션은 뺀다**(깔끔한 체크리스트).
 * - 내용(줄)이 하나도 없는 블록은 통째로 생략. 날짜 포맷은 호출부가 dateLabel로 넘긴다(함수는 날짜에 비의존 → 테스트 결정적).
 */
export function formatDaySummary(dateLabel: string, blocks: SummaryBlock[]): string {
  let total = 0;
  let done = 0;
  for (const b of blocks) {
    const c = completionCount(b.sections);
    total += c.total;
    done += c.done;
  }

  const parts: string[] = [`${dateLabel} · ${done}/${total} 완료`];

  const multi = blocks.length > 1;
  for (const b of blocks) {
    const lines = blockLines(b.sections);
    if (lines.length === 0) continue; // 보여 줄 게 없는 블록은 생략
    if (multi && b.title) parts.push(`\n# ${b.title}`);
    parts.push(...lines);
  }

  return parts.join('\n');
}
