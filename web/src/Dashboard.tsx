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
  const [activeWatchlist, setActiveWatchlist] = useState<any>(null);
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
    recommendations: Set<string>;
    industries: Set<string>;
    volumeFilter: Set<string>;
  }>({
    fireLevels: new Set(),
    priceFilters: new Set(),
    marketValueFilters: new Set<string>([]),

    sectors: new Set(),
    employeeCount: new Set(),
    ipoDate: new Set(),
    recommendations: new Set(),
    industries: new Set(),
    volumeFilter: new Set()
  });
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<string[]>([]); // Multi-sort: order of sort criteria
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');

  const [filterPanelOpen, setFilterPanelOpen] = useState<boolean>(false);
  const [urlTicker, setUrlTicker] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageLimit] = useState<number>(50);
  const [pagination, setPagination] = useState<{
    total: number;
    totalPages: number;
    hasMore: boolean;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);


  useEffect(() => {
    loadData();
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    if (!isInitialLoad) {
      setCurrentPage(1);
      setStockData(new Map());
      loadStockData(true);
    }
  }, [activeFilter, JSON.stringify(Array.from(multiFilters.fireLevels)), JSON.stringify(Array.from(multiFilters.priceFilters)), JSON.stringify(Array.from(multiFilters.marketValueFilters)), JSON.stringify(Array.from(multiFilters.sectors)), JSON.stringify(Array.from(multiFilters.industries)), debouncedSearchQuery, sortOrder]);

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

  useEffect(() => {
    loadStockData();
  }, [currentPage]);

  const loadData = async () => {
    await Promise.all([loadTickers(), loadStockData(true), loadHoldings(), loadWatchlists()]);

  };

  const loadMoreData = async () => {
    if (pagination && pagination.hasMore && !loadingMore) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // Load more data when page changes (except initial load)
  useEffect(() => {
    if (currentPage > 1) {
      loadStockData(false);
    }
  }, [currentPage]);



  const loadTickers = async () => {
    try {
      if (isInitialLoad) setLoading(true);
      else setIsRefreshing(true);

      const data = await api.getTickers();
      setTickers(data?.tickers || []);
      setError(null);
    } catch (err) {
      setError('Failed to load tickers');
      console.error('Error loading tickers:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadStockData = async (reset: boolean = false) => {
    try {
      if (reset) {
        if (isInitialLoad) {
          setLoading(true);
        } else {
          setIsRefreshing(true);
        }
      } else {
        setLoadingMore(true);
      }

      // If watchlist is active, use stockData directly without API call
      if (activeWatchlistId && activeWatchlist?.stockData) {
        const stockMap = new Map<string, Stock>();
        activeWatchlist.stockData.forEach((stock: Stock) => {
          if (stock.ticker) {
            stockMap.set(stock.ticker, stock);
          }
        });
        setStockData(stockMap);

        // Set pagination based on watchlist stocks
        const total = activeWatchlist.stocks?.length || 0;
        const totalPages = Math.ceil(total / pageLimit);
        setPagination({
          total,
          totalPages,
          hasMore: currentPage < totalPages
        });
      } else {
        // Only call results API if no active watchlist
        const page = reset ? 1 : currentPage;
        const response = await api.getLatestResults(
          page,
          pageLimit,
          debouncedSearchQuery,
          Array.from(multiFilters.fireLevels),
          Array.from(multiFilters.priceFilters),
          Array.from(multiFilters.marketValueFilters),
          Array.from(multiFilters.sectors),
          Array.from(multiFilters.industries),
          Array.from(multiFilters.volumeFilter),
          sortOrder
        );

        console.log(`[DEBUG] loadStockData response: ${response?.stocks?.length} stocks, total: ${response?.pagination?.total}, pageLimit: ${pageLimit}, page: ${page}`);

        if (response && response.stocks) {
          setStockData(prevData => {
            const stockMap = reset ? new Map<string, Stock>() : new Map(prevData);
            response.stocks.forEach(stock => {
              stockMap.set(stock.ticker, stock);
            });
            return stockMap;
          });

          setPagination({
            total: response.pagination?.total || 0,
            totalPages: response.pagination?.totalPages || 1,
            hasMore: response.pagination?.hasMore || false
          });
        }
      }

      if (reset) {
        setCurrentPage(1);
        if (isInitialLoad) setIsInitialLoad(false);
      }
    } catch (err) {
      console.error('Error loading stock data:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setIsRefreshing(false);
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

      // Auto-load "Personal" watchlist for eye icon status
      if (data.watchlists && data.watchlists.length > 0) {
        const personalWatchlist = data.watchlists.find((w: any) => w.name === 'Personal');
        if (personalWatchlist) {
          await loadActiveWatchlist(personalWatchlist.id);
        } else {
          // Create "Personal" watchlist if it doesn't exist
          try {
            const newWatchlist = await api.createWatchlist('Personal');
            console.log('Created Personal watchlist:', newWatchlist);
            // Reload watchlists to get the new one
            const updatedData = await api.getWatchlists();
            setWatchlists(updatedData.watchlists || []);
            const createdPersonal = updatedData.watchlists.find((w: any) => w.name === 'Personal');
            if (createdPersonal) {
              await loadActiveWatchlist(createdPersonal.id);
            }
          } catch (createErr) {
            console.error('Error creating Personal watchlist:', createErr);
          }
        }
      }
    } catch (err) {
      console.error('Error loading watchlists:', err);
    }
  };

  const loadActiveWatchlist = async (watchlistId?: string) => {
    try {
      setIsRefreshing(true);
      const id = watchlistId || activeWatchlistId;
      if (!id) return;

      console.log('Loading active watchlist:', id);
      const watchlist = await api.getWatchlist(id);
      console.log('Loaded watchlist:', watchlist);
      setActiveWatchlist(watchlist);
      setWatchlistStocks(new Set(watchlist.stocks || []));

      // Reload stock data from the watchlist
      if (watchlist.stockData) {
        setStockData(prev => {
          const newMap = new Map(prev);
          watchlist.stockData.forEach((stock: Stock) => {
            if (stock.ticker) {
              newMap.set(stock.ticker, stock);
            }
          });
          return newMap;
        });

        // Set pagination based on watchlist stocks
        const total = watchlist.stocks?.length || 0;
        const totalPages = Math.ceil(total / pageLimit);
        setPagination({
          total,
          totalPages,
          hasMore: 1 < totalPages
        });
      }
    } catch (err) {
      console.error('Error loading active watchlist:', err);
    } finally {
      setIsRefreshing(false);
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
      // Use the currently selected watchlist from dropdown, or fall back to "Personal"
      let targetWatchlistId = activeWatchlistId;

      // If no watchlist is selected, try to find or create "Personal"
      if (!targetWatchlistId) {
        const personalWatchlist = watchlists.find((w: any) => w.name === 'Personal');
        targetWatchlistId = personalWatchlist?.id;

        // If Personal watchlist doesn't exist, create it
        if (!targetWatchlistId) {
          try {
            const newWatchlist = await api.createWatchlist('Personal');
            console.log('Created Personal watchlist:', newWatchlist);
            targetWatchlistId = newWatchlist.watchlist.id;
            // Reload watchlists
            const updatedData = await api.getWatchlists();
            setWatchlists(updatedData.watchlists || []);
            // Set it as active
            setActiveWatchlistId(targetWatchlistId);
            await loadActiveWatchlist(targetWatchlistId);
          } catch (createErr) {
            console.error('Error creating Personal watchlist:', createErr);
            return;
          }
        }
      }

      // Check if ticker is in the active watchlist
      const isInWatchlist = watchlistStocks.has(ticker);

      if (isInWatchlist) {
        const result = await api.removeFromWatchlist(targetWatchlistId, [ticker]);
        if (result.success) {
          setWatchlistStocks(prev => {
            const newSet = new Set(prev);
            newSet.delete(ticker);
            return newSet;
          });
        }
      } else {
        const result = await api.addToWatchlist(targetWatchlistId, [ticker]);
        if (result.success) {
          setWatchlistStocks(prev => new Set(prev).add(ticker));
        }
      }
    } catch (err) {
      console.error('Error toggling watchlist:', err);
    }
  };


  // Single unified filter toggle function
  const toggleFilter = (type: 'fire' | 'price' | 'marketValue' | 'sector' | 'employee' | 'ipo' | 'recommendation' | 'industry' | 'volume', value: number | string) => {
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
      } else if (type === 'recommendation') {
        const newRecommendations = new Set(prev.recommendations);
        if (newRecommendations.has(value as string)) {
          newRecommendations.delete(value as string);
        } else {
          newRecommendations.add(value as string);
        }
        newFilters.recommendations = newRecommendations;
      } else if (type === 'industry') {
        const newIndustries = new Set(prev.industries);
        if (newIndustries.has(value as string)) {
          newIndustries.delete(value as string);
        } else {
          newIndustries.add(value as string);
        }
        newFilters.industries = newIndustries;
      } else if (type === 'volume') {
        const newVolumeFilter = new Set(prev.volumeFilter);
        if (newVolumeFilter.has(value as string)) {
          newVolumeFilter.delete(value as string);
        } else {
          newVolumeFilter.add(value as string);
        }
        newFilters.volumeFilter = newVolumeFilter;
      }

      return newFilters;
    });

    // Clear URL ticker parameter when any filter is applied
    window.history.pushState({}, '', window.location.pathname);
    setUrlTicker(null);

    // Auto-set activeFilter based on whether we have any filters
    // Check the updated state by calculating hasFilters separately
    setActiveFilter(prev => {
      const newFiltersSize =
        (type === 'fire' ? (multiFilters.fireLevels.has(value as number) ? multiFilters.fireLevels.size - 1 : multiFilters.fireLevels.size + 1) : multiFilters.fireLevels.size) +
        (type === 'price' ? (multiFilters.priceFilters.has(value as string) ? multiFilters.priceFilters.size - 1 : multiFilters.priceFilters.size + 1) : multiFilters.priceFilters.size) +
        (type === 'marketValue' ? (multiFilters.marketValueFilters.has(value as string) ? multiFilters.marketValueFilters.size - 1 : multiFilters.marketValueFilters.size + 1) : multiFilters.marketValueFilters.size) +
        (type === 'sector' ? (multiFilters.sectors.has(value as string) ? multiFilters.sectors.size - 1 : multiFilters.sectors.size + 1) : multiFilters.sectors.size) +
        (type === 'employee' ? (multiFilters.employeeCount.has(value as string) ? multiFilters.employeeCount.size - 1 : multiFilters.employeeCount.size + 1) : multiFilters.employeeCount.size) +
        (type === 'ipo' ? (multiFilters.ipoDate.has(value as string) ? multiFilters.ipoDate.size - 1 : multiFilters.ipoDate.size + 1) : multiFilters.ipoDate.size) +
        (type === 'volume' ? (multiFilters.volumeFilter.has(value as string) ? multiFilters.volumeFilter.size - 1 : multiFilters.volumeFilter.size + 1) : multiFilters.volumeFilter.size) +
        (type === 'recommendation' ? (multiFilters.recommendations.has(value as string) ? multiFilters.recommendations.size - 1 : multiFilters.recommendations.size + 1) : multiFilters.recommendations.size) +
        (type === 'industry' ? (multiFilters.industries.has(value as string) ? multiFilters.industries.size - 1 : multiFilters.industries.size + 1) : multiFilters.industries.size);

      // If we're currently on a watchlist, keep the watchlist active
      if (prev.startsWith('watchlist-')) {
        return prev;
      }

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
      ipoDate: new Set(),
      recommendations: new Set(),
      industries: new Set(),
      volumeFilter: new Set()
    });

    // Clear URL parameters
    window.history.pushState({}, '', window.location.pathname);
    setUrlTicker(null);

    // Don't clear watchlist selection - keep activeFilter as is if it's a watchlist
  };

  // Calculate stats - memoized to prevent re-renders
  const tickersWithData = React.useMemo(() =>
    Array.from(stockData.keys()),
    [stockData]
  );

  const fire5Tickers = React.useMemo(() =>
    tickersWithData.filter(ticker => stockData.get(ticker)?.fire_level === 5),
    [tickersWithData, stockData]
  );

  const fire4Tickers = React.useMemo(() =>
    tickersWithData.filter(ticker => stockData.get(ticker)?.fire_level === 4),
    [tickersWithData, stockData]
  );

  const fire3Tickers = React.useMemo(() =>
    tickersWithData.filter(ticker => stockData.get(ticker)?.fire_level === 3),
    [tickersWithData, stockData]
  );

  const fire2Tickers = React.useMemo(() =>
    tickersWithData.filter(ticker => stockData.get(ticker)?.fire_level === 2),
    [tickersWithData, stockData]
  );

  const fire1Tickers = React.useMemo(() =>
    tickersWithData.filter(ticker => stockData.get(ticker)?.fire_level === 1),
    [tickersWithData, stockData]
  );

  const anyFireTickers = React.useMemo(() =>
    tickersWithData.filter(ticker => (stockData.get(ticker)?.fire_level || 0) > 0),
    [tickersWithData, stockData]
  );

  const holdingTickers = React.useMemo(() =>
    tickers.filter(ticker => holdings.has(ticker)),
    [tickers, holdings]
  );

  // Filter stocks based on active filter and search query
  const getFilteredStocks = () => {
    let stocks: string[];
    switch (activeFilter) {
      case 'holdings':
        stocks = holdingTickers;
        break;
      default:
        if (activeFilter.startsWith('watchlist-')) {
          // Get tickers from watchlist that also have stock data
          stocks = Array.from(watchlistStocks).filter(ticker => stockData.has(ticker));
          // Apply fire level filters if any are selected (client-side for watchlist view only)
          if (multiFilters.fireLevels.size > 0) {
            stocks = stocks.filter(ticker => {
              const fireLevel = stockData.get(ticker)?.fire_level || 0;
              return multiFilters.fireLevels.has(fireLevel);
            });
          }
        } else {
          // For all other views: server already filtered and sorted, just use stockData in insertion order
          stocks = tickersWithData;
        }
    }

    // These filters are CLIENT-SIDE ONLY (not passed to server) because they are infrequent:

    // Apply employee count filter if selected
    if (multiFilters.employeeCount.size > 0) {
      stocks = stocks.filter(ticker => {
        const stock = stockData.get(ticker);
        if (!stock) return false;
        const employees = stock.employee_count;
        if (employees === null || employees === undefined || employees === 0) return false;
        return Array.from(multiFilters.employeeCount).some(employeeFilter => {
          switch (employeeFilter) {
            case 'under50': return employees < 50;
            case '50to200': return employees >= 50 && employees < 200;
            case '200to1000': return employees >= 200 && employees < 1000;
            case '1000to5000': return employees >= 1000 && employees < 5000;
            case 'over5000': return employees >= 5000;
            default: return true;
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
            case 'lastYear': return yearsDiff <= 1;
            case 'last3Years': return yearsDiff <= 3;
            case 'last5Years': return yearsDiff <= 5;
            case 'older': return yearsDiff > 5;
            default: return true;
          }
        });
      });
    }

    // Apply recommendation filter if selected
    if (multiFilters.recommendations.size > 0) {
      stocks = stocks.filter(ticker => {
        const stock = stockData.get(ticker);
        if (!stock) return false;
        return Array.from(multiFilters.recommendations).some(rec => {
          if (rec === 'NONE') return !stock.recommendation || stock.recommendation === null;
          return stock.recommendation === rec;
        });
      });
    }

    // Server already handles: fire, price, marketCap, sector, industry, volume, sortOrder, searchQuery
    // Server returns data pre-sorted — preserve that insertion order here (no re-sort needed)
    return stocks;
  };

  const filteredStocks = React.useMemo(() =>
    getFilteredStocks(),
    [
      activeFilter,
      multiFilters,
      sortOrder,
      tickersWithData,
      holdingTickers,
      stockData,
      watchlistStocks
    ]
  );


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

  // Calculate available industries - if sectors are selected, only show industries from those sectors
  const availableIndustries = React.useMemo(() => {
    const industries = new Set<string>();
    tickersWithData.forEach(ticker => {
      const stock = stockData.get(ticker);
      if (stock?.industry) {
        // If sectors are filtered, only include industries from selected sectors
        if (multiFilters.sectors.size > 0) {
          if (stock.sector && multiFilters.sectors.has(stock.sector)) {
            industries.add(stock.industry);
          }
        } else {
          // No sector filter, show all industries
          industries.add(stock.industry);
        }
      }
    });
    return Array.from(industries).sort();
  }, [tickersWithData, stockData, multiFilters.sectors]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500); // 500ms debounce delay

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  if (isInitialLoad && loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
        fontSize: theme.typography.fontSize.lg,
        color: theme.ui.text.secondary,
        backgroundColor: theme.ui.background,
        fontFamily: theme.typography.fontFamily
      }}>
        <div style={{
          fontSize: '3rem',
          marginBottom: '20px',
          animation: 'spin 2s linear infinite'
        }}>
          🎯
        </div>
        Loading PennyWhales...
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
        padding: `${theme.spacing.md} ${theme.spacing.xl}`,
        borderBottom: `2px solid ${theme.ui.border}`,
        backgroundColor: theme.ui.surface,
        flexShrink: 0,
        boxShadow: theme.ui.shadow.sm
      }}>
        {/* Single Row Layout */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: theme.spacing.lg
        }}>
          {/* Left: Title and Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md, flex: 1 }}>
            <h1 style={{
              margin: 0,
              fontSize: '1.75rem',
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.ui.text.primary,
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm
            }}>
              🎯 Dashboard
              <span style={{
                fontSize: theme.typography.fontSize.sm,
                backgroundColor: theme.ui.surface,
                color: theme.ui.text.secondary,
                padding: `4px 8px`,
                borderRadius: theme.borderRadius.md,
                border: `1px solid ${theme.ui.border}`,
                fontWeight: theme.typography.fontWeight.medium,
                display: 'inline-flex',
                alignItems: 'center',
                verticalAlign: 'middle'
              }}>
                {activeWatchlistId
                  ? `${activeWatchlist?.stocks?.length || watchlistStocks.size || 0} Stocks`
                  : `${pagination?.total || stockData.size || 0} Stocks`}
              </span>
            </h1>

            {(multiFilters.fireLevels.size > 0 || multiFilters.priceFilters.size > 0 || multiFilters.marketValueFilters.size > 0 || multiFilters.sectors.size > 0 || multiFilters.employeeCount.size > 0 || multiFilters.ipoDate.size > 0 || multiFilters.volumeFilter.size > 0) && (
              <span style={{
                fontSize: theme.typography.fontSize.sm,
                backgroundColor: theme.status.info,
                color: 'white',
                padding: `6px ${theme.spacing.sm}`,
                borderRadius: theme.borderRadius.md,
                fontWeight: theme.typography.fontWeight.semibold,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}>
                <span>🔍</span>
                {multiFilters.fireLevels.size + multiFilters.priceFilters.size + multiFilters.marketValueFilters.size + multiFilters.sectors.size + multiFilters.employeeCount.size + multiFilters.ipoDate.size + multiFilters.recommendations.size + multiFilters.industries.size + multiFilters.volumeFilter.size} active
              </span>
            )}

            <button
              onClick={() => {
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

                navigator.clipboard.writeText(jsonString).then(() => {
                  alert(`Copied ${filteredStocks.length} tickers with fire levels to clipboard!`);
                }).catch(err => {
                  console.error('Failed to copy:', err);
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
                padding: '6px 10px',
                border: `1px solid ${theme.ui.border}`,
                borderRadius: theme.borderRadius.md,
                backgroundColor: theme.ui.background,
                color: theme.ui.text.secondary,
                cursor: 'pointer',
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.semibold,
                transition: `all ${theme.transition.normal}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.status.success;
                e.currentTarget.style.color = 'white';
                e.currentTarget.style.borderColor = theme.status.success;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.ui.background;
                e.currentTarget.style.color = theme.ui.text.secondary;
                e.currentTarget.style.borderColor = theme.ui.border;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              title="Copy filtered stocks as JSON"
            >
              {FaShareAlt({ size: 11 })}
              <span>Export</span>
            </button>
          </div>

          {/* Right: Search and Actions */}
          <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search tickers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                paddingLeft: '36px',
                border: `2px solid ${theme.ui.border}`,
                borderRadius: theme.borderRadius.lg,
                backgroundColor: theme.ui.background,
                color: theme.ui.text.primary,
                fontSize: theme.typography.fontSize.sm,
                fontFamily: theme.typography.fontFamily,
                width: '220px',
                outline: 'none',
                transition: `all ${theme.transition.normal}`,
                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3ccircle cx='11' cy='11' r='8'%3e%3c/circle%3e%3cpath d='m21 21-4.35-4.35'%3e%3c/path%3e%3c/svg%3e")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: '10px center',
                backgroundSize: '18px'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = theme.status.info;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${theme.status.info}20`;
                e.currentTarget.style.backgroundColor = theme.ui.surface;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = theme.ui.border;
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.backgroundColor = theme.ui.background;
              }}
            />

            {/* Watchlist Dropdown */}
            {watchlists.length > 0 && (
              <select
                value={activeWatchlistId || ''}
                onChange={(e) => {
                  const watchlistId = e.target.value;
                  if (watchlistId) {
                    setActiveWatchlistId(watchlistId);
                    setActiveFilter(`watchlist-${watchlistId}`);
                    loadActiveWatchlist(watchlistId);
                    // Remove ticker from URL when switching watchlist
                    const url = new URL(window.location.href);
                    url.searchParams.delete('ticker');
                    window.history.pushState({}, '', url);
                    setUrlTicker(null);
                  } else {
                    setActiveWatchlistId('');
                    setActiveFilter('multifilter');
                    // Remove ticker from URL when clearing watchlist
                    const url = new URL(window.location.href);
                    url.searchParams.delete('ticker');
                    window.history.pushState({}, '', url);
                    setUrlTicker(null);
                  }
                }}
                style={{
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  paddingRight: '36px',
                  border: `2px solid ${activeWatchlistId ? theme.status.warning : theme.ui.border}`,
                  borderRadius: theme.borderRadius.lg,
                  backgroundColor: activeWatchlistId ? theme.status.warning : theme.ui.background,
                  color: activeWatchlistId ? 'white' : theme.ui.text.primary,
                  cursor: 'pointer',
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: activeWatchlistId ? theme.typography.fontWeight.bold : theme.typography.fontWeight.medium,
                  fontFamily: theme.typography.fontFamily,
                  outline: 'none',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${activeWatchlistId ? 'white' : '%23888'}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                  backgroundSize: '18px',
                  transition: `all ${theme.transition.normal}`,
                  boxShadow: activeWatchlistId ? theme.ui.shadow.md : 'none',
                  minWidth: '180px'
                }}
                onMouseEnter={(e) => {
                  if (!activeWatchlistId) {
                    e.currentTarget.style.borderColor = theme.status.warning;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!activeWatchlistId) {
                    e.currentTarget.style.borderColor = theme.ui.border;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${activeWatchlistId ? theme.status.warning : theme.status.info}30`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = activeWatchlistId ? theme.ui.shadow.md : 'none';
                }}
              >
                <option value="">📊 All Stocks</option>
                {watchlists.map((watchlist) => {
                  const watchlistId = watchlist.id || watchlist._id;
                  return (
                    <option key={watchlistId} value={watchlistId}>
                      👀 {watchlist.name}
                    </option>
                  );
                })}
              </select>
            )}

            <button
              onClick={() => setFilterPanelOpen(true)}
              style={{
                padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                border: 'none',
                borderRadius: theme.borderRadius.lg,
                backgroundColor: theme.status.warning,
                color: 'white',
                cursor: 'pointer',
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.bold,
                transition: `all ${theme.transition.normal}`,
                boxShadow: theme.ui.shadow.sm,
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
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
                borderRadius: theme.borderRadius.lg,
                backgroundColor: theme.status.info,
                color: 'white',
                cursor: 'pointer',
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.bold,
                transition: `all ${theme.transition.normal}`,
                boxShadow: theme.ui.shadow.sm,
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.md;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }}
            >
              ⚙️ Manage Tickers
            </button>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div style={{
        flex: 1,
        padding: theme.spacing.lg,
        overflow: 'auto',
        position: 'relative'
      }}>
        {/* Refreshing Overlay */}
        {isRefreshing && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.4)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
            backdropFilter: 'blur(2px)'
          }}>
            <div style={{
              padding: '12px 24px',
              backgroundColor: theme.ui.surface,
              borderRadius: theme.borderRadius.lg,
              boxShadow: theme.ui.shadow.md,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontWeight: theme.typography.fontWeight.semibold,
              color: theme.ui.text.primary,
              border: `1px solid ${theme.ui.border}`
            }}>
              <span style={{ animation: 'spin 1s linear infinite' }}>🔄</span>
              Updating...
            </div>
          </div>
        )}

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
              onLoadMore={loadMoreData}
              hasMore={pagination?.hasMore || false}
              loadingMore={loadingMore}
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
        availableIndustries={availableIndustries}
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