import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { ThemeProvider, useTheme } from './ThemeContext';
import FireDashboard from './FireDashboard';
import TickerManagement from './TickerManagement';
import Scans from './Scans';
import Sidebar from './components/Sidebar';

const AppContent: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Router>
      <div className="app" data-theme={theme}>
        <Sidebar
          isDarkTheme={theme === 'dark'}
          onToggleTheme={toggleTheme}
        />
        
        <div className="app-content">
          <main className="app-main">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<FireDashboard />} />
              <Route path="/tickers" element={<TickerManagement />} />
              <Route path="/scans" element={<Scans />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
