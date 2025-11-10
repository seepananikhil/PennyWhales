import React, { useState, useEffect } from 'react';
import api from './api';
import { Stock } from './types';
import { theme, getFireLevelStyle } from './theme';
import TickerModal from './components/TickerModal';
import ChartView from './components/ChartView';
import GridView from './components/GridView';

const Dashboard: React.FC = () => {
  const [tickers, setTickers] = useState<string[]>([]);
  const [stockData, setStockData] = useState<Map<string, Stock>>(new Map());
  const [livePriceData, setLivePriceData] = useState<Map<string, {
    price: number;
    priceChange: number;
    timestamp: string;
  }>>(new Map());
  const [holdings, setHoldings] = useState<Set<string>>(new Set());
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string>('');
  const [watchlistStocks, setWatchlistStocks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<{
    scanning: boolean;
    progress: { current: number; total: number; percentage: number } | null;
    message: string | null;
  }>({ scanning: false, progress: null, message: null });
  const [activeFilter, setActiveFilter] = useState<string>('anyfire');
  const [multiFilters, setMultiFilters] = useState<{
    fireLevels: Set<number>;
    priceFilters: Set<string>;
    marketValueFilters: Set<string>;
  }>({
    fireLevels: new Set(),
    priceFilters: new Set(),
    marketValueFilters: new Set()
  });
  const [sortBy, setSortBy] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [topGainers, setTopGainers] = useState<string[]>([]);
  const [topLosers, setTopLosers] = useState<string[]>([]);
  const [showChartView, setShowChartView] = useState<boolean>(true);
  const [performanceTimeframe, setPerformanceTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [performanceType, setPerformanceType] = useState<'gainers' | 'losers'>('gainers');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeWatchlistId) {
      loadActiveWatchlist();
    }
  }, [activeWatchlistId]);

  const loadData = async () => {
    await Promise.all([loadTickers(), loadStockData(), loadHoldings(), loadWatchlists(), loadTopMovers()]);
  };

  const loadTopMovers = async () => {
    try {
      const { gainers, losers } = await api.getTopMovers(20);
      setTopGainers(gainers.map(g => g.ticker));
      setTopLosers(losers.map(l => l.ticker));
    } catch (err) {
      console.error('Error loading top movers:', err);
    }
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
    } catch (err) {
      console.error('Error loading holdings:', err);
    }
  };

  const loadWatchlists = async () => {
    try {
      const data = await api.getWatchlists();
      console.log('Loaded watchlists:', data.watchlists);
      setWatchlists(data.watchlists || []);
      
      // Set first watchlist as active if none selected
      if (data.watchlists && data.watchlists.length > 0 && !activeWatchlistId) {
        console.log('Setting active watchlist to:', data.watchlists[0].id);
        const watchlistId = data.watchlists[0].id;
        setActiveWatchlistId(watchlistId);
        loadActiveWatchlist(watchlistId);
      }
    } catch (err) {
      console.error('Error loading watchlists:', err);
    }
  };

  const loadActiveWatchlist = async (watchlistId?: string) => {
    try {
      const id = watchlistId || activeWatchlistId;
      if (!id) return;
      
      console.log('Loading active watchlist:', id);
      const watchlist = await api.getWatchlist(id);
      console.log('Loaded watchlist:', watchlist);
      setWatchlistStocks(new Set(watchlist.stocks || []));
    } catch (err) {
      console.error('Error loading active watchlist:', err);
    }
  };

  const loadLivePriceForTicker = async (ticker: string) => {
    try {
      const livePrice = await api.getLivePrice(ticker);
      setLivePriceData(prev => {
        const newData = new Map(prev);
        newData.set(ticker, {
          price: livePrice.price,
          priceChange: livePrice.priceChange,
          timestamp: livePrice.timestamp
        });
        return newData;
      });
    } catch (err) {
      console.error(`Error loading live price for ${ticker}:`, err);
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

  const handleDeleteTicker = async (ticker: string) => {
    try {
      await api.removeTicker(ticker);
      // Remove from local state
      setStockData(prev => {
        const newMap = new Map(prev);
        newMap.delete(ticker);
        return newMap;
      });
      // Remove from tickers list
      setTickers(prev => prev.filter(t => t !== ticker));
      // Also remove from holdings and watchlist if present
      setHoldings(prev => {
        const newSet = new Set(prev);
        newSet.delete(ticker);
        return newSet;
      });
      setWatchlistStocks(prev => {
        const newSet = new Set(prev);
        newSet.delete(ticker);
        return newSet;
      });
    } catch (err) {
      console.error('Error deleting ticker:', err);
    }
  };

  const handleToggleWatchlist = async (ticker: string) => {
    try {
      if (!activeWatchlistId) {
        console.warn('No active watchlist selected');
        return;
      }

      const isInWatchlist = watchlistStocks.has(ticker);
      if (isInWatchlist) {
        const result = await api.removeFromWatchlist(activeWatchlistId, [ticker]);
        if (result.success) {
          setWatchlistStocks(prev => {
            const newSet = new Set(prev);
            newSet.delete(ticker);
            return newSet;
          });
        }
      } else {
        const result = await api.addToWatchlist(activeWatchlistId, [ticker]);
        if (result.success) {
          setWatchlistStocks(prev => new Set(prev).add(ticker));
        }
      }
    } catch (err) {
      console.error('Error toggling watchlist:', err);
    }
  };

  const handleOpenChart = (ticker: string) => {
    window.open(`https://www.tradingview.com/chart/?symbol=${ticker}`, '_blank');
  };

  // Single unified filter toggle function
  const toggleFilter = (type: 'fire' | 'price' | 'marketValue', value: number | string) => {
    setMultiFilters(prev => {
      const newFilters = { ...prev };
      
      if (type === 'fire') {
        const newFireLevels = new Set(prev.fireLevels);
        if (newFireLevels.has(value as number)) {
          newFireLevels.delete(value as number);
        } else {
          newFireLevels.add(value as number);
        }
        newFilters.fireLevels = newFireLevels;
      } else if (type === 'price') {
        const newPriceFilters = new Set(prev.priceFilters);
        if (newPriceFilters.has(value as string)) {
          newPriceFilters.delete(value as string);
        } else {
          newPriceFilters.add(value as string);
        }
        newFilters.priceFilters = newPriceFilters;
      } else if (type === 'marketValue') {
        const newMarketValueFilters = new Set(prev.marketValueFilters);
        if (newMarketValueFilters.has(value as string)) {
          newMarketValueFilters.delete(value as string);
        } else {
          newMarketValueFilters.add(value as string);
        }
        newFilters.marketValueFilters = newMarketValueFilters;
      }
      
      return newFilters;
    });
    
    // Auto-set activeFilter based on whether we have any filters
    // Check the updated state by calculating hasFilters separately
    setActiveFilter(prev => {
      // Preserve 'performance' filter - don't override it
      if (prev === 'performance') {
        return 'performance';
      }
      
      // If currently on gainers/losers, switch to multifilter when toggling
      const newFiltersSize = (type === 'fire' ? (multiFilters.fireLevels.has(value as number) ? multiFilters.fireLevels.size - 1 : multiFilters.fireLevels.size + 1) : multiFilters.fireLevels.size) +
                             (type === 'price' ? (multiFilters.priceFilters.has(value as string) ? multiFilters.priceFilters.size - 1 : multiFilters.priceFilters.size + 1) : multiFilters.priceFilters.size) +
                             (type === 'marketValue' ? (multiFilters.marketValueFilters.has(value as string) ? multiFilters.marketValueFilters.size - 1 : multiFilters.marketValueFilters.size + 1) : multiFilters.marketValueFilters.size);
      
      return newFiltersSize > 0 ? 'multifilter' : 'all';
    });
  };

  const clearAllFilters = () => {
    setMultiFilters({
      fireLevels: new Set(),
      priceFilters: new Set(),
      marketValueFilters: new Set()
    });
  };

  // Calculate stats
  const tickersWithData = tickers.filter(ticker => stockData.has(ticker));
  const fire5Tickers = tickersWithData.filter(ticker => stockData.get(ticker)?.fire_level === 5);
  const fire4Tickers = tickersWithData.filter(ticker => stockData.get(ticker)?.fire_level === 4);
  const fire3Tickers = tickersWithData.filter(ticker => stockData.get(ticker)?.fire_level === 3);
  const fire2Tickers = tickersWithData.filter(ticker => stockData.get(ticker)?.fire_level === 2);
  const fire1Tickers = tickersWithData.filter(ticker => stockData.get(ticker)?.fire_level === 1);
  const anyFireTickers = tickersWithData.filter(ticker => (stockData.get(ticker)?.fire_level || 0) > 0);
  const holdingTickers = tickers.filter(ticker => holdings.has(ticker));

  // Filter stocks based on active filter and search query
  const getFilteredStocks = () => {
    let stocks;
    switch (activeFilter) {
      case 'fire5':
        stocks = fire5Tickers;
        break;
      case 'fire4':
        stocks = fire4Tickers;
        break;
      case 'fire3':
        stocks = fire3Tickers;
        break;
      case 'fire2':
        stocks = fire2Tickers;
        break;
      case 'fire1':
        stocks = fire1Tickers;
        break;
      case 'anyfire':
        stocks = anyFireTickers;
        break;
      case 'multifire':
      case 'multifilter':
        // Multi-select filtering
        stocks = tickersWithData;
        
        // Apply fire level filters
        if (multiFilters.fireLevels.size > 0) {
          stocks = stocks.filter(ticker => {
            const fireLevel = stockData.get(ticker)?.fire_level || 0;
            return multiFilters.fireLevels.has(fireLevel);
          });
        }
        break;
      case 'holdings':
        stocks = holdingTickers;
        break;
      case 'gainers':
        // Filter based on selected timeframe performance
        if (performanceTimeframe === 'daily') {
          // Daily - use topGainers from API
          stocks = topGainers.filter(ticker => tickersWithData.includes(ticker));
        } else {
          // Weekly or Monthly - filter by performance data
          stocks = tickersWithData.filter(ticker => {
            const stock = stockData.get(ticker);
            if (!stock?.performance) return false;
            
            if (performanceTimeframe === 'weekly') {
              return (stock.performance.week || 0) > 0;
            } else {
              return (stock.performance.month || 0) > 0;
            }
          }).sort((a, b) => {
            const stockA = stockData.get(a);
            const stockB = stockData.get(b);
            if (!stockA?.performance || !stockB?.performance) return 0;
            
            if (performanceTimeframe === 'weekly') {
              return (stockB.performance.week || 0) - (stockA.performance.week || 0);
            } else {
              return (stockB.performance.month || 0) - (stockA.performance.month || 0);
            }
          });
        }
        break;
      case 'losers':
        // Filter based on selected timeframe performance
        if (performanceTimeframe === 'daily') {
          // Daily - use topLosers from API
          stocks = topLosers.filter(ticker => tickersWithData.includes(ticker));
        } else {
          // Weekly or Monthly - filter by performance data
          stocks = tickersWithData.filter(ticker => {
            const stock = stockData.get(ticker);
            if (!stock?.performance) return false;
            
            if (performanceTimeframe === 'weekly') {
              return (stock.performance.week || 0) < 0;
            } else {
              return (stock.performance.month || 0) < 0;
            }
          }).sort((a, b) => {
            const stockA = stockData.get(a);
            const stockB = stockData.get(b);
            if (!stockA?.performance || !stockB?.performance) return 0;
            
            if (performanceTimeframe === 'weekly') {
              return (stockA.performance.week || 0) - (stockB.performance.week || 0);
            } else {
              return (stockA.performance.month || 0) - (stockB.performance.month || 0);
            }
          });
        }
        break;
      case 'performance':
        // Start with all stocks that have data
        stocks = tickersWithData;
        break;
      default:
        stocks = tickersWithData;
    }
    
    // Apply price filter if selected
    if (multiFilters.priceFilters.size > 0) {
      stocks = stocks.filter(ticker => {
        const stock = stockData.get(ticker);
        if (!stock) return false;
        
        return Array.from(multiFilters.priceFilters).some(priceFilter => {
          switch (priceFilter) {
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
      });
    }
    
    // Apply market value filter if selected
    if (multiFilters.marketValueFilters.size > 0) {
      stocks = stocks.filter(ticker => {
        const stock = stockData.get(ticker);
        if (!stock) return false;
        
       
        const marketCap = stock.market_cap || 0;
        
        return Array.from(multiFilters.marketValueFilters).some(marketValueFilter => {
          switch (marketValueFilter) {
            case 'under10':
              return marketCap < 10;
            case '10to50':
              return marketCap >= 10 && marketCap  < 50;
            case '50to100':
              return marketCap >= 50 && marketCap < 100;
            case 'over100':
              return marketCap >= 100;
            default:
              return true;
          }
        });
      });
    }

    // Apply performance sorting/filtering if active
    if (activeFilter === 'performance') {
      if (performanceTimeframe === 'daily') {
        // Daily - filter to only stocks in topGainers/topLosers
        const topList = performanceType === 'gainers' ? topGainers : topLosers;
        stocks = stocks.filter(ticker => topList.includes(ticker));
        // Sort by position in top list
        stocks.sort((a, b) => topList.indexOf(a) - topList.indexOf(b));
      } else {
        // Weekly or Monthly - filter by performance data
        stocks = stocks.filter(ticker => {
          const stock = stockData.get(ticker);
          if (!stock?.performance) return false;
          
          const perfValue = performanceTimeframe === 'weekly' 
            ? (stock.performance.week || 0)
            : (stock.performance.month || 0);
          
          return performanceType === 'gainers' ? perfValue > 0 : perfValue < 0;
        }).sort((a, b) => {
          const stockA = stockData.get(a);
          const stockB = stockData.get(b);
          if (!stockA?.performance || !stockB?.performance) return 0;
          
          const perfA = performanceTimeframe === 'weekly' 
            ? (stockA.performance.week || 0)
            : (stockA.performance.month || 0);
          const perfB = performanceTimeframe === 'weekly'
            ? (stockB.performance.week || 0)
            : (stockB.performance.month || 0);
          
          return performanceType === 'gainers' 
            ? perfB - perfA  // Highest to lowest for gainers
            : perfA - perfB; // Lowest to highest for losers
        });
      }
    }
    
    // Filter by search query if provided
    if (searchQuery.trim()) {
      // Split by comma, space, or newline to support multiple tickers
      // Also remove quotes and other special characters
      const queries = searchQuery
        .split(/[,\s\n]+/)
        .map(q => q.trim().replace(/['"]/g, '').toLowerCase())
        .filter(q => q.length > 0);
      
      if (queries.length > 0) {
        stocks = stocks.filter(ticker => 
          queries.some(query => ticker.toLowerCase().includes(query))
        );
      }
    }
    
    // Sort stocks based on selected sort option
    return stocks.sort((a, b) => {
      // If no sort selected, maintain original order
      if (!sortBy) return 0;
      
      const stockA = stockData.get(a);
      const stockB = stockData.get(b);
      
      // For holdings filter, some tickers might not have stock data
      if (activeFilter === 'holdings') {
        if (!stockA && !stockB) return a.localeCompare(b); // Sort alphabetically if neither has data
        if (!stockA) return 1; // Put tickers without data at the end
        if (!stockB) return -1; // Put tickers without data at the end
      }
      
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
        case 'market-value-desc':
          // Sort by market cap (highest first)
          const marketCapA = stockA.market_cap || 0;
          const marketCapB = stockB.market_cap || 0;
          return marketCapB - marketCapA;
        case 'market-value-asc':
          // Sort by market cap (lowest first)
          const marketCapAscA = stockA.market_cap || 0;
          const marketCapAscB = stockB.market_cap || 0;
          return marketCapAscA - marketCapAscB;
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
            color: theme.ui.text.primary,
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.md
          }}>
            🎯 Dashboard
            <span style={{
              fontSize: theme.typography.fontSize.base,
              backgroundColor: theme.status.success,
              color: 'white',
              padding: `${theme.spacing.xs} ${theme.spacing.md}`,
              borderRadius: theme.borderRadius.md,
              fontWeight: theme.typography.fontWeight.semibold
            }}>
              {filteredStocks.length} {filteredStocks.length === 1 ? 'Stock' : 'Stocks'}
            </span>
            {(multiFilters.fireLevels.size > 0 || multiFilters.priceFilters.size > 0 || multiFilters.marketValueFilters.size > 0) && (
              <span style={{
                fontSize: theme.typography.fontSize.sm,
                backgroundColor: theme.status.info,
                color: 'white',
                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                borderRadius: theme.borderRadius.md,
                fontWeight: theme.typography.fontWeight.medium
              }}>
                {multiFilters.fireLevels.size + multiFilters.priceFilters.size + multiFilters.marketValueFilters.size} filters active
              </span>
            )}
          </h1>
          <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center' }}>
            {/* Chart View Toggle */}
            <button
              onClick={() => setShowChartView(!showChartView)}
              style={{
                padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                border: 'none',
                borderRadius: theme.borderRadius.md,
                backgroundColor: showChartView ? theme.status.success : theme.status.info,
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
              {showChartView ? '📊 Chart Mode' : '📋 Grid Mode'}
            </button>
            {/* Search Input */}
            <input
              type="text"
              placeholder="🔍 Search tickers..."
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
              <option value="">🔢 No Sort</option>
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
              <option value="market-value-desc">💎 Market Value (High to Low)</option>
              <option value="market-value-asc">💎 Market Value (Low to High)</option>
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
            onClick={() => {
              setActiveFilter('all');
              clearAllFilters();
            }}
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
            onClick={() => {
              if (activeFilter === 'anyfire') {
                setActiveFilter('all');
                clearAllFilters();
              } else {
                setActiveFilter('anyfire');
                clearAllFilters();
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
            onMouseEnter={(e) => {
              if (activeFilter !== 'anyfire') {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.md;
              }
            }}
            onMouseLeave={(e) => {
              if (activeFilter !== 'anyfire') {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            <div style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.bold,
              color: activeFilter === 'anyfire' ? 'white' : '#ff6b35'
            }}>
              {anyFireTickers.length}
            </div>
            <div style={{
              fontSize: theme.typography.fontSize.xs,
              color: activeFilter === 'anyfire' ? 'rgba(255,255,255,0.8)' : theme.ui.text.secondary,
              fontWeight: theme.typography.fontWeight.medium
            }}>
              🔥 Any Fire
            </div>
          </div>

          <div 
            onClick={() => toggleFilter('fire', 5)}
            style={{
              textAlign: 'center',
              padding: theme.spacing.sm,
              backgroundColor: multiFilters.fireLevels.has(5) ? getFireLevelStyle(5).primary : getFireLevelStyle(5).background,
              borderRadius: theme.borderRadius.md,
              border: `2px solid ${multiFilters.fireLevels.has(5) ? getFireLevelStyle(5).primary : getFireLevelStyle(5).border}`,
              cursor: 'pointer',
              transition: `all ${theme.transition.normal}`,
              transform: multiFilters.fireLevels.has(5) ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: multiFilters.fireLevels.has(5) ? theme.ui.shadow.md : theme.ui.shadow.sm,
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              if (!multiFilters.fireLevels.has(5)) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.md;
              }
            }}
            onMouseLeave={(e) => {
              if (!multiFilters.fireLevels.has(5)) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            <div style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.bold,
              color: multiFilters.fireLevels.has(5) ? 'white' : getFireLevelStyle(5).primary
            }}>
              {fire5Tickers.length}
            </div>
            <div style={{
              fontSize: theme.typography.fontSize.xs,
              color: multiFilters.fireLevels.has(5) ? 'rgba(255,255,255,0.8)' : theme.ui.text.secondary,
              fontWeight: theme.typography.fontWeight.medium
            }}>
              🔥🔥🔥🔥🔥
            </div>
          </div>

          <div 
            onClick={() => toggleFilter('fire', 4)}
            style={{
              textAlign: 'center',
              padding: theme.spacing.sm,
              backgroundColor: multiFilters.fireLevels.has(4) ? getFireLevelStyle(4).primary : getFireLevelStyle(4).background,
              borderRadius: theme.borderRadius.md,
              border: `2px solid ${multiFilters.fireLevels.has(4) ? getFireLevelStyle(4).primary : getFireLevelStyle(4).border}`,
              cursor: 'pointer',
              transition: `all ${theme.transition.normal}`,
              transform: multiFilters.fireLevels.has(4) ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: multiFilters.fireLevels.has(4) ? theme.ui.shadow.md : theme.ui.shadow.sm,
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              if (!multiFilters.fireLevels.has(4)) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.md;
              }
            }}
            onMouseLeave={(e) => {
              if (!multiFilters.fireLevels.has(4)) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            <div style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.bold,
              color: multiFilters.fireLevels.has(4) ? 'white' : getFireLevelStyle(4).primary
            }}>
              {fire4Tickers.length}
            </div>
            <div style={{
              fontSize: theme.typography.fontSize.xs,
              color: multiFilters.fireLevels.has(4) ? 'rgba(255,255,255,0.8)' : theme.ui.text.secondary,
              fontWeight: theme.typography.fontWeight.medium
            }}>
              🔥🔥🔥🔥
            </div>
          </div>

          <div 
            onClick={() => toggleFilter('fire', 3)}
            style={{
              textAlign: 'center',
              padding: theme.spacing.sm,
              backgroundColor: multiFilters.fireLevels.has(3) ? getFireLevelStyle(3).primary : getFireLevelStyle(3).background,
              borderRadius: theme.borderRadius.md,
              border: `2px solid ${multiFilters.fireLevels.has(3) ? getFireLevelStyle(3).primary : getFireLevelStyle(3).border}`,
              cursor: 'pointer',
              transition: `all ${theme.transition.normal}`,
              transform: multiFilters.fireLevels.has(3) ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: multiFilters.fireLevels.has(3) ? theme.ui.shadow.md : theme.ui.shadow.sm,
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              if (!multiFilters.fireLevels.has(3)) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.md;
              }
            }}
            onMouseLeave={(e) => {
              if (!multiFilters.fireLevels.has(3)) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            <div style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.bold,
              color: multiFilters.fireLevels.has(3) ? 'white' : getFireLevelStyle(3).primary
            }}>
              {fire3Tickers.length}
            </div>
            <div style={{
              fontSize: theme.typography.fontSize.xs,
              color: multiFilters.fireLevels.has(3) ? 'rgba(255,255,255,0.8)' : theme.ui.text.secondary,
              fontWeight: theme.typography.fontWeight.medium
            }}>
              🔥🔥🔥
            </div>
          </div>

          <div 
            onClick={() => toggleFilter('fire', 2)}
            style={{
              textAlign: 'center',
              padding: theme.spacing.sm,
              backgroundColor: multiFilters.fireLevels.has(2) ? getFireLevelStyle(2).primary : getFireLevelStyle(2).background,
              borderRadius: theme.borderRadius.md,
              border: `2px solid ${multiFilters.fireLevels.has(2) ? getFireLevelStyle(2).primary : getFireLevelStyle(2).border}`,
              cursor: 'pointer',
              transition: `all ${theme.transition.normal}`,
              transform: multiFilters.fireLevels.has(2) ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: multiFilters.fireLevels.has(2) ? theme.ui.shadow.md : theme.ui.shadow.sm,
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              if (!multiFilters.fireLevels.has(2)) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.md;
              }
            }}
            onMouseLeave={(e) => {
              if (!multiFilters.fireLevels.has(2)) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            <div style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.bold,
              color: multiFilters.fireLevels.has(2) ? 'white' : getFireLevelStyle(2).primary
            }}>
              {fire2Tickers.length}
            </div>
            <div style={{
              fontSize: theme.typography.fontSize.xs,
              color: multiFilters.fireLevels.has(2) ? 'rgba(255,255,255,0.8)' : theme.ui.text.secondary,
              fontWeight: theme.typography.fontWeight.medium
            }}>
              🔥🔥
            </div>
          </div>

          <div 
            onClick={() => toggleFilter('fire', 1)}
            style={{
              textAlign: 'center',
              padding: theme.spacing.sm,
              backgroundColor: multiFilters.fireLevels.has(1) ? getFireLevelStyle(1).primary : getFireLevelStyle(1).background,
              borderRadius: theme.borderRadius.md,
              border: `2px solid ${multiFilters.fireLevels.has(1) ? getFireLevelStyle(1).primary : getFireLevelStyle(1).border}`,
              cursor: 'pointer',
              transition: `all ${theme.transition.normal}`,
              transform: multiFilters.fireLevels.has(1) ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: multiFilters.fireLevels.has(1) ? theme.ui.shadow.md : theme.ui.shadow.sm,
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              if (!multiFilters.fireLevels.has(1)) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.md;
              }
            }}
            onMouseLeave={(e) => {
              if (!multiFilters.fireLevels.has(1)) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            <div style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.bold,
              color: multiFilters.fireLevels.has(1) ? 'white' : getFireLevelStyle(1).primary
            }}>
              {fire1Tickers.length}
            </div>
            <div style={{
              fontSize: theme.typography.fontSize.xs,
              color: multiFilters.fireLevels.has(1) ? 'rgba(255,255,255,0.8)' : theme.ui.text.secondary,
              fontWeight: theme.typography.fontWeight.medium
            }}>
              🔥
            </div>
          </div>

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

        {/* Price Filter Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.md
        }}>
          <button
            onClick={() => toggleFilter('price', 'under1')}
            style={{
              padding: theme.spacing.md,
              backgroundColor: multiFilters.priceFilters.has('under1') ? '#28a745' : theme.ui.surface,
              color: multiFilters.priceFilters.has('under1') ? 'white' : '#28a745',
              border: `2px solid #28a745`,
              borderRadius: theme.borderRadius.md,
              textAlign: 'center',
              boxShadow: multiFilters.priceFilters.has('under1') ? '0 4px 8px rgba(40, 167, 69, 0.3)' : theme.ui.shadow.sm,
              cursor: 'pointer',
              transition: `all ${theme.transition.normal}`,
              transform: multiFilters.priceFilters.has('under1') ? 'translateY(-1px)' : 'none',
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.semibold
            }}
            onMouseEnter={(e) => {
              if (!multiFilters.priceFilters.has('under1')) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(40, 167, 69, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (!multiFilters.priceFilters.has('under1')) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            💰 Under $1
          </button>

          <button
            onClick={() => toggleFilter('price', '1to2')}
            style={{
              padding: theme.spacing.md,
              backgroundColor: multiFilters.priceFilters.has('1to2') ? '#fd7e14' : theme.ui.surface,
              color: multiFilters.priceFilters.has('1to2') ? 'white' : '#fd7e14',
              border: `2px solid #fd7e14`,
              borderRadius: theme.borderRadius.md,
              textAlign: 'center',
              boxShadow: multiFilters.priceFilters.has('1to2') ? '0 4px 8px rgba(253, 126, 20, 0.3)' : theme.ui.shadow.sm,
              cursor: 'pointer',
              transition: `all ${theme.transition.normal}`,
              transform: multiFilters.priceFilters.has('1to2') ? 'translateY(-1px)' : 'none',
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.semibold
            }}
            onMouseEnter={(e) => {
              if (!multiFilters.priceFilters.has('1to2')) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(253, 126, 20, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (!multiFilters.priceFilters.has('1to2')) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            💎 $1 - $2
          </button>

          <button
            onClick={() => toggleFilter('price', 'over2')}
            style={{
              padding: theme.spacing.md,
              backgroundColor: multiFilters.priceFilters.has('over2') ? '#6f42c1' : theme.ui.surface,
              color: multiFilters.priceFilters.has('over2') ? 'white' : '#6f42c1',
              border: `2px solid #6f42c1`,
              borderRadius: theme.borderRadius.md,
              textAlign: 'center',
              boxShadow: multiFilters.priceFilters.has('over2') ? '0 4px 8px rgba(111, 66, 193, 0.3)' : theme.ui.shadow.sm,
              cursor: 'pointer',
              transition: `all ${theme.transition.normal}`,
              transform: multiFilters.priceFilters.has('over2') ? 'translateY(-1px)' : 'none',
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.semibold
            }}
            onMouseEnter={(e) => {
              if (!multiFilters.priceFilters.has('over2')) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(111, 66, 193, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (!multiFilters.priceFilters.has('over2')) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            🏆 Over $2
          </button>

          {/* Compact Performance Filter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            backgroundColor: activeFilter === 'performance' ? '#E3F2FD' : theme.ui.surface,
            border: `2px solid ${activeFilter === 'performance' ? '#2196F3' : theme.ui.border}`,
            borderRadius: theme.borderRadius.md,
            boxShadow: activeFilter === 'performance' ? '0 4px 8px rgba(33, 150, 243, 0.3)' : theme.ui.shadow.sm,
            transition: `all ${theme.transition.normal}`,
            fontFamily: theme.typography.fontFamily
          }}>
            {/* Timeframe Toggle */}
            <div style={{ display: 'flex', gap: '2px', backgroundColor: '#f8f9fa', borderRadius: theme.borderRadius.sm, padding: '2px' }}>
              <button
                onClick={() => setPerformanceTimeframe('daily')}
                style={{
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  backgroundColor: performanceTimeframe === 'daily' ? '#2196F3' : 'transparent',
                  color: performanceTimeframe === 'daily' ? 'white' : theme.ui.text.primary,
                  border: 'none',
                  borderRadius: theme.borderRadius.sm,
                  cursor: 'pointer',
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.semibold,
                  fontFamily: theme.typography.fontFamily,
                  transition: `all ${theme.transition.normal}`
                }}
              >
                D
              </button>
              <button
                onClick={() => setPerformanceTimeframe('weekly')}
                style={{
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  backgroundColor: performanceTimeframe === 'weekly' ? '#2196F3' : 'transparent',
                  color: performanceTimeframe === 'weekly' ? 'white' : theme.ui.text.primary,
                  border: 'none',
                  borderRadius: theme.borderRadius.sm,
                  cursor: 'pointer',
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.semibold,
                  fontFamily: theme.typography.fontFamily,
                  transition: `all ${theme.transition.normal}`
                }}
              >
                W
              </button>
              <button
                onClick={() => setPerformanceTimeframe('monthly')}
                style={{
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  backgroundColor: performanceTimeframe === 'monthly' ? '#2196F3' : 'transparent',
                  color: performanceTimeframe === 'monthly' ? 'white' : theme.ui.text.primary,
                  border: 'none',
                  borderRadius: theme.borderRadius.sm,
                  cursor: 'pointer',
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.semibold,
                  fontFamily: theme.typography.fontFamily,
                  transition: `all ${theme.transition.normal}`
                }}
              >
                M
              </button>
            </div>

            {/* Gainers Button */}
            <button
              onClick={() => {
                setPerformanceType('gainers');
                if (activeFilter === 'performance' && performanceType === 'gainers') {
                  // Toggle off
                  setActiveFilter('all');
                } else {
                  setActiveFilter('performance');
                }
              }}
              style={{
                padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                backgroundColor: activeFilter === 'performance' && performanceType === 'gainers' ? '#28a745' : 'transparent',
                color: activeFilter === 'performance' && performanceType === 'gainers' ? 'white' : '#28a745',
                border: `2px solid #28a745`,
                borderRadius: theme.borderRadius.sm,
                cursor: 'pointer',
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                fontFamily: theme.typography.fontFamily,
                transition: `all ${theme.transition.normal}`,
                whiteSpace: 'nowrap'
              }}
            >
              📈 Gainers
            </button>

            {/* Losers Button */}
            <button
              onClick={() => {
                setPerformanceType('losers');
                if (activeFilter === 'performance' && performanceType === 'losers') {
                  // Toggle off
                  setActiveFilter('all');
                } else {
                  setActiveFilter('performance');
                }
              }}
              style={{
                padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                backgroundColor: activeFilter === 'performance' && performanceType === 'losers' ? '#dc3545' : 'transparent',
                color: activeFilter === 'performance' && performanceType === 'losers' ? 'white' : '#dc3545',
                border: `2px solid #dc3545`,
                borderRadius: theme.borderRadius.sm,
                cursor: 'pointer',
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                fontFamily: theme.typography.fontFamily,
                transition: `all ${theme.transition.normal}`,
                whiteSpace: 'nowrap'
              }}
            >
              📉 Losers
            </button>
          </div>
        </div>

        {/* Market Value Filter Row */}
        {/* <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.md
        }}>
          <button
            onClick={() => toggleFilter('marketValue', 'under10')}
            style={{
              padding: theme.spacing.md,
              backgroundColor: multiFilters.marketValueFilters.has('under10') ? '#17a2b8' : theme.ui.surface,
              color: multiFilters.marketValueFilters.has('under10') ? 'white' : '#17a2b8',
              border: `2px solid #17a2b8`,
              borderRadius: theme.borderRadius.md,
              textAlign: 'center',
              boxShadow: multiFilters.marketValueFilters.has('under10') ? '0 4px 8px rgba(23, 162, 184, 0.3)' : theme.ui.shadow.sm,
              cursor: 'pointer',
              transition: `all ${theme.transition.normal}`,
              transform: multiFilters.marketValueFilters.has('under10') ? 'translateY(-1px)' : 'none',
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.semibold
            }}
            onMouseEnter={(e) => {
              if (!multiFilters.marketValueFilters.has('under10')) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(23, 162, 184, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (!multiFilters.marketValueFilters.has('under10')) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            💎 Under $10M
          </button>

          <button
            onClick={() => toggleFilter('marketValue', '10to50')}
            style={{
              padding: theme.spacing.md,
              backgroundColor: multiFilters.marketValueFilters.has('10to50') ? '#20c997' : theme.ui.surface,
              color: multiFilters.marketValueFilters.has('10to50') ? 'white' : '#20c997',
              border: `2px solid #20c997`,
              borderRadius: theme.borderRadius.md,
              textAlign: 'center',
              boxShadow: multiFilters.marketValueFilters.has('10to50') ? '0 4px 8px rgba(32, 201, 151, 0.3)' : theme.ui.shadow.sm,
              cursor: 'pointer',
              transition: `all ${theme.transition.normal}`,
              transform: multiFilters.marketValueFilters.has('10to50') ? 'translateY(-1px)' : 'none',
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.semibold
            }}
            onMouseEnter={(e) => {
              if (!multiFilters.marketValueFilters.has('10to50')) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(32, 201, 151, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (!multiFilters.marketValueFilters.has('10to50')) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            🚀 $10M - $50M
          </button>

          <button
            onClick={() => toggleFilter('marketValue', '50to100')}
            style={{
              padding: theme.spacing.md,
              backgroundColor: multiFilters.marketValueFilters.has('50to100') ? '#e83e8c' : theme.ui.surface,
              color: multiFilters.marketValueFilters.has('50to100') ? 'white' : '#e83e8c',
              border: `2px solid #e83e8c`,
              borderRadius: theme.borderRadius.md,
              textAlign: 'center',
              boxShadow: multiFilters.marketValueFilters.has('50to100') ? '0 4px 8px rgba(232, 62, 140, 0.3)' : theme.ui.shadow.sm,
              cursor: 'pointer',
              transition: `all ${theme.transition.normal}`,
              transform: multiFilters.marketValueFilters.has('50to100') ? 'translateY(-1px)' : 'none',
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.semibold
            }}
            onMouseEnter={(e) => {
              if (!multiFilters.marketValueFilters.has('50to100')) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(232, 62, 140, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (!multiFilters.marketValueFilters.has('50to100')) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            💰 $50M - $100M
          </button>

          <button
            onClick={() => toggleFilter('marketValue', 'over100')}
            style={{
              padding: theme.spacing.md,
              backgroundColor: multiFilters.marketValueFilters.has('over100') ? '#6610f2' : theme.ui.surface,
              color: multiFilters.marketValueFilters.has('over100') ? 'white' : '#6610f2',
              border: `2px solid #6610f2`,
              borderRadius: theme.borderRadius.md,
              textAlign: 'center',
              boxShadow: multiFilters.marketValueFilters.has('over100') ? '0 4px 8px rgba(102, 16, 242, 0.3)' : theme.ui.shadow.sm,
              cursor: 'pointer',
              transition: `all ${theme.transition.normal}`,
              transform: multiFilters.marketValueFilters.has('over100') ? 'translateY(-1px)' : 'none',
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.semibold
            }}
            onMouseEnter={(e) => {
              if (!multiFilters.marketValueFilters.has('over100')) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 16, 242, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (!multiFilters.marketValueFilters.has('over100')) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            🏆 Over $100M
          </button>
        </div> */}
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

        {tickersWithData.length > 0 || (activeFilter === 'holdings' && holdingTickers.length > 0) ? (
          <>
            {showChartView ? (
              <ChartView
                stocks={filteredStocks}
                stockData={stockData}
                livePriceData={livePriceData}
                holdings={holdings}
                watchlistStocks={watchlistStocks}
                onToggleHolding={handleToggleHolding}
                onToggleWatchlist={handleToggleWatchlist}
                onDeleteTicker={handleDeleteTicker}
                onLoadLivePrice={loadLivePriceForTicker}
                showWatchButton={watchlists.length > 0}
                showDeleteButton={true}
                tradingViewChartUrl="https://www.tradingview.com/chart/StTMbjgz/?symbol="
              />
            ) : (
              <GridView
                stocks={filteredStocks}
                stockData={stockData}
                livePriceData={livePriceData}
                holdings={holdings}
                watchlistStocks={watchlistStocks}
                onToggleHolding={handleToggleHolding}
                onToggleWatchlist={handleToggleWatchlist}
                onOpenChart={handleOpenChart}
                onDeleteTicker={handleDeleteTicker}
                onLoadLivePrice={loadLivePriceForTicker}
                showWatchButton={watchlists.length > 0}
                showDeleteButton={true}
                activeFilter={activeFilter}
              />
            )}
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

export default Dashboard;