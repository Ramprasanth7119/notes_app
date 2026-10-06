import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AuthProvider from './contexts/AuthProvider';
import ThemeProvider from './contexts/ThemeProvider';
import ToastProvider from './contexts/ToastProvider';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>
);
