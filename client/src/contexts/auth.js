import { createContext, useContext } from 'react';

// status: 'loading' | 'authenticated' | 'anonymous' | 'error'
export const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);
