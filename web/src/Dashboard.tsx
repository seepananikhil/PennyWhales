import React, { useState, useEffect } from 'react';
import api from './api';
import { Stock } from './types';
import { theme } from './theme';
import TickerModal from './components/TickerModal';
import ChartView from './components/ChartView';
import FilterPanel from './components/FilterPanel';
import { FaShareAlt } from 'react-icons/fa';

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
  const [activeFilter, setActiveFilter] = useState<string>('multifilter');
  const [multiFilters, setMultiFilters] = useState<{
    fireLevels: Set<number>;
    priceFilters: Set<string>;
    marketValueFilters: Set<string>;
    sectors: Set<string>;
    employeeCount: Set<string>;
    ipoDate: Set<string>;
  }>({
    fireLevels: new Set([5, 4, 3]),
    priceFilters: new Set(),
    marketValueFilters: new Set(),
    sectors: new Set(),
    employeeCount: new Set(),
    ipoDate: new Set()
  });
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<string[]>([]); // Multi-sort: order of sort criteria
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [topGainers, setTopGainers] = useState<string[]>([]);
  const [topLosers, setTopLosers] = useState<string[]>([]);
  const [filterPanelOpen, setFilterPanelOpen] = useState<boolean>(false);
  const [urlTicker, setUrlTicker] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);
  
  useEffect(() => {
    // Read ticker and sector from URL
    const params = new URLSearchParams(window.location.search);
    const ticker = params.get('ticker');
    const sector = params.get('sector');
    
    setUrlTicker(ticker ? ticker.toUpperCase() : null);
    
    // Apply sector filter if present
    if (sector) {
      setMultiFilters(prev => ({
        ...prev,
        sectors: new Set([sector])
      }));
      setActiveFilter('multifilter');
    }
    
    // Listen for browser back/forward navigation
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const ticker = params.get('ticker');
      const sector = params.get('sector');
      
      setUrlTicker(ticker ? ticker.toUpperCase() : null);
      
      if (sector) {
        setMultiFilters(prev => ({
          ...prev,
          sectors: new Set([sector])
        }));
        setActiveFilter('multifilter');
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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
  const toggleFilter = (type: 'fire' | 'price' | 'marketValue' | 'sector' | 'employee' | 'ipo', value: number | string) => {
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
      } else if (type === 'sector') {
        const newSectors = new Set(prev.sectors);
        if (newSectors.has(value as string)) {
          newSectors.delete(value as string);
        } else {
          newSectors.add(value as string);
        }
        newFilters.sectors = newSectors;
      } else if (type === 'employee') {
        const newEmployeeCount = new Set(prev.employeeCount);
        if (newEmployeeCount.has(value as string)) {
          newEmployeeCount.delete(value as string);
        } else {
          newEmployeeCount.add(value as string);
        }
        newFilters.employeeCount = newEmployeeCount;
      } else if (type === 'ipo') {
        const newIpoDate = new Set(prev.ipoDate);
        if (newIpoDate.has(value as string)) {
          newIpoDate.delete(value as string);
        } else {
          newIpoDate.add(value as string);
        }
        newFilters.ipoDate = newIpoDate;
      }
      
      return newFilters;
    });
    
    // Auto-set activeFilter based on whether we have any filters
    // Check the updated state by calculating hasFilters separately
    setActiveFilter(prev => {
      const newFiltersSize = 
        (type === 'fire' ? (multiFilters.fireLevels.has(value as number) ? multiFilters.fireLevels.size - 1 : multiFilters.fireLevels.size + 1) : multiFilters.fireLevels.size) +
        (type === 'price' ? (multiFilters.priceFilters.has(value as string) ? multiFilters.priceFilters.size - 1 : multiFilters.priceFilters.size + 1) : multiFilters.priceFilters.size) +
        (type === 'marketValue' ? (multiFilters.marketValueFilters.has(value as string) ? multiFilters.marketValueFilters.size - 1 : multiFilters.marketValueFilters.size + 1) : multiFilters.marketValueFilters.size) +
        (type === 'sector' ? (multiFilters.sectors.has(value as string) ? multiFilters.sectors.size - 1 : multiFilters.sectors.size + 1) : multiFilters.sectors.size) +
        (type === 'employee' ? (multiFilters.employeeCount.has(value as string) ? multiFilters.employeeCount.size - 1 : multiFilters.employeeCount.size + 1) : multiFilters.employeeCount.size) +
        (type === 'ipo' ? (multiFilters.ipoDate.has(value as string) ? multiFilters.ipoDate.size - 1 : multiFilters.ipoDate.size + 1) : multiFilters.ipoDate.size);
      
      return newFiltersSize > 0 ? 'multifilter' : 'anyfire';
    });
  };

  const clearAllFilters = () => {
    setMultiFilters({
      fireLevels: new Set(),
      priceFilters: new Set(),
      marketValueFilters: new Set(),
      sectors: new Set(),
      employeeCount: new Set(),
      ipoDate: new Set()
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
            case '1to3':
              return stock.price >= 1.0 && stock.price < 3.0;
            case '3to5':
              return stock.price >= 3.0 && stock.price < 5.0;
            case '5to10':
              return stock.price >= 5.0 && stock.price < 10.0;
            case 'over10':
              return stock.price >= 10.0;
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
        
        const marketCap = stock.market_cap;
        
        // Skip stocks without market cap data
        if (marketCap === null || marketCap === undefined || marketCap === 0) return false;
        
        return Array.from(multiFilters.marketValueFilters).some(marketValueFilter => {
          switch (marketValueFilter) {
            case 'nano':
              // Nano cap: < $50M
              return marketCap < 50;
            case 'micro':
              // Micro cap: $50M - $300M
              return marketCap >= 50 && marketCap < 300;
            case 'small':
              // Small cap: $300M - $2B
              return marketCap >= 300 && marketCap < 2000;
            case 'mid':
              // Mid cap: $2B - $10B
              return marketCap >= 2000 && marketCap < 10000;
            case 'large':
              // Large cap: $10B+
              return marketCap >= 10000;
            default:
              return true;
          }
        });
      });
    }

    // Apply sector filter if selected
    if (multiFilters.sectors.size > 0) {
      stocks = stocks.filter(ticker => {
        const stock = stockData.get(ticker);
        if (!stock || !stock.sector) return false;
        return multiFilters.sectors.has(stock.sector);
      });
    }

    // Apply employee count filter if selected
    if (multiFilters.employeeCount.size > 0) {
      stocks = stocks.filter(ticker => {
        const stock = stockData.get(ticker);
        if (!stock) return false;
        
        const employees = stock.employee_count;
        
        // Skip stocks without employee count data
        if (employees === null || employees === undefined || employees === 0) return false;
        
        return Array.from(multiFilters.employeeCount).some(employeeFilter => {
          switch (employeeFilter) {
            case 'under50':
              return employees < 50;
            case '50to200':
              return employees >= 50 && employees < 200;
            case '200to1000':
              return employees >= 200 && employees < 1000;
            case '1000to5000':
              return employees >= 1000 && employees < 5000;
            case 'over5000':
              return employees >= 5000;
            default:
              return true;
          }
        });
      });
    }

    // Apply IPO date filter if selected
    if (multiFilters.ipoDate.size > 0) {
      stocks = stocks.filter(ticker => {
        const stock = stockData.get(ticker);
        if (!stock || !stock.ipo_date) return false;
        
        const ipoDate = new Date(stock.ipo_date);
        const now = new Date();
        const yearsDiff = (now.getTime() - ipoDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
        
        return Array.from(multiFilters.ipoDate).some(ipoFilter => {
          switch (ipoFilter) {
            case 'lastYear':
              return yearsDiff <= 1;
            case 'last3Years':
              return yearsDiff <= 3;
            case 'last5Years':
              return yearsDiff <= 5;
            case 'older':
              return yearsDiff > 5;
            default:
              return true;
          }
        });
      });
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
      // Multi-sort: apply each sort criteria in order
      if (sortOrder.length > 0) {
        for (const sortKey of sortOrder) {
          const stockA = stockData.get(a);
          const stockB = stockData.get(b);
          
          if (!stockA || !stockB) continue;
          
          let comparison = 0;
          
          switch (sortKey) {
            case 'combined-desc':
              const combinedA = stockA.vanguard_pct + stockA.blackrock_pct + (stockA.statestreet_pct || 0);
              const combinedB = stockB.vanguard_pct + stockB.blackrock_pct + (stockB.statestreet_pct || 0);
              comparison = combinedB - combinedA;
              break;
            case 'combined-asc':
              const combinedAsc = stockA.vanguard_pct + stockA.blackrock_pct + (stockA.statestreet_pct || 0);
              const combinedBsc = stockB.vanguard_pct + stockB.blackrock_pct + (stockB.statestreet_pct || 0);
              comparison = combinedAsc - combinedBsc;
              break;
            case 'vg-desc':
              comparison = stockB.vanguard_pct - stockA.vanguard_pct;
              break;
            case 'vg-asc':
              comparison = stockA.vanguard_pct - stockB.vanguard_pct;
              break;
            case 'br-desc':
              comparison = stockB.blackrock_pct - stockA.blackrock_pct;
              break;
            case 'br-asc':
              comparison = stockA.blackrock_pct - stockB.blackrock_pct;
              break;
            case 'ss-desc':
              comparison = (stockB.statestreet_pct || 0) - (stockA.statestreet_pct || 0);
              break;
            case 'ss-asc':
              comparison = (stockA.statestreet_pct || 0) - (stockB.statestreet_pct || 0);
              break;
            case 'fire-desc':
              const fireA = stockA.fire_level || 0;
              const fireB = stockB.fire_level || 0;
              comparison = fireB - fireA;
              break;
            case 'fire-asc':
              const fireAscA = stockA.fire_level || 0;
              const fireAscB = stockB.fire_level || 0;
              comparison = fireAscA - fireAscB;
              break;
            case 'price-desc':
              comparison = stockB.price - stockA.price;
              break;
            case 'price-asc':
              comparison = stockA.price - stockB.price;
              break;
            case 'price-change-desc':
              const priceChangeA = livePriceData.get(a)?.priceChange || 0;
              const priceChangeB = livePriceData.get(b)?.priceChange || 0;
              comparison = priceChangeB - priceChangeA;
              break;
            case 'price-change-asc':
              const priceChangeAscA = livePriceData.get(a)?.priceChange || 0;
              const priceChangeAscB = livePriceData.get(b)?.priceChange || 0;
              comparison = priceChangeAscA - priceChangeAscB;
              break;
            case 'market-value-desc':
              const marketCapA = stockA.market_cap || 0;
              const marketCapB = stockB.market_cap || 0;
              comparison = marketCapB - marketCapA;
              break;
            case 'market-value-asc':
              const marketCapAscA = stockA.market_cap || 0;
              const marketCapAscB = stockB.market_cap || 0;
              comparison = marketCapAscA - marketCapAscB;
              break;
            case 'daily-change-desc':
              // Sort by daily price change (gainers first = highest percentage first)
              const dailyChangeA = livePriceData.get(a)?.priceChange || 0;
              const dailyChangeB = livePriceData.get(b)?.priceChange || 0;
              comparison = dailyChangeB - dailyChangeA;
              break;
            case 'daily-change-asc':
              // Sort by daily price change (losers first = lowest percentage first)
              const dailyChangeAscA = livePriceData.get(a)?.priceChange || 0;
              const dailyChangeAscB = livePriceData.get(b)?.priceChange || 0;
              comparison = dailyChangeAscA - dailyChangeAscB;
              break;
            case 'weekly-change-desc':
              // Sort by weekly performance (gainers first = highest percentage first)
              if (!stockA?.performance || !stockB?.performance) comparison = 0;
              else comparison = (stockB.performance.week || 0) - (stockA.performance.week || 0);
              break;
            case 'weekly-change-asc':
              // Sort by weekly performance (losers first = lowest percentage first)
              if (!stockA?.performance || !stockB?.performance) comparison = 0;
              else comparison = (stockA.performance.week || 0) - (stockB.performance.week || 0);
              break;
            case 'monthly-change-desc':
              // Sort by monthly performance (gainers first = highest percentage first)
              if (!stockA?.performance || !stockB?.performance) comparison = 0;
              else comparison = (stockB.performance.month || 0) - (stockA.performance.month || 0);
              break;
            case 'monthly-change-asc':
              // Sort by monthly performance (losers first = lowest percentage first)
              if (!stockA?.performance || !stockB?.performance) comparison = 0;
              else comparison = (stockA.performance.month || 0) - (stockB.performance.month || 0);
              break;
            case 'price-asc-combined-desc':
              // First sort by price (low to high)
              const priceAsc = stockA.price - stockB.price;
              if (priceAsc !== 0) {
                comparison = priceAsc;
              } else {
                // Then by combined % (high to low) as tiebreaker
                const combinedB = stockB.vanguard_pct + stockB.blackrock_pct + (stockB.statestreet_pct || 0);
                const combinedA = stockA.vanguard_pct + stockA.blackrock_pct + (stockA.statestreet_pct || 0);
                comparison = combinedB - combinedA;
              }
              break;
            case 'employees-desc':
              const empA = stockA.employee_count || 0;
              const empB = stockB.employee_count || 0;
              comparison = empB - empA;
              break;
            case 'employees-asc':
              const empAscA = stockA.employee_count || 0;
              const empAscB = stockB.employee_count || 0;
              comparison = empAscA - empAscB;
              break;
            case 'ipo-date-desc':
              // Sort by IPO date (newest first = most recent dates first)
              if (!stockA?.ipo_date && !stockB?.ipo_date) comparison = 0;
              else if (!stockA?.ipo_date) comparison = 1; // No IPO date goes to end
              else if (!stockB?.ipo_date) comparison = -1;
              else {
                const dateA = new Date(stockA.ipo_date).getTime();
                const dateB = new Date(stockB.ipo_date).getTime();
                comparison = dateB - dateA; // Newer dates (higher timestamp) first
              }
              break;
            case 'ipo-date-asc':
              // Sort by IPO date (oldest first = earliest dates first)
              if (!stockA?.ipo_date && !stockB?.ipo_date) comparison = 0;
              else if (!stockA?.ipo_date) comparison = 1; // No IPO date goes to end
              else if (!stockB?.ipo_date) comparison = -1;
              else {
                const dateA = new Date(stockA.ipo_date).getTime();
                const dateB = new Date(stockB.ipo_date).getTime();
                comparison = dateA - dateB; // Older dates (lower timestamp) first
              }
              break;
            case 'inst-trans-desc':
              // Sort by institutional transaction (buying = positive, highest first)
              comparison = (stockB.inst_trans || 0) - (stockA.inst_trans || 0);
              break;
            case 'inst-trans-asc':
              // Sort by institutional transaction (selling = negative, lowest first)
              comparison = (stockA.inst_trans || 0) - (stockB.inst_trans || 0);
              break;
            case 'inst-own-desc':
              // Sort by institutional ownership (highest first)
              comparison = (stockB.inst_own || 0) - (stockA.inst_own || 0);
              break;
            case 'inst-own-asc':
              // Sort by institutional ownership (lowest first)
              comparison = (stockA.inst_own || 0) - (stockB.inst_own || 0);
              break;
          }
          
          // If this sort criteria produces a difference, return it
          if (comparison !== 0) return comparison;
        }
        // All sort criteria resulted in equality
        return 0;
      }
      
      // Legacy single sort (fallback)
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
          // Sort by combined VG + BR + SS percentage (highest first)
          const combinedA = stockA.vanguard_pct + stockA.blackrock_pct + (stockA.statestreet_pct || 0);
          const combinedB = stockB.vanguard_pct + stockB.blackrock_pct + (stockB.statestreet_pct || 0);
          return combinedB - combinedA;
        case 'combined-asc':
          // Sort by combined VG + BR + SS percentage (lowest first)
          const combinedAsc = stockA.vanguard_pct + stockA.blackrock_pct + (stockA.statestreet_pct || 0);
          const combinedBsc = stockB.vanguard_pct + stockB.blackrock_pct + (stockB.statestreet_pct || 0);
          return combinedAsc - combinedBsc;
        case 'vg-desc':
          return stockB.vanguard_pct - stockA.vanguard_pct;
        case 'vg-asc':
          return stockA.vanguard_pct - stockB.vanguard_pct;
        case 'br-desc':
          return stockB.blackrock_pct - stockA.blackrock_pct;
        case 'br-asc':
          return stockA.blackrock_pct - stockB.blackrock_pct;
        case 'ss-desc':
          return (stockB.statestreet_pct || 0) - (stockA.statestreet_pct || 0);
        case 'ss-asc':
          return (stockA.statestreet_pct || 0) - (stockB.statestreet_pct || 0);
        case 'fire-desc':
          const fireA = stockA.fire_level || 0;
          const fireB = stockB.fire_level || 0;
          if (fireA !== fireB) return fireB - fireA;
          // If fire levels are equal, sort by combined VG+BR+SS as secondary
          const fireComboA = stockA.vanguard_pct + stockA.blackrock_pct + (stockA.statestreet_pct || 0);
          const fireComboB = stockB.vanguard_pct + stockB.blackrock_pct + (stockB.statestreet_pct || 0);
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
        case 'daily-gainers':
          // Sort by daily gainers (from topGainers list)
          // Stocks not in list get pushed to end
          const indexA_gainers = topGainers.indexOf(a);
          const indexB_gainers = topGainers.indexOf(b);
          if (indexA_gainers === -1 && indexB_gainers === -1) return 0;
          if (indexA_gainers === -1) return 1;
          if (indexB_gainers === -1) return -1;
          return indexA_gainers - indexB_gainers;
        case 'daily-losers':
          // Sort by daily losers (from topLosers list)
          // Stocks not in list get pushed to end
          const indexA_losers = topLosers.indexOf(a);
          const indexB_losers = topLosers.indexOf(b);
          if (indexA_losers === -1 && indexB_losers === -1) return 0;
          if (indexA_losers === -1) return 1;
          if (indexB_losers === -1) return -1;
          return indexA_losers - indexB_losers;
        case 'weekly-gainers':
          // Sort by weekly performance (highest gains first)
          if (!stockA?.performance || !stockB?.performance) return 0;
          return (stockB.performance.week || 0) - (stockA.performance.week || 0);
        case 'weekly-losers':
          // Sort by weekly performance (lowest/most negative first)
          if (!stockA?.performance || !stockB?.performance) return 0;
          return (stockA.performance.week || 0) - (stockB.performance.week || 0);
        case 'monthly-gainers':
          // Sort by monthly performance (highest gains first)
          if (!stockA?.performance || !stockB?.performance) return 0;
          return (stockB.performance.month || 0) - (stockA.performance.month || 0);
        case 'monthly-losers':
          // Sort by monthly performance (lowest/most negative first)
          if (!stockA?.performance || !stockB?.performance) return 0;
          return (stockA.performance.month || 0) - (stockB.performance.month || 0);
        case 'employees-desc':
          // Sort by employee count (highest first)
          const empA = stockA.employee_count || 0;
          const empB = stockB.employee_count || 0;
          return empB - empA;
        case 'ipo-newest':
          // Sort by IPO date (newest first)
          if (!stockA?.ipo_date && !stockB?.ipo_date) return 0;
          if (!stockA?.ipo_date) return 1;
          if (!stockB?.ipo_date) return -1;
          return new Date(stockB.ipo_date).getTime() - new Date(stockA.ipo_date).getTime();
        case 'ipo-oldest':
          // Sort by IPO date (oldest first)
          if (!stockA?.ipo_date && !stockB?.ipo_date) return 0;
          if (!stockA?.ipo_date) return 1;
          if (!stockB?.ipo_date) return -1;
          return new Date(stockA.ipo_date).getTime() - new Date(stockB.ipo_date).getTime();
        default:
          // Default to combined VG + BR + SS (highest first)
          const defaultA = stockA.vanguard_pct + stockA.blackrock_pct + (stockA.statestreet_pct || 0);
          const defaultB = stockB.vanguard_pct + stockB.blackrock_pct + (stockB.statestreet_pct || 0);
          return defaultB - defaultA;
      }
    });
  };

  const filteredStocks = getFilteredStocks();

  // Calculate available sectors from all stocks with data
  const availableSectors = React.useMemo(() => {
    const sectors = new Set<string>();
    tickersWithData.forEach(ticker => {
      const stock = stockData.get(ticker);
      if (stock?.sector) {
        sectors.add(stock.sector);
      }
    });
    return Array.from(sectors).sort();
  }, [tickersWithData, stockData]);

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
            <button
              onClick={() => {
                // Create JSON with filtered tickers and their fire levels
                const shareData = filteredStocks.map(ticker => {
                  const stock = stockData.get(ticker);
                  return {
                    ticker,
                    fire_level: stock?.fire_level || 0,
                    blackrock_pct: stock?.blackrock_pct || 0,
                    vanguard_pct: stock?.vanguard_pct || 0
                  };
                }).sort((a, b) => b.fire_level - a.fire_level);
                
                const jsonString = JSON.stringify(shareData, null, 2);
                
                // Copy to clipboard
                navigator.clipboard.writeText(jsonString).then(() => {
                  alert(`Copied ${filteredStocks.length} tickers with fire levels to clipboard!`);
                }).catch(err => {
                  console.error('Failed to copy:', err);
                  // Fallback: create a download
                  const blob = new Blob([jsonString], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `filtered-stocks-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                });
              }}
              style={{
                padding: '4px 8px',
                border: 'none',
                borderRadius: theme.borderRadius.md,
                backgroundColor: theme.status.success,
                color: 'white',
                cursor: 'pointer',
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                transition: `all ${theme.transition.normal}`,
                boxShadow: theme.ui.shadow.sm,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.md;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }}
              title="Copy filtered stocks as JSON"
            >
              {FaShareAlt({ size: 12 })}
            </button>
            {(multiFilters.fireLevels.size > 0 || multiFilters.priceFilters.size > 0 || multiFilters.marketValueFilters.size > 0 || multiFilters.sectors.size > 0 || multiFilters.employeeCount.size > 0 || multiFilters.ipoDate.size > 0) && (
              <span style={{
                fontSize: theme.typography.fontSize.sm,
                backgroundColor: theme.status.info,
                color: 'white',
                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                borderRadius: theme.borderRadius.md,
                fontWeight: theme.typography.fontWeight.medium
              }}>
                {multiFilters.fireLevels.size + multiFilters.priceFilters.size + multiFilters.marketValueFilters.size + multiFilters.sectors.size + multiFilters.employeeCount.size + multiFilters.ipoDate.size} filters active
              </span>
            )}
          </h1>
          <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center' }}>
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
          
            <button
              onClick={() => setFilterPanelOpen(true)}
              style={{
                padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                border: 'none',
                borderRadius: theme.borderRadius.md,
                backgroundColor: theme.status.warning,
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
              🔍 Filters & Sort
            </button>
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
            <ChartView
              stocks={filteredStocks}
              stockData={stockData}
              livePriceData={livePriceData}
              holdings={holdings}
              watchlistStocks={watchlistStocks}
              onToggleHolding={handleToggleHolding}
              onToggleWatchlist={handleToggleWatchlist}
              onDeleteTicker={handleDeleteTicker}
              showWatchButton={watchlists.length > 0}
              showDeleteButton={true}
              tradingViewChartUrl="https://www.tradingview.com/chart/StTMbjgz/?symbol="
              initialSelectedTicker={urlTicker}
            />
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

      {/* Filter Panel */}
      <FilterPanel
        isOpen={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        filters={multiFilters}
        onToggleFilter={toggleFilter}
        onClearFilters={clearAllFilters}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(sort: string) => {
          if (sort === 'CLEAR_ALL') {
            setSortOrder([]);
            setSortBy('');
          } else if (sort.startsWith('TOGGLE_')) {
            // Handle toggle from desc to asc or vice versa
            const match = sort.match(/TOGGLE_(.+)_TO_(ASC|DESC)/);
            if (match) {
              const sortKey = match[1];
              const direction = match[2].toLowerCase();
              const oldKey = direction === 'asc' ? `${sortKey}-desc` : `${sortKey}-asc`;
              const newKey = `${sortKey}-${direction}`;
              
              setSortOrder(prev => {
                const newOrder = prev.filter(s => s !== oldKey);
                newOrder.push(newKey);
                return newOrder;
              });
              setSortBy(newKey);
            }
          } else if (sortOrder.includes(sort)) {
            // Remove the sort
            const newSortOrder = sortOrder.filter(s => s !== sort);
            setSortOrder(newSortOrder);
            setSortBy(newSortOrder.length > 0 ? newSortOrder[0] : '');
          } else {
            // Add the sort
            const newSortOrder = [...sortOrder, sort];
            setSortOrder(newSortOrder);
            setSortBy(sort);
          }
        }}
        availableSectors={availableSectors}
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