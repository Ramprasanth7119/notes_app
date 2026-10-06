import { createContext, useContext } from 'react';

export const ToastContext = createContext(null);

// toast.show(message, 'success' | 'error' | 'info')
export const useToast = () => useContext(ToastContext);
