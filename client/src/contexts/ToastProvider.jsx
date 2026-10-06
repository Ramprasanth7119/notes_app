import { useCallback, useMemo, useRef, useState } from 'react';
import { BsCheckCircle, BsExclamationCircle, BsInfoCircle, BsX } from 'react-icons/bs';
import { ToastContext } from './toast';

const ICONS = { success: BsCheckCircle, error: BsExclamationCircle, info: BsInfoCircle };

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message, type = 'success') => {
      const id = ++nextId.current;
      setToasts((list) => [...list.slice(-2), { id, message, type }]);
      setTimeout(() => dismiss(id), type === 'error' ? 6000 : 3500);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map(({ id, message, type }) => {
          const Icon = ICONS[type] || BsInfoCircle;
          return (
            <div key={id} className={`toast toast--${type}`}>
              <Icon aria-hidden="true" className="toast__icon" />
              <span>{message}</span>
              <button type="button" className="icon-button icon-button--small" onClick={() => dismiss(id)} aria-label="Dismiss">
                <BsX aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
