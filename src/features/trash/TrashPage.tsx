import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { useTrash } from './useTrash';

function deletedAgo(deletedAt: string | null): string {
  if (!deletedAt) return '';
  try {
    return formatDistanceToNow(parseISO(deletedAt), { addSuffix: true, locale: ko });
  } catch {
    return '';
  }
}

export function TrashPage() {
  const active = useUiStore((s) => s.activeView === 'trash');
  const {
    deletedTasks,
    deletedSpaces,
    total,
    isLoading,
    restoreTask,
    purgeTask,
    restoreSpace,
    purgeSpace,
    emptyTrash,
  } = useTrash(active);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="휴지통" description="삭제한 항목을 복구하거나 영구 삭제해요." />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-xl">
          {isLoading && total === 0 ? (
            <p className="py-10 text-center text-sm text-muted">불러오는 중…</p>
          ) : total === 0 ? (
            <div className="flex flex-col items-center gap-1 py-16 text-center">
              <Trash2 className="size-9 text-muted" strokeWidth={1.5} />
              <p className="mt-1 text-sm text-muted">휴지통이 비어 있어요</p>
              <p className="text-xs text-muted">삭제한 할 일과 공간이 여기 모여요</p>
            </div>
          ) : (
            <div className="space-y-5">
              {deletedSpaces.length > 0 && (
                <TrashSection title="공간" count={deletedSpaces.length}>
                  {deletedSpaces.map((sp) => (
                    <TrashRow
                      key={sp.id}
                      ago={deletedAgo(sp.deletedAt)}
                      onRestore={() => restoreSpace(sp.id)}
                      onPurge={() => purgeSpace(sp.id)}
                      purgeHint="공간과 그 안의 할 일이 모두 영구 삭제돼요"
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: sp.color }}
                        aria-hidden
                      />
                      <span className="truncate">{sp.name}</span>
                    </TrashRow>
                  ))}
                </TrashSection>
              )}

              {deletedTasks.length > 0 && (
                <TrashSection title="할 일" count={deletedTasks.length}>
                  {deletedTasks.map((t) => (
                    <TrashRow
                      key={t.id}
                      ago={deletedAgo(t.deletedAt)}
                      onRestore={() => restoreTask(t.id)}
                      onPurge={() => purgeTask(t.id)}
                    >
                      <span className={cn('truncate', t.completedAt && 'text-muted line-through')}>
                        {t.title}
                      </span>
                    </TrashRow>
                  ))}
                </TrashSection>
              )}

              <div className="border-t border-border pt-3">
                <EmptyTrashButton onEmpty={emptyTrash} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrashSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section>
      <p className="px-1 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
        {title} <span className="text-muted">{count}</span>
      </p>
      <ul className="space-y-1.5">{children}</ul>
    </section>
  );
}

function TrashRow({
  ago,
  onRestore,
  onPurge,
  purgeHint,
  children,
}: {
  ago: string;
  onRestore: () => void;
  onPurge: () => void;
  purgeHint?: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">{children}</div>
      {ago && <span className="shrink-0 text-xs text-muted">{ago}</span>}
      <button
        onClick={onRestore}
        aria-label="복구"
        title="복구"
        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface2 hover:text-accent"
      >
        <RotateCcw className="size-4" />
      </button>
      <ConfirmPurge onPurge={onPurge} hint={purgeHint} />
    </li>
  );
}

/** 되돌릴 수 없는 영구 삭제 — 확인 창 대신 2단계(한 번 더 눌러 확정). 3초 후 자동 해제. */
function ConfirmPurge({ onPurge, hint }: { onPurge: () => void; hint?: string }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(id);
  }, [armed]);

  if (armed) {
    return (
      <button
        onClick={() => {
          onPurge();
          setArmed(false);
        }}
        title={hint}
        className="shrink-0 rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-red-600"
      >
        정말요?
      </button>
    );
  }

  return (
    <button
      onClick={() => setArmed(true)}
      aria-label="영구 삭제"
      title={hint ?? '영구 삭제'}
      className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-red-500/10 hover:text-red-500"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

function EmptyTrashButton({ onEmpty }: { onEmpty: () => void }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(id);
  }, [armed]);

  return (
    <button
      onClick={() => {
        if (armed) {
          onEmpty();
          setArmed(false);
        } else {
          setArmed(true);
        }
      }}
      className={cn(
        'flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition',
        armed ? 'bg-red-500 text-white hover:bg-red-600' : 'text-red-500 hover:bg-red-500/10'
      )}
    >
      <Trash2 className="size-4" />
      {armed ? '정말 비울까요? (되돌릴 수 없음)' : '휴지통 비우기'}
    </button>
  );
}
