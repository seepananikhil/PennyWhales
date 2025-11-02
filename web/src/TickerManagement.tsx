import React, { useState, useEffect } from 'react';
import api from './api';
import { Stock } from './types';

const TickerManagement: React.FC = () => {
  const [tickers, setTickers] = useState<string[]>([]);
  const [stockData, setStockData] = useState<Map<string, Stock>>(new Map());
  const [holdings, setHoldings] = useState<Set<string>>(new Set());
  const [bulkTickersText, setBulkTickersText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([loadTickers(), loadStockData(), loadHoldings()]);
  };

  const loadTickers = async () => {
    try {
      setLoading(true);
      const data = await api.getTickers();
      setTickers(data?.tickers || []);
      setError(null);
    } catch (err) {
      setError('Failed to load tickers');
      console.error('Error loading tickers:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStockData = async () => {
    try {
      const results = await api.getLatestResults();
      if (results?.stocks) {
        const stockMap = new Map<string, Stock>();
        results.stocks.forEach(stock => {
          stockMap.set(stock.ticker, stock);
        });
        setStockData(stockMap);
      }
    } catch (err) {
      console.error('Error loading stock data:', err);
    }
  };

  const loadHoldings = async () => {
    try {
      const data = await api.getHoldings();
      setHoldings(new Set(data.holdings || []));
    } catch (err) {
      console.error('Error loading holdings:', err);
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

  const getFireEmoji = (level: number): string => {
    switch (level) {
      case 3: return "🔥🔥🔥";
      case 2: return "🔥🔥";
      case 1: return "🔥";
      default: return "";
    }
  };

  const getFireColor = (level: number): string => {
    switch (level) {
      case 3: return "#dc2626"; // Red
      case 2: return "#f59e0b"; // Orange
      case 1: return "#22c55e"; // Green
      default: return "#6b7280"; // Gray
    }
  };

  const handleBulkUpdate = async () => {
    if (!bulkTickersText.trim()) return;

    try {
      const newTickers = bulkTickersText
        .split(/[,\n\r\s]+/)
        .map(t => t.trim().toUpperCase())
        .filter(t => t && t.length > 0);

      if (newTickers.length === 0) {
        setError('No valid tickers provided');
        return;
      }

      // Use PUT to replace all tickers
      const response = await fetch('http://localhost:9000/api/tickers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: newTickers })
      });

      if (response.ok) {
        setTickers(newTickers);
        setBulkTickersText('');
        setError(null);
        await loadStockData(); // Reload stock data
        await loadHoldings(); // Reload holdings
      } else {
        setError('Failed to update tickers');
      }
    } catch (err) {
      setError('Failed to update tickers');
      console.error('Error updating tickers:', err);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkTickersText.trim()) return;

    try {
      const tickersToAdd = bulkTickersText
        .split(/[,\n\r\s]+/)
        .map(t => t.trim().toUpperCase())
        .filter(t => t && t.length > 0 && !tickers.includes(t));

      if (tickersToAdd.length === 0) {
        setError('No new tickers to add');
        return;
      }

      // Use PATCH to add new tickers
      const response = await fetch('http://localhost:9000/api/tickers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: tickersToAdd })
      });

      if (response.ok) {
        setTickers([...tickers, ...tickersToAdd]);
        setBulkTickersText('');
        setError(null);
        await loadStockData(); // Reload stock data
        await loadHoldings(); // Reload holdings
      } else {
        setError('Failed to add tickers');
      }
    } catch (err) {
      setError('Failed to add tickers');
      console.error('Error adding tickers:', err);
    }
  };

  const handleDeleteTicker = async (ticker: string) => {
    if (!window.confirm(`Are you sure you want to delete ticker ${ticker}?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:9000/api/tickers/${ticker}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setTickers(tickers.filter(t => t !== ticker));
        setError(null);
        await loadStockData(); // Reload stock data
        await loadHoldings(); // Reload holdings
      } else {
        setError(`Failed to delete ticker ${ticker}`);
      }
    } catch (err) {
      setError(`Failed to delete ticker ${ticker}`);
      console.error('Error deleting ticker:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '100%', 
      backgroundColor: '#f8f9fa', 
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ margin: '0 0 10px 0', color: '#333' }}>🎯 Ticker Management</h1>
        <p style={{ color: '#666', margin: 0 }}>Total Tickers: <strong>{tickers.length}</strong></p>
        
        {/* Fire Stock Summary */}
        {stockData.size > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '15px',
            marginTop: '15px',
            flexWrap: 'wrap'
          }}>
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#dc2626',
              color: 'white',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              🔥🔥🔥 {Array.from(stockData.values()).filter(s => s.fire_level === 3).length}
            </div>
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#f59e0b',
              color: 'white',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              🔥🔥 {Array.from(stockData.values()).filter(s => s.fire_level === 2).length}
            </div>
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#22c55e',
              color: 'white',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              🔥 {Array.from(stockData.values()).filter(s => s.fire_level === 1).length}
            </div>
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#6b7280',
              color: 'white',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              No Fire {tickers.length - stockData.size}
            </div>
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#ffd700',
              color: '#333',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              ⭐ Holdings {holdings.size}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '6px',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          ❌ {error}
        </div>
      )}

      {/* Bulk Input Section */}
      <div style={{
        backgroundColor: '#fff',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '30px'
      }}>
        <h2 style={{ margin: '0 0 15px 0', color: '#333' }}>Add/Update Tickers</h2>
        <p style={{ color: '#666', fontSize: '14px', margin: '0 0 15px 0' }}>
          Enter tickers separated by commas, spaces, or new lines
        </p>
        
        <textarea
          value={bulkTickersText}
          onChange={(e) => setBulkTickersText(e.target.value)}
          placeholder="AAPL, MSFT, GOOGL, TSLA&#10;NVDA AMZN META&#10;NFLX"
          rows={6}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px',
            fontFamily: 'monospace',
            resize: 'vertical',
            boxSizing: 'border-box'
          }}
        />
        
        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
          <button
            onClick={handleBulkAdd}
            disabled={!bulkTickersText.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: bulkTickersText.trim() ? '#28a745' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: bulkTickersText.trim() ? 'pointer' : 'not-allowed',
              fontWeight: 'bold'
            }}
          >
            ➕ Add New Tickers
          </button>
          
          <button
            onClick={handleBulkUpdate}
            disabled={!bulkTickersText.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: bulkTickersText.trim() ? '#007bff' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: bulkTickersText.trim() ? 'pointer' : 'not-allowed',
              fontWeight: 'bold'
            }}
          >
            🔄 Replace All Tickers
          </button>
        </div>
      </div>

      {/* All Tickers Display */}
      <div style={{
        backgroundColor: '#fff',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <h2 style={{ margin: 0, color: '#333' }}>All Tickers ({tickers.length})</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={async () => {
                try {
                  await fetch('http://localhost:9000/api/scan/daily', { method: 'POST' });
                  // Poll for updates after a delay
                  setTimeout(() => {
                    loadStockData();
                  }, 3000);
                } catch (error) {
                  console.error('Daily scan failed:', error);
                  setError('Daily scan failed');
                }
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px'
              }}
            >
              🔥 Daily Scan
            </button>
            <button
              onClick={async () => {
                try {
                  await fetch('http://localhost:9000/api/scan/start', { method: 'POST' });
                  // Poll for updates after a delay
                  setTimeout(() => {
                    loadStockData();
                  }, 5000);
                } catch (error) {
                  console.error('Full scan failed:', error);
                  setError('Full scan failed');
                }
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#fd7e14',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px'
              }}
            >
              🔍 Full Scan
            </button>
            <button
              onClick={loadStockData}
              style={{
                padding: '8px 16px',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px'
              }}
            >
              🔄 Refresh Data
            </button>
          </div>
        </div>
        
        {tickers.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '12px',
            maxHeight: '60vh',
            overflowY: 'auto',
            padding: '10px',
            backgroundColor: '#f8f9fa',
            borderRadius: '6px'
          }}>
            {tickers.map((ticker) => {
              const stock = stockData.get(ticker);
              return (
                <div
                  key={ticker}
                  style={{
                    padding: '12px',
                    backgroundColor: '#fff',
                    borderRadius: '6px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    border: stock ? `2px solid ${getFireColor(stock.fire_level || 0)}` : '2px solid #e9ecef',
                    position: 'relative'
                  }}
                >
                  {/* Header with ticker and delete button */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontWeight: 'bold',
                        fontSize: '14px',
                        color: '#333',
                        fontFamily: 'monospace'
                      }}>
                        {ticker}
                      </span>
                      {holdings.has(ticker) && (
                        <span 
                          style={{ 
                            color: "#ffd700", 
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleHolding(ticker);
                          }}
                          title="Currently holding (click to remove)"
                        >
                          ⭐
                        </span>
                      )}
                      {!holdings.has(ticker) && (
                        <span 
                          style={{ 
                            color: "#ccc", 
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleHolding(ticker);
                          }}
                          title="Click to mark as holding"
                        >
                          ☆
                        </span>
                      )}
                      {stock && (
                        <span style={{ fontSize: '12px' }}>
                          {getFireEmoji(stock.fire_level || 0)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteTicker(ticker)}
                      style={{
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        padding: '2px 6px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                      title={`Delete ${ticker}`}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Stock details */}
                  {stock ? (
                    <div style={{ fontSize: '11px', color: '#666', lineHeight: '1.4' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px'
                      }}>
                        <span style={{ fontWeight: 'bold', color: '#333' }}>
                          ${stock.price.toFixed(2)}
                        </span>
                        {stock.fire_level_changed && (
                          <span style={{
                            fontSize: '10px',
                            color: (stock.fire_level || 0) > (stock.previous_fire_level || 0) ? '#28a745' : '#dc3545',
                            fontWeight: 'bold'
                          }}>
                            {(stock.fire_level || 0) > (stock.previous_fire_level || 0) ? '📈' : '📉'}
                          </span>
                        )}
                      </div>
                      <div>BR: {stock.blackrock_pct.toFixed(1)}%</div>
                      <div>VG: {stock.vanguard_pct.toFixed(1)}%</div>
                      {stock.is_new && (
                        <div style={{
                          color: '#28a745',
                          fontWeight: 'bold',
                          fontSize: '10px',
                          marginTop: '2px'
                        }}>
                          NEW
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      fontSize: '11px',
                      color: '#999',
                      fontStyle: 'italic'
                    }}>
                      No scan data available
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#666'
          }}>
            <h3 style={{ margin: '0 0 10px 0' }}>No tickers configured</h3>
            <p style={{ margin: 0 }}>Add some tickers above to start scanning</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TickerManagement;