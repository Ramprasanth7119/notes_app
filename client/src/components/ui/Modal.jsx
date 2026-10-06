import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BsX } from 'react-icons/bs';

// Accessible dialog: Escape and the backdrop close it, focus moves into it and
// returns to the opener afterwards, and the page behind does not scroll.
export default function Modal({ open, title, onClose, children, footer, size = 'md' }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const firstField = panel?.querySelector('input, textarea, select, button:not(.modal__close)');
    (firstField || panel)?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('no-scroll');
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={panelRef}
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="modal__header">
          <h2 id={titleId} className="modal__title">{title}</h2>
          <button type="button" className="icon-button modal__close" onClick={onClose} aria-label="Close">
            <BsX aria-hidden="true" />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}
