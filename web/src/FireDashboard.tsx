import React, { useState, useEffect } from "react";
import { Stock, ScanResult } from "./types";
import api from "./api";
import { theme, getFireLevelStyle, getPriceFilterStyle } from "./theme";
import FilterButton from "./components/FilterButton";
import StockGrid from "./components/StockGrid";
import SectionHeader from "./components/SectionHeader";
import StockCard from "./components/StockCard";

const FireDashboard: React.FC = () => {
  const [results, setResults] = useState<ScanResult | null>(null);
  const [holdings, setHoldings] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedPriceFilter, setSelectedPriceFilter] = useState<string | null>(
    "under1"
  );
  const [showOnlyHoldings, setShowOnlyHoldings] = useState<boolean>(false);
  const [selectedFireFilter, setSelectedFireFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('fire-desc');
  const [livePriceData, setLivePriceData] = useState<Map<string, {
    price: number;
    priceChange: number;
    timestamp: string;
  }>>(new Map());

  useEffect(() => {
    loadData();
    
    // Set up auto-refresh for live prices every 5 minutes
    const priceRefreshInterval = setInterval(() => {
      if (results?.stocks && results.stocks.length > 0) {
        loadLivePrices();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      clearInterval(priceRefreshInterval);
    };
  }, []);

  // Load live prices when results change
  useEffect(() => {
    if (results?.stocks && results.stocks.length > 0) {
      loadLivePrices();
    }
  }, [results]);

  const loadData = async () => {
    await Promise.all([loadResults(), loadHoldings()]);
  };

  const loadResults = async () => {
    try {
      const data = await api.getLatestResults();
      setResults(data);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadHoldings = async () => {
    try {
      const holdingsData = await api.getHoldings();
      
      // Handle both possible response formats
      let holdingsArray = [];
      if (holdingsData.holdings) {
        if (Array.isArray(holdingsData.holdings)) {
          // If holdings is already an array of strings
          if (typeof holdingsData.holdings[0] === 'string') {
            holdingsArray = holdingsData.holdings;
          } else {
            // If holdings is an array of objects with ticker property
            holdingsArray = holdingsData.holdings.map((holding: any) => holding.ticker).filter(Boolean);
          }
        }
      }
      
      setHoldings(new Set(holdingsArray));
    } catch (error) {
      console.error("Error loading holdings:", error);
    }
  };

  const loadLivePrices = async () => {
    try {
      if (!results?.stocks) return;
      
      // Load live prices for all fire stocks
      const fireStockTickers = results.stocks.filter(stock => getFireLevel(stock) > 0).map(stock => stock.ticker);
      const pricePromises = fireStockTickers.map(async (ticker) => {
        try {
          const livePrice = await api.getLivePrice(ticker);
          return {
            ticker,
            data: {
              price: livePrice.price,
              priceChange: livePrice.priceChange,
              timestamp: livePrice.timestamp
            }
          };
        } catch (err) {
          console.error(`Error fetching live price for ${ticker}:`, err);
          return null;
        }
      });

      const priceResults = await Promise.all(pricePromises);
      const newLivePriceData = new Map(livePriceData);
      
      priceResults.forEach(result => {
        if (result) {
          newLivePriceData.set(result.ticker, result.data);
        }
      });
      
      setLivePriceData(newLivePriceData);
    } catch (err) {
      console.error('Error loading live prices:', err);
    }
  };

  const toggleHolding = async (ticker: string) => {
    try {
      const isCurrentlyHolding = holdings.has(ticker);

      if (isCurrentlyHolding) {
        await api.removeHolding(ticker);
        setHoldings((prev) => {
          const newSet = new Set(prev);
          newSet.delete(ticker);
          return newSet;
        });
      } else {
        await api.addHolding(ticker);
        setHoldings((prev) => {
          const newSet = new Set(prev);
          newSet.add(ticker);
          return newSet;
        });
      }
    } catch (error) {
      console.error("Error toggling holding:", error);
    }
  };

  const getFireLevel = (stock: Stock): number => {
    // Always use fire_level from API - no local calculation
    return stock.fire_level || 0;
  };

  const getFireEmoji = (level: number): string => {
    return getFireLevelStyle(level).emoji;
  };

  const startScan = async (scanType: "daily" | "full" = "daily") => {
    setScanning(true);
    try {
      const endpoint =
        scanType === "daily" ? "/api/scan/daily" : "/api/scan/start";
      await fetch(`http://localhost:9000${endpoint}`, { method: "POST" });

      // Poll for updates
      setTimeout(() => {
        loadData();
        setScanning(false);
      }, 3000);
    } catch (error) {
      console.error("Scan failed:", error);
      setScanning(false);
    }
  };

  const clearDatabase = async () => {
    if (
      !window.confirm(
        "Are you sure you want to clear all scan results? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      const response = await fetch("http://localhost:9000/api/scan/clear", {
        method: "POST",
      });
      const result = await response.json();

      if (result.success) {
        // Clear local state
        setResults(null);
        setSelectedPriceFilter(null);
        alert("Database cleared successfully!");
      } else {
        alert("Failed to clear database");
      }
    } catch (error) {
      console.error("Clear failed:", error);
      alert("Failed to clear database");
    }
  };

  const openChart = (ticker: string) => {
    window.open(
      `https://www.tradingview.com/chart/?symbol=${ticker}`,
      "_blank"
    );
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h1>🔥 Fire Dashboard</h1>
        <div>Loading...</div>
      </div>
    );
  }

  const fireStocks =
    results?.stocks.filter((stock) => getFireLevel(stock) > 0) || [];

  // Remove duplicates by ticker
  const uniqueFireStocks = fireStocks.filter(
    (stock, index, arr) =>
      arr.findIndex((s) => s.ticker === stock.ticker) === index
  );

  // Apply price filtering
  const applyPriceFilter = (stocks: Stock[]) => {
    if (!selectedPriceFilter) return stocks;

    switch (selectedPriceFilter) {
      case "under1":
        return stocks.filter((s) => s.price < 1.0);
      case "1to2":
        return stocks.filter((s) => s.price >= 1.0 && s.price <= 2.0);
      case "over2":
        return stocks.filter((s) => s.price > 2.0);
      default:
        return stocks;
    }
  };

  // Apply holdings filter
  const applyHoldingsFilter = (stocks: Stock[]) => {
    if (!showOnlyHoldings) return stocks;
    return stocks.filter((s) => holdings.has(s.ticker));
  };

  // Price bucket counts for all fire stocks
  const priceUnder1 = uniqueFireStocks.filter((s) => s.price < 1.0);
  const price1to2 = uniqueFireStocks.filter(
    (s) => s.price >= 1.0 && s.price <= 2.0
  );
  const priceOver2 = uniqueFireStocks.filter((s) => s.price > 2.0);
  const holdingsCount = uniqueFireStocks.filter((s) =>
    holdings.has(s.ticker)
  ).length;

  const getDisplayStocks = () => {
    let stocks = uniqueFireStocks;

    // If holdings filter is active, only show holdings (ignore price filters)
    if (showOnlyHoldings) {
      stocks = stocks.filter((s) => holdings.has(s.ticker));
    }
    // Otherwise, apply price filter if selected
    else if (selectedPriceFilter) {
      stocks = applyPriceFilter(stocks);
    }

    // Apply search filter if provided
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      stocks = stocks.filter(stock => 
        stock.ticker.toLowerCase().includes(query)
      );
    }

    // Sort stocks based on selected sort option
    return stocks.sort((a, b) => {
      switch (sortBy) {
        case 'combined-desc':
          // Sort by combined VG + BR percentage (highest first)
          const combinedA = a.vanguard_pct + a.blackrock_pct;
          const combinedB = b.vanguard_pct + b.blackrock_pct;
          return combinedB - combinedA;
        case 'combined-asc':
          // Sort by combined VG + BR percentage (lowest first)
          const combinedAsc = a.vanguard_pct + a.blackrock_pct;
          const combinedBsc = b.vanguard_pct + b.blackrock_pct;
          return combinedAsc - combinedBsc;
        case 'vg-desc':
          return b.vanguard_pct - a.vanguard_pct;
        case 'vg-asc':
          return a.vanguard_pct - b.vanguard_pct;
        case 'br-desc':
          return b.blackrock_pct - a.blackrock_pct;
        case 'br-asc':
          return a.blackrock_pct - b.blackrock_pct;
        case 'fire-desc':
          const fireA = getFireLevel(a);
          const fireB = getFireLevel(b);
          if (fireA !== fireB) return fireB - fireA;
          // If fire levels are equal, sort by combined VG+BR as secondary
          const fireComboA = a.vanguard_pct + a.blackrock_pct;
          const fireComboB = b.vanguard_pct + b.blackrock_pct;
          return fireComboB - fireComboA;
        case 'price-desc':
          return b.price - a.price;
        case 'price-asc':
          return a.price - b.price;
        case 'price-change-desc':
          // Sort by price change percentage (highest first)
          const priceChangeA = livePriceData.get(a.ticker)?.priceChange || 0;
          const priceChangeB = livePriceData.get(b.ticker)?.priceChange || 0;
          return priceChangeB - priceChangeA;
        case 'price-change-asc':
          // Sort by price change percentage (lowest first)
          const priceChangeAscA = livePriceData.get(a.ticker)?.priceChange || 0;
          const priceChangeAscB = livePriceData.get(b.ticker)?.priceChange || 0;
          return priceChangeAscA - priceChangeAscB;
        default:
          // Default to fire level (highest first) then by price (lowest first)
          const defaultFireA = getFireLevel(a);
          const defaultFireB = getFireLevel(b);
          if (defaultFireA !== defaultFireB) {
            return defaultFireB - defaultFireA;
          }
          return a.price - b.price;
      }
    });
  };

  const displayStocks = getDisplayStocks();

  return (
    <div
      style={{
        padding: theme.spacing.lg,
        width: "100%",
        maxWidth: "100vw",
        backgroundColor: theme.ui.background,
        minHeight: "100vh",
        margin: "0",
        boxSizing: "border-box",
        fontFamily: theme.typography.fontFamily,
      }}
    >
      {/* Header with Search and Sort Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.lg,
        padding: theme.spacing.md,
        backgroundColor: theme.ui.surface,
        borderRadius: theme.borderRadius.md,
        boxShadow: theme.ui.shadow.sm
      }}>
        <h1 style={{
          margin: 0,
          fontSize: theme.typography.fontSize.xxl,
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.ui.text.primary
        }}>
          🔥 Fire Dashboard
        </h1>
        <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center' }}>
          {/* Search Input */}
          <input
            type="text"
            placeholder="🔍 Search fire stocks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              border: `1px solid ${theme.ui.border}`,
              borderRadius: theme.borderRadius.md,
              backgroundColor: theme.ui.surface,
              color: theme.ui.text.primary,
              fontSize: theme.typography.fontSize.sm,
              fontFamily: theme.typography.fontFamily,
              width: '200px',
              outline: 'none',
              transition: `all ${theme.transition.normal}`
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme.status.info;
              e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.status.info}20`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.ui.border;
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              border: `1px solid ${theme.ui.border}`,
              borderRadius: theme.borderRadius.md,
              backgroundColor: theme.ui.surface,
              color: theme.ui.text.primary,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.medium,
              cursor: 'pointer',
              fontFamily: theme.typography.fontFamily
            }}
          >
            <option value="fire-desc">🔥 Fire Level (High to Low)</option>
            <option value="combined-desc">🔥 VG + BR % (High to Low)</option>
            <option value="combined-asc">🔥 VG + BR % (Low to High)</option>
            <option value="vg-desc">🔄 VG % (High to Low)</option>
            <option value="vg-asc">🔄 VG % (Low to High)</option>
            <option value="br-desc">🔄 BR % (High to Low)</option>
            <option value="br-asc">🔄 BR % (Low to High)</option>
            <option value="price-desc">💰 Price (High to Low)</option>
            <option value="price-asc">💰 Price (Low to High)</option>
            <option value="price-change-desc">📈 Price Change % (High to Low)</option>
            <option value="price-change-asc">📉 Price Change % (Low to High)</option>
          </select>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "5px",
          marginBottom: "25px",
          width: "100%",
          maxWidth: "100%",
          justifyContent: "center",
        }}
      >
        <button
          onClick={() => {
            if (selectedPriceFilter === "under1") {
              setSelectedPriceFilter(null);
            } else {
              setSelectedPriceFilter("under1");
              setShowOnlyHoldings(false); // Clear holdings filter
            }
          }}
          style={{
            flex: 1,
            padding: theme.spacing.xl,
            backgroundColor:
              selectedPriceFilter === "under1"
                ? theme.price.under1.primary
                : theme.ui.surface,
            color:
              selectedPriceFilter === "under1"
                ? theme.ui.surface
                : theme.price.under1.primary,
            border: `2px solid ${theme.price.under1.primary}`,
            borderRadius: theme.borderRadius.lg,
            textAlign: "center",
            boxShadow:
              selectedPriceFilter === "under1"
                ? `0 4px 8px ${theme.price.under1.primary}40`
                : theme.ui.shadow.md,
            cursor: "pointer",
            transition: `all ${theme.transition.slow}`,
            transform:
              selectedPriceFilter === "under1" ? "translateY(-1px)" : "none",
            fontFamily: theme.typography.fontFamily,
          }}
        >
          <div
            style={{
              fontSize: theme.typography.fontSize.xxl,
              fontWeight: theme.typography.fontWeight.bold,
              marginBottom: theme.spacing.sm,
            }}
          >
            {priceUnder1.length}
          </div>
          <div
            style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
            }}
          >
            💰 Under $1
          </div>
        </button>

        <button
          onClick={() => {
            if (selectedPriceFilter === "1to2") {
              setSelectedPriceFilter(null);
            } else {
              setSelectedPriceFilter("1to2");
              setShowOnlyHoldings(false); // Clear holdings filter
            }
          }}
          style={{
            flex: 1,
            padding: theme.spacing.xl,
            backgroundColor:
              selectedPriceFilter === "1to2"
                ? theme.price.range1to2.primary
                : theme.ui.surface,
            color:
              selectedPriceFilter === "1to2"
                ? theme.ui.surface
                : theme.price.range1to2.primary,
            border: `2px solid ${theme.price.range1to2.primary}`,
            borderRadius: theme.borderRadius.lg,
            textAlign: "center",
            boxShadow:
              selectedPriceFilter === "1to2"
                ? `0 4px 8px ${theme.price.range1to2.primary}40`
                : theme.ui.shadow.md,
            cursor: "pointer",
            transition: `all ${theme.transition.slow}`,
            transform:
              selectedPriceFilter === "1to2" ? "translateY(-1px)" : "none",
            fontFamily: theme.typography.fontFamily,
          }}
        >
          <div
            style={{
              fontSize: theme.typography.fontSize.xxl,
              fontWeight: theme.typography.fontWeight.bold,
              marginBottom: theme.spacing.sm,
            }}
          >
            {price1to2.length}
          </div>
          <div
            style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
            }}
          >
            💎 $1 - $2
          </div>
        </button>

        <button
          onClick={() => {
            if (selectedPriceFilter === "over2") {
              setSelectedPriceFilter(null);
            } else {
              setSelectedPriceFilter("over2");
              setShowOnlyHoldings(false); // Clear holdings filter
            }
          }}
          style={{
            flex: 1,
            padding: theme.spacing.xl,
            backgroundColor:
              selectedPriceFilter === "over2"
                ? theme.price.over2.primary
                : theme.ui.surface,
            color:
              selectedPriceFilter === "over2"
                ? theme.ui.surface
                : theme.price.over2.primary,
            border: `2px solid ${theme.price.over2.primary}`,
            borderRadius: theme.borderRadius.lg,
            textAlign: "center",
            boxShadow:
              selectedPriceFilter === "over2"
                ? `0 4px 8px ${theme.price.over2.primary}40`
                : theme.ui.shadow.md,
            cursor: "pointer",
            transition: `all ${theme.transition.slow}`,
            transform:
              selectedPriceFilter === "over2" ? "translateY(-1px)" : "none",
            fontFamily: theme.typography.fontFamily,
          }}
        >
          <div
            style={{
              fontSize: theme.typography.fontSize.xxl,
              fontWeight: theme.typography.fontWeight.bold,
              marginBottom: theme.spacing.sm,
            }}
          >
            {priceOver2.length}
          </div>
          <div
            style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
            }}
          >
            🏆 Over $2
          </div>
        </button>

        <button
          onClick={() => {
            if (showOnlyHoldings) {
              setShowOnlyHoldings(false);
            } else {
              setShowOnlyHoldings(true);
              setSelectedPriceFilter(null); // Clear price filter
            }
          }}
          style={{
            flex: 1,
            padding: theme.spacing.xl,
            backgroundColor: showOnlyHoldings
              ? theme.holdings.primary
              : theme.ui.surface,
            color: showOnlyHoldings
              ? theme.ui.text.primary
              : theme.holdings.primary,
            border: `2px solid ${theme.holdings.primary}`,
            borderRadius: theme.borderRadius.lg,
            textAlign: "center",
            boxShadow: showOnlyHoldings
              ? `0 4px 8px ${theme.holdings.primary}40`
              : theme.ui.shadow.md,
            cursor: "pointer",
            transition: `all ${theme.transition.slow}`,
            transform: showOnlyHoldings ? "translateY(-1px)" : "none",
            fontFamily: theme.typography.fontFamily,
          }}
        >
          <div
            style={{
              fontSize: theme.typography.fontSize.xxl,
              fontWeight: theme.typography.fontWeight.bold,
              marginBottom: theme.spacing.sm,
            }}
          >
            {holdingsCount}
          </div>
          <div
            style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
            }}
          >
            ⭐ Only Holdings
          </div>
        </button>
      </div>
      {/* Selected Stocks Display */}
      {(selectedPriceFilter || showOnlyHoldings) &&
        displayStocks.length > 0 && (
          <section style={{ marginBottom: "25px", width: "100%" }}>
            <div
              style={{
                marginBottom: "15px",
              }}
            >
              <h2
                style={{
                  color: showOnlyHoldings
                    ? theme.holdings.primary
                    : getPriceFilterStyle(selectedPriceFilter || "under1")
                        .primary,
                  margin: 0,
                  fontSize: theme.typography.fontSize.xl,
                  fontWeight: theme.typography.fontWeight.bold,
                  fontFamily: theme.typography.fontFamily,
                }}
              >
                {showOnlyHoldings && "⭐ Your Holdings"}
                {!showOnlyHoldings &&
                  selectedPriceFilter === "under1" &&
                  "💰 Under $1"}
                {!showOnlyHoldings &&
                  selectedPriceFilter === "1to2" &&
                  "💎 $1 - $2"}
                {!showOnlyHoldings &&
                  selectedPriceFilter === "over2" &&
                  "🏆 Over $2"}{" "}
                ({displayStocks.length})
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: theme.spacing.md,
                maxHeight: "75vh",
                overflowY: "auto",
                padding: theme.spacing.md,
                backgroundColor: theme.ui.surface,
                borderRadius: theme.borderRadius.md,
                boxShadow: theme.ui.shadow.md,
                width: "100%",
              }}
            >
              {displayStocks.map((stock) => {
                const borderColor = showOnlyHoldings
                  ? theme.holdings.primary
                  : selectedFireFilter
                  ? getFireLevelStyle(selectedFireFilter).primary
                  : getPriceFilterStyle(selectedPriceFilter || "under1")
                      .primary;

                return (
                  <StockCard
                    key={stock.ticker}
                    stock={stock}
                    livePrice={livePriceData.get(stock.ticker)}
                    isHolding={holdings.has(stock.ticker)}
                    onToggleHolding={toggleHolding}
                    onOpenChart={openChart}
                    borderColor={borderColor}
                  />
                );
              })}
            </div>
          </section>
        )}
      {(selectedPriceFilter || showOnlyHoldings) &&
        displayStocks.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "30px",
              backgroundColor: "#fff",
              borderRadius: "6px",
              color: "#666",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ fontSize: "1.1rem", marginBottom: "6px" }}>
              {showOnlyHoldings
                ? "No holdings found"
                : "No stocks found for this combination"}
            </h3>
            <p style={{ fontSize: "0.85rem" }}>
              {showOnlyHoldings
                ? "You haven't marked any stocks as holdings yet. Click the ☆ icon on any stock to add it to your holdings."
                : selectedPriceFilter
                ? "Try removing the price filter or selecting a different fire level"
                : "Try starting a new scan to discover more stocks"}
            </p>
            <button
              onClick={() => {
                setSelectedPriceFilter(null);
                setShowOnlyHoldings(false);
              }}
              style={{
                marginTop: "10px",
                padding: "8px 16px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: "600",
              }}
            >
              Clear All Filters
            </button>
          </div>
        )}
      {!selectedPriceFilter && !showOnlyHoldings && fireStocks.length > 0 && (
        <section style={{ marginBottom: "25px", width: "100%" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "15px",
            }}
          >
            <h2
              style={{
                color: "#333",
                margin: 0,
                fontSize: "1.3rem",
              }}
            >
              🔥 All Fire Stocks ({getDisplayStocks().length})
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "10px",
              maxHeight: "75vh",
              overflowY: "auto",
              padding: "12px",
              backgroundColor: "#fff",
              borderRadius: "6px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              width: "100%",
            }}
          >
            {getDisplayStocks().map((stock) => (
              <StockCard
                key={stock.ticker}
                stock={stock}
                livePrice={livePriceData.get(stock.ticker)}
                isHolding={holdings.has(stock.ticker)}
                onToggleHolding={toggleHolding}
                onOpenChart={openChart}
              />
            ))}
          </div>
        </section>
      )}
      {fireStocks.length === 0 && !selectedPriceFilter && (
        <div
          style={{
            textAlign: "center",
            padding: "40px 30px",
            backgroundColor: "#fff",
            borderRadius: "6px",
            color: "#666",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          }}
        >
          <h3
            style={{ fontSize: "1.3rem", marginBottom: "12px", color: "#333" }}
          >
            No Fire Stocks Found
          </h3>
          <p style={{ fontSize: "0.9rem" }}>
            Start a scan to discover stocks with strong institutional backing
          </p>
        </div>
      )}{" "}
    </div>
  );
};

export default FireDashboard;
