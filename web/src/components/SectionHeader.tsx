import React from 'react';
import { theme } from '../theme';

interface SectionHeaderProps {
  title: string;
  count: number;
  color: string;
  actions?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  count,
  color,
  actions
}) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: theme.spacing.lg,
      }}
    >
      <h2
        style={{
          color,
          margin: 0,
          fontSize: theme.typography.fontSize.xl,
          fontWeight: theme.typography.fontWeight.bold,
          fontFamily: theme.typography.fontFamily,
        }}
      >
        {title} ({count})
      </h2>
      {actions && (
        <div style={{ display: "flex", gap: theme.spacing.sm }}>
          {actions}
        </div>
      )}
    </div>
  );
};

export default SectionHeader;