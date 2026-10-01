import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/**
 * 가벼운 다이얼로그: 포털 + 백드롭 클릭·Escape 닫기 + 바디 스크롤 잠금.
 * 데스크톱은 중앙 카드, 모바일은 하단 바텀시트로 뜬다.
 * (앱의 조작 기본은 인라인 — 이 모달은 공간 관리처럼 드문 설정에만 쓴다.)
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // 열기 전에 포커스가 있던 곳(트리거)을 기억했다가 닫을 때 되돌려 준다.
    const prevActive = document.activeElement as HTMLElement | null;

    // 다이얼로그 안의 포커스 가능한 요소들(보이는 것만).
    const focusablesIn = (node: HTMLElement) =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);

    // 마운트/애니메이션 직후 첫 포커스 대상으로 이동(없으면 다이얼로그 자체).
    const raf = requestAnimationFrame(() => {
      const node = dialogRef.current;
      if (!node) return;
      (focusablesIn(node)[0] ?? node).focus();
    });

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // 포커스 트랩: Tab이 다이얼로그 밖으로 나가면 양 끝에서 되돌린다.
      if (e.key !== 'Tab') return;
      const node = dialogRef.current;
      if (!node) return;
      const list = focusablesIn(node);
      if (list.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !node.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !node.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      // 닫히면 열기 전 요소로 포커스 복귀(키보드 흐름이 끊기지 않게).
      prevActive?.focus?.();
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-card outline-none sm:max-w-md sm:rounded-2xl"
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="text-base font-semibold">{title}</h2>
              <button
                onClick={onClose}
                aria-label="닫기"
                className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-surface2 hover:text-text"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
