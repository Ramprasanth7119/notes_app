import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import NavigationBar from './components/layout/Navbar';
import ToastMessage from './components/common/ToastMessage';
import Home from './pages/Home';
import NoteView from './pages/NoteView';
import EditNote from './pages/EditNote';
import Collections from './components/collections/Collections';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  const [toast, setToast] = useState({
    show: false,
    message: '',
    type: 'success'
  });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  return (
    <ThemeProvider>
      <Router>
        <NavigationBar showToast={showToast} />
        <ToastMessage 
          show={toast.show}
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
        />
        <div className="container mt-4">
          <Routes>
            <Route path="/" element={<Home showToast={showToast} />} />
            <Route path="/notes/:id" element={<NoteView showToast={showToast} />} />
            <Route path="/edit/:id" element={<EditNote showToast={showToast} />} />
            <Route path="/collections" element={<Collections showToast={showToast} />} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;