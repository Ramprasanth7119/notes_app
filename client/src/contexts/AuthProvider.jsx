import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as authApi from '../api/auth';
import { setSessionExpiredHandler } from '../api/http';
import { AuthContext } from './auth';
import { useToast } from './toast';

// The browser holds the session in an httpOnly cookie that JavaScript cannot
// read, so the only way to know who is signed in is to ask the server
// (GET /api/auth/me). The result lives here for the whole app.
export default function AuthProvider({ children }) {
  const toast = useToast();
  const [state, setState] = useState({ status: 'loading', user: null, error: null });

  const checkSession = useCallback(async () => {
    setState({ status: 'loading', user: null, error: null });
    try {
      const user = await authApi.getCurrentUser();
      setState({ status: 'authenticated', user, error: null });
    } catch (error) {
      // 401 just means "not signed in"; anything else (server asleep or
      // unreachable) is shown as an error with a retry button.
      setState(
        error.status === 401
          ? { status: 'anonymous', user: null, error: null }
          : { status: 'error', user: null, error }
      );
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Any API call that comes back 401 means the cookie expired or was cleared.
  const statusRef = useRef(state.status);
  useEffect(() => {
    statusRef.current = state.status;
  }, [state.status]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      if (statusRef.current !== 'authenticated') return;
      statusRef.current = 'anonymous';
      toast.show('Your session has expired. Please log in again.', 'error');
      setState({ status: 'anonymous', user: null, error: null });
    });
  }, [toast]);

  const value = useMemo(
    () => ({
      ...state,
      checkSession,
      login: async (credentials) => {
        const user = await authApi.login(credentials);
        setState({ status: 'authenticated', user, error: null });
      },
      register: async (credentials) => {
        const user = await authApi.register(credentials);
        setState({ status: 'authenticated', user, error: null });
      },
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          setState({ status: 'anonymous', user: null, error: null });
        }
      }
    }),
    [state, checkSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
