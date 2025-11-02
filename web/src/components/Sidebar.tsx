import React from 'react';
import { theme } from '../theme';

interface SidebarProps {
  currentPage: 'dashboard' | 'tickers';
  onPageChange: (page: 'dashboard' | 'tickers') => void;
  isDarkTheme: boolean;
  onToggleTheme: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onPageChange,
  isDarkTheme,
  onToggleTheme,
}) => {
  return (
    <aside className="sidebar">
      {/* Brand Section */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          <img 
            src="/icons8-whale-50.png" 
            alt="PennyWhales" 
            width="24" 
            height="24"
          />
        </div>
        <h1 className="brand-text">PennyWhales</h1>
      </div>

      {/* Navigation Items */}
      <nav className="sidebar-nav">
        <button
          className={`sidebar-nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => onPageChange('dashboard')}
          title="Fire Dashboard"
        >
          <span className="nav-icon">🔥</span>
          <span className="nav-text">Dashboard</span>
        </button>
        
        <button
          className={`sidebar-nav-item ${currentPage === 'tickers' ? 'active' : ''}`}
          onClick={() => onPageChange('tickers')}
          title="Ticker Management"
        >
          <span className="nav-icon">🎯</span>
          <span className="nav-text">Tickers</span>
        </button>
      </nav>

      {/* Footer Actions */}
      <div className="sidebar-footer">
        <button 
          className="theme-toggle-sidebar" 
          onClick={onToggleTheme}
          title={`Switch to ${isDarkTheme ? 'light' : 'dark'} theme`}
        >
          <span className="toggle-icon">
            {isDarkTheme ? '☀️' : '🌙'}
          </span>
          <span className="toggle-text">
            {isDarkTheme ? 'Light' : 'Dark'}
          </span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;