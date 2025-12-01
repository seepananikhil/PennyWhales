import React, { useState, useEffect } from "react";
import { Stock } from "../types";
import { theme, getFireLevelStyle, getSectorStyle } from "../theme";
import api from "../api";
import { SiTradingview } from "react-icons/si";
import { FaBell, FaBellSlash, FaBrain } from "react-icons/fa";
import { MdDelete, MdDeleteForever } from "react-icons/md";
import PriceAlertModal from "./PriceAlertModal";
import ReactMarkdown from "react-markdown";

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
    livePrice?.price || stock.price || 0
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
  const [showTooltip, setShowTooltip] = useState(false);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [aiAnalysis, setAIAnalysis] = useState<string | null>(null);
  const [companyDescription, setCompanyDescription] = useState<string | null>(null);
  const [aiLoading, setAILoading] = useState(false);

  const fireLevel = stock.fire_level || 0;
  const fireStyle = getFireLevelStyle(fireLevel);
  const sectorStyle = stock.sector ? getSectorStyle(stock.sector) : null;
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

  // Fetch AI analysis
  const fetchAIAnalysis = async () => {
    if (aiAnalysis) {
      // If already loaded, just toggle display
      setShowAIAnalysis(!showAIAnalysis);
      return;
    }
    
    try {
      setAILoading(true);
      setShowAIAnalysis(true);
      const data = await api.analyzeStock(stock.ticker);
      setAIAnalysis(data.analysis);
      setCompanyDescription(data.description || null);
    } catch (error) {
      console.error(`Error fetching AI analysis for ${stock.ticker}:`, error);
      setAIAnalysis("Failed to load AI analysis. Please try again.");
    } finally {
      setAILoading(false);
    }
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

  // Visibility-based live price fetching
  // Fetch if card is visible for 1.5+ seconds (avoids auto-scroll triggers)
  // Re-fetches every time card becomes visible again
  useEffect(() => {
    if (livePrice) {
      // If live price is provided from parent, don't fetch independently
      return;
    }

    let visibilityTimer: NodeJS.Timeout | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Card is visible - wait 1.5 seconds before fetching
            visibilityTimer = setTimeout(() => {
              fetchLivePrice();
            }, 1500);
          } else if (!entry.isIntersecting && visibilityTimer) {
            // Card left viewport before 1.5 seconds - cancel fetch
            clearTimeout(visibilityTimer);
            visibilityTimer = null;
          }
        });
      },
      {
        threshold: 0.5, // At least 50% of card must be visible
        rootMargin: '0px',
      }
    );

    // Find the card element and observe it
    const cardElement = document.getElementById(`stock-card-${stock.ticker}`);
    if (cardElement) {
      observer.observe(cardElement);
    }

    return () => {
      if (visibilityTimer) {
        clearTimeout(visibilityTimer);
      }
      observer.disconnect();
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
        onClick={() => {
          onOpenChart(stock.ticker);
          const url = new URL(window.location.href);
          url.searchParams.set('ticker', stock.ticker);
          window.history.pushState({}, '', url);
        }}
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
              position: "relative",
            }}
          >
            <span
              style={{
                fontWeight: "bold",
                fontSize: "1.05rem",
                color: "#333",
                textTransform: "uppercase",
                position: "relative",
              }}
              title={stock.company_name || stock.ticker}
            >
              {stock.ticker}
            </span>
            <span style={{ fontSize: "1rem" }}>{getFireEmoji(fireLevel)}</span>
            {sectorStyle && (
              <span
                style={{
                  fontSize: "0.7rem",
                  color: sectorStyle.color,
                  fontWeight: "600",
                  backgroundColor: sectorStyle.background,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: `1px solid ${sectorStyle.border}`,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                }}
                title={sectorStyle.description}
              >
                <span>{sectorStyle.icon}</span>
                <span>{stock.sector}</span>
              </span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              flexShrink: 0,
            }}
          >
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
            {/* AI Analysis Button */}
            <span
              style={{
                color: showAIAnalysis ? "#7C3AED" : "#8B5CF6",
                cursor: "pointer",
                fontSize: "1rem",
                backgroundColor: showAIAnalysis ? "#EDE9FE" : "#F5F3FF",
                padding: "3px 4px",
                borderRadius: "8px",
                border: showAIAnalysis ? "1px solid #C4B5FD" : "1px solid #DDD6FE",
                boxShadow: showAIAnalysis
                  ? "0 1px 2px rgba(124,58,237,0.2)"
                  : "0 1px 2px rgba(139,92,246,0.2)",
                display: "inline-flex",
                alignItems: "center",
                transition: "all 0.2s ease",
              }}
              onClick={(e) => {
                e.stopPropagation();
                // Select the stock by opening chart
                if (!showAIAnalysis) {
                  onOpenChart(stock.ticker);
                }
                fetchAIAnalysis();
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.backgroundColor = "#DDD6FE";
                e.currentTarget.style.color = "#6D28D9";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(124,58,237,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.backgroundColor = showAIAnalysis ? "#EDE9FE" : "#F5F3FF";
                e.currentTarget.style.color = showAIAnalysis ? "#7C3AED" : "#8B5CF6";
                e.currentTarget.style.boxShadow = showAIAnalysis
                  ? "0 1px 2px rgba(124,58,237,0.2)"
                  : "0 1px 2px rgba(139,92,246,0.2)";
              }}
              title={aiLoading ? "Loading AI analysis..." : showAIAnalysis ? "Hide AI analysis" : "Get AI analysis"}
            >
              {aiLoading ? (
                <span style={{ animation: "pulse 1.5s ease-in-out infinite" }}>🔄</span>
              ) : (
                FaBrain({ size: 12 })
              )}
            </span>
          </div>
        </div>

        {/* AI Analysis Section */}
        {showAIAnalysis && aiAnalysis && (
          <div
            style={{
              marginBottom: "8px",
              padding: "12px",
              backgroundColor: "#F5F3FF",
              border: "2px solid #8B5CF6",
              borderRadius: "8px",
              fontSize: "0.85rem",
              lineHeight: "1.6",
              color: "#333",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
                paddingBottom: "8px",
                borderBottom: "2px solid #DDD6FE",
              }}
            >
              <span style={{ fontWeight: "bold", color: "#7C3AED", fontSize: "0.95rem" }}>
                🤖 AI Risk Analysis
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAIAnalysis(false);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#8B5CF6",
                  cursor: "pointer",
                  fontSize: "1.3rem",
                  padding: "0 4px",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            {companyDescription && (
              <div style={{ 
                marginBottom: "12px", 
                paddingBottom: "12px", 
                borderBottom: "1px solid #DDD6FE",
                color: "#555",
                fontSize: "0.82rem",
              }}>
                <ReactMarkdown
                  components={{
                    strong: ({node, ...props}) => <strong style={{ color: "#7C3AED", fontWeight: "600" }} {...props} />,
                    p: ({node, ...props}) => <span {...props} />
                  }}
                >
                  {companyDescription}
                </ReactMarkdown>
              </div>
            )}
            <div>
              <ReactMarkdown
                components={{
                  strong: ({node, ...props}) => <strong style={{ color: "#DC2626", fontWeight: "700", fontSize: "0.9rem" }} {...props} />,
                  p: ({node, ...props}) => <p style={{ margin: "6px 0" }} {...props} />,
                  ul: ({node, ...props}) => <ul style={{ margin: "6px 0", paddingLeft: "20px" }} {...props} />,
                  li: ({node, ...props}) => <li style={{ margin: "4px 0" }} {...props} />
                }}
              >
                {aiAnalysis}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Price Section */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "4px",
            marginBottom: "6px",
            paddingBottom: "6px",
            borderBottom: "1px solid #e9ecef",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span
              style={{
                fontWeight: "bold",
                fontSize: "1.1rem",
                color: "#4F46E5",
              }}
            >
              ${(currentPrice || 0).toFixed(2)}
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
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {stock.ipo_date && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#6c757d",
                  fontWeight: "600",
                  backgroundColor: "#fff9e6",
                  padding: "2px 6px",
                  borderRadius: "5px",
                  border: "1px solid #ffe8a1",
                }}
                title={`IPO: ${stock.ipo_date}`}
              >
                📅 {(() => {
                  try {
                    const ipoDate = new Date(stock.ipo_date);
                    const now = new Date();
                    const diffMs = now.getTime() - ipoDate.getTime();
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    const diffMonths = Math.floor(diffDays / 30);
                    const diffYears = Math.floor(diffDays / 365);

                    if (diffYears >= 1) {
                      return `${diffYears}Y`;
                    } else if (diffMonths >= 1) {
                      return `${diffMonths}M`;
                    } else {
                      return `${diffDays}D`;
                    }
                  } catch {
                    return stock.ipo_date;
                  }
                })()}
              </span>
            )}
            {stock.sma200 !== null && stock.sma200 !== undefined && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: stock.sma200 > 0 ? "#28a745" : "#dc3545",
                  fontWeight: "600",
                  backgroundColor: stock.sma200 > 0 ? "#d4edda" : "#f8d7da",
                  padding: "2px 6px",
                  borderRadius: "5px",
                  border: `1px solid ${stock.sma200 > 0 ? "#c3e6cb" : "#f5c6cb"}`,
                }}
                title={`${stock.sma200 > 0 ? "Above" : "Below"} 200-day moving average by ${Math.abs(stock.sma200).toFixed(1)}%`}
              >
                📈 {stock.sma200 > 0 ? "+" : ""}{stock.sma200.toFixed(1)}%
              </span>
            )}
            {stock.market_cap && stock.market_cap > 0 && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#6c757d",
                  fontWeight: "600",
                  backgroundColor: "#fafafa",
                  padding: "2px 6px",
                  borderRadius: "5px",
                  border: "1px solid #e9ecef",
                }}
                title={`Market Cap: ${(() => {
                  const mcap = Number(stock.market_cap);
                  return mcap >= 1000
                    ? `$${(mcap / 1000).toFixed(1)}B`
                    : `$${Math.round(mcap)}M`;
                })()}`}
              >
                💼 {(() => {
                  const mcap = Number(stock.market_cap);
                  return mcap >= 1000
                    ? `${(mcap / 1000).toFixed(1)}B`
                    : `${Math.round(mcap)}M`;
                })()}
              </span>
            )}
            {stock.employee_count && stock.employee_count > 0 && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#6c757d",
                  fontWeight: "600",
                  backgroundColor: "#f0f8ff",
                  padding: "2px 6px",
                  borderRadius: "5px",
                  border: "1px solid #d0e8f2",
                }}
                title={`${stock.employee_count.toLocaleString()} employees`}
              >
                👥 {(() => {
                  const emp = stock.employee_count;
                  if (emp >= 1000) {
                    return `${(emp / 1000).toFixed(emp >= 10000 ? 0 : 1)}k`;
                  }
                  return emp.toString();
                })()}
              </span>
            )}
          </div>
        </div>

        {/* Holdings Section - BR, VG & SS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
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
              STATE ST
            </div>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: "bold",
                color: "#4F46E5",
              }}
            >
              {stock.statestreet_pct ? stock.statestreet_pct.toFixed(1) : '0.0'}%
            </div>
            {stock.statestreet_market_value && stock.statestreet_market_value > 0 && (
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#888",
                }}
              >
                $
                {stock.statestreet_market_value >= 1000
                  ? `${(stock.statestreet_market_value / 1000).toFixed(1)}B`
                  : `${stock.statestreet_market_value.toFixed(1)}M`}
              </div>
            )}
          </div>

          {/* Institutional Ownership & Transaction */}
          {(stock.inst_own !== null && stock.inst_own !== undefined) || 
           (stock.inst_trans !== null && stock.inst_trans !== undefined) ? (
            <div
              style={{
                backgroundColor: stock.inst_trans && stock.inst_trans > 0 ? "#d4edda" : stock.inst_trans && stock.inst_trans < 0 ? "#f8d7da" : "#f8f9fa",
                padding: "6px 8px",
                borderRadius: "6px",
                border: `1px solid ${stock.inst_trans && stock.inst_trans > 0 ? "#c3e6cb" : stock.inst_trans && stock.inst_trans < 0 ? "#f5c6cb" : "#e9ecef"}`,
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
                INST. HOLD
              </div>
              {stock.inst_own !== null && stock.inst_own !== undefined && (
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: "bold",
                    color: "#4F46E5",
                  }}
                >
                  {stock.inst_own.toFixed(1)}%
                </div>
              )}
              {stock.inst_trans !== null && stock.inst_trans !== undefined && (
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    color: stock.inst_trans > 0 ? "#28a745" : stock.inst_trans < 0 ? "#dc3545" : "#6c757d",
                    marginTop: "2px",
                  }}
                >
                  {stock.inst_trans > 0 ? "+" : ""}{stock.inst_trans.toFixed(1)}% {stock.inst_trans > 0 ? "🟢" : stock.inst_trans < 0 ? "🔴" : ""}
                </div>
              )}
            </div>
          ) : null}
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
