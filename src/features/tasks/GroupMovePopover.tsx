import { useState, type ReactNode } from 'react';
import { Check, Plus } from 'lucide-react';
import { NO_GROUP_NAME } from '@/domain/sections';
import { PopoverMenu } from '@/components/PopoverMenu';
import { cn } from '@/lib/utils';

export type GroupOption = { id: string; name: string };

type Props = {
  /** 이 공간의 살아있는 그룹들 (position 순) */
  groups: GroupOption[];
  /** 현재 선택된 그룹 (null = 미분류) */
  currentGroupId: string | null;
  /** 그룹 선택 (null = 미분류) */
  onSelect: (groupId: string | null) => void;
  /** "새 그룹으로": 생성 후 선택까지 (없으면 새 그룹 항목 숨김) */
  onCreate?: (name: string) => void;
  /** 트리거 버튼 내용 */
  trigger: ReactNode;
  triggerClassName?: string;
  triggerLabel: string;
  /** 메뉴 가로 정렬 기준 (기본 start = 트리거 왼쪽 맞춤) */
  align?: 'start' | 'end';
};

export function GroupMovePopover({
  groups,
  currentGroupId,
  onSelect,
  onCreate,
  trigger,
  triggerClassName,
  triggerLabel,
  align = 'start',
}: Props) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');

  const options: GroupOption[] = [{ id: '__none__', name: NO_GROUP_NAME }, ...groups];

  return (
    <PopoverMenu
      trigger={trigger}
      triggerClassName={triggerClassName}
      triggerLabel={triggerLabel}
      align={align}
      onOpenChange={(open) => {
        if (!open) {
          setCreating(false);
          setDraft('');
        }
      }}
    >
      {(close) => (
        <>
          <p className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
            그룹으로 이동
          </p>
          <div className="max-h-64 overflow-y-auto">
            {options.map((o) => {
              const gid = o.id === '__none__' ? null : o.id;
              const selected = gid === currentGroupId;
              return (
                <button
                  key={o.id}
                  role="menuitem"
                  onClick={() => {
                    onSelect(gid);
                    close();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-surface2',
                    selected && 'font-medium text-accent'
                  )}
                >
                  <Check className={cn('size-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{o.name}</span>
                </button>
              );
            })}
          </div>

          {onCreate && (
            <div className="border-t border-border pt-1">
              {creating ? (
                <div className="px-2 py-1">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                        const name = draft.trim();
                        if (name) {
                          onCreate(name);
                          close();
                        }
                      }
                      if (e.key === 'Escape') {
                        setCreating(false);
                        setDraft('');
                      }
                    }}
                    placeholder="새 그룹 이름"
                    aria-label="새 그룹 이름"
                    className="w-full rounded-lg bg-bg px-2 py-1.5 text-sm outline-none ring-1 ring-accent"
                  />
                </div>
              ) : (
                <button
                  role="menuitem"
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted transition hover:bg-surface2 hover:text-text"
                >
                  <Plus className="size-4 shrink-0" />
                  <span>새 그룹으로…</span>
                </button>
              )}
            </div>
          )}
        </>
      )}
    </PopoverMenu>
  );
}
