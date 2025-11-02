// Design System & Theme Configuration
export const theme = {
  // Fire Level Colors
  fire: {
    level3: {
      primary: '#FF4444',    // Bright red for 3 fires
      secondary: '#FF6B6B',  // Lighter red
      background: '#FFF5F5', // Very light red background
      border: '#FFCCCC',     // Light red border
      emoji: '🔥🔥🔥'
    },
    level2: {
      primary: '#FF8C00',    // Dark orange for 2 fires
      secondary: '#FFA500',  // Orange
      background: '#FFF8F0', // Very light orange background
      border: '#FFE0B3',     // Light orange border
      emoji: '🔥🔥'
    },
    level1: {
      primary: '#FFD700',    // Gold for 1 fire
      secondary: '#FFEB3B',  // Light gold
      background: '#FFFEF0', // Very light gold background
      border: '#FFF9C4',     // Light gold border
      emoji: '🔥'
    }
  },

  // Price Filter Colors
  price: {
    under1: {
      primary: '#28a745',
      secondary: '#34ce57',
      background: '#f8fff9',
      border: '#c3e6cb',
      hover: 'rgba(40,167,69,0.1)'
    },
    range1to2: {
      primary: '#17a2b8',
      secondary: '#20c997',
      background: '#f8feff',
      border: '#bee5eb',
      hover: 'rgba(23,162,184,0.1)'
    },
    over2: {
      primary: '#6f42c1',
      secondary: '#8a63d2',
      background: '#faf8ff',
      border: '#d6c9f0',
      hover: 'rgba(111,66,193,0.1)'
    }
  },

  // Holdings Colors
  holdings: {
    primary: '#FFD700',
    secondary: '#FFA500',
    background: '#fff3cd',
    border: '#ffeaa7',
    hover: 'rgba(255,215,0,0.1)',
    star: {
      filled: '#FFD700',
      empty: '#CCC',
      background: {
        filled: '#fff3cd',
        empty: '#f8f9fa'
      },
      border: {
        filled: '#ffeaa7',
        empty: '#e9ecef'
      }
    }
  },

  // Base UI Colors
  ui: {
    background: '#f8f9fa',
    surface: '#ffffff',
    border: '#dee2e6',
    text: {
      primary: '#333333',
      secondary: '#666666',
      muted: '#999999'
    },
    shadow: {
      sm: '0 1px 3px rgba(0,0,0,0.1)',
      md: '0 2px 6px rgba(0,0,0,0.1)',
      lg: '0 4px 8px rgba(0,0,0,0.15)',
      xl: '0 8px 16px rgba(0,0,0,0.2)'
    }
  },

  // Status Colors
  status: {
    success: '#28a745',
    danger: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8',
    new: '#28a745'
  },

  // Typography
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '0.65rem',
      sm: '0.75rem',
      base: '0.9rem',
      lg: '1rem',
      xl: '1.3rem',
      xxl: '1.5rem'
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    }
  },

  // Spacing
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px'
  },

  // Border Radius
  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '50%'
  },

  // Transitions
  transition: {
    fast: '0.15s ease',
    normal: '0.2s ease',
    slow: '0.3s ease'
  }
};

// Helper functions for getting fire level styling
export const getFireLevelStyle = (level: number) => {
  switch (level) {
    case 3:
      return theme.fire.level3;
    case 2:
      return theme.fire.level2;
    case 1:
      return theme.fire.level1;
    default:
      return {
        primary: theme.ui.text.muted,
        secondary: theme.ui.text.muted,
        background: theme.ui.surface,
        border: theme.ui.border,
        emoji: ''
      };
  }
};

// Helper function for price filter styling
export const getPriceFilterStyle = (filter: string) => {
  switch (filter) {
    case 'under1':
      return theme.price.under1;
    case '1to2':
      return theme.price.range1to2;
    case 'over2':
      return theme.price.over2;
    default:
      return theme.price.under1;
  }
};

export default theme;