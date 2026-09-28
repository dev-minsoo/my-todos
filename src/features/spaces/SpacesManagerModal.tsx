import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Palette, Plus, Trash2 } from 'lucide-react';
import type { Space } from '@/db/types';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/Modal';
import { useSpaces } from './useSpaces';
import { SPACE_PALETTE, moveItem } from './spaceSelection';

export function SpacesManagerModal() {
  const open = useUiStore((s) => s.spacesManagerOpen);
  const startAddOpen = useUiStore((s) => s.spacesManagerAddOpen);
  const close = useUiStore((s) => s.closeSpacesManager);
  const { spaces, addSpace, updateSpace, deleteSpace, reorderSpaces } = useSpaces();

  const ids = spaces.map((s) => s.id);
  const move = (from: number, to: number) => reorderSpaces(moveItem(ids, from, to));

  return (
    <Modal open={open} onClose={close} title="공간 관리">
      <ul className="space-y-1.5">
        {spaces.map((sp, i) => (
          <SpaceRow
            key={sp.id}
            space={sp}
            isFirst={i === 0}
            isLast={i === spaces.length - 1}
            canDelete={spaces.length > 1}
            onRename={(name) => updateSpace({ id: sp.id, name })}
            onColor={(color) => updateSpace({ id: sp.id, color })}
            onUp={() => move(i, i - 1)}
            onDown={() => move(i, i + 1)}
            onDelete={() => deleteSpace(sp)}
          />
        ))}
      </ul>

      <AddSection
        modalOpen={open}
        startOpen={startAddOpen}
        defaultColor={SPACE_PALETTE[spaces.length % SPACE_PALETTE.length]}
        onAdd={(name, color) => addSpace({ name, color })}
      />
    </Modal>
  );
}

function SpaceRow({
  space,
  isFirst,
  isLast,
  canDelete,
  onRename,
  onColor,
  onUp,
  onDown,
  onDelete,
}: {
  space: Space;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  onRename: (name: string) => void;
  onColor: (color: string) => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(space.name);
  const [editingColor, setEditingColor] = useState(false);

  // 서버 반영/롤백으로 외부에서 이름이 바뀌면 초안도 맞춘다
  useEffect(() => setDraft(space.name), [space.name]);

  function commitName() {
    const n = draft.trim();
    if (n && n !== space.name) onRename(n);
    else setDraft(space.name);
  }

  return (
    <li className="rounded-xl border border-border bg-bg">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          onClick={() => setEditingColor((v) => !v)}
          aria-label="포인트 컬러 변경"
          className="grid size-7 shrink-0 place-items-center rounded-full ring-2 ring-transparent transition hover:ring-border"
        >
          <span className="size-3.5 rounded-full" style={{ background: space.color }} />
        </button>

        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur();
            if (e.key === 'Escape') {
              setDraft(space.name);
              e.currentTarget.blur();
            }
          }}
          aria-label="공간 이름"
          className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-sm outline-none focus:bg-surface2"
        />

        <div className="flex shrink-0 items-center">
          <IconButton label="위로" onClick={onUp} disabled={isFirst}>
            <ArrowUp className="size-4" />
          </IconButton>
          <IconButton label="아래로" onClick={onDown} disabled={isLast}>
            <ArrowDown className="size-4" />
          </IconButton>
          <IconButton
            label="공간 삭제"
            onClick={onDelete}
            disabled={!canDelete}
            className="hover:text-red-500"
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      {editingColor && (
        <div className="border-t border-border p-3">
          <ColorPicker
            value={space.color}
            onChange={(c) => {
              onColor(c);
              setEditingColor(false);
            }}
          />
        </div>
      )}
    </li>
  );
}

function AddSection({
  modalOpen,
  startOpen,
  defaultColor,
  onAdd,
}: {
  modalOpen: boolean;
  startOpen: boolean;
  defaultColor: string;
  onAdd: (name: string, color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(defaultColor);

  // 모달이 열릴 때마다 '공간 추가' 버튼으로 열었으면 폼을 펼친 채로, ⚙로 열었으면 접은 채로 시작
  useEffect(() => {
    if (modalOpen) {
      setOpen(startOpen);
      setName('');
      setColor(defaultColor);
    }
    // defaultColor는 목록 길이에 따라 바뀔 수 있어 의존성에서 제외 — 모달 열림 시점 값만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, startOpen]);

  function reset() {
    setName('');
    setColor(defaultColor);
    setOpen(false);
  }

  function commit() {
    const n = name.trim();
    if (!n) return;
    onAdd(n, color);
    reset();
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setColor(defaultColor);
          setOpen(true);
        }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-sm text-muted transition hover:border-accent hover:text-accent"
      >
        <Plus className="size-4" />새 공간 추가
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-bg p-3">
      <div className="flex items-center gap-2">
        <span className="size-3.5 shrink-0 rounded-full" style={{ background: color }} />
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) commit();
            if (e.key === 'Escape') reset();
          }}
          placeholder="새 공간 이름"
          aria-label="새 공간 이름"
          className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-sm outline-none focus:bg-surface2"
        />
      </div>

      <div className="mt-3">
        <p className="flex items-center gap-1.5 px-0.5 pb-2 text-xs text-muted">
          <Palette className="size-3.5" />
          포인트 컬러
        </p>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={reset}
          className="flex-1 rounded-lg border border-border py-2 text-sm text-muted transition hover:bg-surface2 hover:text-text"
        >
          취소
        </button>
        <button
          onClick={commit}
          disabled={!name.trim()}
          className="flex-1 rounded-lg bg-accent py-2 text-sm font-medium text-accentFg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          추가
        </button>
      </div>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div>
      <div className="grid grid-cols-8 gap-1.5">
        {SPACE_PALETTE.map((c) => {
          const active = value.toLowerCase() === c.toLowerCase();
          return (
            <button
              key={c}
              onClick={() => onChange(c)}
              aria-label={`색 ${c}`}
              aria-pressed={active}
              className={cn(
                'grid aspect-square place-items-center rounded-full ring-offset-2 ring-offset-surface transition',
                active ? 'ring-2 ring-text' : 'ring-0 hover:opacity-80'
              )}
              style={{ background: c }}
            >
              {active && <Check className="size-3.5 text-white" strokeWidth={3} />}
            </button>
          );
        })}
      </div>
      <label className="mt-2.5 flex items-center gap-2 text-xs text-muted">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-7 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
          aria-label="직접 색 선택"
        />
        직접 선택
      </label>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface2 hover:text-text disabled:pointer-events-none disabled:opacity-25',
        className
      )}
    >
      {children}
    </button>
  );
}
