import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarCheck, CalendarOff, Check, X } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { todayStr } from '@/domain/dayBoundary';
import { deriveSections, type CarriedTask } from '@/domain/sections';
import { useActiveTab } from '@/features/spaces/useActiveTab';
import { useTasks } from '@/features/tasks/useTasks';
import { Modal } from '@/components/Modal';

/**
 * 아침 정리 한 장 — 앱을 열었을 때 넘어온 일이 있으면 하루 한 번 자동으로 뜨는 오버레이 시트.
 *
 * - 모든 공간을 통합해 공간별 소제목(색점+이름)으로 묶는다(활성 탭과 무관 — 전부 보여 준다).
 * - 각 항목에 네 액션: [완료] 토글 · [오늘] 오늘로 · [나중에] 날짜 미정으로 · [취소] 취소.
 *   모두 기존 뮤테이션 재사용(이동/취소는 내부에서 Undo 토스트). 처리 즉시 넘어옴에서 빠져 행이 사라진다.
 * - "하루 한 번" 판정은 uiStore의 morningTriageHandledDate(=오늘)로만 한다. DB·마이그레이션 없음.
 *
 * 넘어옴 집합은 deriveSections(tasks, today, today).carried 재사용 — 가상 반복분은
 * recurrenceId 가드로 자연 제외되고, overdueDays까지 붙어 온다.
 */
export function MorningTriage() {
  const enabled = useUiStore((s) => s.morningTriageEnabled);
  const handledDate = useUiStore((s) => s.morningTriageHandledDate);
  const open = useUiStore((s) => s.morningTriageOpen);
  const activeView = useUiStore((s) => s.activeView);
  const openMorningTriage = useUiStore((s) => s.openMorningTriage);
  const dismissMorningTriage = useUiStore((s) => s.dismissMorningTriage);

  const { spaces } = useActiveTab();
  const { tasks, toggleTask, moveTaskToDate, cancelTask } = useTasks();

  const today = todayStr();

  // 모든 공간의 넘어온 항목(살아있는 공간만), 공간 순서대로 묶고 빈 공간 생략.
  const carried = useMemo(() => deriveSections(tasks, today, today).carried, [tasks, today]);
  const spaceIds = useMemo(() => new Set(spaces.map((s) => s.id)), [spaces]);
  const scoped = useMemo(() => carried.filter((t) => spaceIds.has(t.spaceId)), [carried, spaceIds]);
  const bySpace = useMemo(
    () =>
      spaces
        .map((sp) => ({ space: sp, items: scoped.filter((t) => t.spaceId === sp.id) }))
        .filter((g) => g.items.length > 0),
    [spaces, scoped]
  );

  // 자동 열기 — 하루에 한 번, 하루 화면에서, 아직 오늘 처리 안 했고, 넘어온 게 있을 때.
  // 데이터가 늦게 로드돼 0→N이 돼도 한 번은 연다(useRef로 중복 열기 가드).
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current) return;
    if (enabled && activeView === 'day' && handledDate !== today && scoped.length > 0) {
      openedRef.current = true;
      openMorningTriage();
    }
  }, [enabled, activeView, handledDate, today, scoped.length, openMorningTriage]);

  // 자동 닫기 — 마지막 항목을 처리해 넘어온 게 0이 되면 저절로 닫힌다('오늘 처리함'으로 찍힘).
  useEffect(() => {
    if (open && scoped.length === 0) dismissMorningTriage();
  }, [open, scoped.length, dismissMorningTriage]);

  return (
    <Modal open={open} onClose={dismissMorningTriage} title="아침 정리">
      <div className="space-y-4">
        <p className="px-1 text-sm text-muted">
          넘어온 <span className="font-medium text-text">{scoped.length}개</span>를 정리해요.
          남겨 두면 그대로 오늘에 따라와요.
        </p>

        <div className="space-y-4">
          {bySpace.map(({ space, items }) => (
            <section key={space.id}>
              <div className="flex items-center gap-2 px-1 pb-1.5">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: space.color }}
                  aria-hidden
                />
                <span className="text-sm font-semibold">{space.name}</span>
                <span className="text-xs tabular-nums text-muted">{items.length}</span>
              </div>
              <ul role="list" className="flex flex-col gap-1.5">
                <AnimatePresence initial={false}>
                  {items.map((task) => (
                    <TriageRow
                      key={task.id}
                      task={task}
                      onComplete={() => toggleTask(task)}
                      onToday={() => moveTaskToDate(task, today)}
                      onSomeday={() => moveTaskToDate(task, null)}
                      onCancel={() => cancelTask(task)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>

        <button
          type="button"
          onClick={dismissMorningTriage}
          className="w-full rounded-xl bg-surface2 py-2.5 text-sm font-medium text-muted transition hover:text-text"
        >
          나중에 하기
        </button>
      </div>
    </Modal>
  );
}

/**
 * 아침 정리 전용 경량 행 — TaskItem을 쓰지 않는다(스와이프·상세·인라인 수정이 불필요하고 액션 세트가 다름).
 * 제목 + "N일 지남" 배지 + 액션 4개. 처리하면 부모에서 넘어옴이 재계산돼 행이 빠진다(exit 애니메이션).
 */
function TriageRow({
  task,
  onComplete,
  onToday,
  onSomeday,
  onCancel,
}: {
  task: CarriedTask;
  onComplete: () => void;
  onToday: () => void;
  onSomeday: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.15 }}
      className="overflow-hidden rounded-xl border border-border bg-surface p-2.5"
    >
      <div className="flex items-start gap-2 px-1">
        <span className="min-w-0 flex-1 break-words text-sm">{task.title}</span>
        <span className="mt-0.5 shrink-0 rounded-full bg-overdueBg px-2 py-0.5 text-[11px] font-medium text-overdueFg">
          {task.overdueDays}일 지남
        </span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        <TriageButton label="완료" icon={Check} onClick={onComplete} tone="accent" />
        <TriageButton label="오늘" icon={CalendarCheck} onClick={onToday} />
        <TriageButton label="나중에" icon={CalendarOff} onClick={onSomeday} />
        <TriageButton label="취소" icon={X} onClick={onCancel} tone="muted" />
      </div>
    </motion.li>
  );
}

function TriageButton({
  label,
  icon: Icon,
  onClick,
  tone = 'neutral',
}: {
  label: string;
  icon: typeof Check;
  onClick: () => void;
  tone?: 'accent' | 'neutral' | 'muted';
}) {
  const toneCls =
    tone === 'accent'
      ? 'bg-accent text-accentFg hover:opacity-90'
      : tone === 'muted'
        ? 'bg-surface2 text-muted hover:text-text'
        : 'bg-surface2 text-text hover:bg-border';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-xs font-medium transition active:scale-95 ${toneCls}`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
