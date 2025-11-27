// Design System & Theme Configuration
export const theme = {
  // Fire Level Colors
  fire: {
    level5: {
      primary: '#8B0000',    // Dark red for 5 fires (inferno)
      secondary: '#B22222',  // Fire brick red
      background: '#FFF0F0', // Very light red background  
      border: '#FFB3B3',     // Light red border
      emoji: '🔥🔥🔥🔥🔥'
    },
    level4: {
      primary: '#DC143C',    // Crimson for 4 fires
      secondary: '#FF1744',  // Bright crimson
      background: '#FFF0F0', // Very light crimson background
      border: '#FFB3B3',     // Light crimson border
      emoji: '🔥🔥🔥🔥'
    },
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
    case 5:
      return theme.fire.level5;
    case 4:
      return theme.fire.level4;
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

// Sector Configuration with Icons and Colors
export const sectors = {
  'Technology': {
    icon: '💻',
    color: '#4F46E5',      // Indigo
    background: '#EEF2FF',
    border: '#C7D2FE',
    description: 'Software, Hardware, IT Services'
  },
  'Healthcare': {
    icon: '🏥',
    color: '#DC2626',      // Red
    background: '#FEF2F2',
    border: '#FECACA',
    description: 'Biotechnology, Medical Devices, Healthcare Services'
  },
  'Financial': {
    icon: '💰',
    color: '#16A34A',      // Green
    background: '#F0FDF4',
    border: '#BBF7D0',
    description: 'Banks, Insurance, Asset Management'
  },
  'Consumer Cyclical': {
    icon: '🛍️',
    color: '#EA580C',      // Orange
    background: '#FFF7ED',
    border: '#FED7AA',
    description: 'Retail, Automotive, Leisure'
  },
  'Industrials': {
    icon: '🏭',
    color: '#64748B',      // Slate
    background: '#F8FAFC',
    border: '#CBD5E1',
    description: 'Manufacturing, Construction, Aerospace'
  },
  'Communication Services': {
    icon: '📡',
    color: '#7C3AED',      // Violet
    background: '#F5F3FF',
    border: '#DDD6FE',
    description: 'Telecom, Media, Entertainment'
  },
  'Consumer Defensive': {
    icon: '🛒',
    color: '#059669',      // Emerald
    background: '#ECFDF5',
    border: '#A7F3D0',
    description: 'Food, Beverages, Household Products'
  },
  'Energy': {
    icon: '⚡',
    color: '#CA8A04',      // Yellow
    background: '#FEFCE8',
    border: '#FDE68A',
    description: 'Oil & Gas, Renewable Energy'
  },
  'Real Estate': {
    icon: '🏢',
    color: '#0891B2',      // Cyan
    background: '#ECFEFF',
    border: '#A5F3FC',
    description: 'REITs, Real Estate Services'
  },
  'Basic Materials': {
    icon: '⚙️',
    color: '#9333EA',      // Purple
    background: '#FAF5FF',
    border: '#E9D5FF',
    description: 'Chemicals, Metals, Mining'
  },
  'Utilities': {
    icon: '💡',
    color: '#0D9488',      // Teal
    background: '#F0FDFA',
    border: '#99F6E4',
    description: 'Electric, Water, Gas Utilities'
  }
};

// Helper function to get sector styling
export const getSectorStyle = (sector: string) => {
  return sectors[sector as keyof typeof sectors] || {
    icon: '📊',
    color: '#6B7280',
    background: '#F9FAFB',
    border: '#E5E7EB',
    description: 'Other'
  };
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