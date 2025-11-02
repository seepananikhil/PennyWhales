import React, { useState, useEffect } from 'react';
import { Stock, ScanResult, ScanStatus } from './types';
import api from './api';
import './index.css';

interface Filters {
  priority: 'all' | 1 | 2 | 3;
  maxPrice: number;
  minBlackrock: number;
  minVanguard: number;
  fireLevel: 'all' | 1 | 3 | 5; // 1=🔥, 3=🔥🔥🔥, 5=🔥🔥🔥🔥🔥
  underDollar: boolean;
  premiumDeals: boolean;
}

const StockDashboard: React.FC = () => {
  const [scanStatus, setScanStatus] = useState<ScanStatus>({
    scanning: false,
    progress: null,
    error: null,
    last_scan: null
  });
  const [results, setResults] = useState<ScanResult | null>(null);
  const [processedStocksCount, setProcessedStocksCount] = useState<number>(0);
  const [tickers, setTickers] = useState<string[]>([]);
  const [newTicker, setNewTicker] = useState<string>('');
  const [showTickerManagement, setShowTickerManagement] = useState<boolean>(false);
  const [filters, setFilters] = useState<Filters>({
    priority: 'all',
    maxPrice: 1000,
    minBlackrock: 0,
    minVanguard: 0,
    fireLevel: 'all',
    underDollar: false,
    premiumDeals: false
  });

  // Poll for scan status updates
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (scanStatus.scanning) {
      interval = setInterval(async () => {
        try {
          const status = await api.getScanStatus();
          setScanStatus(status);
          
          if (!status.scanning) {
            // Scan completed, fetch results
            const latestResults = await api.getLatestResults();
            setResults(latestResults);
            clearInterval(interval);
          }
        } catch (error) {
          console.error('Error polling scan status:', error);
          setScanStatus(prev => ({ 
            ...prev, 
            scanning: false, 
            error: 'Failed to get scan status' 
          }));
          clearInterval(interval);
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [scanStatus.scanning]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Get processed stocks count
        const processedData = await api.getProcessedStocks();
        setProcessedStocksCount(processedData.count);
        
        // Get latest results
        const latestResults = await api.getLatestResults();
        setResults(latestResults);
        
        // Get scan status
        const status = await api.getScanStatus();
        setScanStatus(status);
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };

    loadInitialData();
  }, []);

  const handleStartScan = async () => {
    try {
      setScanStatus(prev => ({ ...prev, error: null, scanning: true }));
      const response = await api.startScan();
      
      if (!response.success) {
        setScanStatus(prev => ({ 
          ...prev, 
          scanning: false, 
          error: response.message 
        }));
      }
    } catch (error: any) {
      setScanStatus(prev => ({ 
        ...prev, 
        scanning: false, 
        error: error.message || 'Failed to start scan' 
      }));
    }
  };

  // Ticker Management Functions
  const loadTickers = async () => {
    try {
      const response = await api.getTickers();
      setTickers(response.tickers);
    } catch (error) {
      console.error('Error loading tickers:', error);
    }
  };

  const handleAddTicker = async () => {
    if (!newTicker.trim()) return;
    
    try {
      const response = await api.addTicker(newTicker.trim().toUpperCase());
      if (response.success) {
        setNewTicker('');
        await loadTickers();
      } else {
        alert('Failed to add ticker');
      }
    } catch (error) {
      console.error('Error adding ticker:', error);
      alert('Error adding ticker');
    }
  };

  const handleRemoveTicker = async (ticker: string) => {
    try {
      const response = await api.removeTicker(ticker);
      if (response.success) {
        await loadTickers();
      } else {
        alert('Failed to remove ticker');
      }
    } catch (error) {
      console.error('Error removing ticker:', error);
      alert('Error removing ticker');
    }
  };

  const handleBulkAddTickers = async (tickersText: string) => {
    const tickersList = tickersText
      .split(/[,\n\s]+/)
      .map(t => t.trim().toUpperCase())
      .filter(t => t.length > 0);
    
    if (tickersList.length === 0) return;
    
    try {
      const response = await api.addTickers(tickersList);
      if (response.success) {
        alert(`Added ${response.added} new tickers`);
        await loadTickers();
      }
    } catch (error) {
      console.error('Error adding tickers:', error);
      alert('Error adding tickers');
    }
  };

  // Load tickers on component mount
  useEffect(() => {
    loadTickers();
  }, []);

  const openTradingView = (ticker: string) => {
    const url = `https://www.tradingview.com/chart/?symbol=${ticker}`;
    window.open(url, '_blank');
  };

  const getFireIndicators = (stock: Stock): string => {
    const { blackrock_pct, vanguard_pct, price } = stock;
    
    if (blackrock_pct >= 5.0 && vanguard_pct >= 5.0 && price < 1.0) {
      return '🔥🔥🔥🔥🔥'; // Premium deal
    } else if (blackrock_pct >= 5.0 && vanguard_pct >= 5.0) {
      return '🔥🔥🔥'; // Both 5%+
    } else if (stock.rank_category === 1) {
      return '🔥'; // High priority
    }
    return '';
  };

  const getTierData = (stocks: Stock[], category: number) => {
    return stocks.filter(stock => stock.rank_category === category);
  };

  const getFireLevel = (stock: Stock): number => {
    const { blackrock_pct, vanguard_pct, price } = stock;
    
    if (blackrock_pct >= 5.0 && vanguard_pct >= 5.0 && price < 1.0) {
      return 5; // 🔥🔥🔥🔥🔥 Premium deals
    } else if (blackrock_pct >= 5.0 && vanguard_pct >= 5.0) {
      return 3; // 🔥🔥🔥 Super
    } else if (stock.rank_category === 1) {
      return 1; // 🔥 Standard high priority
    }
    return 0;
  };

  const applyFilters = (stocks: Stock[]): Stock[] => {
    return stocks.filter(stock => {
      // Priority filter
      if (filters.priority !== 'all' && stock.rank_category !== filters.priority) {
        return false;
      }
      
      // Price filter (max only)
      if (stock.price > filters.maxPrice) {
        return false;
      }
      
      // Under dollar filter
      if (filters.underDollar && stock.price >= 1.0) {
        return false;
      }
      
      // Premium deals filter
      if (filters.premiumDeals) {
        if (!(stock.blackrock_pct >= 5.0 && stock.vanguard_pct >= 5.0 && stock.price < 1.0)) {
          return false;
        }
      }
      
      // Fire level filter
      if (filters.fireLevel !== 'all') {
        const fireLevel = getFireLevel(stock);
        if (fireLevel !== filters.fireLevel) {
          return false;
        }
      }
      
      // BlackRock filter
      if (stock.blackrock_pct < filters.minBlackrock) {
        return false;
      }
      
      // Vanguard filter
      if (stock.vanguard_pct < filters.minVanguard) {
        return false;
      }
      
      return true;
    });
  };

  const resetFilters = () => {
    setFilters({
      priority: 'all',
      maxPrice: 1000,
      minBlackrock: 0,
      minVanguard: 0,
      fireLevel: 'all',
      underDollar: false,
      premiumDeals: false
    });
  };

  const quickFilterHighPriority = () => {
    setFilters({
      priority: 1,
      maxPrice: 2,
      minBlackrock: 4,
      minVanguard: 4,
      fireLevel: 'all',
      underDollar: false,
      premiumDeals: false
    });
  };

  // Quick filter functions for summary stats
  const filterByPriority = (priority: 1 | 2 | 3) => {
    setFilters({...filters, priority, underDollar: false, premiumDeals: false});
  };

  const filterUnderDollar = () => {
    setFilters({...filters, underDollar: true, premiumDeals: false});
  };

  const filterPremiumDeals = () => {
    setFilters({...filters, premiumDeals: true, underDollar: false});
  };

  const showAllStocks = () => {
    setFilters({...filters, priority: 'all', underDollar: false, premiumDeals: false});
  };

  const renderTierSection = (
    title: string, 
    stocks: Stock[], 
    className: string, 
    emoji: string
  ) => {
    if (stocks.length === 0) return null;

    return (
      <div className={`tier-section ${className}`}>
        <div className="tier-header">
          <span>{emoji}</span>
          <span>{title} ({stocks.length} stocks)</span>
        </div>
        <div className="stock-grid">
          {stocks.map((stock) => (
            <div 
              key={stock.ticker}
              className="stock-item"
              onClick={() => openTradingView(stock.ticker)}
            >
              <div className="stock-ticker">{stock.ticker}</div>
              <div className="stock-price">${stock.price.toFixed(2)}</div>
              <div className="stock-holdings">
                <div className="holding-item">
                  <div className="holding-label">BlackRock</div>
                  <div className="holding-value">{stock.blackrock_pct.toFixed(1)}%</div>
                </div>
                <div className="holding-item">
                  <div className="holding-label">Vanguard</div>
                  <div className="holding-value">{stock.vanguard_pct.toFixed(1)}%</div>
                </div>
              </div>
              <div className="stock-indicators">
                {getFireIndicators(stock)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="container">
      <div className="header">
        <h1>🎯 Stock Scanner Pro</h1>
        <p>BlackRock & Vanguard Holdings Analysis</p>
      </div>

      {/* Ticker Management */}
      <div className="ticker-management">
        <div className="ticker-header">
          <h3>📋 Ticker Management ({tickers.length} tickers)</h3>
          <button 
            className="toggle-btn"
            onClick={() => setShowTickerManagement(!showTickerManagement)}
          >
            {showTickerManagement ? '▼ Hide' : '▶ Show'}
          </button>
        </div>
        
        {showTickerManagement && (
          <div className="ticker-content">
            <div className="ticker-actions">
              <div className="add-ticker">
                <input
                  type="text"
                  placeholder="Add ticker (e.g., AAPL)"
                  value={newTicker}
                  onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTicker()}
                />
                <button onClick={handleAddTicker} className="add-btn">
                  ➕ Add
                </button>
              </div>
              
              <div className="bulk-actions">
                <button 
                  onClick={() => {
                    const tickersText = prompt('Enter tickers separated by commas or new lines:');
                    if (tickersText) handleBulkAddTickers(tickersText);
                  }}
                  className="bulk-btn"
                >
                  📝 Bulk Add
                </button>
              </div>
            </div>
            
            <div className="ticker-list">
              {tickers.length > 0 ? (
                <div className="ticker-grid">
                  {tickers.map((ticker) => (
                    <div key={ticker} className="ticker-item">
                      <span className="ticker-symbol">{ticker}</span>
                      <button 
                        onClick={() => handleRemoveTicker(ticker)}
                        className="remove-btn"
                        title="Remove ticker"
                      >
                        ❌
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-tickers">No tickers configured. Add some tickers to start scanning.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Scan Control */}
      <div className="scan-status">
        {scanStatus.scanning ? (
          <div className="loading">
            <div className="spinner"></div>
            <span>
              Scanning... 
              {scanStatus.progress && 
                ` (${scanStatus.progress.current}/${scanStatus.progress.total} - ${scanStatus.progress.percentage}%)`
              }
            </span>
          </div>
        ) : (
          <div>
            <button 
              className="scan-button" 
              onClick={handleStartScan}
              disabled={scanStatus.scanning}
            >
              Start New Scan
            </button>
            {processedStocksCount > 0 && (
              <div className="last-scan">
                📊 {processedStocksCount} stocks previously processed
                {results?.new_stocks_only && " (showing new finds only)"}
              </div>
            )}
          </div>
        )}
        
        {scanStatus.error && (
          <div className="error-message">
            ❌ {scanStatus.error}
          </div>
        )}
      </div>

      {/* Results */}
      {results && (
        <>
          {/* Summary Stats - Now Clickable */}
          <div className="summary-stats">
            <h3>📊 Scan Summary (Click to Filter)</h3>
            <div className="stats-grid">
              <div className="stat-item clickable" onClick={showAllStocks}>
                <div className="stat-value">{results.summary.qualifying_count}</div>
                <div className="stat-label">Qualifying Stocks</div>
              </div>
              <div className="stat-item clickable" onClick={() => filterByPriority(1)}>
                <div className="stat-value">{results.summary.high_tier}</div>
                <div className="stat-label">High Priority 🔥</div>
              </div>
              <div className="stat-item clickable" onClick={() => filterByPriority(2)}>
                <div className="stat-value">{results.summary.medium_tier}</div>
                <div className="stat-label">Medium Priority 📊</div>
              </div>
              <div className="stat-item clickable" onClick={filterUnderDollar}>
                <div className="stat-value">{results.summary.under_dollar}</div>
                <div className="stat-label">Under $1.00 💰</div>
              </div>
              <div className="stat-item clickable" onClick={filterPremiumDeals}>
                <div className="stat-value">{results.summary.premium_count}</div>
                <div className="stat-label">Premium Deals 🔥🔥🔥🔥🔥</div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="filters-section">
            <h3>🔍 Filters</h3>
            <div className="filters-grid">
              <div className="filter-group">
                <label>Priority Tier:</label>
                <select 
                  value={filters.priority} 
                  onChange={(e) => setFilters({...filters, priority: e.target.value === 'all' ? 'all' : parseInt(e.target.value) as 1 | 2 | 3})}
                >
                  <option value="all">All Tiers</option>
                  <option value={1}>🔥 High Priority</option>
                  <option value={2}>📊 Medium Priority</option>
                  <option value={3}>⚠️ Low Priority</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Max Price:</label>
                <select 
                  value={filters.maxPrice}
                  onChange={(e) => setFilters({...filters, maxPrice: parseFloat(e.target.value)})}
                >
                  <option value={1}>Under $1.00</option>
                  <option value={1.5}>Under $1.50</option>
                  <option value={2}>Under $2.00</option>
                  <option value={3}>Under $3.00</option>
                  <option value={5}>Under $5.00</option>
                  <option value={10}>Under $10.00</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Fire Level:</label>
                <select 
                  value={filters.fireLevel}
                  onChange={(e) => setFilters({...filters, fireLevel: e.target.value === 'all' ? 'all' : parseInt(e.target.value) as 1 | 3 | 5})}
                >
                  <option value="all">All Levels</option>
                  <option value={5}>🔥🔥🔥🔥🔥 Premium (Both 5%+ under $1)</option>
                  <option value={3}>🔥🔥🔥 Super (Both 5%+)</option>
                  <option value={1}>🔥 Standard (High Priority)</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Min BlackRock %:</label>
                <input 
                  type="number" 
                  step="0.1" 
                  placeholder="0"
                  value={filters.minBlackrock}
                  onChange={(e) => setFilters({...filters, minBlackrock: parseFloat(e.target.value) || 0})}
                />
              </div>
              
              <div className="filter-group">
                <label>Min Vanguard %:</label>
                <input 
                  type="number" 
                  step="0.1" 
                  placeholder="0"
                  value={filters.minVanguard}
                  onChange={(e) => setFilters({...filters, minVanguard: parseFloat(e.target.value) || 0})}
                />
              </div>
            </div>
            
            <div className="filter-buttons">
              <button className="filter-btn quick-high" onClick={quickFilterHighPriority}>
                🔥 High Priority (BR+VG 4%+, Under $2)
              </button>
              <button className="filter-btn premium" onClick={filterPremiumDeals}>
                🔥🔥🔥🔥🔥 Premium Deals Only
              </button>
              <button className="filter-btn reset" onClick={resetFilters}>
                Clear Filters
              </button>
            </div>
          </div>

          {/* Stock Tiers */}
          {results.stocks.length > 0 ? (
            <>
              {(() => {
                const filteredStocks = applyFilters(results.stocks);
                const filteredHigh = getTierData(filteredStocks, 1);
                const filteredMedium = getTierData(filteredStocks, 2);
                const filteredLow = getTierData(filteredStocks, 3);
                
                return (
                  <>
                    <div className="filtered-summary">
                      <span>Showing {filteredStocks.length} of {results.stocks.length} stocks</span>
                      {filteredStocks.length !== results.stocks.length && (
                        <span className="filter-active">🔍 Filters Active</span>
                      )}
                    </div>
                    
                    {renderTierSection(
                      "HIGH PRIORITY - Both BR+VG 4%+",
                      filteredHigh,
                      "tier-high",
                      "🔥"
                    )}
                    
                    {renderTierSection(
                      "MEDIUM PRIORITY - One 3%+",
                      filteredMedium,
                      "tier-medium", 
                      "📊"
                    )}
                    
                    {renderTierSection(
                      "LOW PRIORITY - Other",
                      filteredLow,
                      "tier-low",
                      "⚠️"
                    )}
                    
                    {filteredStocks.length === 0 && (
                      <div className="no-results">
                        🔍 No stocks match the current filters
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          ) : (
            <div className="no-results">
              {results.new_stocks_only 
                ? (
                  <div>
                    <h3>🎉 No new qualifying stocks found since last scan!</h3>
                    <p>Showing your previously discovered stocks below...</p>
                  </div>
                )
                : "❌ No stocks found matching criteria"
              }
            </div>
          )}

          <div className="last-scan">
            Last scan: {new Date(results.timestamp).toLocaleString()}
          </div>
        </>
      )}
    </div>
  );
};

export default StockDashboard;