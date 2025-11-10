import React, { useState, useEffect } from "react";
import { Stock } from "../types";
import { theme, getFireLevelStyle } from "../theme";
import api from "../api";
import { SiTradingview } from "react-icons/si";
import { FaBell, FaBellSlash } from "react-icons/fa";
import { MdDelete, MdDeleteForever } from "react-icons/md";
import PriceAlertModal from "./PriceAlertModal";

// Custom eye icons as React components
const EyeIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
  </svg>
);

const EyeOffIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
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
  showDeleteButton?: boolean;
  onDeleteTicker?: (ticker: string) => void;
  isSelected?: boolean;
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
  showWatchButton = true,
  showDeleteButton = true,
  onDeleteTicker,
  isSelected = false,
}) => {
  const [currentPrice, setCurrentPrice] = useState(
    livePrice?.price || stock.price
  );
  const [priceChange, setPriceChange] = useState(livePrice?.priceChange || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    livePrice ? new Date(livePrice.timestamp) : null
  );
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [hasAlerts, setHasAlerts] = useState(false);
  const [alertCheckKey, setAlertCheckKey] = useState(0);

  const fireLevel = stock.fire_level || 0;
  const fireStyle = getFireLevelStyle(fireLevel);
  const cardBorderColor = isSelected
    ? fireLevel > 0
      ? fireStyle.primary
      : theme.status.info
    : fireLevel > 0
    ? fireStyle.border
    : borderColor || theme.ui.border;
  const cardBackgroundColor = isSelected
    ? fireLevel > 0
      ? fireStyle.background
      : "#e3f2fd"
    : fireLevel > 0
    ? fireStyle.background
    : "#f8f9fa";

  // Check if this stock has active alerts
  useEffect(() => {
    const checkAlerts = async () => {
      try {
        const result = await api.getAlertsByTicker(stock.ticker);
        const activeAlerts = result.alerts.some(
          (a: any) => a.active && !a.triggered
        );
        setHasAlerts(activeAlerts);
      } catch (error) {
        console.error("Error checking alerts:", error);
      }
    };
    checkAlerts();
  }, [stock.ticker, alertCheckKey]); // Re-check when alertCheckKey changes

  const handleAlertModalClose = () => {
    setShowAlertModal(false);
    // Trigger re-check of alerts when modal closes
    setAlertCheckKey((prev) => prev + 1);
  };

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
          padding: "6px",
          backgroundColor: cardBackgroundColor,
          border: `${isSelected ? "2px" : "1px"} solid ${cardBorderColor}`,
          borderRadius: "6px",
          cursor: "pointer",
          transition: "all 0.2s ease",
          boxShadow: isSelected
            ? "0 2px 8px rgba(0,0,0,0.15)"
            : "0 1px 2px rgba(0,0,0,0.08)",
          fontFamily: theme.typography.fontFamily,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.12)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = isSelected
            ? "0 2px 8px rgba(0,0,0,0.15)"
            : "0 1px 2px rgba(0,0,0,0.08)";
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontWeight: "bold",
                fontSize: "1.05rem",
                color: "#333",
                textTransform: "uppercase",
              }}
            >
              {stock.ticker}
            </span>
            <span style={{ fontSize: "1rem" }}>{getFireEmoji(fireLevel)}</span>
            {stock.is_new && (
              <span
                style={{
                  color: "#28a745",
                  fontSize: "0.7rem",
                  fontWeight: "600",
                  backgroundColor: "#d4edda",
                  padding: "2px 5px",
                  borderRadius: "6px",
                  border: "1px solid #c3e6cb",
                }}
              >
                NEW
              </span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
            }}
          >
            {stock.market_cap && stock.market_cap > 0 && (
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "#6c757d",
                  fontWeight: "600",
                  backgroundColor: "#f8f9fa",
                  padding: "2px 6px",
                  borderRadius: "5px",
                  border: "1px solid #e9ecef",
                  marginRight: "4px",
                }}
              >
                {(() => {
                  const mcap = Number(stock.market_cap);
                  return mcap >= 1000
                    ? `${(mcap / 1000).toFixed(1)}B`
                    : `${Math.round(mcap)}M`;
                })()}
              </span>
            )}
            {showHoldingStar && isHolding && (
              <span
                style={{
                  color: "#ffd700",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  backgroundColor: "#fff3cd",
                  padding: "2px 4px",
                  borderRadius: "8px",
                  border: "1px solid #ffeaa7",
                  boxShadow: "0 1px 2px rgba(255,215,0,0.2)",
                  display: "inline-block",
                  transition: "all 0.2s ease",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHolding(stock.ticker);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.1)";
                  e.currentTarget.style.boxShadow =
                    "0 2px 4px rgba(255,215,0,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow =
                    "0 1px 2px rgba(255,215,0,0.2)";
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
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  backgroundColor: "#f8f9fa",
                  padding: "2px 4px",
                  borderRadius: "8px",
                  border: "1px solid #e9ecef",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  display: "inline-block",
                  transition: "all 0.2s ease",
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
                  cursor: "pointer",
                  fontSize: "1rem",
                  backgroundColor: "#f8d7da",
                  padding: "3px 4px",
                  borderRadius: "8px",
                  border: "1px solid #f5c6cb",
                  boxShadow: "0 1px 2px rgba(220,53,69,0.2)",
                  display: "inline-flex",
                  alignItems: "center",
                  transition: "all 0.2s ease",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log(
                    "Watch button clicked for:",
                    stock.ticker,
                    "isInWatchlist:",
                    isInWatchlist,
                    "onToggleWatchlist:",
                    !!onToggleWatchlist
                  );
                  onToggleWatchlist!(stock.ticker);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.1)";
                  e.currentTarget.style.boxShadow =
                    "0 2px 4px rgba(220,53,69,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow =
                    "0 1px 2px rgba(220,53,69,0.2)";
                }}
                title="Remove from watchlist"
              >
                <EyeOffIcon size={12} />
              </span>
            )}
            {showWatchButton && onToggleWatchlist && !isInWatchlist && (
              <span
                style={{
                  color: "#17a2b8",
                  cursor: "pointer",
                  fontSize: "1rem",
                  backgroundColor: "#d1ecf1",
                  padding: "3px 4px",
                  borderRadius: "8px",
                  border: "1px solid #bee5eb",
                  boxShadow: "0 1px 2px rgba(23,162,184,0.2)",
                  display: "inline-flex",
                  alignItems: "center",
                  transition: "all 0.2s ease",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log(
                    "Watch button clicked for:",
                    stock.ticker,
                    "isInWatchlist:",
                    isInWatchlist,
                    "onToggleWatchlist:",
                    !!onToggleWatchlist
                  );
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
                <EyeIcon size={12} />
              </span>
            )}
            {showDeleteButton && onDeleteTicker && (
              <span
                style={{
                  color: deleteConfirm ? "#dc3545" : "#6c757d",
                  cursor: "pointer",
                  fontSize: "1rem",
                  backgroundColor: deleteConfirm ? "#f8d7da" : "#f8f9fa",
                  padding: "3px 4px",
                  borderRadius: "8px",
                  border: deleteConfirm
                    ? "1px solid #f5c6cb"
                    : "1px solid #dee2e6",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  display: "inline-flex",
                  alignItems: "center",
                  transition: "all 0.2s ease",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (deleteConfirm) {
                    onDeleteTicker(stock.ticker);
                    setDeleteConfirm(false);
                  } else {
                    setDeleteConfirm(true);
                    // Reset after 3 seconds
                    setTimeout(() => setDeleteConfirm(false), 3000);
                  }
                }}
                onMouseEnter={(e) => {
                  if (!deleteConfirm) {
                    e.currentTarget.style.transform = "scale(1.1)";
                    e.currentTarget.style.backgroundColor = "#f8d7da";
                    e.currentTarget.style.borderColor = "#f5c6cb";
                    e.currentTarget.style.color = "#dc3545";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!deleteConfirm) {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.backgroundColor = "#f8f9fa";
                    e.currentTarget.style.borderColor = "#dee2e6";
                    e.currentTarget.style.color = "#6c757d";
                  }
                }}
                title={
                  deleteConfirm
                    ? "Click again to confirm"
                    : "Remove from ticker list"
                }
              >
                {deleteConfirm ? MdDeleteForever({}) : MdDelete({})}
              </span>
            )}
            {/* TradingView Chart Button */}
            <span
              style={{
                color: "#000000",
                cursor: "pointer",
                fontSize: "1rem",
                backgroundColor: "#E3F2FD",
                padding: "3px 4px",
                borderRadius: "8px",
                border: "1px solid #BBDEFB",
                boxShadow: "0 1px 2px rgba(41,98,255,0.2)",
                display: "inline-flex",
                alignItems: "center",
                transition: "all 0.2s ease",
              }}
              onClick={(e) => {
                e.stopPropagation();
                window.open(
                  `https://www.tradingview.com/chart/StTMbjgz/?symbol=${stock.ticker}`,
                  "_blank"
                );
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.backgroundColor = "#BBDEFB";
                e.currentTarget.style.color = "#000000";
                e.currentTarget.style.boxShadow =
                  "0 2px 4px rgba(41,98,255,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.backgroundColor = "#E3F2FD";
                e.currentTarget.style.color = "#000000";
                e.currentTarget.style.boxShadow =
                  "0 1px 2px rgba(41,98,255,0.2)";
              }}
              title="View on TradingView"
            >
              {SiTradingview({ size: 12 })}
            </span>
            {/* Price Alert Bell Button */}
            <span
              style={{
                color: hasAlerts ? "#DC2626" : "#FFA500",
                cursor: "pointer",
                fontSize: "1rem",
                backgroundColor: hasAlerts ? "#FEE2E2" : "#FFF4E6",
                padding: "3px 4px",
                borderRadius: "8px",
                border: hasAlerts ? "1px solid #FCA5A5" : "1px solid #FFD8A8",
                boxShadow: hasAlerts
                  ? "0 1px 2px rgba(220,38,38,0.2)"
                  : "0 1px 2px rgba(255,165,0,0.2)",
                display: "inline-flex",
                alignItems: "center",
                transition: "all 0.2s ease",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setShowAlertModal(true);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.backgroundColor = hasAlerts
                  ? "#FCA5A5"
                  : "#FFD8A8";
                e.currentTarget.style.color = hasAlerts ? "#991B1B" : "#D97706";
                e.currentTarget.style.boxShadow = hasAlerts
                  ? "0 2px 4px rgba(220,38,38,0.3)"
                  : "0 2px 4px rgba(255,165,0,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.backgroundColor = hasAlerts
                  ? "#FEE2E2"
                  : "#FFF4E6";
                e.currentTarget.style.color = hasAlerts ? "#DC2626" : "#FFA500";
                e.currentTarget.style.boxShadow = hasAlerts
                  ? "0 1px 2px rgba(220,38,38,0.2)"
                  : "0 1px 2px rgba(255,165,0,0.2)";
              }}
              title={hasAlerts ? "View/manage price alerts" : "Set price alert"}
            >
              {hasAlerts ? FaBellSlash({ size: 12 }) : FaBell({ size: 12 })}
            </span>
          </div>
        </div>

        {/* Price Section */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "6px",
            marginBottom: "6px",
            paddingBottom: "6px",
            borderBottom: "1px solid #e9ecef",
          }}
        >
          <span
            style={{
              fontWeight: "bold",
              fontSize: "1.1rem",
              color: "#4F46E5",
            }}
          >
            ${currentPrice.toFixed(2)}
          </span>
          {isLoading && (
            <span
              style={{
                fontSize: "0.65rem",
                color: "#999",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            >
              🔄
            </span>
          )}
          {priceChange !== undefined && priceChange !== 0 && (
            <span
              style={{
                fontSize: "0.85rem",
                color: priceChange > 0 ? "#28a745" : "#dc3545",
                fontWeight: "600",
              }}
            >
              {priceChange > 0 ? "+" : ""}
              {priceChange.toFixed(2)}%
            </span>
          )}
        </div>

        {/* Holdings Section - BR & VG */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            marginBottom: "6px",
          }}
        >
          <div
            style={{
              backgroundColor: "#f8f9fa",
              padding: "6px 8px",
              borderRadius: "6px",
              border: "1px solid #e9ecef",
            }}
          >
            <div
              style={{
                fontSize: "0.7rem",
                color: "#6c757d",
                fontWeight: "600",
                marginBottom: "3px",
                letterSpacing: "0.5px",
              }}
            >
              BLACKROCK
            </div>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: "bold",
                color: "#4F46E5",
                marginBottom: "2px",
              }}
            >
              {stock.blackrock_pct.toFixed(1)}%
            </div>
            {stock.blackrock_market_value &&
              stock.blackrock_market_value > 0 && (
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#888",
                  }}
                >
                  $
                  {stock.blackrock_market_value >= 1000
                    ? `${(stock.blackrock_market_value / 1000).toFixed(1)}B`
                    : `${stock.blackrock_market_value.toFixed(1)}M`}
                </div>
              )}
          </div>

          <div
            style={{
              backgroundColor: "#f8f9fa",
              padding: "6px 8px",
              borderRadius: "6px",
              border: "1px solid #e9ecef",
            }}
          >
            <div
              style={{
                fontSize: "0.7rem",
                color: "#6c757d",
                fontWeight: "600",
                marginBottom: "3px",
                letterSpacing: "0.5px",
              }}
            >
              VANGUARD
            </div>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: "bold",
                color: "#4F46E5",
                marginBottom: "2px",
              }}
            >
              {stock.vanguard_pct.toFixed(1)}%
            </div>
            {stock.vanguard_market_value && stock.vanguard_market_value > 0 && (
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#888",
                }}
              >
                $
                {stock.vanguard_market_value >= 1000
                  ? `${(stock.vanguard_market_value / 1000).toFixed(1)}B`
                  : `${stock.vanguard_market_value.toFixed(1)}M`}
              </div>
            )}
          </div>
        </div>

        {/* Performance Metrics */}
        {stock.performance && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "6px",
            }}
          >
            <div
              style={{
                textAlign: "center",
                backgroundColor:
                  stock.performance.week > 0
                    ? "#d4edda"
                    : stock.performance.week < 0
                    ? "#f8d7da"
                    : "#f8f9fa",
                padding: "5px 4px",
                borderRadius: "6px",
                border: `1px solid ${
                  stock.performance.week > 0
                    ? "#c3e6cb"
                    : stock.performance.week < 0
                    ? "#f5c6cb"
                    : "#e9ecef"
                }`,
              }}
            >
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#6c757d",
                  fontWeight: "600",
                  marginBottom: "2px",
                }}
              >
                Week
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: "bold",
                  color:
                    stock.performance.week > 0
                      ? "#28a745"
                      : stock.performance.week < 0
                      ? "#dc3545"
                      : "#6c757d",
                }}
              >
                {stock.performance.week > 0 ? "+" : ""}
                {stock.performance.week.toFixed(1)}%
              </div>
            </div>

            <div
              style={{
                textAlign: "center",
                backgroundColor:
                  stock.performance.month > 0
                    ? "#d4edda"
                    : stock.performance.month < 0
                    ? "#f8d7da"
                    : "#f8f9fa",
                padding: "5px 4px",
                borderRadius: "6px",
                border: `1px solid ${
                  stock.performance.month > 0
                    ? "#c3e6cb"
                    : stock.performance.month < 0
                    ? "#f5c6cb"
                    : "#e9ecef"
                }`,
              }}
            >
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#6c757d",
                  fontWeight: "600",
                  marginBottom: "2px",
                }}
              >
                Month
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: "bold",
                  color:
                    stock.performance.month > 0
                      ? "#28a745"
                      : stock.performance.month < 0
                      ? "#dc3545"
                      : "#6c757d",
                }}
              >
                {stock.performance.month > 0 ? "+" : ""}
                {stock.performance.month.toFixed(1)}%
              </div>
            </div>

            <div
              style={{
                textAlign: "center",
                backgroundColor:
                  stock.performance.year > 0
                    ? "#d4edda"
                    : stock.performance.year < 0
                    ? "#f8d7da"
                    : "#f8f9fa",
                padding: "5px 4px",
                borderRadius: "6px",
                border: `1px solid ${
                  stock.performance.year > 0
                    ? "#c3e6cb"
                    : stock.performance.year < 0
                    ? "#f5c6cb"
                    : "#e9ecef"
                }`,
              }}
            >
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#6c757d",
                  fontWeight: "600",
                  marginBottom: "2px",
                }}
              >
                Year
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: "bold",
                  color:
                    stock.performance.year > 0
                      ? "#28a745"
                      : stock.performance.year < 0
                      ? "#dc3545"
                      : "#6c757d",
                }}
              >
                {stock.performance.year > 0 ? "+" : ""}
                {stock.performance.year.toFixed(1)}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Price Alert Modal */}
      <PriceAlertModal
        isOpen={showAlertModal}
        onClose={handleAlertModalClose}
        ticker={stock.ticker}
        currentPrice={currentPrice}
      />
    </>
  );
};

export default StockCard;
