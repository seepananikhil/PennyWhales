import React from 'react';
import { Stock } from '../types';
import { theme, getFireLevelStyle } from '../theme';

interface StockCardProps {
  stock: Stock;
  isHolding: boolean;
  onToggleHolding: (ticker: string) => void;
  onOpenChart: (ticker: string) => void;
  borderColor?: string;
  showHoldingStar?: boolean;
}

const StockCard: React.FC<StockCardProps> = ({
  stock,
  isHolding,
  onToggleHolding,
  onOpenChart,
  borderColor,
  showHoldingStar = true
}) => {
  const fireLevel = stock.fire_level || 0;
  const fireStyle = getFireLevelStyle(fireLevel);
  const cardBorderColor = fireLevel > 0 ? fireStyle.border : (borderColor || theme.ui.border);

  const getFireEmoji = (level: number): string => {
    return getFireLevelStyle(level).emoji;
  };

  return (
    <div
      onClick={() => onOpenChart(stock.ticker)}
      style={{
        padding: theme.spacing.md,
        backgroundColor: fireLevel > 0 ? fireStyle.background : theme.ui.surface,
        border: `2px solid ${cardBorderColor}`,
        borderRadius: theme.borderRadius.md,
        cursor: "pointer",
        transition: `all ${theme.transition.normal}`,
        boxShadow: theme.ui.shadow.sm,
        fontFamily: theme.typography.fontFamily,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = theme.ui.shadow.lg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: theme.spacing.sm,
        }}
      >
        <span
          style={{
            fontWeight: theme.typography.fontWeight.bold,
            fontSize: theme.typography.fontSize.lg,
            color: theme.ui.text.primary,
            textTransform: "uppercase",
          }}
        >
          {stock.ticker}
          {showHoldingStar && isHolding && (
            <span 
              style={{ 
                color: "#ffd700", 
                marginLeft: "6px",
                cursor: "pointer",
                fontSize: "1.3rem",
                backgroundColor: "#fff3cd",
                padding: "2px 6px",
                borderRadius: "12px",
                border: "1px solid #ffeaa7",
                boxShadow: "0 1px 3px rgba(255,215,0,0.3)",
                display: "inline-block",
                transition: "all 0.2s ease"
              }}
              onClick={(e) => {
                e.stopPropagation();
                onToggleHolding(stock.ticker);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(255,215,0,0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(255,215,0,0.3)";
              }}
              title="Currently holding (click to remove)"
            >
              ⭐
            </span>
          )}
          {showHoldingStar && !isHolding && (
            <span 
              style={{ 
                color: "#999", 
                marginLeft: "6px",
                cursor: "pointer",
                fontSize: "1.3rem",
                backgroundColor: "#f8f9fa",
                padding: "2px 6px",
                borderRadius: "12px",
                border: "1px solid #e9ecef",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                display: "inline-block",
                transition: "all 0.2s ease"
              }}
              onClick={(e) => {
                e.stopPropagation();
                onToggleHolding(stock.ticker);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.backgroundColor = "#fff3cd";
                e.currentTarget.style.borderColor = "#ffeaa7";
                e.currentTarget.style.color = "#ffd700";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.backgroundColor = "#f8f9fa";
                e.currentTarget.style.borderColor = "#e9ecef";
                e.currentTarget.style.color = "#999";
              }}
              title="Click to mark as holding"
            >
              ☆
            </span>
          )}
          {stock.is_new && (
            <span 
              style={{ 
                color: theme.status.new, 
                marginLeft: theme.spacing.xs,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold
              }}
            >
              NEW
            </span>
          )}
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: theme.spacing.xs,
          }}
        >
          {stock.fire_level_changed && (
            <span
              style={{
                fontSize: theme.typography.fontSize.sm,
                color: stock.fire_level! > (stock.previous_fire_level || 0)
                  ? theme.status.success
                  : theme.status.danger,
                fontWeight: theme.typography.fontWeight.bold,
              }}
            >
              {stock.fire_level! > (stock.previous_fire_level || 0) ? "▲" : "▼"}
            </span>
          )}
          <span style={{ fontSize: theme.typography.fontSize.lg }}>
            {getFireEmoji(fireLevel)}
          </span>
        </div>
      </div>
      
      <div
        style={{
          fontWeight: theme.typography.fontWeight.bold,
          fontSize: theme.typography.fontSize.lg,
          color: "#4F46E5",
          marginBottom: theme.spacing.sm,
          display: "flex",
          alignItems: "center",
          gap: theme.spacing.xs,
        }}
      >
        ${stock.price.toFixed(2)}
        {stock.price_change !== undefined && stock.price_change !== 0 && (
          <span
            style={{
              fontSize: theme.typography.fontSize.sm,
              color: stock.price_change > 0 ? theme.status.danger : theme.status.success,
              fontWeight: theme.typography.fontWeight.normal,
            }}
          >
            ({stock.price_change > 0 ? "+" : ""}${stock.price_change.toFixed(2)})
          </span>
        )}
      </div>
      
      <div
        style={{
          fontSize: theme.typography.fontSize.sm,
          color: theme.ui.text.secondary,
          lineHeight: "1.2",
        }}
      >
        <div>BR: {stock.blackrock_pct.toFixed(1)}%</div>
        <div>VG: {stock.vanguard_pct.toFixed(1)}%</div>
      </div>
    </div>
  );
};

export default StockCard;