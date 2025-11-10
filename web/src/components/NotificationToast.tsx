import React, { useEffect } from 'react';
import { theme } from '../theme';

interface NotificationToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

const NotificationToast: React.FC<NotificationToastProps> = ({
  message,
  type,
  onClose,
  duration = 5000
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          bg: '#d4edda',
          border: '#c3e6cb',
          text: '#155724',
          icon: '✅'
        };
      case 'error':
        return {
          bg: '#f8d7da',
          border: '#f5c6cb',
          text: '#721c24',
          icon: '❌'
        };
      case 'info':
        return {
          bg: '#d1ecf1',
          border: '#bee5eb',
          text: '#0c5460',
          icon: '🔔'
        };
    }
  };

  const colors = getColors();

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        backgroundColor: colors.bg,
        color: colors.text,
        padding: '16px 20px',
        borderRadius: theme.borderRadius.md,
        border: `1px solid ${colors.border}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minWidth: '300px',
        maxWidth: '500px',
        animation: 'slideInRight 0.3s ease-out'
      }}
    >
      <style>
        {`
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          @keyframes slideOutRight {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(100%);
              opacity: 0;
            }
          }
        `}
      </style>
      <span style={{ fontSize: '1.5rem' }}>{colors.icon}</span>
      <span style={{ flex: 1, fontSize: '0.95rem', fontWeight: '500' }}>
        {message}
      </span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: colors.text,
          fontSize: '1.2rem',
          cursor: 'pointer',
          padding: '0 4px',
          opacity: 0.7
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
      >
        ×
      </button>
    </div>
  );
};

export default NotificationToast;
