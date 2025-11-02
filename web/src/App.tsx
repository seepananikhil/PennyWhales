import React, { useState } from 'react';
import './App.css';
import { ThemeProvider, useTheme } from './ThemeContext';
import FireDashboard from './FireDashboard';
import TickerManagement from './TickerManagement';

type Page = 'dashboard' | 'tickers';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app" data-theme={theme}>
      <nav className="app-nav">
        <div className="nav-brand">
          <h1>📈 Stock Scanner</h1>
        </div>
        <div className="nav-links">
          <button 
            className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
          >
            🏠 Dashboard
          </button>
          <button 
            className={`nav-link ${currentPage === 'tickers' ? 'active' : ''}`}
            onClick={() => setCurrentPage('tickers')}
          >
            🎯 Tickers
          </button>
        </div>
        <div className="nav-actions">
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </nav>

      <main className="app-main">
        {currentPage === 'dashboard' && <FireDashboard />}
        {currentPage === 'tickers' && <TickerManagement />}
      </main>
    </div>
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