import React, { useState, useEffect } from 'react';
import { Stock } from '../types';
import { theme, getFireLevelStyle } from '../theme';
import api from '../api';

// Custom eye icons as React components
const EyeIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
  </svg>
);

const EyeOffIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
  </svg>
);

interface StockCardProps {
  stock: Stock;
  livePrice?: {
    price: number;
    priceChange: number;
    timestamp: string;
  };
  isHolding: boolean;
  isInWatchlist?: boolean;
  onToggleHolding: (ticker: string) => void;
  onToggleWatchlist?: (ticker: string) => void;
  onOpenChart: (ticker: string) => void;
  borderColor?: string;
  showHoldingStar?: boolean;
  showWatchButton?: boolean;
}

const StockCard: React.FC<StockCardProps> = ({
  stock,
  livePrice,
  isHolding,
  isInWatchlist = false,
  onToggleHolding,
  onToggleWatchlist,
  onOpenChart,
  borderColor,
  showHoldingStar = true,
  showWatchButton = true
}) => {
  const [currentPrice, setCurrentPrice] = useState(livePrice?.price || stock.price);
  const [priceChange, setPriceChange] = useState(livePrice?.priceChange || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(livePrice ? new Date(livePrice.timestamp) : null);

  const fireLevel = stock.fire_level || 0;
  const fireStyle = getFireLevelStyle(fireLevel);
  const cardBorderColor = fireLevel > 0 ? fireStyle.border : (borderColor || theme.ui.border);

  // Fetch live price data via proxy API
  const fetchLivePrice = async () => {
    try {
      setIsLoading(true);
      const data = await api.getLivePrice(stock.ticker);
      
      setCurrentPrice(data.price);
      setPriceChange(data.priceChange);
      setLastUpdated(new Date());
    } catch (error) {
      console.error(`Error fetching live price for ${stock.ticker}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update local state when livePrice prop changes
  useEffect(() => {
    if (livePrice) {
      setCurrentPrice(livePrice.price);
      setPriceChange(livePrice.priceChange);
      setLastUpdated(new Date(livePrice.timestamp));
    }
  }, [livePrice]);

  // Set up auto-refresh only if no livePrice is provided (fallback mode)
  useEffect(() => {
    if (livePrice) {
      // If live price is provided from parent, don't fetch independently
      return;
    }

    // Initial fetch after component mounts (with small delay to stagger requests)
    const initialDelay = Math.random() * 5000; // Random delay 0-5 seconds
    const initialTimer = setTimeout(() => {
      fetchLivePrice();
    }, initialDelay);

    // Set up interval for every 5 minutes
    const interval = setInterval(() => {
      fetchLivePrice();
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [stock.ticker, livePrice]);

  const getFireEmoji = (level: number): string => {
    return getFireLevelStyle(level).emoji;
  };

  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          @keyframes priceUpdate {
            0% { background-color: transparent; }
            50% { background-color: rgba(75, 192, 192, 0.2); }
            100% { background-color: transparent; }
          }
        `}
      </style>
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
          {showWatchButton && onToggleWatchlist && isInWatchlist && (
            <span 
              style={{ 
                color: "#dc3545", 
                marginLeft: "6px",
                cursor: "pointer",
                fontSize: "1.1rem",
                backgroundColor: "#f8d7da",
                padding: "4px 6px",
                borderRadius: "12px",
                border: "1px solid #f5c6cb",
                boxShadow: "0 1px 3px rgba(220,53,69,0.3)",
                display: "inline-flex",
                alignItems: "center",
                transition: "all 0.2s ease"
              }}
              onClick={(e) => {
                e.stopPropagation();
                console.log('Watch button clicked for:', stock.ticker, 'isInWatchlist:', isInWatchlist, 'onToggleWatchlist:', !!onToggleWatchlist);
                onToggleWatchlist!(stock.ticker);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(220,53,69,0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(220,53,69,0.3)";
              }}
              title="Remove from watchlist"
            >
              <EyeOffIcon size={14} />
            </span>
          )}
          {showWatchButton && onToggleWatchlist && !isInWatchlist && (
            <span 
              style={{ 
                color: "#17a2b8", 
                marginLeft: "6px",
                cursor: "pointer",
                fontSize: "1.1rem",
                backgroundColor: "#d1ecf1",
                padding: "4px 6px",
                borderRadius: "12px",
                border: "1px solid #bee5eb",
                boxShadow: "0 1px 2px rgba(23,162,184,0.3)",
                display: "inline-flex",
                alignItems: "center",
                transition: "all 0.2s ease"
              }}
              onClick={(e) => {
                e.stopPropagation();
                console.log('Watch button clicked for:', stock.ticker, 'isInWatchlist:', isInWatchlist, 'onToggleWatchlist:', !!onToggleWatchlist);
                onToggleWatchlist!(stock.ticker);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.backgroundColor = "#bee5eb";
                e.currentTarget.style.color = "#0c5460";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.backgroundColor = "#d1ecf1";
                e.currentTarget.style.color = "#17a2b8";
              }}
              title="Add to watchlist"
            >
              <EyeIcon size={14} />
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
          position: "relative",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          ${currentPrice.toFixed(2)}
          {isLoading && (
            <span 
              style={{ 
                fontSize: "0.6rem", 
                color: "#999",
                animation: "pulse 1.5s ease-in-out infinite"
              }}
            >
              🔄
            </span>
          )}
        </span>
        {priceChange !== undefined && priceChange !== 0 && (
          <span
            style={{
              fontSize: "0.75rem",
              color: priceChange > 0 ? "#28a745" : "#dc3545",
              fontWeight: "normal",
            }}
          >
            ({priceChange > 0 ? "+" : ""}{priceChange.toFixed(2)}%)
          </span>
        )}
      </div>
      
      <div
        style={{
          fontSize: theme.typography.fontSize.lg,
          color: "#666",
          lineHeight: "1.2",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>
          BR: {stock.blackrock_pct.toFixed(1)}%
          {stock.blackrock_market_value && stock.blackrock_market_value > 0 && (
            <span style={{ 
              fontSize: theme.typography.fontSize.xs, 
              color: "#888", 
              fontWeight: "normal" 
            }}
            > (${stock.blackrock_market_value >= 1000 
                ? `${(stock.blackrock_market_value / 1000).toFixed(1)}B` 
                : `${stock.blackrock_market_value.toFixed(1)}M`})
            </span>
          )}
        </span>
        <span>
          VG: {stock.vanguard_pct.toFixed(1)}%
          {stock.vanguard_market_value && stock.vanguard_market_value > 0 && (
            <span style={{ 
              fontSize: theme.typography.fontSize.xs, 
              color: "#888", 
              fontWeight: "normal" 
            }}
            > (${stock.vanguard_market_value >= 1000 
                ? `${(stock.vanguard_market_value / 1000).toFixed(1)}B` 
                : `${stock.vanguard_market_value.toFixed(1)}M`})
            </span>
          )}
        </span>
      </div>
    </div>
    </>
  );
};

export default StockCard;