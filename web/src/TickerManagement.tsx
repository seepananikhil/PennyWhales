import React, { useState, useEffect } from 'react';
import api from './api';
import { Stock } from './types';
import { theme, getFireLevelStyle } from './theme';
import StockCard from './components/StockCard';
import TickerModal from './components/TickerModal';

const TickerManagement: React.FC = () => {
  const [tickers, setTickers] = useState<string[]>([]);
  const [stockData, setStockData] = useState<Map<string, Stock>>(new Map());
  const [holdings, setHoldings] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');

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
      const holdingsData = await api.getHoldings();
      setHoldings(new Set(holdingsData.holdings?.map((holding: any) => holding.ticker) || []));
    } catch (err) {
      console.error('Error loading holdings:', err);
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
    window.open(`https://finance.yahoo.com/quote/${ticker}`, '_blank');
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
    
    // Sort by price (highest to lowest)
    return stocks.sort((a, b) => {
      const stockA = stockData.get(a);
      const stockB = stockData.get(b);
      const priceA = stockA?.price || 0;
      const priceB = stockB?.price || 0;
      return priceB - priceA;
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
            ✏️ Add/Update Tickers
          </button>
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
                return (
                  <StockCard
                    key={ticker}
                    stock={stock}
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
        currentTickers={tickers}
      />
    </div>
  );
};

export default TickerManagement;
