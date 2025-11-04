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
          title="Dashboard"
        >
          <span className="nav-icon">🔥</span>
          <span className="nav-text">Dashboard</span>
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
        {/* Developer Credit */}
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          textAlign: 'center',
          borderTop: '1px solid var(--border-color)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          lineHeight: '1.4'
        }}>
          <div style={{ marginBottom: '0.25rem' }}>
            Developed with ❤️ by
          </div>
          <div style={{ 
            fontWeight: '600',
            color: 'var(--text-primary)',
            fontSize: '0.8rem'
          }}>
            Nikhil Seepana
          </div>
        </div>
    </aside>
  );
};

export default Sidebar;