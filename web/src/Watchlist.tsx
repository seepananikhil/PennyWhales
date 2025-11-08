import React, { useState, useEffect } from 'react';
import { theme, getFireLevelStyle } from './theme';
import api from './api';
import { Stock } from './types';
import ChartView from './components/ChartView';
import GridView from './components/GridView';

const Watchlist: React.FC = () => {
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string>('');
  const [activeWatchlist, setActiveWatchlist] = useState<any>(null);
  const [stockData, setStockData] = useState<Map<string, Stock>>(new Map());
  const [holdings, setHoldings] = useState<Set<string>>(new Set());
  const [watchlistStocks, setWatchlistStocks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [newWatchlistName, setNewWatchlistName] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTickerInput, setNewTickerInput] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPriceFilter, setSelectedPriceFilter] = useState<string | null>(null);
  const [showChartView, setShowChartView] = useState<boolean>(true);
  const [livePriceData, setLivePriceData] = useState<Map<string, { price: number; priceChange: number; timestamp: string }>>(new Map());

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeWatchlistId) {
      loadActiveWatchlist();
    }
  }, [activeWatchlistId]);

  const loadData = async () => {
    await Promise.all([loadWatchlists(), loadHoldings()]);
  };

  const loadWatchlists = async () => {
    try {
      setLoading(true);
      const data = await api.getWatchlists();
      console.log('Loaded watchlists:', data);
      setWatchlists(data.watchlists || []);
      
      // Update stock data map with stock data from all watchlists
      if (data.watchlists) {
        const newStockData = new Map(stockData);
        data.watchlists.forEach((watchlist: any) => {
          if (watchlist.stockData) {
            watchlist.stockData.forEach((stock: Stock) => {
              if (stock.ticker) {
                newStockData.set(stock.ticker, stock);
              }
            });
          }
        });
        setStockData(newStockData);
      }
      
      // Set first watchlist as active if none selected
      if (data.watchlists && data.watchlists.length > 0 && !activeWatchlistId) {
        const firstWatchlistId = data.watchlists[0].id || data.watchlists[0]._id;
        console.log('Setting active watchlist to:', firstWatchlistId);
        setActiveWatchlistId(firstWatchlistId);
      }
      
      setError(null);
    } catch (err) {
      setError('Failed to load watchlists');
      console.error('Error loading watchlists:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveWatchlist = async () => {
    try {
      if (!activeWatchlistId) return;
      
      console.log('Loading active watchlist:', activeWatchlistId);
      const watchlist = await api.getWatchlist(activeWatchlistId);
      console.log('Loaded watchlist data:', watchlist);
      setActiveWatchlist(watchlist);
      setWatchlistStocks(new Set(watchlist.stocks || []));
      
      // Update stock data map with the stock data from the watchlist
      if (watchlist.stockData && watchlist.stockData.length > 0) {
        const newStockData = new Map(stockData);
        watchlist.stockData.forEach((stock: Stock) => {
          if (stock.ticker) {
            newStockData.set(stock.ticker, stock);
          }
        });
        setStockData(newStockData);
        console.log('Updated stock data:', newStockData);
      }
    } catch (err) {
      console.error('Error loading active watchlist:', err);
    }
  };

  const loadHoldings = async () => {
    try {
      const holdingsData = await api.getHoldings();
      let holdingsArray = [];
      if (holdingsData.holdings) {
        if (Array.isArray(holdingsData.holdings)) {
          if (typeof holdingsData.holdings[0] === 'string') {
            holdingsArray = holdingsData.holdings;
          } else {
            holdingsArray = holdingsData.holdings.map((holding: any) => holding.ticker).filter(Boolean);
          }
        }
      }
      setHoldings(new Set(holdingsArray));
    } catch (err) {
      console.error('Error loading holdings:', err);
    }
  };

  const handleCreateWatchlist = async () => {
    try {
      if (!newWatchlistName.trim()) return;
      
      const result = await api.createWatchlist(newWatchlistName.trim());
      if (result.success) {
        await loadWatchlists();
        setActiveWatchlistId(result.watchlist.id || result.watchlist._id);
        setNewWatchlistName('');
        setShowCreateModal(false);
      }
    } catch (err) {
      setError('Failed to create watchlist');
      console.error('Error creating watchlist:', err);
    }
  };

  const handleAddStock = async () => {
    try {
      if (!newTickerInput.trim() || !activeWatchlistId) return;
      
      const ticker = newTickerInput.trim().toUpperCase();
      const result = await api.addToWatchlist(activeWatchlistId, [ticker]);
      
      if (result.success) {
        await loadActiveWatchlist();
        setNewTickerInput('');
      }
    } catch (err) {
      setError('Failed to add stock to watchlist');
      console.error('Error adding stock:', err);
    }
  };

  const handleRemoveStock = async (ticker: string) => {
    try {
      if (!activeWatchlistId) return;
      
      const result = await api.removeFromWatchlist(activeWatchlistId, [ticker]);
      if (result.success) {
        await loadActiveWatchlist();
      }
    } catch (err) {
      setError('Failed to remove stock from watchlist');
      console.error('Error removing stock:', err);
    }
  };

  const handleDeleteWatchlist = async (id: string) => {
    try {
      const result = await api.deleteWatchlist(id);
      if (result.success) {
        await loadWatchlists();
        if (activeWatchlistId === id) {
          const remaining = watchlists.filter(w => (w.id || w._id) !== id);
          setActiveWatchlistId(remaining.length > 0 ? (remaining[0].id || remaining[0]._id) : '');
        }
      }
    } catch (err) {
      setError('Failed to delete watchlist');
      console.error('Error deleting watchlist:', err);
    }
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

  const handleToggleWatchlist = async (ticker: string) => {
    try {
      if (!activeWatchlistId) return;

      const isInWatchlist = watchlistStocks.has(ticker);
      if (isInWatchlist) {
        await handleRemoveStock(ticker);
      } else {
        const result = await api.addToWatchlist(activeWatchlistId, [ticker]);
        if (result.success) {
          await loadActiveWatchlist();
        }
      }
    } catch (err) {
      console.error('Error toggling watchlist:', err);
    }
  };

  const handleOpenChart = (ticker: string) => {
    window.open(`https://www.tradingview.com/chart/?symbol=${ticker}`, '_blank');
  };

  const loadLivePriceForTicker = async (ticker: string) => {
    // Placeholder function - implement live price fetching if needed
    console.log('Live price requested for:', ticker);
  };

  const handleDeleteTicker = async (ticker: string) => {
    try {
      await api.removeTicker(ticker);
      // Refresh watchlist data
      await loadActiveWatchlist();
    } catch (err) {
      console.error('Error deleting ticker:', err);
    }
  };

  const getFilteredAndSortedStocks = (): Stock[] => {
    console.log('getFilteredAndSortedStocks - activeWatchlist:', activeWatchlist);
    if (!activeWatchlist?.stockData) return [];
    
    console.log('Raw stockData from watchlist:', activeWatchlist.stockData);
    
    // Filter out stocks without data (where all values are null)
    let stocksWithData = activeWatchlist.stockData.filter((stock: Stock) => 
      stock.price !== null && stock.ticker
    );

    // Apply fire level filter
    switch (activeFilter) {
      case 'fire5':
        stocksWithData = stocksWithData.filter((stock: Stock) => stock.fire_level === 5);
        break;
      case 'fire4':
        stocksWithData = stocksWithData.filter((stock: Stock) => stock.fire_level === 4);
        break;
      case 'fire3':
        stocksWithData = stocksWithData.filter((stock: Stock) => stock.fire_level === 3);
        break;
      case 'fire2':
        stocksWithData = stocksWithData.filter((stock: Stock) => stock.fire_level === 2);
        break;
      case 'fire1':
        stocksWithData = stocksWithData.filter((stock: Stock) => stock.fire_level === 1);
        break;
      case 'anyfire':
        stocksWithData = stocksWithData.filter((stock: Stock) => (stock.fire_level || 0) > 0);
        break;
      case 'holdings':
        stocksWithData = stocksWithData.filter((stock: Stock) => holdings.has(stock.ticker));
        break;
      default:
        // 'all' - no additional filtering
        break;
    }

    // Apply price filter if selected
    if (selectedPriceFilter) {
      stocksWithData = stocksWithData.filter((stock: Stock) => {
        switch (selectedPriceFilter) {
          case 'under1':
            return stock.price < 1.0;
          case '1to2':
            return stock.price >= 1.0 && stock.price <= 2.0;
          case 'over2':
            return stock.price > 2.0;
          default:
            return true;
        }
      });
    }

    // Filter by search query if provided
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      stocksWithData = stocksWithData.filter((stock: Stock) => 
        stock.ticker.toLowerCase().includes(query)
      );
    }

    console.log('Stocks with valid data after filtering:', stocksWithData);

    // Simple sort by fire level descending, then by combined holdings
    return stocksWithData.sort((a: Stock, b: Stock) => {
      const fireA = a.fire_level || 0;
      const fireB = b.fire_level || 0;
      if (fireA !== fireB) return fireB - fireA;
      const comboA = (a.vanguard_pct || 0) + (a.blackrock_pct || 0);
      const comboB = (b.vanguard_pct || 0) + (b.blackrock_pct || 0);
      return comboB - comboA;
    });
  };

  const filteredStocks = getFilteredAndSortedStocks();

  // Calculate stats for active watchlist - use raw data, not filtered data
  const totalStocks = activeWatchlist?.stocks?.length || 0;
  const stocksWithData = activeWatchlist?.stockData?.filter((stock: Stock) => 
    stock.price !== null && stock.ticker
  ).length || 0;
  const fireStocks = activeWatchlist?.stockData?.filter((stock: Stock) => 
    stock.price !== null && stock.ticker && (stock.fire_level || 0) > 0
  ) || [];
  const fire5Stocks = activeWatchlist?.stockData?.filter((stock: Stock) => 
    stock.price !== null && stock.ticker && stock.fire_level === 5
  ) || [];
  const fire4Stocks = activeWatchlist?.stockData?.filter((stock: Stock) => 
    stock.price !== null && stock.ticker && stock.fire_level === 4
  ) || [];
  const fire3Stocks = activeWatchlist?.stockData?.filter((stock: Stock) => 
    stock.price !== null && stock.ticker && stock.fire_level === 3
  ) || [];
  const fire2Stocks = activeWatchlist?.stockData?.filter((stock: Stock) => 
    stock.price !== null && stock.ticker && stock.fire_level === 2
  ) || [];
  const fire1Stocks = activeWatchlist?.stockData?.filter((stock: Stock) => 
    stock.price !== null && stock.ticker && stock.fire_level === 1
  ) || [];
  const holdingStocks = activeWatchlist?.stockData?.filter((stock: Stock) => 
    stock.price !== null && stock.ticker && holdings.has(stock.ticker)
  ) || [];

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
        Loading watchlists...
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
            👀 Watchlist
          </h1>
          <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center' }}>
            {/* View Toggle Button */}
            <button
              onClick={() => setShowChartView(!showChartView)}
              style={{
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                border: `1px solid ${theme.ui.border}`,
                borderRadius: theme.borderRadius.md,
                backgroundColor: theme.ui.surface,
                color: theme.ui.text.primary,
                cursor: 'pointer',
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                transition: `all ${theme.transition.normal}`,
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.xs
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.ui.background;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.ui.surface;
              }}
            >
              {showChartView ? '📊 Grid View' : '📈 Chart View'}
            </button>
            {/* Search Input */}
            <input
              type="text"
              placeholder="🔍 Search stocks..."
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
          </div>
        </div>

        {/* Stats */}
        {activeWatchlist && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: theme.spacing.md
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
            >
              <div style={{
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.bold,
                color: activeFilter === 'all' ? 'white' : theme.ui.text.primary
              }}>
                {totalStocks}
              </div>
              <div style={{
                fontSize: theme.typography.fontSize.xs,
                color: activeFilter === 'all' ? 'rgba(255,255,255,0.8)' : theme.ui.text.secondary,
                fontWeight: theme.typography.fontWeight.medium
              }}>
                Total Stocks
              </div>
            </div>

            <div 
              onClick={() => {
                if (activeFilter === 'anyfire') {
                  setActiveFilter('all');
                } else {
                  setActiveFilter('anyfire');
                }
              }}
              style={{
                textAlign: 'center',
                padding: theme.spacing.sm,
                backgroundColor: activeFilter === 'anyfire' ? '#ff6b35' : '#fff0e6',
                borderRadius: theme.borderRadius.md,
                border: `2px solid ${activeFilter === 'anyfire' ? '#ff6b35' : '#ffb380'}`,
                cursor: 'pointer',
                transition: `all ${theme.transition.normal}`,
                transform: activeFilter === 'anyfire' ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: activeFilter === 'anyfire' ? theme.ui.shadow.md : theme.ui.shadow.sm
              }}
            >
              <div style={{
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.bold,
                color: activeFilter === 'anyfire' ? 'white' : '#ff6b35'
              }}>
                {fireStocks.length}
              </div>
              <div style={{
                fontSize: theme.typography.fontSize.xs,
                color: activeFilter === 'anyfire' ? 'rgba(255,255,255,0.8)' : theme.ui.text.secondary,
                fontWeight: theme.typography.fontWeight.medium
              }}>
                🔥 Fire Stocks
              </div>
            </div>

            {[
              { level: 5, stocks: fire5Stocks },
              { level: 4, stocks: fire4Stocks },
              { level: 3, stocks: fire3Stocks },
              { level: 2, stocks: fire2Stocks },
              { level: 1, stocks: fire1Stocks }
            ].map(({ level, stocks }) => (
                <div 
                  key={`fire${level}`}
                  onClick={() => {
                    if (activeFilter === `fire${level}`) {
                      setActiveFilter('all');
                    } else {
                      setActiveFilter(`fire${level}`);
                    }
                  }}
                  style={{
                    textAlign: 'center',
                    padding: theme.spacing.sm,
                    backgroundColor: activeFilter === `fire${level}` ? getFireLevelStyle(level).primary : getFireLevelStyle(level).background,
                    borderRadius: theme.borderRadius.md,
                    border: `2px solid ${activeFilter === `fire${level}` ? getFireLevelStyle(level).primary : getFireLevelStyle(level).border}`,
                    cursor: 'pointer',
                    transition: `all ${theme.transition.normal}`,
                    transform: activeFilter === `fire${level}` ? 'translateY(-2px)' : 'translateY(0)',
                    boxShadow: activeFilter === `fire${level}` ? theme.ui.shadow.md : theme.ui.shadow.sm
                  }}
                >
                  <div style={{
                    fontSize: theme.typography.fontSize.lg,
                    fontWeight: theme.typography.fontWeight.bold,
                    color: activeFilter === `fire${level}` ? 'white' : getFireLevelStyle(level).primary
                  }}>
                    {stocks.length}
                  </div>
                  <div style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: activeFilter === `fire${level}` ? 'rgba(255,255,255,0.8)' : theme.ui.text.secondary,
                    fontWeight: theme.typography.fontWeight.medium
                  }}>
                    {'🔥'.repeat(level)}
                  </div>
                </div>
              ))}

            <div 
              onClick={() => {
                if (activeFilter === 'holdings') {
                  setActiveFilter('all');
                } else {
                  setActiveFilter('holdings');
                }
              }}
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
            >
              <div style={{
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.bold,
                color: activeFilter === 'holdings' ? 'white' : '#ffd700'
              }}>
                {holdingStocks.length}
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
        )}

        {/* Price Filter Row */}
        {activeWatchlist && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: theme.spacing.md,
            marginTop: theme.spacing.md
          }}>
            <button
              onClick={() => {
                if (selectedPriceFilter === 'under1') {
                  setSelectedPriceFilter(null);
                } else {
                  setSelectedPriceFilter('under1');
                }
              }}
              style={{
                padding: theme.spacing.md,
                backgroundColor: selectedPriceFilter === 'under1' ? '#28a745' : theme.ui.surface,
                color: selectedPriceFilter === 'under1' ? 'white' : '#28a745',
                border: `2px solid #28a745`,
                borderRadius: theme.borderRadius.md,
                textAlign: 'center',
                boxShadow: selectedPriceFilter === 'under1' ? '0 4px 8px rgba(40, 167, 69, 0.3)' : theme.ui.shadow.sm,
                cursor: 'pointer',
                transition: `all ${theme.transition.normal}`,
                transform: selectedPriceFilter === 'under1' ? 'translateY(-1px)' : 'none',
                fontFamily: theme.typography.fontFamily,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold
              }}
            >
              💰 Under $1
            </button>

            <button
              onClick={() => {
                if (selectedPriceFilter === '1to2') {
                  setSelectedPriceFilter(null);
                } else {
                  setSelectedPriceFilter('1to2');
                }
              }}
              style={{
                padding: theme.spacing.md,
                backgroundColor: selectedPriceFilter === '1to2' ? '#fd7e14' : theme.ui.surface,
                color: selectedPriceFilter === '1to2' ? 'white' : '#fd7e14',
                border: `2px solid #fd7e14`,
                borderRadius: theme.borderRadius.md,
                textAlign: 'center',
                boxShadow: selectedPriceFilter === '1to2' ? '0 4px 8px rgba(253, 126, 20, 0.3)' : theme.ui.shadow.sm,
                cursor: 'pointer',
                transition: `all ${theme.transition.normal}`,
                transform: selectedPriceFilter === '1to2' ? 'translateY(-1px)' : 'none',
                fontFamily: theme.typography.fontFamily,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold
              }}
            >
              💎 $1 - $2
            </button>

            <button
              onClick={() => {
                if (selectedPriceFilter === 'over2') {
                  setSelectedPriceFilter(null);
                } else {
                  setSelectedPriceFilter('over2');
                }
              }}
              style={{
                padding: theme.spacing.md,
                backgroundColor: selectedPriceFilter === 'over2' ? '#6f42c1' : theme.ui.surface,
                color: selectedPriceFilter === 'over2' ? 'white' : '#6f42c1',
                border: `2px solid #6f42c1`,
                borderRadius: theme.borderRadius.md,
                textAlign: 'center',
                boxShadow: selectedPriceFilter === 'over2' ? '0 4px 8px rgba(111, 66, 193, 0.3)' : theme.ui.shadow.sm,
                cursor: 'pointer',
                transition: `all ${theme.transition.normal}`,
                transform: selectedPriceFilter === 'over2' ? 'translateY(-1px)' : 'none',
                fontFamily: theme.typography.fontFamily,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold
              }}
            >
              🏆 Over $2
            </button>
          </div>
        )}
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

        {watchlists.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: theme.spacing.xxl,
            color: theme.ui.text.secondary
          }}>
            <h2 style={{ 
              fontSize: theme.typography.fontSize.xl, 
              marginBottom: theme.spacing.md,
              color: theme.ui.text.primary
            }}>
              No Watchlists Yet
            </h2>
            <p style={{ 
              fontSize: theme.typography.fontSize.base,
              marginBottom: theme.spacing.lg
            }}>
              Create your first watchlist to start tracking stocks
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: `${theme.spacing.md} ${theme.spacing.xl}`,
                border: 'none',
                borderRadius: theme.borderRadius.md,
                backgroundColor: theme.status.info,
                color: 'white',
                cursor: 'pointer',
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.semibold
              }}
            >
              ➕ Create Watchlist
            </button>
          </div>
        ) : !activeWatchlist ? (
          <div style={{
            textAlign: 'center',
            padding: theme.spacing.xxl,
            color: theme.ui.text.secondary
          }}>
            Select a watchlist to view stocks
          </div>
        ) : filteredStocks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: theme.spacing.xxl,
            color: theme.ui.text.secondary
          }}>
            <h3 style={{ 
              fontSize: theme.typography.fontSize.lg, 
              marginBottom: theme.spacing.md,
              color: theme.ui.text.primary
            }}>
              {totalStocks === 0 ? 'Empty Watchlist' : searchQuery.trim() || activeFilter !== 'all' || selectedPriceFilter ? 'No matches found' : 'No Stock Data'}
            </h3>
            <p style={{ fontSize: theme.typography.fontSize.base }}>
              {totalStocks === 0 
                ? 'Add some stocks to get started'
                : searchQuery.trim() || activeFilter !== 'all' || selectedPriceFilter
                ? 'Try adjusting your filters or search query'
                : 'The stocks in this watchlist don\'t have scan data yet'
              }
            </p>
          </div>
        ) : (
          <>
            {showChartView ? (
              <ChartView
                stocks={filteredStocks.map(s => s.ticker)}
                stockData={stockData}
                livePriceData={livePriceData}
                holdings={holdings}
                watchlistStocks={watchlistStocks}
                onToggleHolding={handleToggleHolding}
                onToggleWatchlist={handleToggleWatchlist}
                onDeleteTicker={handleDeleteTicker}
                onLoadLivePrice={loadLivePriceForTicker}
                showWatchButton={true}
                showDeleteButton={false}
                tradingViewChartUrl="https://www.tradingview.com/chart/StTMbjgz/?symbol="
              />
            ) : (
              <GridView
                stocks={filteredStocks.map(s => s.ticker)}
                stockData={stockData}
                livePriceData={livePriceData}
                holdings={holdings}
                watchlistStocks={watchlistStocks}
                onToggleHolding={handleToggleHolding}
                onToggleWatchlist={handleToggleWatchlist}
                onOpenChart={handleOpenChart}
                onDeleteTicker={handleDeleteTicker}
                onLoadLivePrice={loadLivePriceForTicker}
                showWatchButton={true}
                showDeleteButton={false}
                activeFilter={activeFilter}
              />
            )}
          </>
        )}
      </div>

      {/* Create Watchlist Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: theme.ui.surface,
            padding: theme.spacing.xl,
            borderRadius: theme.borderRadius.lg,
            boxShadow: theme.ui.shadow.xl,
            maxWidth: '400px',
            width: '90%'
          }}>
            <h2 style={{
              margin: `0 0 ${theme.spacing.lg} 0`,
              fontSize: theme.typography.fontSize.xl,
              color: theme.ui.text.primary
            }}>
              Create New Watchlist
            </h2>
            <input
              type="text"
              placeholder="Watchlist name"
              value={newWatchlistName}
              onChange={(e) => setNewWatchlistName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateWatchlist()}
              style={{
                width: '100%',
                padding: theme.spacing.md,
                border: `1px solid ${theme.ui.border}`,
                borderRadius: theme.borderRadius.md,
                backgroundColor: theme.ui.surface,
                color: theme.ui.text.primary,
                fontSize: theme.typography.fontSize.base,
                fontFamily: theme.typography.fontFamily,
                marginBottom: theme.spacing.lg
              }}
              autoFocus
            />
            <div style={{
              display: 'flex',
              gap: theme.spacing.md,
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewWatchlistName('');
                }}
                style={{
                  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                  border: `1px solid ${theme.ui.border}`,
                  borderRadius: theme.borderRadius.md,
                  backgroundColor: theme.ui.surface,
                  color: theme.ui.text.primary,
                  cursor: 'pointer',
                  fontSize: theme.typography.fontSize.sm
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWatchlist}
                disabled={!newWatchlistName.trim()}
                style={{
                  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                  border: 'none',
                  borderRadius: theme.borderRadius.md,
                  backgroundColor: newWatchlistName.trim() ? theme.status.info : theme.ui.border,
                  color: 'white',
                  cursor: newWatchlistName.trim() ? 'pointer' : 'not-allowed',
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.semibold
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Watchlist;