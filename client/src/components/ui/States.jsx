import { useEffect, useState } from 'react';
import { BsExclamationTriangle } from 'react-icons/bs';

export function Spinner({ label = 'Loading' }) {
  return <span className="spinner" role="status" aria-label={label} />;
}

// The API runs on a free host that sleeps when idle, so the first request
// can take a while. Say so if loading takes longer than a few seconds.
export function LoadingState({ label = 'Loading…' }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="state" aria-busy="true">
      <Spinner label={label} />
      <p className="muted">{label}</p>
      {slow && <p className="muted small">The server may be waking up — this can take up to a minute.</p>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', error, onRetry }) {
  return (
    <div className="state state--error" role="alert">
      <BsExclamationTriangle className="state__icon" aria-hidden="true" />
      <h2 className="state__title">{title}</h2>
      {error && <p className="muted">{error.message}</p>}
      {onRetry && (
        <button type="button" className="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="state">
      {Icon && <Icon className="state__icon" aria-hidden="true" />}
      <h2 className="state__title">{title}</h2>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}
