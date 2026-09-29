import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { PopoverMenu } from '@/components/PopoverMenu';
import { cn } from '@/lib/utils';

export type SpaceOption = { id: string; name: string; color: string };

type Props = {
  /** 선택 가능한 공간들 (탭 순서) */
  spaces: SpaceOption[];
  /** 현재 대상 공간 */
  currentSpaceId: string | null;
  onSelect: (spaceId: string) => void;
  trigger: ReactNode;
  triggerClassName?: string;
  triggerLabel: string;
  align?: 'start' | 'end';
};

/** 새 할 일을 넣을 대상 공간 선택 ([전체] 탭 입력칸용). 공간 생성은 공간 관리에서만. */
export function SpacePickerPopover({
  spaces,
  currentSpaceId,
  onSelect,
  trigger,
  triggerClassName,
  triggerLabel,
  align = 'start',
}: Props) {
  return (
    <PopoverMenu
      trigger={trigger}
      triggerClassName={triggerClassName}
      triggerLabel={triggerLabel}
      align={align}
    >
      {(close) => (
        <>
          <p className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
            공간 선택
          </p>
          <div className="max-h-64 overflow-y-auto">
            {spaces.map((s) => {
              const selected = s.id === currentSpaceId;
              return (
                <button
                  key={s.id}
                  role="menuitem"
                  onClick={() => {
                    onSelect(s.id);
                    close();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-surface2',
                    selected && 'font-medium'
                  )}
                >
                  <Check
                    className={cn(
                      'size-4 shrink-0 text-accent',
                      selected ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: s.color }}
                    aria-hidden
                  />
                  <span className="truncate">{s.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </PopoverMenu>
  );
}
