import { useState } from 'react';
import { useUiStore } from '@/store/uiStore';
import { useSpaces } from '@/features/spaces/useSpaces';
import { resolveActiveTab, targetSpaceId } from '@/features/spaces/spaceSelection';
import { useTasks } from './useTasks';

export function TaskInput() {
  const [value, setValue] = useState('');
  const viewedDate = useUiStore((s) => s.viewedDate);
  const currentTab = useUiStore((s) => s.currentTab);
  const lastSpaceId = useUiStore((s) => s.lastSpaceId);
  const setLastSpaceId = useUiStore((s) => s.setLastSpaceId);

  const { spaces } = useSpaces();
  const { addTask } = useTasks();

  const activeTab = resolveActiveTab(currentTab, spaces);
  const spaceId = targetSpaceId(activeTab, spaces, lastSpaceId);
  const disabled = !spaceId;

  function submit() {
    const title = value.trim();
    if (!title || !spaceId) return;
    // 지금 보는 날짜·공간에 들어간다. (v0.2) "내일/금" 파싱은 이후 dueDate 보정으로.
    addTask({ title, dueDate: viewedDate, spaceId });
    setLastSpaceId(spaceId);
    setValue('');
  }

  return (
    <div className="border-t border-border bg-surface px-3 py-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        disabled={disabled}
        placeholder={disabled ? '공간을 먼저 만들어 주세요' : '+ 할 일 추가…'}
        aria-label="할 일 추가"
        className="w-full rounded-lg bg-bg px-3 py-2.5 text-sm outline-none placeholder:text-muted disabled:opacity-50"
      />
    </div>
  );
}
