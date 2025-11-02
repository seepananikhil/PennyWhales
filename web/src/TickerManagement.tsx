import React, { useState, useEffect } from 'react';
import api from './api';
import { Stock } from './types';
import { theme, getFireLevelStyle } from './theme';
import StockCard from './components/StockCard';
import StockGrid from './components/StockGrid';
import SectionHeader from './components/SectionHeader';

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
    return getFireLevelStyle(level).emoji;
  };

  const getFireColor = (level: number): string => {
    return getFireLevelStyle(level).primary;
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

  const openChart = (ticker: string) => {
    window.open(
      `https://www.tradingview.com/chart/?symbol=${ticker}`,
      "_blank"
    );
  };

  if (loading) {
    return (
      <div style={{ 
        padding: theme.spacing.xxl, 
        textAlign: 'center',
        fontFamily: theme.typography.fontFamily
      }}>
        <div style={{ 
          fontSize: theme.typography.fontSize.lg,
          color: theme.ui.text.secondary
        }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: theme.spacing.xl, 
      maxWidth: '100%', 
      backgroundColor: theme.ui.background, 
      minHeight: '100vh',
      boxSizing: 'border-box',
      fontFamily: theme.typography.fontFamily,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: theme.spacing.xxl }}>
        <h1 style={{ 
          margin: `0 0 ${theme.spacing.md} 0`, 
          color: theme.ui.text.primary,
          fontSize: theme.typography.fontSize.xl,
          fontWeight: theme.typography.fontWeight.bold
        }}>
          🎯 Ticker Management
        </h1>
        <p style={{ 
          color: theme.ui.text.secondary, 
          margin: 0,
          fontSize: theme.typography.fontSize.base
        }}>
          Total Tickers: <strong>{tickers.length}</strong>
        </p>
        
        {/* Fire Stock Summary */}
        {stockData.size > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: theme.spacing.lg,
            marginTop: theme.spacing.lg,
            flexWrap: 'wrap'
          }}>
            <div style={{
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              backgroundColor: theme.fire.level3.primary,
              color: theme.ui.surface,
              borderRadius: theme.borderRadius.md,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.bold,
              boxShadow: theme.ui.shadow.sm
            }}>
              🔥🔥🔥 {Array.from(stockData.values()).filter(s => s.fire_level === 3).length}
            </div>
            <div style={{
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              backgroundColor: theme.fire.level2.primary,
              color: theme.ui.surface,
              borderRadius: theme.borderRadius.md,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.bold,
              boxShadow: theme.ui.shadow.sm
            }}>
              🔥🔥 {Array.from(stockData.values()).filter(s => s.fire_level === 2).length}
            </div>
            <div style={{
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              backgroundColor: theme.fire.level1.primary,
              color: theme.ui.text.primary,
              borderRadius: theme.borderRadius.md,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.bold,
              boxShadow: theme.ui.shadow.sm
            }}>
              🔥 {Array.from(stockData.values()).filter(s => s.fire_level === 1).length}
            </div>
            <div style={{
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              backgroundColor: theme.ui.text.muted,
              color: theme.ui.surface,
              borderRadius: theme.borderRadius.md,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.bold,
              boxShadow: theme.ui.shadow.sm
            }}>
              No Fire {tickers.length - stockData.size}
            </div>
            <div style={{
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              backgroundColor: theme.holdings.primary,
              color: theme.ui.text.primary,
              borderRadius: theme.borderRadius.md,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.bold,
              boxShadow: theme.ui.shadow.sm
            }}>
              ⭐ Holdings {holdings.size}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: theme.spacing.md,
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.xl,
          textAlign: 'center',
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.fontSize.base
        }}>
          ❌ {error}
        </div>
      )}

      {/* Bulk Input Section */}
      <div style={{
        backgroundColor: theme.ui.surface,
        padding: theme.spacing.xl,
        borderRadius: theme.borderRadius.lg,
        boxShadow: theme.ui.shadow.md,
        marginBottom: theme.spacing.xxl
      }}>
        <h2 style={{ 
          margin: `0 0 ${theme.spacing.lg} 0`, 
          color: theme.ui.text.primary,
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.fontSize.xl,
          fontWeight: theme.typography.fontWeight.semibold
        }}>
          Add/Update Tickers
        </h2>
        <p style={{ 
          color: theme.ui.text.secondary, 
          fontSize: theme.typography.fontSize.base, 
          margin: `0 0 ${theme.spacing.lg} 0`,
          fontFamily: theme.typography.fontFamily
        }}>
          Enter tickers separated by commas, spaces, or new lines
        </p>
        
        <textarea
          value={bulkTickersText}
          onChange={(e) => setBulkTickersText(e.target.value)}
          placeholder="AAPL, MSFT, GOOGL, TSLA&#10;NVDA AMZN META&#10;NFLX"
          rows={6}
          style={{
            width: '100%',
            padding: theme.spacing.md,
            border: `1px solid ${theme.ui.border}`,
            borderRadius: theme.borderRadius.md,
            fontSize: theme.typography.fontSize.base,
            fontFamily: 'monospace',
            resize: 'vertical',
            boxSizing: 'border-box',
            transition: `border-color ${theme.transition.normal}`,
            outline: 'none'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = theme.price.under1.primary;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = theme.ui.border;
          }}
        />
        
        <div style={{ 
          marginTop: theme.spacing.lg, 
          display: 'flex', 
          gap: theme.spacing.md,
          flexWrap: 'wrap'
        }}>
          <button
            onClick={handleBulkAdd}
            disabled={!bulkTickersText.trim()}
            style={{
              padding: `${theme.spacing.md} ${theme.spacing.xl}`,
              backgroundColor: bulkTickersText.trim() ? theme.status.success : theme.ui.text.muted,
              color: theme.ui.surface,
              border: 'none',
              borderRadius: theme.borderRadius.md,
              cursor: bulkTickersText.trim() ? 'pointer' : 'not-allowed',
              fontWeight: theme.typography.fontWeight.bold,
              fontSize: theme.typography.fontSize.base,
              fontFamily: theme.typography.fontFamily,
              transition: `all ${theme.transition.normal}`,
              boxShadow: theme.ui.shadow.sm
            }}
            onMouseEnter={(e) => {
              if (bulkTickersText.trim()) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.md;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
            }}
          >
            ➕ Add New Tickers
          </button>
          
          <button
            onClick={handleBulkUpdate}
            disabled={!bulkTickersText.trim()}
            style={{
              padding: `${theme.spacing.md} ${theme.spacing.xl}`,
              backgroundColor: bulkTickersText.trim() ? theme.status.info : theme.ui.text.muted,
              color: theme.ui.surface,
              border: 'none',
              borderRadius: theme.borderRadius.md,
              cursor: bulkTickersText.trim() ? 'pointer' : 'not-allowed',
              fontWeight: theme.typography.fontWeight.bold,
              fontSize: theme.typography.fontSize.base,
              fontFamily: theme.typography.fontFamily,
              transition: `all ${theme.transition.normal}`,
              boxShadow: theme.ui.shadow.sm
            }}
            onMouseEnter={(e) => {
              if (bulkTickersText.trim()) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.md;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
            }}
          >
            🔄 Replace All Tickers
          </button>
        </div>
      </div>

      {/* All Tickers Display */}
      <div style={{
        backgroundColor: theme.ui.surface,
        padding: theme.spacing.xl,
        borderRadius: theme.borderRadius.lg,
        boxShadow: theme.ui.shadow.md
      }}>
        <SectionHeader
          title="All Tickers"
          count={tickers.length}
          color={theme.ui.text.primary}
          actions={
            <>
              <button
                onClick={async () => {
                  try {
                    await fetch('http://localhost:9000/api/scan/daily', { method: 'POST' });
                    setTimeout(() => {
                      loadStockData();
                    }, 3000);
                  } catch (error) {
                    console.error('Daily scan failed:', error);
                    setError('Daily scan failed');
                  }
                }}
                style={{
                  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                  backgroundColor: theme.status.success,
                  color: theme.ui.surface,
                  border: 'none',
                  borderRadius: theme.borderRadius.md,
                  cursor: 'pointer',
                  fontWeight: theme.typography.fontWeight.bold,
                  fontSize: theme.typography.fontSize.sm,
                  fontFamily: theme.typography.fontFamily,
                  transition: `all ${theme.transition.normal}`,
                  boxShadow: theme.ui.shadow.sm
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = theme.ui.shadow.md;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
                }}
              >
                � Daily Scan
              </button>
              <button
                onClick={async () => {
                  try {
                    await fetch('http://localhost:9000/api/scan/start', { method: 'POST' });
                    setTimeout(() => {
                      loadStockData();
                    }, 5000);
                  } catch (error) {
                    console.error('Full scan failed:', error);
                    setError('Full scan failed');
                  }
                }}
                style={{
                  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                  backgroundColor: '#fd7e14',
                  color: theme.ui.surface,
                  border: 'none',
                  borderRadius: theme.borderRadius.md,
                  cursor: 'pointer',
                  fontWeight: theme.typography.fontWeight.bold,
                  fontSize: theme.typography.fontSize.sm,
                  fontFamily: theme.typography.fontFamily,
                  transition: `all ${theme.transition.normal}`,
                  boxShadow: theme.ui.shadow.sm
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = theme.ui.shadow.md;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
                }}
              >
                🔍 Full Scan
              </button>
              <button
                onClick={loadStockData}
                style={{
                  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                  backgroundColor: theme.status.info,
                  color: theme.ui.surface,
                  border: 'none',
                  borderRadius: theme.borderRadius.md,
                  cursor: 'pointer',
                  fontWeight: theme.typography.fontWeight.bold,
                  fontSize: theme.typography.fontSize.sm,
                  fontFamily: theme.typography.fontFamily,
                  transition: `all ${theme.transition.normal}`,
                  boxShadow: theme.ui.shadow.sm
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = theme.ui.shadow.md;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
                }}
              >
                🔄 Refresh Data
              </button>
            </>
          }
        />
        
        {tickers.length > 0 ? (
          <StockGrid
            stocks={tickers.map(ticker => {
              const stock = stockData.get(ticker);
              return stock || {
                ticker,
                price: 0,
                blackrock_pct: 0,
                vanguard_pct: 0,
                fire_level: 0,
                is_new: false
              } as Stock;
            })}
            holdings={holdings}
            onToggleHolding={toggleHolding}
            onOpenChart={openChart}
            showHoldingStar={true}
            emptyMessage="No tickers configured"
            emptyDescription="Add some tickers above to start scanning"
          />
        ) : (
          <div style={{
            textAlign: 'center',
            padding: theme.spacing.xxl,
            color: theme.ui.text.secondary,
            fontFamily: theme.typography.fontFamily
          }}>
            <h3 style={{ 
              margin: `0 0 ${theme.spacing.md} 0`,
              fontSize: theme.typography.fontSize.xl,
              fontWeight: theme.typography.fontWeight.semibold,
              color: theme.ui.text.primary
            }}>
              No tickers configured
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: theme.typography.fontSize.base
            }}>
              Add some tickers above to start scanning
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TickerManagement;