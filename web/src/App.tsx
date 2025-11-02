import React, { useState } from 'react';
import './App.css';
import { ThemeProvider, useTheme } from './ThemeContext';
import FireDashboard from './FireDashboard';
import TickerManagement from './TickerManagement';
import Sidebar from './components/Sidebar';

type Page = 'dashboard' | 'tickers';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app" data-theme={theme}>
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        isDarkTheme={theme === 'dark'}
        onToggleTheme={toggleTheme}
      />
      
      <div className="app-content">
        <main className="app-main">
          {currentPage === 'dashboard' && <FireDashboard />}
          {currentPage === 'tickers' && <TickerManagement />}
        </main>
      </div>
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
