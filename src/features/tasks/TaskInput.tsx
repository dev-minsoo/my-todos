import { useRef, useState } from 'react';
import { ArrowUp, ChevronDown, Folder, Plus } from 'lucide-react';
import { ALL_TAB } from '@/db/types';
import { useUiStore } from '@/store/uiStore';
import { NO_GROUP_NAME } from '@/domain/sections';
import { useActiveTab } from '@/features/spaces/useActiveTab';
import { useGroups } from '@/features/spaces/useGroups';
import { SpacePickerPopover } from '@/features/spaces/SpacePickerPopover';
import { targetSpaceId } from '@/features/spaces/spaceSelection';
import { GroupMovePopover, type GroupOption } from './GroupMovePopover';
import { useTasks } from './useTasks';

const CHIP_CLASS =
  'inline-flex items-center gap-1 rounded-full bg-surface2 px-2.5 py-1 text-xs font-medium text-text transition hover:bg-border';

export function TaskInput() {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const viewedDate = useUiStore((s) => s.viewedDate);
  const lastSpaceId = useUiStore((s) => s.lastSpaceId);
  const setLastSpaceId = useUiStore((s) => s.setLastSpaceId);
  const lastGroupBySpace = useUiStore((s) => s.lastGroupBySpace);
  const setLastGroup = useUiStore((s) => s.setLastGroup);

  const { activeTab, spaces } = useActiveTab();
  const { groups, createGroup } = useGroups();
  const { addTask } = useTasks();

  // 새 할 일이 들어갈 대상 공간: 특정 공간 탭이면 그 공간, [전체]면 마지막에 쓴 공간(칩으로 변경).
  const spaceId = targetSpaceId(activeTab, spaces, lastSpaceId);
  const disabled = !spaceId;

  // [전체] 탭에서는 대상 공간이 화면에 안 드러나므로 공간 칩을 함께 보인다.
  const isAll = activeTab === ALL_TAB;
  const showSpaceChip = isAll && !!spaceId;
  const currentSpace = spaceId ? spaces.find((s) => s.id === spaceId) ?? null : null;

  // 대상 그룹 칩은 대상 공간이 정해지면 늘 보인다(그룹 0개여도 — 여기서 새 그룹을 만든다).
  const spaceGroups: GroupOption[] = spaceId
    ? groups
        .filter((g) => g.spaceId === spaceId)
        .slice()
        .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0))
        .map((g) => ({ id: g.id, name: g.name }))
    : [];
  const showGroupChip = !!spaceId;

  // 저장된 대상 그룹이 지워졌으면 "미분류"로 폴백
  const rawTarget = spaceId ? lastGroupBySpace[spaceId] ?? null : null;
  const targetGroupId = rawTarget && spaceGroups.some((g) => g.id === rawTarget) ? rawTarget : null;
  const targetName = targetGroupId
    ? spaceGroups.find((g) => g.id === targetGroupId)?.name ?? NO_GROUP_NAME
    : NO_GROUP_NAME;

  function submit() {
    const title = value.trim();
    if (!title || !spaceId) return;
    // 지금 보는 날짜·대상 공간·대상 그룹에 들어간다. (v0.2) "내일/금" 파싱은 이후 dueDate 보정으로.
    addTask({ title, dueDate: viewedDate, spaceId, groupId: targetGroupId });
    setLastSpaceId(spaceId);
    setValue('');
    // 연속 추가: 버튼 탭으로 등록해도 입력칸에 포커스를 되돌려 바로 다음 항목을 적게 한다.
    inputRef.current?.focus();
  }

  const canSubmit = !disabled && value.trim().length > 0;

  return (
    <div className="border-t border-border p-3">
      {(showSpaceChip || showGroupChip) && spaceId && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
          {showSpaceChip && currentSpace && (
            <SpacePickerPopover
              spaces={spaces.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
              currentSpaceId={spaceId}
              onSelect={(id) => setLastSpaceId(id)}
              align="start"
              triggerLabel="추가할 공간"
              triggerClassName={CHIP_CLASS}
              trigger={
                <>
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: currentSpace.color }}
                    aria-hidden
                  />
                  <span className="max-w-[8rem] truncate">{currentSpace.name}</span>
                  <ChevronDown className="size-3 text-muted" />
                </>
              }
            />
          )}
          {showGroupChip && (
            <GroupMovePopover
              groups={spaceGroups}
              currentGroupId={targetGroupId}
              onSelect={(gid) => setLastGroup(spaceId, gid)}
              onCreate={async (name) => {
                // 즉석 생성 후 그 그룹을 입력 대상으로 지정
                const g = await createGroup({ spaceId, name });
                setLastGroup(spaceId, g.id);
              }}
              align="start"
              triggerLabel="추가할 그룹"
              triggerClassName={CHIP_CLASS}
              trigger={
                <>
                  <Folder className="size-3.5 text-muted" />
                  <span className="max-w-[10rem] truncate">{targetName}</span>
                  <ChevronDown className="size-3 text-muted" />
                </>
              }
            />
          )}
        </div>
      )}
      <div className="flex items-center gap-2 rounded-xl bg-bg px-3 py-2.5 ring-1 ring-transparent transition focus-within:ring-accent">
        <Plus className="size-4 shrink-0 text-muted" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // 한글 등 IME 조합 중 Enter는 무시 (조합 확정 Enter가 submit을 겹쳐 마지막 글자가 중복되는 문제 방지)
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
          }}
          disabled={disabled}
          placeholder={disabled ? '공간을 먼저 만들어 주세요' : '할 일 추가…'}
          aria-label="할 일 추가"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted disabled:opacity-50"
        />
        {/* 우측 전송 버튼: 텍스트가 있으면 나타난다 (모바일에서 Enter 없이 탭으로 등록) */}
        {canSubmit && (
          <button
            type="button"
            onClick={submit}
            aria-label="추가"
            className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-accentFg transition hover:opacity-90 active:scale-95"
          >
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
