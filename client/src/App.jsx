import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Home from './pages/Home';
import NoteView from './pages/NoteView';
import EditNote from './pages/EditNote';
import Navbar from './components/Navbar';
import Collections from './components/Collections';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Navbar />
        <div className="container mt-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/notes/:id" element={<NoteView />} />
            <Route path="/edit/:id" element={<EditNote />} />
            <Route path="/collections" element={<Collections />} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;