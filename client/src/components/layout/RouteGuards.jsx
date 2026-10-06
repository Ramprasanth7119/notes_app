import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/auth';
import { ErrorState, LoadingState } from '../ui/States';

// The server is the source of truth for authentication; these guards only
// decide what to render. Every API route is protected server-side anyway.

function SessionGate({ children }) {
  const { status, error, checkSession } = useAuth();

  if (status === 'loading') {
    return (
      <div className="fullscreen">
        <LoadingState label="Connecting…" />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="fullscreen">
        <ErrorState title="Can't reach the server" error={error} onRetry={checkSession} />
      </div>
    );
  }
  return children;
}

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  return (
    <SessionGate>
      {status === 'authenticated' ? (
        <Outlet />
      ) : (
        <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
      )}
    </SessionGate>
  );
}

export function PublicOnly() {
  const { status } = useAuth();
  const location = useLocation();

  return (
    <SessionGate>
      {status === 'authenticated' ? <Navigate to={location.state?.from || '/'} replace /> : <Outlet />}
    </SessionGate>
  );
}
