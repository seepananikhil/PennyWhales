import React from 'react';
import { theme } from '../theme';

interface FilterButtonProps {
  isActive: boolean;
  onClick: () => void;
  count: number;
  icon: string;
  label: string;
  description: string;
  color: {
    primary: string;
    secondary?: string;
  };
}

const FilterButton: React.FC<FilterButtonProps> = ({
  isActive,
  onClick,
  count,
  icon,
  label,
  description,
  color
}) => {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: theme.spacing.lg,
        backgroundColor: isActive ? color.primary : theme.ui.surface,
        color: isActive ? theme.ui.surface : color.primary,
        border: `2px solid ${color.primary}`,
        borderRadius: theme.borderRadius.lg,
        textAlign: "center",
        boxShadow: isActive
          ? `0 4px 8px ${color.primary}40`
          : theme.ui.shadow.md,
        cursor: "pointer",
        transition: `all ${theme.transition.slow}`,
        transform: isActive ? "translateY(-1px)" : "none",
        fontFamily: theme.typography.fontFamily,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = `${color.primary}10`;
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = theme.ui.surface;
          e.currentTarget.style.transform = "translateY(0)";
        }
      }}
    >
      <div
        style={{
          fontSize: theme.typography.fontSize.xxl,
          fontWeight: theme.typography.fontWeight.bold,
          marginBottom: theme.spacing.sm,
          color: isActive ? theme.ui.surface : color.primary,
        }}
      >
        {count}
      </div>
      <div 
        style={{ 
          fontSize: theme.typography.fontSize.sm, 
          fontWeight: theme.typography.fontWeight.semibold,
          marginBottom: theme.spacing.xs,
          color: isActive ? theme.ui.surface : color.primary,
        }}
      >
        {icon} {label}
      </div>
      <div 
        style={{ 
          fontSize: theme.typography.fontSize.xs, 
          opacity: 0.8,
          color: isActive ? theme.ui.surface : color.primary,
        }}
      >
        {description}
      </div>
    </button>
  );
};

export default FilterButton;