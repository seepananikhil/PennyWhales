import React, { useState, useEffect, useRef } from 'react';
import { Stock } from '../types';
import { theme } from '../theme';
import StockCard from './StockCard';

interface ChartViewProps {
  stocks: string[];
  stockData: Map<string, Stock>;
  livePriceData: Map<string, {
    price: number;
    priceChange: number;
    timestamp: string;
  }>;
  holdings: Set<string>;
  watchlistStocks: Set<string>;
  onToggleHolding: (ticker: string) => void;
  onToggleWatchlist?: (ticker: string) => void;
  onDeleteTicker?: (ticker: string) => void;
  showWatchButton?: boolean;
  showDeleteButton?: boolean;
  tradingViewChartUrl?: string;
  initialSelectedTicker?: string | null;
  showLastUpdated?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

const ChartView: React.FC<ChartViewProps> = ({
  stocks,
  stockData,
  livePriceData,
  holdings,
  watchlistStocks,
  onToggleHolding,
  onToggleWatchlist,
  onDeleteTicker,
  showWatchButton = true,
  showDeleteButton = false,
  initialSelectedTicker = null,
  showLastUpdated = false,
  onLoadMore,
  hasMore = false,
  loadingMore = false
}) => {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(
    stocks.length > 0 ? stocks[0] : null
  );
  const [exchange, setExchange] = useState<'default' | 'NASDAQ' | 'NYSE'>('default');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Infinite scroll handler
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || !onLoadMore) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
      
      // Load more when scrolled to 80% of content
      if (scrollPercentage > 0.8 && hasMore && !loadingMore && onLoadMore) {
        onLoadMore();
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [onLoadMore, hasMore, loadingMore]);

  // Reset exchange when ticker changes
  useEffect(() => {
    setExchange('default');
  }, [selectedTicker]);

  // Handle URL ticker selection and scroll
  useEffect(() => {
    if (initialSelectedTicker && stocks.includes(initialSelectedTicker)) {
      setSelectedTicker(initialSelectedTicker);
      
      // Scroll to the ticker after a short delay to ensure DOM is ready
      setTimeout(() => {
        const element = document.getElementById(`stock-card-${initialSelectedTicker}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
    }
  }, [initialSelectedTicker, stocks]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && stocks.length > 0) {
        e.preventDefault(); // Prevent page scroll
        const currentIndex = selectedTicker ? stocks.indexOf(selectedTicker) : -1;
        const nextIndex = (currentIndex + 1) % stocks.length;
        setSelectedTicker(stocks[nextIndex]);
        
        // Scroll the selected card into view
        const cardElement = document.querySelector(`[data-ticker="${stocks[nextIndex]}"]`);
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stocks, selectedTicker]);

  // Auto-select first item when stocks change
  useEffect(() => {
    if (stocks.length > 0 && !selectedTicker) {
      setSelectedTicker(stocks[0]);
    }
  }, [stocks, selectedTicker]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      {/* Main Content Area */}
      <div style={{
        display: 'flex',
        flex: 1,
        gap: theme.spacing.md,
        minHeight: 0
      }}>
        {/* Left Sidebar - Stock Cards */}
        <div 
          ref={scrollContainerRef}
          style={{
          width: '400px',
          flexShrink: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          borderRight: `1px solid ${theme.ui.border}`,
          paddingRight: theme.spacing.md,
          paddingBottom: theme.spacing.xxl,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.sm
        }}>
          {stocks.map(ticker => {
            const stock = stockData.get(ticker);
            const livePrice = livePriceData.get(ticker);
            
            if (!stock) return null;
            
            const isSelected = selectedTicker === ticker;
            
            return (
              <div 
                key={ticker}
                id={`stock-card-${ticker}`}
                data-ticker={ticker}
                onClick={() => setSelectedTicker(ticker)}
                style={{
                  borderRadius: theme.borderRadius.md,
                  cursor: 'pointer',
                  transition: `all ${theme.transition.normal}`,
                  boxShadow: isSelected ? theme.ui.shadow.lg : 'none',
                }}
              >
                <StockCard
                  stock={stock}
                  livePrice={livePrice}
                  isHolding={holdings.has(ticker)}
                  isInWatchlist={watchlistStocks.has(ticker)}
                  onToggleHolding={onToggleHolding}
                  onToggleWatchlist={onToggleWatchlist}
                  onOpenChart={(t) => {
                    setSelectedTicker(t);
                  }}
                  showWatchButton={showWatchButton}
                  showDeleteButton={showDeleteButton}
                  onDeleteTicker={onDeleteTicker}
                  isSelected={isSelected}
                  showLastUpdated={showLastUpdated}
                />
              </div>
            );
          })}
          
          {/* Loading More Indicator */}
          {loadingMore && (
            <div style={{
              padding: theme.spacing.lg,
              textAlign: 'center',
              color: theme.ui.text.secondary
            }}>
              <div style={{
                fontSize: '1.5rem',
                marginBottom: theme.spacing.xs,
                animation: 'spin 1s linear infinite'
              }}>
                🔄
              </div>
              <div style={{ fontSize: theme.typography.fontSize.sm }}>
                Loading more stocks...
              </div>
            </div>
          )}
          
          {/* End of Results Indicator */}
          {!loadingMore && !hasMore && stocks.length > 0 && (
            <div style={{
              padding: theme.spacing.md,
              textAlign: 'center',
              color: theme.ui.text.secondary,
              fontSize: theme.typography.fontSize.sm,
              fontStyle: 'italic'
            }}>
              All stocks loaded
            </div>
          )}
        </div>

        {/* Right Side - TradingView Chart */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0
        }}>
          {selectedTicker ? (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing.xs
            }}>
              <div style={{
                display: 'flex',
                gap: theme.spacing.xs,
                padding: theme.spacing.xs,
                alignItems: 'center'
              }}>
                <span style={{
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.ui.text.secondary,
                  marginRight: theme.spacing.xs
                }}>
                  Exchange:
                </span>
                <button
                  onClick={() => setExchange('default')}
                  style={{
                    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                    backgroundColor: exchange === 'default' ? '#007bff' : theme.ui.surface,
                    color: exchange === 'default' ? 'white' : theme.ui.text.primary,
                    border: `1px solid ${theme.ui.border}`,
                    borderRadius: theme.borderRadius.sm,
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: `all ${theme.transition.normal}`
                  }}
                >
                  Auto
                </button>
                <button
                    onClick={() => setExchange('NASDAQ')}
                    style={{
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      backgroundColor: exchange === 'NASDAQ' ? '#007bff' : theme.ui.surface,
                      color: exchange === 'NASDAQ' ? 'white' : theme.ui.text.primary,
                      border: `1px solid ${theme.ui.border}`,
                      borderRadius: theme.borderRadius.sm,
                      fontSize: theme.typography.fontSize.sm,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: `all ${theme.transition.normal}`
                    }}
                  >
                    NASDAQ
                  </button>
                  <button
                    onClick={() => setExchange('NYSE')}
                    style={{
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      backgroundColor: exchange === 'NYSE' ? '#007bff' : theme.ui.surface,
                      color: exchange === 'NYSE' ? 'white' : theme.ui.text.primary,
                      border: `1px solid ${theme.ui.border}`,
                      borderRadius: theme.borderRadius.sm,
                      fontSize: theme.typography.fontSize.sm,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: `all ${theme.transition.normal}`
                    }}
                  >
                  NYSE
                </button>
              </div>
              <div style={{
                flex: 1,
                position: 'relative'
              }}>
                <iframe
                  key={`${selectedTicker}-${exchange}`}
                  src={`https://www.tradingview.com/widgetembed/?frameElementId=tradingview_${selectedTicker}&symbol=${exchange === 'default' ? selectedTicker : `${exchange}:${selectedTicker}`}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=MASimple@tv-basicstudies&studies_overrides={"moving average.length":200}&theme=light&style=1&timezone=Etc%2FUTC&locale=en`}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none'
                  }}
                  title={`${selectedTicker} Chart`}
                  allowFullScreen
                />
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.ui.text.secondary,
              fontSize: theme.typography.fontSize.lg
            }}>
              Select a ticker to view chart
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChartView;
