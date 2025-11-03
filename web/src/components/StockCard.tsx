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
        padding: "12px",
        backgroundColor: fireLevel > 0 ? fireStyle.background : "#f8f9fa",
        border: `2px solid ${cardBorderColor}`,
        borderRadius: theme.borderRadius.md,
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        fontFamily: theme.typography.fontFamily,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 3px 6px rgba(0,0,0,0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "6px",
        }}
      >
        <span
          style={{
            fontWeight: "bold",
            fontSize: "1rem",
            color: "#333",
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
            <span style={{ color: "#28a745", marginLeft: "4px" }}>
              NEW
            </span>
          )}
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {stock.fire_level_changed && (
            <span
              style={{
                fontSize: "0.75rem",
                color: stock.fire_level! > (stock.previous_fire_level || 0)
                  ? "#28a745"
                  : "#dc3545",
                fontWeight: "bold",
              }}
            >
              {stock.fire_level! > (stock.previous_fire_level || 0) ? "▲" : "▼"}
            </span>
          )}
          <span style={{ fontSize: "1rem" }}>
            {getFireEmoji(fireLevel)}
          </span>
        </div>
      </div>
      
      <div
        style={{
          fontWeight: "bold",
          fontSize: "1rem",
          color: "#4F46E5",
          marginBottom: "6px",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        ${stock.price.toFixed(2)}
        {stock.price_change !== undefined && stock.price_change !== 0 && (
          <span
            style={{
              fontSize: "0.75rem",
              color: stock.price_change > 0 ? "#dc3545" : "#28a745",
              fontWeight: "normal",
            }}
          >
            ({stock.price_change > 0 ? "+" : ""}${stock.price_change.toFixed(2)})
          </span>
        )}
      </div>
      
      <div
        style={{
          fontSize: theme.typography.fontSize.xl,
          color: "#666",
          lineHeight: "1.2",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>BR: {stock.blackrock_pct.toFixed(1)}%</span>
        <span>VG: {stock.vanguard_pct.toFixed(1)}%</span>
      </div>
    </div>
  );
};

export default StockCard;