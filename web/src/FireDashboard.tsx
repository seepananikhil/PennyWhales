import React, { useState, useEffect } from "react";
import { Stock, ScanResult } from "./types";
import api from "./api";

const FireDashboard: React.FC = () => {
  const [results, setResults] = useState<ScanResult | null>(null);
  const [holdings, setHoldings] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedPriceFilter, setSelectedPriceFilter] = useState<string | null>('under1');
  const [showOnlyHoldings, setShowOnlyHoldings] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

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
      const data = await api.getHoldings();
      setHoldings(new Set(data.holdings || []));
    } catch (error) {
      console.error("Error loading holdings:", error);
    }
  };

  const toggleHolding = async (ticker: string) => {
    try {
      const isCurrentlyHolding = holdings.has(ticker);
      
      if (isCurrentlyHolding) {
        await api.removeHolding(ticker);
        setHoldings(prev => {
          const newSet = new Set(prev);
          newSet.delete(ticker);
          return newSet;
        });
      } else {
        await api.addHolding(ticker);
        setHoldings(prev => {
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
    switch (level) {
      case 3:
        return "🔥🔥🔥";
      case 2:
        return "🔥🔥";
      case 1:
        return "🔥";
      default:
        return "";
    }
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
      case 'under1':
        return stocks.filter(s => s.price < 1.0);
      case '1to2':
        return stocks.filter(s => s.price >= 1.0 && s.price <= 2.0);
      case 'over2':
        return stocks.filter(s => s.price > 2.0);
      default:
        return stocks;
    }
  };

  // Apply holdings filter
  const applyHoldingsFilter = (stocks: Stock[]) => {
    if (!showOnlyHoldings) return stocks;
    return stocks.filter(s => holdings.has(s.ticker));
  };

  // Price bucket counts for all fire stocks
  const priceUnder1 = uniqueFireStocks.filter(s => s.price < 1.0);
  const price1to2 = uniqueFireStocks.filter(s => s.price >= 1.0 && s.price <= 2.0);
  const priceOver2 = uniqueFireStocks.filter(s => s.price > 2.0);
  const holdingsCount = uniqueFireStocks.filter(s => holdings.has(s.ticker)).length;

  const getDisplayStocks = () => {
    let stocks = uniqueFireStocks;
    
    // If holdings filter is active, only show holdings (ignore price filters)
    if (showOnlyHoldings) {
      stocks = stocks.filter(s => holdings.has(s.ticker));
    }
    // Otherwise, apply price filter if selected
    else if (selectedPriceFilter) {
      stocks = applyPriceFilter(stocks);
    }
    
    // Sort by fire level (highest first) then by price (lowest first)
    return stocks.sort((a, b) => {
      const fireA = getFireLevel(a);
      const fireB = getFireLevel(b);
      
      // First sort by fire level (descending - highest fire first)
      if (fireA !== fireB) {
        return fireB - fireA;
      }
      
      // Then sort by price (ascending - lowest price first)
      return a.price - b.price;
    });
  };

  const displayStocks = getDisplayStocks();

  return (
    <div
      style={{
        padding: "15px",
        width: "100%",
        maxWidth: "100vw",
        backgroundColor: "#f8f9fa",
        minHeight: "100vh",
        margin: "0",
        boxSizing: "border-box",
      }}
    >

      <div
        style={{
          display: 'flex',
          gap: "5px",
          marginBottom: "25px",
          width: "100%",
          maxWidth: "100%",
          justifyContent: "center",
        }}
      >
        <button
          onClick={() => {
            if (selectedPriceFilter === 'under1') {
              setSelectedPriceFilter(null);
            } else {
              setSelectedPriceFilter('under1');
              setShowOnlyHoldings(false); // Clear holdings filter
            }
          }}
          style={{
            flex: 1,
            padding: "15px",
            backgroundColor: selectedPriceFilter === 'under1' ? "#28a745" : "#fff",
            color: selectedPriceFilter === 'under1' ? "#fff" : "#28a745",
            border: "2px solid #28a745",
            borderRadius: "8px",
            textAlign: "center",
            boxShadow:
              selectedPriceFilter === 'under1'
                ? "0 4px 8px rgba(40,167,69,0.3)"
                : "0 2px 6px rgba(0,0,0,0.1)",
            cursor: "pointer",
            transition: "all 0.3s",
            transform: selectedPriceFilter === 'under1' ? "translateY(-1px)" : "none",
          }}
        >
          <div
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              marginBottom: "6px",
            }}
          >
            {priceUnder1.length}
          </div>
          <div style={{ fontSize: "0.8rem", fontWeight: "600" }}>
            💰 Under $1
          </div>
          <div style={{ fontSize: "0.65rem", opacity: 0.8, marginTop: "3px" }}>
            Price &lt; $1.00
          </div>
        </button>

        <button
          onClick={() => {
            if (selectedPriceFilter === '1to2') {
              setSelectedPriceFilter(null);
            } else {
              setSelectedPriceFilter('1to2');
              setShowOnlyHoldings(false); // Clear holdings filter
            }
          }}
          style={{
            flex: 1,
            padding: "15px",
            backgroundColor: selectedPriceFilter === '1to2' ? "#17a2b8" : "#fff",
            color: selectedPriceFilter === '1to2' ? "#fff" : "#17a2b8",
            border: "2px solid #17a2b8",
            borderRadius: "8px",
            textAlign: "center",
            boxShadow:
              selectedPriceFilter === '1to2'
                ? "0 4px 8px rgba(23,162,184,0.3)"
                : "0 2px 6px rgba(0,0,0,0.1)",
            cursor: "pointer",
            transition: "all 0.3s",
            transform: selectedPriceFilter === '1to2' ? "translateY(-1px)" : "none",
          }}
        >
          <div
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              marginBottom: "6px",
            }}
          >
            {price1to2.length}
          </div>
          <div style={{ fontSize: "0.8rem", fontWeight: "600" }}>
            💎 $1 - $2
          </div>
          <div style={{ fontSize: "0.65rem", opacity: 0.8, marginTop: "3px" }}>
            Price $1.00 - $2.00
          </div>
        </button>

        <button
          onClick={() => {
            if (selectedPriceFilter === 'over2') {
              setSelectedPriceFilter(null);
            } else {
              setSelectedPriceFilter('over2');
              setShowOnlyHoldings(false); // Clear holdings filter
            }
          }}
          style={{
            flex: 1,
            padding: "15px",
            backgroundColor: selectedPriceFilter === 'over2' ? "#6f42c1" : "#fff",
            color: selectedPriceFilter === 'over2' ? "#fff" : "#6f42c1",
            border: "2px solid #6f42c1",
            borderRadius: "8px",
            textAlign: "center",
            boxShadow:
              selectedPriceFilter === 'over2'
                ? "0 4px 8px rgba(111,66,193,0.3)"
                : "0 2px 6px rgba(0,0,0,0.1)",
            cursor: "pointer",
            transition: "all 0.3s",
            transform: selectedPriceFilter === 'over2' ? "translateY(-1px)" : "none",
          }}
        >
          <div
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              marginBottom: "6px",
            }}
          >
            {priceOver2.length}
          </div>
          <div style={{ fontSize: "0.8rem", fontWeight: "600" }}>
            🏆 Over $2
          </div>
          <div style={{ fontSize: "0.65rem", opacity: 0.8, marginTop: "3px" }}>
            Price &gt; $2.00
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
            padding: "15px",
            backgroundColor: showOnlyHoldings ? "#ffd700" : "#fff",
            color: showOnlyHoldings ? "#333" : "#ffd700",
            border: "2px solid #ffd700",
            borderRadius: "8px",
            textAlign: "center",
            boxShadow: showOnlyHoldings
              ? "0 4px 8px rgba(255,215,0,0.3)"
              : "0 2px 6px rgba(0,0,0,0.1)",
            cursor: "pointer",
            transition: "all 0.3s",
            transform: showOnlyHoldings ? "translateY(-1px)" : "none",
          }}
        >
          <div
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              marginBottom: "6px",
            }}
          >
            {holdingsCount}
          </div>
          <div style={{ fontSize: "0.8rem", fontWeight: "600" }}>
            ⭐ Only Holdings
          </div>
          <div style={{ fontSize: "0.65rem", opacity: 0.8, marginTop: "3px" }}>
            Your Portfolio
          </div>
        </button>
      </div>

      {/* Selected Stocks Display */}
      {(selectedPriceFilter || showOnlyHoldings) && displayStocks.length > 0 && (
        <section style={{ marginBottom: "25px", width: "100%" }}>
          <div
            style={{
              marginBottom: "15px",
            }}
          >
            <h2
              style={{
                color: showOnlyHoldings 
                    ? "#ffd700"
                    : selectedPriceFilter === 'under1'
                    ? "#28a745"
                    : selectedPriceFilter === '1to2'
                    ? "#17a2b8"
                    : "#6f42c1",
                margin: 0,
                fontSize: "1.3rem",
              }}
            >
              {showOnlyHoldings && "⭐ Your Holdings"}
              {!showOnlyHoldings && selectedPriceFilter === 'under1' && "💰 Under $1"}
              {!showOnlyHoldings && selectedPriceFilter === '1to2' && "💎 $1 - $2"}
              {!showOnlyHoldings && selectedPriceFilter === 'over2' && "🏆 Over $2"}
              {" "}({displayStocks.length})
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
            {displayStocks.map((stock) => (
              <div
                key={stock.ticker}
                onClick={() => openChart(stock.ticker)}
                style={{
                  padding: "12px",
                  backgroundColor: "#f8f9fa",
                  border: `1px solid ${showOnlyHoldings ? "#ffd700" : selectedPriceFilter === 'under1' ? "#28a745" : selectedPriceFilter === '1to2' ? "#17a2b8" : "#6f42c1"}`,
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow =
                    "0 3px 6px rgba(0,0,0,0.15)";
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
                    {holdings.has(stock.ticker) && (
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
                          toggleHolding(stock.ticker);
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
                    {!holdings.has(stock.ticker) && (
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
                          toggleHolding(stock.ticker);
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
                          color:
                            stock.fire_level! > (stock.previous_fire_level || 0)
                              ? "#28a745"
                              : "#dc3545",
                          fontWeight: "bold",
                        }}
                      >
                        {stock.fire_level! > (stock.previous_fire_level || 0)
                          ? "▲"
                          : "▼"}
                      </span>
                    )}
                    <span style={{ fontSize: "1rem" }}>
                      {getFireEmoji(getFireLevel(stock))}
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
                  {stock.price_change !== undefined &&
                    stock.price_change !== 0 && (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: stock.price_change > 0 ? "#dc3545" : "#28a745",
                          fontWeight: "normal",
                        }}
                      >
                        ({stock.price_change > 0 ? "+" : ""}$
                        {stock.price_change.toFixed(2)})
                      </span>
                    )}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#666",
                    lineHeight: "1.2",
                  }}
                >
                  <div>BR: {stock.blackrock_pct.toFixed(1)}%</div>
                  <div>VG: {stock.vanguard_pct.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(selectedPriceFilter || showOnlyHoldings) && displayStocks.length === 0 && (
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
            {showOnlyHoldings ? "No holdings found" : "No stocks found for this combination"}
          </h3>
          <p style={{ fontSize: "0.85rem" }}>
            {showOnlyHoldings 
              ? "You haven't marked any stocks as holdings yet. Click the ☆ icon on any stock to add it to your holdings."
              : selectedPriceFilter 
                ? "Try removing the price filter or selecting a different fire level"
                : "Try starting a new scan to discover more stocks"
            }
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
              🔥 All Fire Stocks ({uniqueFireStocks.length})
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
            {uniqueFireStocks
              .sort((a, b) => {
                const fireA = getFireLevel(a);
                const fireB = getFireLevel(b);
                
                // First sort by fire level (descending - highest fire first)
                if (fireA !== fireB) {
                  return fireB - fireA;
                }
                
                // Then sort by price (ascending - lowest price first)
                return a.price - b.price;
              })
              .map((stock) => (
              <div
                key={stock.ticker}
                onClick={() => openChart(stock.ticker)}
                style={{
                  padding: "12px",
                  backgroundColor: "#f8f9fa",
                  border: "1px solid #dee2e6",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow =
                    "0 3px 6px rgba(0,0,0,0.15)";
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
                    {holdings.has(stock.ticker) && (
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
                          toggleHolding(stock.ticker);
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
                    {!holdings.has(stock.ticker) && (
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
                          toggleHolding(stock.ticker);
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
                          color:
                            stock.fire_level! > (stock.previous_fire_level || 0)
                              ? "#28a745"
                              : "#dc3545",
                          fontWeight: "bold",
                        }}
                      >
                        {stock.fire_level! > (stock.previous_fire_level || 0)
                          ? "▲"
                          : "▼"}
                      </span>
                    )}
                    <span style={{ fontSize: "1rem" }}>
                      {getFireEmoji(getFireLevel(stock))}
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
                  {stock.price_change !== undefined &&
                    stock.price_change !== 0 && (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: stock.price_change > 0 ? "#dc3545" : "#28a745",
                          fontWeight: "normal",
                        }}
                      >
                        ({stock.price_change > 0 ? "+" : ""}$
                        {stock.price_change.toFixed(2)})
                      </span>
                    )}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#666",
                    lineHeight: "1.2",
                  }}
                >
                  <div>BR: {stock.blackrock_pct.toFixed(1)}%</div>
                  <div>VG: {stock.vanguard_pct.toFixed(1)}%</div>
                </div>
              </div>
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
      )}

      {/* Footer */}
      {results && (
        <div
          style={{
            textAlign: "center",
            marginTop: "25px",
            padding: "15px",
            backgroundColor: "#fff",
            borderRadius: "6px",
            color: "#666",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: "600",
              marginBottom: "2px",
            }}
          >
            Last Scan
          </div>
          <div style={{ fontSize: "0.9rem", color: "#333" }}>
            {new Date(results.timestamp).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default FireDashboard;
