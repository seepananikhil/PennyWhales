import React, { useState, useEffect } from 'react';
import api from './api';
import { Stock } from './types';
import { theme, getFireLevelStyle } from './theme';
import StockCard from './components/StockCard';
import TickerModal from './components/TickerModal';

const TickerManagement: React.FC = () => {
  const [tickers, setTickers] = useState<string[]>([]);
  const [stockData, setStockData] = useState<Map<string, Stock>>(new Map());
  const [livePriceData, setLivePriceData] = useState<Map<string, {
    price: number;
    priceChange: number;
    timestamp: string;
  }>>(new Map());
  const [holdings, setHoldings] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<{
    scanning: boolean;
    progress: { current: number; total: number; percentage: number } | null;
    message: string | null;
  }>({ scanning: false, progress: null, message: null });
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('combined-desc');

  useEffect(() => {
    loadData();
    
    // Set up auto-refresh for live prices every 5 minutes
    const priceRefreshInterval = setInterval(() => {
      if (tickers.length > 0) {
        loadLivePrices();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      clearInterval(priceRefreshInterval);
    };
  }, []);

  // Load live prices when tickers change
  useEffect(() => {
    if (tickers.length > 0) {
      loadLivePrices();
    }
  }, [tickers]);

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
      const holdingsData = await api.getHoldings();
      setHoldings(new Set(holdingsData.holdings?.map((holding: any) => holding.ticker) || []));
    } catch (err) {
      console.error('Error loading holdings:', err);
    }
  };

  const loadLivePrices = async () => {
    try {
      // Load live prices for all tickers with data
      const tickersWithData = tickers.filter(ticker => stockData.has(ticker));
      const pricePromises = tickersWithData.map(async (ticker) => {
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

      const results = await Promise.all(pricePromises);
      const newLivePriceData = new Map(livePriceData);
      
      results.forEach(result => {
        if (result) {
          newLivePriceData.set(result.ticker, result.data);
        }
      });
      
      setLivePriceData(newLivePriceData);
    } catch (err) {
      console.error('Error loading live prices:', err);
    }
  };

  const handleSaveTickers = async (newTickers: string[]) => {
    try {
      await api.updateTickers(newTickers);
      setTickers(newTickers);
      await loadStockData(); // Refresh stock data
    } catch (err) {
      setError('Failed to update tickers');
      console.error('Error updating tickers:', err);
    }
  };

  const handleAddNewTickers = async (newTickers: string[]) => {
    try {
      setScanProgress({ scanning: true, progress: null, message: 'Adding new tickers...' });
      
      const result = await api.addNewTickers(newTickers);
      
      if (result.success && result.added > 0) {
        setScanProgress({ 
          scanning: true, 
          progress: null, 
          message: `Added ${result.added} new tickers. Starting fire analysis...` 
        });
        
        // Update tickers list immediately
        await loadTickers();
        
        // Monitor scan progress
        monitorScanProgress();
        
      } else {
        setScanProgress({ scanning: false, progress: null, message: null });
        setError(result.message || 'No new tickers to add');
      }
    } catch (err) {
      setScanProgress({ scanning: false, progress: null, message: null });
      setError('Failed to add new tickers');
      console.error('Error adding new tickers:', err);
    }
  };

  const monitorScanProgress = async () => {
    const checkProgress = async () => {
      try {
        const status = await api.getScanStatus();
        
        if (status.scanning) {
          setScanProgress({
            scanning: true,
            progress: status.progress,
            message: status.progress 
              ? `Analyzing fire levels: ${status.progress.current}/${status.progress.total} (${status.progress.percentage}%)`
              : 'Analyzing fire levels for new tickers...'
          });
          
          // Continue monitoring
          setTimeout(checkProgress, 2000);
        } else {
          // Scan completed
          setScanProgress({ scanning: false, progress: null, message: null });
          
          // Refresh data
          await loadStockData();
          
          if (status.error) {
            setError(`Scan completed with error: ${status.error}`);
          }
        }
      } catch (err) {
        console.error('Error monitoring scan progress:', err);
        setScanProgress({ scanning: false, progress: null, message: null });
      }
    };
    
    checkProgress();
  };

  const handleToggleHolding = async (ticker: string) => {
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
        setHoldings(prev => new Set(prev).add(ticker));
      }
    } catch (err) {
      console.error('Error toggling holding:', err);
    }
  };

  const handleOpenChart = (ticker: string) => {
    window.open(`https://www.tradingview.com/chart/?symbol=${ticker}`, '_blank');
  };

  // Calculate stats
  const tickersWithData = tickers.filter(ticker => stockData.has(ticker));
  const tickersWithoutData = tickers.filter(ticker => !stockData.has(ticker));
  const fire3Tickers = tickersWithData.filter(ticker => stockData.get(ticker)?.fire_level === 3);
  const fire2Tickers = tickersWithData.filter(ticker => stockData.get(ticker)?.fire_level === 2);
  const fire1Tickers = tickersWithData.filter(ticker => stockData.get(ticker)?.fire_level === 1);
  const noFireTickers = tickersWithData.filter(ticker => stockData.get(ticker)?.fire_level === 0);
  const holdingTickers = tickers.filter(ticker => holdings.has(ticker));

  // Filter stocks based on active filter
  const getFilteredStocks = () => {
    let stocks;
    switch (activeFilter) {
      case 'fire3':
        stocks = fire3Tickers;
        break;
      case 'fire2':
        stocks = fire2Tickers;
        break;
      case 'fire1':
        stocks = fire1Tickers;
        break;
      case 'nofire':
        stocks = noFireTickers;
        break;
      case 'holdings':
        stocks = holdingTickers;
        break;
      default:
        stocks = tickersWithData;
    }
    
    // Sort stocks based on selected sort option
    return stocks.sort((a, b) => {
      const stockA = stockData.get(a);
      const stockB = stockData.get(b);
      
      if (!stockA || !stockB) return 0;
      
      switch (sortBy) {
        case 'combined-desc':
          // Sort by combined VG + BR percentage (highest first)
          const combinedA = stockA.vanguard_pct + stockA.blackrock_pct;
          const combinedB = stockB.vanguard_pct + stockB.blackrock_pct;
          return combinedB - combinedA;
        case 'combined-asc':
          // Sort by combined VG + BR percentage (lowest first)
          const combinedAsc = stockA.vanguard_pct + stockA.blackrock_pct;
          const combinedBsc = stockB.vanguard_pct + stockB.blackrock_pct;
          return combinedAsc - combinedBsc;
        case 'vg-desc':
          return stockB.vanguard_pct - stockA.vanguard_pct;
        case 'vg-asc':
          return stockA.vanguard_pct - stockB.vanguard_pct;
        case 'br-desc':
          return stockB.blackrock_pct - stockA.blackrock_pct;
        case 'br-asc':
          return stockA.blackrock_pct - stockB.blackrock_pct;
        case 'fire-desc':
          const fireA = stockA.fire_level || 0;
          const fireB = stockB.fire_level || 0;
          if (fireA !== fireB) return fireB - fireA;
          // If fire levels are equal, sort by combined VG+BR as secondary
          const fireComboA = stockA.vanguard_pct + stockA.blackrock_pct;
          const fireComboB = stockB.vanguard_pct + stockB.blackrock_pct;
          return fireComboB - fireComboA;
        case 'price-desc':
          return stockB.price - stockA.price;
        case 'price-asc':
          return stockA.price - stockB.price;
        case 'price-change-desc':
          // Sort by price change percentage (highest first)
          const priceChangeA = livePriceData.get(a)?.priceChange || 0;
          const priceChangeB = livePriceData.get(b)?.priceChange || 0;
          return priceChangeB - priceChangeA;
        case 'price-change-asc':
          // Sort by price change percentage (lowest first)
          const priceChangeAscA = livePriceData.get(a)?.priceChange || 0;
          const priceChangeAscB = livePriceData.get(b)?.priceChange || 0;
          return priceChangeAscA - priceChangeAscB;
        default:
          // Default to combined VG + BR (highest first)
          const defaultA = stockA.vanguard_pct + stockA.blackrock_pct;
          const defaultB = stockB.vanguard_pct + stockB.blackrock_pct;
          return defaultB - defaultA;
      }
    });
  };

  const filteredStocks = getFilteredStocks();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        fontSize: theme.typography.fontSize.lg,
        color: theme.ui.text.secondary,
        fontFamily: theme.typography.fontFamily
      }}>
        Loading ticker data...
      </div>
    );
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: theme.typography.fontFamily
    }}>
      {/* Header Section */}
      <div style={{
        padding: theme.spacing.lg,
        borderBottom: `1px solid ${theme.ui.border}`,
        backgroundColor: theme.ui.surface,
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing.md
        }}>
          <h1 style={{
            margin: 0,
            fontSize: theme.typography.fontSize.xxl,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.ui.text.primary
          }}>
            🎯 Ticker Management
          </h1>
          <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center' }}>
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
              <option value="combined-desc">🔥 VG + BR % (High to Low)</option>
              <option value="combined-asc">🔥 VG + BR % (Low to High)</option>
              <option value="vg-desc">🔄 VG % (High to Low)</option>
              <option value="vg-asc">🔄 VG % (Low to High)</option>
              <option value="br-desc">🔄 BR % (High to Low)</option>
              <option value="br-asc">🔄 BR % (Low to High)</option>
              <option value="fire-desc">🔥 Fire Level (High to Low)</option>
              <option value="price-desc">💰 Price (High to Low)</option>
              <option value="price-asc">💰 Price (Low to High)</option>
              <option value="price-change-desc">📈 Price Change % (High to Low)</option>
              <option value="price-change-asc">📉 Price Change % (Low to High)</option>
            </select>
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                border: 'none',
                borderRadius: theme.borderRadius.md,
                backgroundColor: theme.status.info,
                color: 'white',
                cursor: 'pointer',
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
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
              🎯 Manage Tickers
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.md
        }}>
          <div 
            onClick={() => setActiveFilter('all')}
            style={{
              textAlign: 'center',
              padding: theme.spacing.sm,
              backgroundColor: activeFilter === 'all' ? theme.status.info : theme.ui.background,
              borderRadius: theme.borderRadius.md,
              border: `2px solid ${activeFilter === 'all' ? theme.status.info : theme.ui.border}`,
              cursor: 'pointer',
              transition: `all ${theme.transition.normal}`,
              transform: activeFilter === 'all' ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: activeFilter === 'all' ? theme.ui.shadow.md : theme.ui.shadow.sm
            }}
            onMouseEnter={(e) => {
              if (activeFilter !== 'all') {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.md;
              }
            }}
            onMouseLeave={(e) => {
              if (activeFilter !== 'all') {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            <div style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.bold,
              color: activeFilter === 'all' ? 'white' : theme.ui.text.primary
            }}>
              {tickers.length}
            </div>
            <div style={{
              fontSize: theme.typography.fontSize.xs,
              color: activeFilter === 'all' ? 'rgba(255,255,255,0.8)' : theme.ui.text.secondary,
              fontWeight: theme.typography.fontWeight.medium
            }}>
              Total Tickers
            </div>
          </div>

          <div 
            onClick={() => setActiveFilter('fire3')}
            style={{
              textAlign: 'center',
              padding: theme.spacing.sm,
              backgroundColor: activeFilter === 'fire3' ? getFireLevelStyle(3).primary : getFireLevelStyle(3).background,
              borderRadius: theme.borderRadius.md,
              border: `2px solid ${activeFilter === 'fire3' ? getFireLevelStyle(3).primary : getFireLevelStyle(3).border}`,
              cursor: 'pointer',
              transition: `all ${theme.transition.normal}`,
              transform: activeFilter === 'fire3' ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: activeFilter === 'fire3' ? theme.ui.shadow.md : theme.ui.shadow.sm
            }}
            onMouseEnter={(e) => {
              if (activeFilter !== 'fire3') {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.md;
              }
            }}
            onMouseLeave={(e) => {
              if (activeFilter !== 'fire3') {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            <div style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.bold,
              color: activeFilter === 'fire3' ? 'white' : getFireLevelStyle(3).primary
            }}>
              {fire3Tickers.length}
            </div>
            <div style={{
              fontSize: theme.typography.fontSize.xs,
              color: activeFilter === 'fire3' ? 'rgba(255,255,255,0.8)' : theme.ui.text.secondary,
              fontWeight: theme.typography.fontWeight.medium
            }}>
              🔥🔥🔥
            </div>
          </div>

          <div 
            onClick={() => setActiveFilter('fire2')}
            style={{
              textAlign: 'center',
              padding: theme.spacing.sm,
              backgroundColor: activeFilter === 'fire2' ? getFireLevelStyle(2).primary : getFireLevelStyle(2).background,
              borderRadius: theme.borderRadius.md,
              border: `2px solid ${activeFilter === 'fire2' ? getFireLevelStyle(2).primary : getFireLevelStyle(2).border}`,
              cursor: 'pointer',
              transition: `all ${theme.transition.normal}`,
              transform: activeFilter === 'fire2' ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: activeFilter === 'fire2' ? theme.ui.shadow.md : theme.ui.shadow.sm
            }}
            onMouseEnter={(e) => {
              if (activeFilter !== 'fire2') {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.md;
              }
            }}
            onMouseLeave={(e) => {
              if (activeFilter !== 'fire2') {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            <div style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.bold,
              color: activeFilter === 'fire2' ? 'white' : getFireLevelStyle(2).primary
            }}>
              {fire2Tickers.length}
            </div>
            <div style={{
              fontSize: theme.typography.fontSize.xs,
              color: activeFilter === 'fire2' ? 'rgba(255,255,255,0.8)' : theme.ui.text.secondary,
              fontWeight: theme.typography.fontWeight.medium
            }}>
              🔥🔥
            </div>
          </div>

          <div 
            onClick={() => setActiveFilter('fire1')}
            style={{
              textAlign: 'center',
              padding: theme.spacing.sm,
              backgroundColor: activeFilter === 'fire1' ? getFireLevelStyle(1).primary : getFireLevelStyle(1).background,
              borderRadius: theme.borderRadius.md,
              border: `2px solid ${activeFilter === 'fire1' ? getFireLevelStyle(1).primary : getFireLevelStyle(1).border}`,
              cursor: 'pointer',
              transition: `all ${theme.transition.normal}`,
              transform: activeFilter === 'fire1' ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: activeFilter === 'fire1' ? theme.ui.shadow.md : theme.ui.shadow.sm
            }}
            onMouseEnter={(e) => {
              if (activeFilter !== 'fire1') {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.md;
              }
            }}
            onMouseLeave={(e) => {
              if (activeFilter !== 'fire1') {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            <div style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.bold,
              color: activeFilter === 'fire1' ? 'white' : getFireLevelStyle(1).primary
            }}>
              {fire1Tickers.length}
            </div>
            <div style={{
              fontSize: theme.typography.fontSize.xs,
              color: activeFilter === 'fire1' ? 'rgba(255,255,255,0.8)' : theme.ui.text.secondary,
              fontWeight: theme.typography.fontWeight.medium
            }}>
              🔥
            </div>
          </div>

          <div 
            onClick={() => setActiveFilter('nofire')}
            style={{
              textAlign: 'center',
              padding: theme.spacing.sm,
              backgroundColor: activeFilter === 'nofire' ? theme.ui.text.secondary : theme.ui.background,
              borderRadius: theme.borderRadius.md,
              border: `2px solid ${activeFilter === 'nofire' ? theme.ui.text.secondary : theme.ui.border}`,
              cursor: 'pointer',
              transition: `all ${theme.transition.normal}`,
              transform: activeFilter === 'nofire' ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: activeFilter === 'nofire' ? theme.ui.shadow.md : theme.ui.shadow.sm
            }}
            onMouseEnter={(e) => {
              if (activeFilter !== 'nofire') {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.md;
              }
            }}
            onMouseLeave={(e) => {
              if (activeFilter !== 'nofire') {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            <div style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.bold,
              color: activeFilter === 'nofire' ? 'white' : theme.ui.text.secondary
            }}>
              {noFireTickers.length}
            </div>
            <div style={{
              fontSize: theme.typography.fontSize.xs,
              color: activeFilter === 'nofire' ? 'rgba(255,255,255,0.8)' : theme.ui.text.secondary,
              fontWeight: theme.typography.fontWeight.medium
            }}>
              No Fire
            </div>
          </div>

          <div 
            onClick={() => setActiveFilter('holdings')}
            style={{
              textAlign: 'center',
              padding: theme.spacing.sm,
              backgroundColor: activeFilter === 'holdings' ? '#ffd700' : '#fff3cd',
              borderRadius: theme.borderRadius.md,
              border: `2px solid ${activeFilter === 'holdings' ? '#ffd700' : '#ffeaa7'}`,
              cursor: 'pointer',
              transition: `all ${theme.transition.normal}`,
              transform: activeFilter === 'holdings' ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: activeFilter === 'holdings' ? theme.ui.shadow.md : theme.ui.shadow.sm
            }}
            onMouseEnter={(e) => {
              if (activeFilter !== 'holdings') {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.md;
              }
            }}
            onMouseLeave={(e) => {
              if (activeFilter !== 'holdings') {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            <div style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.bold,
              color: activeFilter === 'holdings' ? 'white' : '#ffd700'
            }}>
              {holdingTickers.length}
            </div>
            <div style={{
              fontSize: theme.typography.fontSize.xs,
              color: activeFilter === 'holdings' ? 'rgba(255,255,255,0.8)' : theme.ui.text.secondary,
              fontWeight: theme.typography.fontWeight.medium
            }}>
              ⭐ Holdings
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div style={{
        flex: 1,
        padding: theme.spacing.lg,
        overflow: 'auto'
      }}>
        {error && (
          <div style={{
            padding: theme.spacing.md,
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: theme.borderRadius.md,
            marginBottom: theme.spacing.md,
            border: '1px solid #f5c6cb'
          }}>
            {error}
          </div>
        )}

        {scanProgress.scanning && (
          <div style={{
            padding: theme.spacing.lg,
            backgroundColor: '#d1ecf1',
            border: `1px solid #bee5eb`,
            borderRadius: theme.borderRadius.md,
            marginBottom: theme.spacing.md,
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '2rem',
              marginBottom: theme.spacing.sm,
              animation: 'spin 2s linear infinite'
            }}>
              🔄
            </div>
            <p style={{
              margin: 0,
              fontSize: theme.typography.fontSize.base,
              fontWeight: theme.typography.fontWeight.semibold,
              color: theme.ui.text.primary
            }}>
              {scanProgress.message || 'Processing...'}
            </p>
          </div>
        )}

        {tickersWithData.length > 0 ? (
          <>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: theme.spacing.md,
              height: 'fit-content'
            }}>
              {filteredStocks.map(ticker => {
                const stock = stockData.get(ticker)!;
                const livePrice = livePriceData.get(ticker);
                return (
                  <StockCard
                    key={ticker}
                    stock={stock}
                    livePrice={livePrice}
                    isHolding={holdings.has(ticker)}
                    onToggleHolding={handleToggleHolding}
                    onOpenChart={handleOpenChart}
                  />
                );
              })}
            </div>
          </>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: theme.spacing.xxl,
            color: theme.ui.text.secondary
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
              Click "Add/Update Tickers" to get started
            </p>
          </div>
        )}
      </div>

      {/* Modal */}
      <TickerModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveTickers}
        onAddNew={handleAddNewTickers}
        currentTickers={tickers}
      />

      {/* Add CSS for spinning animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default TickerManagement;
