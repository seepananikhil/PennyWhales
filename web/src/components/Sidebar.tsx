import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../theme';

interface SidebarProps {
  isDarkTheme: boolean;
  onToggleTheme: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
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
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          title="Fire Dashboard"
        >
          <span className="nav-icon">🔥</span>
          <span className="nav-text">Dashboard</span>
        </NavLink>
        
        <NavLink
          to="/tickers"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          title="Ticker Management"
        >
          <span className="nav-icon">🎯</span>
          <span className="nav-text">Tickers</span>
        </NavLink>

        <NavLink
          to="/scans"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          title="Stock Scans"
        >
          <span className="nav-icon">🔍</span>
          <span className="nav-text">Scans</span>
        </NavLink>
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