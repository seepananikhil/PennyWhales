import React, { useState, useEffect } from "react";
import { Stock, ScanResult, ScanStatus } from "./types";
import api from "./api";

const FireDashboard: React.FC = () => {
  const [results, setResults] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await api.getLatestResults();
      setResults(data);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
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
        setSelectedLevel(null);
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

  const level3 = uniqueFireStocks.filter((s) => getFireLevel(s) === 3);
  const level2 = uniqueFireStocks.filter((s) => getFireLevel(s) === 2);
  const level1 = uniqueFireStocks.filter((s) => getFireLevel(s) === 1);

  const getDisplayStocks = () => {
    if (selectedLevel === 3) return level3;
    if (selectedLevel === 2) return level2;
    if (selectedLevel === 1) return level1;
    return [];
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
      {/* Scan Buttons */}
      <div style={{ textAlign: "center", marginBottom: "25px" }}>
        <button
          onClick={() => startScan("daily")}
          disabled={scanning}
          style={{
            padding: "10px 25px",
            fontSize: "14px",
            backgroundColor: scanning ? "#ccc" : "#28a745",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: scanning ? "not-allowed" : "pointer",
            fontWeight: "bold",
            boxShadow: "0 3px 6px rgba(0,0,0,0.1)",
            marginRight: "10px",
          }}
        >
          {scanning ? "🔍 Scanning..." : "� Daily Scan (Fire Stocks Only)"}
        </button>
        <button
          onClick={clearDatabase}
          style={{
            padding: "10px 25px",
            fontSize: "14px",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
            boxShadow: "0 3px 6px rgba(0,0,0,0.1)",
          }}
        >
          🗑️ Clear Database
        </button>
      </div>
      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "15px",
          marginBottom: "25px",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        <button
          onClick={() => setSelectedLevel(selectedLevel === 3 ? null : 3)}
          style={{
            padding: "20px",
            backgroundColor: selectedLevel === 3 ? "#ff4444" : "#fff",
            color: selectedLevel === 3 ? "#fff" : "#ff4444",
            border: "2px solid #ff4444",
            borderRadius: "10px",
            textAlign: "center",
            boxShadow:
              selectedLevel === 3
                ? "0 4px 8px rgba(255,68,68,0.3)"
                : "0 2px 6px rgba(0,0,0,0.1)",
            cursor: "pointer",
            transition: "all 0.3s",
            transform: selectedLevel === 3 ? "translateY(-1px)" : "none",
          }}
        >
          <div
            style={{
              fontSize: "2rem",
              fontWeight: "bold",
              marginBottom: "6px",
            }}
          >
            {level3.length}
          </div>
          <div style={{ fontSize: "0.8rem", fontWeight: "600" }}>
            🔥🔥🔥 Excellent
          </div>
          <div style={{ fontSize: "0.65rem", opacity: 0.8, marginTop: "3px" }}>
            Both funds ≥5%, Price &lt;$1
          </div>
        </button>

        <button
          onClick={() => setSelectedLevel(selectedLevel === 2 ? null : 2)}
          style={{
            padding: "20px",
            backgroundColor: selectedLevel === 2 ? "#ff8800" : "#fff",
            color: selectedLevel === 2 ? "#fff" : "#ff8800",
            border: "2px solid #ff8800",
            borderRadius: "10px",
            textAlign: "center",
            boxShadow:
              selectedLevel === 2
                ? "0 4px 8px rgba(255,136,0,0.3)"
                : "0 2px 6px rgba(0,0,0,0.1)",
            cursor: "pointer",
            transition: "all 0.3s",
            transform: selectedLevel === 2 ? "translateY(-1px)" : "none",
          }}
        >
          <div
            style={{
              fontSize: "2rem",
              fontWeight: "bold",
              marginBottom: "6px",
            }}
          >
            {level2.length}
          </div>
          <div style={{ fontSize: "0.8rem", fontWeight: "600" }}>
            🔥🔥 Strong
          </div>
          <div style={{ fontSize: "0.65rem", opacity: 0.8, marginTop: "3px" }}>
            Both funds ≥5%, Price ≤$2
          </div>
        </button>

        <button
          onClick={() => setSelectedLevel(selectedLevel === 1 ? null : 1)}
          style={{
            padding: "20px",
            backgroundColor: selectedLevel === 1 ? "#ffcc00" : "#fff",
            color: selectedLevel === 1 ? "#fff" : "#ffcc00",
            border: "2px solid #ffcc00",
            borderRadius: "10px",
            textAlign: "center",
            boxShadow:
              selectedLevel === 1
                ? "0 4px 8px rgba(255,204,0,0.3)"
                : "0 2px 6px rgba(0,0,0,0.1)",
            cursor: "pointer",
            transition: "all 0.3s",
            transform: selectedLevel === 1 ? "translateY(-1px)" : "none",
          }}
        >
          <div
            style={{
              fontSize: "2rem",
              fontWeight: "bold",
              marginBottom: "6px",
            }}
          >
            {level1.length}
          </div>
          <div style={{ fontSize: "0.8rem", fontWeight: "600" }}>
            🔥 Moderate
          </div>
          <div style={{ fontSize: "0.65rem", opacity: 0.8, marginTop: "3px" }}>
            One fund ≥5%, Price ≤$2
          </div>
        </button>

        <div
          style={{
            padding: "20px",
            backgroundColor: "#fff",
            border: "2px solid #00cc88",
            borderRadius: "10px",
            textAlign: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              fontSize: "2rem",
              fontWeight: "bold",
              color: "#00cc88",
              marginBottom: "6px",
            }}
          >
            {fireStocks.length}
          </div>
          <div
            style={{ fontSize: "0.8rem", color: "#00cc88", fontWeight: "600" }}
          >
            Total Fire Stocks
          </div>
          <div style={{ fontSize: "0.65rem", color: "#666", marginTop: "3px" }}>
            All categories combined
          </div>
        </div>
      </div>

      {/* Selected Stocks Display */}
      {selectedLevel && displayStocks.length > 0 && (
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
                color:
                  selectedLevel === 3
                    ? "#ff4444"
                    : selectedLevel === 2
                    ? "#ff8800"
                    : "#ffcc00",
                margin: 0,
                fontSize: "1.3rem",
              }}
            >
              {getFireEmoji(selectedLevel)}{" "}
              {selectedLevel === 3
                ? "Excellent"
                : selectedLevel === 2
                ? "Strong"
                : "Moderate"}{" "}
              ({displayStocks.length})
            </h2>
            <button
              onClick={() => setSelectedLevel(null)}
              style={{
                padding: "6px 12px",
                backgroundColor: "#fff",
                border: "1px solid #ddd",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "600",
                color: "#666",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              ✕ Close
            </button>
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
                  border: `1px solid ${
                    selectedLevel === 3
                      ? "#ff4444"
                      : selectedLevel === 2
                      ? "#ff8800"
                      : "#ffcc00"
                  }`,
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
                      {getFireEmoji(selectedLevel)}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: "1rem",
                    color:
                      selectedLevel === 3
                        ? "#ff4444"
                        : selectedLevel === 2
                        ? "#ff8800"
                        : "#ffcc00",
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

      {selectedLevel && displayStocks.length === 0 && (
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
            No stocks found for this fire level
          </h3>
          <p style={{ fontSize: "0.85rem" }}>
            Try starting a new scan to discover more stocks
          </p>
        </div>
      )}

      {!selectedLevel && fireStocks.length > 0 && (
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
            Select a Fire Level to View Stocks
          </h3>
          <p style={{ fontSize: "0.9rem", marginBottom: "15px" }}>
            Click on any of the cards above to explore stocks in that category
          </p>
          <div style={{ fontSize: "1.3rem", letterSpacing: "6px" }}>
            🔥🔥🔥 • 🔥🔥 • 🔥
          </div>
        </div>
      )}

      {fireStocks.length === 0 && !selectedLevel && (
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
