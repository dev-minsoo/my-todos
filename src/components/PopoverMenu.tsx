import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  /** 트리거 버튼 내용 */
  trigger: ReactNode;
  triggerClassName?: string;
  triggerLabel: string;
  /** 메뉴 가로 정렬 기준 (기본 start = 트리거 왼쪽 맞춤) */
  align?: 'start' | 'end';
  /** 메뉴 너비(px) */
  width?: number;
  /** 열림 상태가 바뀔 때 (내부 상태 초기화 등에 사용) */
  onOpenChange?: (open: boolean) => void;
  /** 메뉴 본문 — close()를 받아 항목 선택 시 닫는다 */
  children: (close: () => void) => ReactNode;
};

const DEFAULT_WIDTH = 224;

/** 메뉴 안에서 키보드로 오갈 수 있는(보이는) 요소들 */
function menuFocusables(node: HTMLElement): HTMLElement[] {
  return Array.from(
    node.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null);
}

/**
 * 트리거 버튼 + body 포털 메뉴. 트리거 위치를 기준으로 좌표를 잡아
 * 스크롤 컨테이너의 clip을 피하고, 화면 아래쪽이면 위로 편다.
 * 바깥 클릭 / Esc / 스크롤 / 리사이즈 시 닫힌다.
 */
export function PopoverMenu({
  trigger,
  triggerClassName,
  triggerLabel,
  align = 'start',
  width = DEFAULT_WIDTH,
  onOpenChange,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number }>({ left: 0, top: 0 });

  const setOpenAnd = (v: boolean) => {
    setOpen(v);
    onOpenChange?.(v);
  };
  const close = () => setOpenAnd(false);

  useLayoutEffect(() => {
    if (!open) return;
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = align === 'end' ? r.right - width : r.left;
    left = Math.min(Math.max(8, left), vw - width - 8);
    if (r.top > vh * 0.6) setPos({ left, bottom: vh - r.top + 6 });
    else setPos({ left, top: r.bottom + 6 });
  }, [open, align, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onScroll = () => close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 열리면 메뉴 안 첫 요소로 포커스를 옮긴다(키보드 사용자가 트리거에 갇히지 않게).
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const node = menuRef.current;
      if (node) menuFocusables(node)[0]?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // ↑/↓(및 Home/End)로 메뉴 항목 사이를 순환 이동한다.
  function onMenuKeyDown(e: React.KeyboardEvent) {
    const node = menuRef.current;
    if (!node) return;
    const items = menuFocusables(node);
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[idx < 0 ? 0 : (idx + 1) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[idx < 0 ? items.length - 1 : (idx - 1 + items.length) % items.length].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpenAnd(!open);
        }}
        className={triggerClassName}
      >
        {trigger}
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={triggerLabel}
            className="fixed z-50 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
            style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width }}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={onMenuKeyDown}
          >
            {children(close)}
          </div>,
          document.body
        )}
    </>
  );
}
